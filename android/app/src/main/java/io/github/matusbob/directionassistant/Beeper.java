package io.github.matusbob.directionassistant;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Short stereo tones: pan -1 = left ear, +1 = right ear. Same envelope as the web app's beeps. */
final class Beeper {
    private static final int RATE = 44100;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

    void beep(float pan, float freq, int durMs, boolean triangle) {
        if (worker.isShutdown()) return;
        worker.execute(() -> play(pan, freq, durMs, triangle));
    }

    /** Two rising tones: "direction set". */
    void chime() {
        beep(0, 523, 100, false);
        beep(0, 784, 140, false);
    }

    void shutdown() {
        worker.shutdown();
    }

    static short[] render(float pan, float freq, int durMs, boolean triangle) {
        double dur = durMs / 1000.0, attack = 0.02;
        int n = (int) (RATE * (dur + 0.02));
        short[] buf = new short[n * 2];
        // Equal-power panning
        double angle = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
        double left = Math.cos(angle), right = Math.sin(angle);
        for (int i = 0; i < n; i++) {
            double t = (double) i / RATE;
            double g;
            if (t < attack) g = 0.0001 * Math.pow(0.5 / 0.0001, t / attack);
            else if (t < dur) g = 0.5 * Math.pow(0.0001 / 0.5, (t - attack) / (dur - attack));
            else g = 0;
            double ph = 2 * Math.PI * freq * t;
            double w = triangle ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph);
            double s = w * g * 32767 * 0.9;
            buf[2 * i] = (short) Math.round(s * left);
            buf[2 * i + 1] = (short) Math.round(s * right);
        }
        return buf;
    }

    private void play(float pan, float freq, int durMs, boolean triangle) {
        short[] buf = render(pan, freq, durMs, triangle);
        AudioTrack track = null;
        try {
            track = new AudioTrack.Builder()
                    .setAudioAttributes(attrs)
                    .setAudioFormat(new AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(RATE)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                            .build())
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .setBufferSizeInBytes(buf.length * 2)
                    .build();
            track.write(buf, 0, buf.length);
            track.play();
            Thread.sleep(durMs + 60L);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (RuntimeException e) {
            // No audio right now (e.g. during a call): the vibration and voice still work
        } finally {
            if (track != null) track.release();
        }
    }
}
