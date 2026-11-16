package io.github.matusbob.directionassistant;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.Locale;

/** The app's own voice, so messages are heard with the screen locked. */
final class Speaker implements TextToSpeech.OnInitListener {
    interface LanguageProblem { void onMissing(); }

    private final Context ctx;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final TextToSpeech tts;
    private final LanguageProblem problem;
    private boolean ready;
    private String pending;
    private Runnable afterPending;
    private Runnable afterUtterance;
    private int counter;

    Speaker(Context ctx, LanguageProblem problem) {
        this.ctx = ctx;
        this.problem = problem;
        tts = new TextToSpeech(ctx, this);
    }

    @Override
    public void onInit(int status) {
        if (status != TextToSpeech.SUCCESS) {
            if (problem != null) problem.onMissing();
            return;
        }
        int res = tts.setLanguage(Locale.forLanguageTag(ctx.getString(R.string.tts_lang)));
        if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
            if (problem != null) problem.onMissing();
        }
        tts.setSpeechRate(1.1f);
        tts.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build());
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) { finished(id); }
            @Override public void onError(String id) { finished(id); }
            @Override public void onStop(String id, boolean interrupted) { finished(id); }
        });
        ready = true;
        if (pending != null) {
            String p = pending;
            Runnable after = afterPending;
            pending = null;
            afterPending = null;
            say(p, after);
        }
    }

    void say(String text) {
        say(text, null);
    }

    /** Speaks, replacing whatever is being said; "after" runs when this text has been spoken (or failed). */
    void say(String text, Runnable after) {
        if (!ready) {
            pending = text;
            afterPending = after;
            return;
        }
        String id = "u" + (++counter);
        afterUtterance = after;
        if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS && after != null) {
            afterUtterance = null;
            main.post(after);
        }
    }

    private void finished(String id) {
        if (!("u" + counter).equals(id)) return;
        Runnable after = afterUtterance;
        afterUtterance = null;
        if (after != null) main.post(after);
    }

    void shutdown() {
        tts.stop();
        tts.shutdown();
    }
}
