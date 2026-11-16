package io.github.matusbob.directionassistant;

import java.util.ArrayDeque;

/** Notices a compass that jumps around (3 or more jumps over 45 degrees within 4 s), at most once a minute. */
public final class CompassCheck {
    private final ArrayDeque<float[]> history = new ArrayDeque<>();
    private long lastWarn = Long.MIN_VALUE / 4;

    public void reset() {
        history.clear();
    }

    /** Returns true when the walker should be told to calibrate the compass. */
    public boolean add(float heading, long nowMs) {
        history.addLast(new float[] {heading, nowMs});
        while (!history.isEmpty() && nowMs - (long) history.peekFirst()[1] > 4000) history.removeFirst();
        if (history.size() < 4) return false;
        int jumps = 0;
        float[] prev = null;
        for (float[] h : history) {
            if (prev != null && Math.abs(Heading.angleDiff(h[0], prev[0])) > 45) jumps++;
            prev = h;
        }
        return jumps >= 3 && warnAllowed(nowMs);
    }

    /** Also used when the sensor itself reports low accuracy, sharing the once-a-minute limit. */
    public boolean warnAllowed(long nowMs) {
        if (nowMs - lastWarn <= 60000) return false;
        lastWarn = nowMs;
        return true;
    }
}
