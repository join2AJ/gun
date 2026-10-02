package com.artinstudios.calibre;

import android.util.DisplayMetrics;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.FrameLayout;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Ads (AdMob banner + rewarded, behind Google UMP consent) and one-time
 * in-app purchases (Google Play Billing). Exposed to the game as
 * window.CalibreStore; results come back through window.calibreStoreEvent(json).
 *
 * Product IDs must be created in Play Console → Monetize → In-app products.
 */
public class Monetization implements PurchasesUpdatedListener {
    static final String REMOVE_ADS = "remove_ads";
    static final String FULL_ARSENAL = "full_arsenal";
    static final String PRO_BUNDLE = "pro_bundle";
    private static final List<String> PRODUCTS = List.of(REMOVE_ADS, FULL_ARSENAL, PRO_BUNDLE);

    private final MainActivity activity;
    private final WebView web;
    private final FrameLayout bannerBox;
    private final AtomicBoolean adsStarted = new AtomicBoolean(false);
    private ConsentInformation consent;
    private AdView banner;
    private RewardedAd rewarded;
    private boolean rewardedLoading = false;
    private int rewardedFailures = 0;
    private final android.os.Handler retry = new android.os.Handler(android.os.Looper.getMainLooper());
    private boolean bannerWanted = false;
    private boolean adsReady = false;
    private BillingClient billing;
    private final Map<String, ProductDetails> details = new HashMap<>();
    private final Set<String> owned = Collections.synchronizedSet(new HashSet<>());

    Monetization(MainActivity activity, WebView web, FrameLayout bannerBox) {
        this.activity = activity;
        this.web = web;
        this.bannerBox = bannerBox;
    }

    void start() {
        startConsentThenAds();
        startBilling();
    }

