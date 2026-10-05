// Monetization for the Android app: free vs premium content, 24-hour unlocks
// earned by watching a rewarded ad, and one-time purchases via Google Play.
// The website build has no store (everything open); add ?storetest to a URL to
// try the store flow in a browser with a simulated backend.

const STORE_KEY = 'arsenal:';
const ls = {
  get(k, d) { try { const v = localStorage.getItem(STORE_KEY + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(STORE_KEY + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// ~1/3 of the arsenal is free forever, including the most popular guns.
export const FREE_GUNS = new Set([
  'm1911', 'glock17', 'pa1a', 'beretta92', 'deagle', 'smle', 'mosin', 'garand', 'thompson', 'mp40', 'ppsh41', 'mg42',
  'ak47', 'type56', 'ak74', 'm16a1', 'fal', 'uzi', 'mp5', 'svd', 'rem870', 'insas', 'm4a1', 'ak203', 'm82a1',
]);
export const FREE_SCENES = new Set(['range', 'desert', 'urban']);
export const UNLOCK_HOURS = 24;

export const PRODUCTS = {
  remove_ads: { name: 'Remove ads', blurb: 'No banner ads, ever. Rewarded videos stay optional.', fallback: '₹99' },
  full_arsenal: { name: 'Full Arsenal', blurb: 'Every weapon and every environment unlocked forever — including all future weapons.', fallback: '₹149' },
  pro_bundle: { name: 'Pro', blurb: 'Everything: full arsenal, all environments and no ads. Best value.', fallback: '₹199', best: true },
};

function mockBackend() {
  const fire = (o) => setTimeout(() => window.calibreStoreEvent?.(JSON.stringify(o)), 250);
  const owned = new Set(ls.get('mockOwned', []));
  return {
    setBanner(v) { document.documentElement.dataset.mockBanner = v ? '1' : '0'; },
    rewardedReady: () => true,
    loadRewardedNow() {},
    adStatus: () => JSON.stringify({ sdk: 'mock', consent: 'ok', banner: 'showing', rewarded: 'ready', billing: 'products 3/3' }),
    products: () => JSON.stringify({ type: 'products', products: Object.keys(PRODUCTS).map((id) => ({ id, title: PRODUCTS[id].name, price: PRODUCTS[id].fallback })) }),
    owned: () => JSON.stringify({ type: 'owned', owned: [...owned] }),
    restore() { fire({ type: 'owned', owned: [...owned] }); },
    showRewarded(token) { fire({ type: 'reward', token, earned: true }); return true; },
    buy(id) { owned.add(id); ls.set('mockOwned', [...owned]); fire({ type: 'owned', owned: [...owned] }); return true; },
    privacyOptionsRequired: () => false,
    showPrivacyOptions() {},
  };
}

const BACKEND = typeof window !== 'undefined' && (window.CalibreStore || (new URLSearchParams(location.search).has('storetest') ? mockBackend() : null));

export const Store = {
  enabled: !!BACKEND,
  owned: new Set(ls.get('owned', [])),
  products: {},
  unlocks: ls.get('unlocks', {}), // key -> expiry timestamp
  listeners: new Set(),
  pending: new Map(), // rewarded-ad token -> callback

  on(fn) { this.listeners.add(fn); },
  emit() { this.listeners.forEach((fn) => fn()); },

  get premium() { return this.owned.has('full_arsenal') || this.owned.has('pro_bundle'); },
  get adsRemoved() { return this.owned.has('remove_ads') || this.owned.has('pro_bundle'); },
  tempLeft(key) { const t = this.unlocks[key]; return t && t > Date.now() ? t - Date.now() : 0; },
  gunLocked(id) { return this.enabled && !FREE_GUNS.has(id) && !this.premium && !this.tempLeft('g:' + id); },
  sceneLocked(id) { return this.enabled && !FREE_SCENES.has(id) && !this.premium && !this.tempLeft('s:' + id); },
  price(id) { return this.products[id]?.price || PRODUCTS[id].fallback; },
  available(id) { return !!this.products[id]; },

  setBanner(show) { if (BACKEND) BACKEND.setBanner(!!show && !this.adsRemoved); },
  rewardedReady() { return !!BACKEND && BACKEND.rewardedReady(); },
  adError: null, // AdMob error code of the last failed rewarded load (3 = no ad to show yet)
  adStatus() { try { return JSON.parse(BACKEND?.adStatus?.() || 'null'); } catch { return null; } },
  loadRewarded() { try { BACKEND?.loadRewardedNow?.(); } catch { /* older app build */ } },

  /** Watch a rewarded ad to unlock `key` ('g:<gun>' or 's:<scene>') for 24 h. */
  unlockWithAd(key, done) {
    if (!BACKEND) return false;
    const token = key + ':' + Date.now();
    this.pending.set(token, done);
    if (!BACKEND.showRewarded(token)) { this.pending.delete(token); return false; }
    return true;
  },
  buy(id) { return !!BACKEND && BACKEND.buy(id); },
  restore() { if (BACKEND) BACKEND.restore(); },
  privacyOptionsRequired() { return !!BACKEND && BACKEND.privacyOptionsRequired(); },
  showPrivacyOptions() { if (BACKEND) BACKEND.showPrivacyOptions(); },

  _handle(msg) {
    if (msg.type === 'products') { this.products = Object.fromEntries(msg.products.map((p) => [p.id, p])); }
    else if (msg.type === 'rewardedReady') { this.adError = msg.ready ? null : (msg.code ?? -1); }
    else if (msg.type === 'owned') { this.owned = new Set(msg.owned); ls.set('owned', msg.owned); }
    else if (msg.type === 'reward') {
      const cb = this.pending.get(msg.token); this.pending.delete(msg.token);
      if (msg.earned) {
        const key = msg.token.split(':').slice(0, 2).join(':');
        this.unlocks[key] = Date.now() + UNLOCK_HOURS * 3600e3;
        for (const k of Object.keys(this.unlocks)) if (this.unlocks[k] < Date.now()) delete this.unlocks[k];
        ls.set('unlocks', this.unlocks);
      }
      cb?.(msg.earned);
    }
    this.lastEvent = msg;
    this.emit();
  },
};

if (BACKEND) {
  window.calibreStoreEvent = (json) => { try { Store._handle(JSON.parse(json)); } catch { /* ignore */ } };
  // pick up anything the native side already knows
  try { Store._handle(JSON.parse(BACKEND.products())); Store._handle(JSON.parse(BACKEND.owned())); } catch { /* not ready yet */ }
}

export const fmtLeft = (ms) => { const h = Math.floor(ms / 3600e3), m = Math.round((ms % 3600e3) / 60e3); return h ? `${h}h ${m}m` : `${m}m`; };
