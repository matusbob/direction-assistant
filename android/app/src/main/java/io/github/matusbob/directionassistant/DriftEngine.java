package io.github.matusbob.directionassistant;

import java.util.ArrayList;
import java.util.List;

/**
 * Decides, for each compass reading, what the walker hears and feels. The rules are the same as in the web
 * version of the app, so both behave alike:
 * - within the allowed deviation: a quiet tick every 2.5 s, and one warning tick once you reach 70 % of it;
 * - beyond it: beeps from the side you drift to, faster and higher the further you drift, with vibration
 *   (drifting right: one continuous buzz, left: pulses) and a spoken message at most every 3 s;
 * - "Back on track" when you return; "Straight" every 8 s only if the voice is set to always.
 */
public final class DriftEngine {
    public enum State { OK, RIGHT, LEFT }
    public enum Speech { BACK_ON_TRACK, DRIFT, STRAIGHT }

    public static final class Beep {
        public final float pan;
        public final float freq;
        public final int durMs;
        public final boolean triangle;

        Beep(float pan, float freq, int durMs, boolean triangle) {
            this.pan = pan;
            this.freq = freq;
            this.durMs = durMs;
            this.triangle = triangle;
        }
    }

    public static final class Output {
        public State state;
        public boolean hard;
        /** The state or its strength (slight / hard) changed with this reading */
        public boolean changed;
        public int degrees;
        public final List<Beep> beeps = new ArrayList<>();
        /** Vibration as on/off durations in ms, starting with "on"; null for none */
        public long[] vibration;
        public Speech speech;
    }

    static final long[] VIBE_RIGHT = {120};
    static final long[] VIBE_RIGHT_HARD = {220};
    static final long[] VIBE_LEFT = {50, 50, 50, 50};
    static final long[] VIBE_LEFT_HARD = {40, 30, 40, 30, 40, 30};

    private static final long NEVER = Long.MIN_VALUE / 4;

    private float threshold = 15f;
    private boolean speakStraight;
    private State last;
    private boolean lastHard;
    private long lastVoice, lastOkBeep, lastBeep;
    private boolean nearEdgeWarned;
    private int driftEvents;

    public DriftEngine() {
        reset();
    }

    /** Forget everything, including the drift count (a new walk). */
    public void reset() {
        resetState();
        driftEvents = 0;
    }

    /** Forget the current state but keep the drift count (direction set again during the same walk). */
    public void resetState() {
        last = null;
        lastHard = false;
        lastVoice = lastOkBeep = lastBeep = NEVER;
        nearEdgeWarned = false;
    }

    public void setThreshold(float degrees) {
        threshold = degrees;
    }

    public void setSpeakStraight(boolean on) {
        speakStraight = on;
    }

    public int getDriftEvents() {
        return driftEvents;
    }

    /** diff: current heading minus target heading in degrees, positive = drifted to the right. */
    public Output update(float diff, long nowMs) {
        Output o = new Output();
        float cur = Math.abs(diff);
        float th = threshold;
        boolean wasOk = last == null || last == State.OK;
        State st = cur <= th ? State.OK : (diff > 0 ? State.RIGHT : State.LEFT);
        o.state = st;
        o.hard = st != State.OK && cur > th * 2;
        o.degrees = Math.round(cur);
        o.changed = st != last || o.hard != lastHard;
        if (st != State.OK && wasOk) driftEvents++;
        last = st;
        lastHard = o.hard;

        if (st == State.OK && !wasOk) {
            lastVoice = nowMs;
            o.speech = Speech.BACK_ON_TRACK;
        } else if (st != State.OK && nowMs - lastVoice > 3000) {
            lastVoice = nowMs;
            o.speech = Speech.DRIFT;
        } else if (st == State.OK && speakStraight && nowMs - lastVoice > 8000) {
            lastVoice = nowMs;
            o.speech = Speech.STRAIGHT;
        }

        if (st == State.OK) {
            if (cur >= th * 0.7f && !nearEdgeWarned) {
                nearEdgeWarned = true;
                o.beeps.add(new Beep(diff >= 0 ? 0.5f : -0.5f, 380, 70, false));
            } else if (cur < th * 0.5f) {
                nearEdgeWarned = false;
            }
            if (nowMs - lastOkBeep > 2500) {
                lastOkBeep = nowMs;
                o.beeps.add(new Beep(0, 220, 60, false));
            }
        } else {
            nearEdgeWarned = false;
            float urgency = Math.min(cur / (th * 2.5f), 1f);
            float interval = 700 - urgency * 480;
            if (nowMs - lastBeep > interval) {
                lastBeep = nowMs;
                boolean right = diff > 0;
                o.beeps.add(new Beep(right ? 1f : -1f, (right ? 500 : 280) + urgency * 320, Math.round(140 + urgency * 50), !right));
                o.vibration = right ? (o.hard ? VIBE_RIGHT_HARD : VIBE_RIGHT) : (o.hard ? VIBE_LEFT_HARD : VIBE_LEFT);
            }
        }
        return o;
    }
}