    // ------------------------------------------------------------------ consent + ads
    private void startConsentThenAds() {
        consent = UserMessagingPlatform.getConsentInformation(activity);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consent.requestConsentInfoUpdate(activity, params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, err -> { if (consent.canRequestAds()) initAds(); }),
                err -> { if (consent.canRequestAds()) initAds(); });
        if (consent.canRequestAds()) initAds(); // consent from a previous session
    }

    private void initAds() {
        if (!adsStarted.compareAndSet(false, true)) return;
        new Thread(() -> MobileAds.initialize(activity, status -> activity.runOnUiThread(() -> {
            adsReady = true;
            loadRewarded();
            applyBanner();
            emit("{\"type\":\"adsReady\"}");
        }))).start();
    }

    private boolean noAds() { return owned.contains(REMOVE_ADS) || owned.contains(PRO_BUNDLE); }

    private void applyBanner() {
        boolean show = bannerWanted && adsReady && !noAds();
        if (!show) {
            bannerBox.setVisibility(View.GONE);
            return;
        }
        if (banner == null) {
            banner = new AdView(activity);
            banner.setAdUnitId(BuildConfig.AD_BANNER);
            DisplayMetrics dm = activity.getResources().getDisplayMetrics();
            int widthDp = (int) (dm.widthPixels / dm.density);
            banner.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, widthDp));
            bannerBox.addView(banner);
            banner.loadAd(new AdRequest.Builder().build());
        }
        bannerBox.setVisibility(View.VISIBLE);
    }

    /** Loads the next rewarded ad. Failed loads retry by themselves after 30 s, 60 s, 120 s … up to 5 min. */
    private void loadRewarded() {
        if (!adsReady || rewarded != null || rewardedLoading) return;
        rewardedLoading = true;
        retry.removeCallbacksAndMessages(null);
        RewardedAd.load(activity, BuildConfig.AD_REWARDED, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(RewardedAd ad) {
                rewarded = ad; rewardedLoading = false; rewardedFailures = 0;
                emit("{\"type\":\"rewardedReady\",\"ready\":true}");
            }
            @Override public void onAdFailedToLoad(LoadAdError e) {
                rewarded = null; rewardedLoading = false;
                long delay = Math.min(300_000L, 30_000L << Math.min(rewardedFailures++, 4));
                retry.postDelayed(Monetization.this::loadRewarded, delay);
                emit("{\"type\":\"rewardedReady\",\"ready\":false,\"code\":" + e.getCode() + "}");
            }
        });
    }

    // ------------------------------------------------------------------ billing
    private void startBilling() {
        billing = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        billing.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) { queryProducts(); queryOwned(); }
                else emit(event("billingUnavailable", r.getDebugMessage()));
            }
            @Override public void onBillingServiceDisconnected() { }
        });
    }

    private void queryProducts() {
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        for (String id : PRODUCTS) list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), (r, result) -> {
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
            for (ProductDetails pd : result.getProductDetailsList()) details.put(pd.getProductId(), pd);
            emit(productsJson());
        });
    }

    private void queryOwned() {
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (r, purchases) -> {
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) handle(purchases, true);
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult r, List<Purchase> purchases) {
        int code = r.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) handle(purchases, false);
        else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) queryOwned();
        else if (code != BillingClient.BillingResponseCode.USER_CANCELED) emit(event("purchaseError", r.getDebugMessage()));
    }

    private void handle(List<Purchase> purchases, boolean fullList) {
        if (fullList) owned.clear();
        for (Purchase p : purchases) {
            if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue; // pending: wait for completion
            owned.addAll(p.getProducts());
            if (!p.isAcknowledged()) {
                billing.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), res -> { });
            }
        }
        activity.runOnUiThread(this::applyBanner);
        emit(ownedJson());
    }

    // ------------------------------------------------------------------ JavaScript API (window.CalibreStore)
    @JavascriptInterface public void setBanner(boolean show) { activity.runOnUiThread(() -> { bannerWanted = show; applyBanner(); }); }
    @JavascriptInterface public boolean rewardedReady() { return rewarded != null; }
    /** Asks for a rewarded ad now (e.g. when the unlock dialog opens) instead of waiting for the next retry. */
    @JavascriptInterface public void loadRewardedNow() { activity.runOnUiThread(() -> { rewardedFailures = 0; loadRewarded(); }); }
    @JavascriptInterface public String products() { return productsJson(); }
    @JavascriptInterface public String owned() { return ownedJson(); }
    @JavascriptInterface public void restore() { if (billing != null && billing.isReady()) queryOwned(); }

    /** Shows a rewarded ad; reports {type:"reward", token, earned} when it closes. */
    @JavascriptInterface
    public boolean showRewarded(final String token) {
        if (rewarded == null) return false;
        activity.runOnUiThread(() -> {
            final RewardedAd ad = rewarded;
            if (ad == null) return;
            final boolean[] earned = {false};
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override public void onAdDismissedFullScreenContent() { done(); }
                @Override public void onAdFailedToShowFullScreenContent(com.google.android.gms.ads.AdError e) { done(); }
                private void done() {
                    rewarded = null;
                    try { emit(new JSONObject().put("type", "reward").put("token", token).put("earned", earned[0]).toString()); } catch (JSONException ignored) { }
                    loadRewarded();
                }
            });
            ad.show(activity, item -> earned[0] = true);
        });
        return true;
    }

    @JavascriptInterface
    public boolean buy(String productId) {
        ProductDetails pd = details.get(productId);
        if (pd == null || billing == null || !billing.isReady()) return false;
        activity.runOnUiThread(() -> {
            BillingFlowParams flow = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(List.of(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd).build()))
                    .build();
            billing.launchBillingFlow(activity, flow);
        });
        return true;
    }

    @JavascriptInterface
    public boolean privacyOptionsRequired() {
        return consent != null && consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    @JavascriptInterface
    public void showPrivacyOptions() { activity.runOnUiThread(() -> UserMessagingPlatform.showPrivacyOptionsForm(activity, err -> { })); }

    // ------------------------------------------------------------------ helpers
    private String productsJson() {
        JSONArray arr = new JSONArray();
        for (String id : PRODUCTS) {
            ProductDetails pd = details.get(id);
            if (pd == null) continue;
            ProductDetails.OneTimePurchaseOfferDetails offer = pd.getOneTimePurchaseOfferDetails();
            try {
                arr.put(new JSONObject().put("id", id).put("title", pd.getName()).put("price", offer != null ? offer.getFormattedPrice() : ""));
            } catch (JSONException ignored) { }
        }
        try { return new JSONObject().put("type", "products").put("products", arr).toString(); } catch (JSONException e) { return "{}"; }
    }

    private String ownedJson() {
        try { return new JSONObject().put("type", "owned").put("owned", new JSONArray(new ArrayList<>(owned))).toString(); } catch (JSONException e) { return "{}"; }
    }

    private static String event(String type, String msg) {
        try { return new JSONObject().put("type", type).put("message", msg == null ? "" : msg).toString(); } catch (JSONException e) { return "{}"; }
    }

    private void emit(final String json) {
        final String js = "window.calibreStoreEvent && window.calibreStoreEvent(" + JSONObject.quote(json) + ")";
        activity.runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    void destroy() {
        if (banner != null) banner.destroy();
        if (billing != null) billing.endConnection();
    }
}
