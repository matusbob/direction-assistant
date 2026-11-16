package io.github.matusbob.directionassistant;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

final class Haptics {
    private final Vibrator vibrator;

    Haptics(Context c) {
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = c.getSystemService(VibratorManager.class);
            vibrator = vm != null ? vm.getDefaultVibrator() : null;
        } else {
            vibrator = c.getSystemService(Vibrator.class);
        }
    }

    /** onOff: vibration and pause durations in ms, starting with vibration. */
    void vibrate(long[] onOff) {
        if (vibrator == null || !vibrator.hasVibrator() || onOff == null || onOff.length == 0) return;
        long[] timings = new long[onOff.length + 1];
        System.arraycopy(onOff, 0, timings, 1, onOff.length);
        VibrationEffect effect = VibrationEffect.createWaveform(timings, -1);
        // Alarm-type vibration: it isn't silenced by the touch-feedback setting or when the screen is off
        if (Build.VERSION.SDK_INT >= 33) {
            vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM));
        } else {
            vibrator.vibrate(effect, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
        }
    }

    void cancel() {
        if (vibrator != null) vibrator.cancel();
    }
}
