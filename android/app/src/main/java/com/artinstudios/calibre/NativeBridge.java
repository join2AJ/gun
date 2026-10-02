package com.artinstudios.calibre;

import android.content.Context;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONException;

/**
 * JavaScript bridge exposed as window.CalibreNative.
 *
 * Unlike the browser Vibration API (on/off only), Android can drive the motor
 * with an amplitude per segment, so each gun's sound envelope becomes a true
 * strength curve. The flashlight uses CameraManager.setTorchMode, which needs
 * no camera permission and toggles fast.
 */
public class NativeBridge {
    private final MainActivity activity;
    private final Vibrator vibrator;
    private final CameraManager cameras;
    private final Handler main = new Handler(Looper.getMainLooper());
    private String torchId;
    private int torchToken = 0;

    NativeBridge(MainActivity activity) {
        this.activity = activity;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vibrator = vm != null ? vm.getDefaultVibrator() : null;
        } else {
            vibrator = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
        }
        cameras = (CameraManager) activity.getSystemService(Context.CAMERA_SERVICE);
        try {
            if (cameras != null) {
                for (String id : cameras.getCameraIdList()) {
                    CameraCharacteristics ch = cameras.getCameraCharacteristics(id);
                    Boolean flash = ch.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                    Integer facing = ch.get(CameraCharacteristics.LENS_FACING);
                    if (Boolean.TRUE.equals(flash) && facing != null && facing == CameraCharacteristics.LENS_FACING_BACK) { torchId = id; break; }
                }
            }
        } catch (CameraAccessException | RuntimeException ignored) { }
    }

    // ------------------------------------------------------------------ vibration
    @JavascriptInterface public boolean hasVibrator() { return vibrator != null && vibrator.hasVibrator(); }
    @JavascriptInterface public boolean hasAmplitude() { return hasVibrator() && vibrator.hasAmplitudeControl(); }

    /** timings: ms per segment; amplitudes: 0-255 per segment. Falls back to on/off when the motor can't vary strength. */
    @JavascriptInterface
    public boolean vibrateWave(String timingsJson, String amplitudesJson) {
        if (!hasVibrator()) return false;
        try {
            long[] t = longs(timingsJson);
            int[] a = ints(amplitudesJson);
            if (t.length == 0 || t.length != a.length) return false;
            VibrationEffect effect;
            if (vibrator.hasAmplitudeControl()) {
                effect = VibrationEffect.createWaveform(t, a, -1);
            } else {
                effect = VibrationEffect.createWaveform(onOff(t, a), -1); // strong segments -> "on"
            }
            play(effect);
            return true;
        } catch (JSONException | IllegalArgumentException e) {
            return false;
        }
    }

    /** Classic on/off pattern (alternating on, off, on… in ms). */
    @JavascriptInterface
    public boolean vibratePattern(String patternJson) {
        if (!hasVibrator()) return false;
        try {
            long[] pat = longs(patternJson);
            if (pat.length == 0) return false;
            long[] p = new long[pat.length + 1];
            p[0] = 0;
            System.arraycopy(pat, 0, p, 1, pat.length);
            play(VibrationEffect.createWaveform(p, -1));
            return true;
        } catch (JSONException | IllegalArgumentException e) {
            return false;
        }
    }

    @JavascriptInterface
    public void vibrateOne(int ms, int amplitude) {
        if (!hasVibrator() || ms <= 0) return;
        int amp = vibrator.hasAmplitudeControl() ? Math.max(1, Math.min(255, amplitude)) : VibrationEffect.DEFAULT_AMPLITUDE;
        play(VibrationEffect.createOneShot(ms, amp));
    }

    @JavascriptInterface public void cancelVibration() { if (vibrator != null) vibrator.cancel(); }

    private void play(VibrationEffect effect) {
        if (Build.VERSION.SDK_INT >= 33) {
            vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_MEDIA));
        } else {
            vibrator.vibrate(effect, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).build());
        }
    }

    /** Amplitude segments -> classic [delay, on, off, on, ...] pattern for motors without strength control. */
    private static long[] onOff(long[] t, int[] a) {
        java.util.ArrayList<Long> runs = new java.util.ArrayList<>();
        boolean cur = false; // pattern starts with an "off" (delay) slot
        long acc = 0;
        for (int i = 0; i < t.length; i++) {
            boolean on = a[i] > 60;
            if (on != cur) { runs.add(acc); acc = 0; cur = on; }
            acc += t[i];
        }
        runs.add(acc);
        long[] out = new long[runs.size()];
        for (int i = 0; i < out.length; i++) out[i] = runs.get(i);
        return out;
    }

    // ------------------------------------------------------------------ torch
    @JavascriptInterface public boolean hasTorch() { return torchId != null; }

    /** Alternating on/off durations in ms, starting with "on". */
    @JavascriptInterface
    public void torchPattern(String patternJson) {
        if (torchId == null) return;
        final long[] pat;
        try { pat = longs(patternJson); } catch (JSONException e) { return; }
        final int token = ++torchToken;
        main.post(() -> {
            long at = 0;
            for (int i = 0; i < pat.length; i++) {
                final boolean on = i % 2 == 0;
                main.postDelayed(() -> { if (token == torchToken) setTorch(on); }, at);
                at += pat[i];
            }
            main.postDelayed(() -> { if (token == torchToken) setTorch(false); }, at);
        });
    }

    private void setTorch(boolean on) {
        try { cameras.setTorchMode(torchId, on); } catch (CameraAccessException | RuntimeException ignored) { }
    }

    // ------------------------------------------------------------------ screen
    @JavascriptInterface
    public void setLandscape(boolean landscape) { main.post(() -> activity.setLandscape(landscape)); }

    @JavascriptInterface public String platform() { return "android"; }
    @JavascriptInterface public String version() { return BuildConfig.VERSION_NAME; }

    void stopAll() {
        torchToken++;
        if (torchId != null) main.post(() -> setTorch(false));
        cancelVibration();
    }

    // ------------------------------------------------------------------ helpers
    private static long[] longs(String json) throws JSONException {
        JSONArray a = new JSONArray(json);
        long[] out = new long[a.length()];
        for (int i = 0; i < out.length; i++) out[i] = Math.max(0, a.getLong(i));
        return out;
    }

    private static int[] ints(String json) throws JSONException {
        JSONArray a = new JSONArray(json);
        int[] out = new int[a.length()];
        for (int i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, a.getInt(i)));
        return out;
    }
}
