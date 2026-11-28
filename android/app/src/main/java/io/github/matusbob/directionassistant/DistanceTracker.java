package io.github.matusbob.directionassistant;

/**
 * Walked distance from GPS for the "Doing good" messages, with the same rules as the web app: fixes worse than
 * 20 m are ignored, steps under 2 m are not counted yet (they add up once you've moved further), and a weak
 * signal for 15 s or more is reported at most every 30 s.
 */
public final class DistanceTracker {
    private static final long NEVER = Long.MIN_VALUE / 4;

    private double lastLat = Double.NaN, lastLon;
    private double total, since;
    private boolean hasFix;
    private double next;
    private int every;
    private long lastAccepted;
    private long lastWarn = NEVER;

    public void reset(int everyMeters, long nowMs) {
        every = everyMeters;
        next = everyMeters;
        total = 0;
        since = 0;
        hasFix = false;
        lastLat = Double.NaN;
        lastAccepted = nowMs;
        lastWarn = NEVER;
    }

    public double total() {
        return total;
    }

    /** Walked distance since the direction was last set (for drift in meters). */
    public double since() {
        return since;
    }

    public void resetSince() {
        since = 0;
    }

    /** A good fix (20 m or better) came within the last maxAgeMs. */
    public boolean fresh(long nowMs, long maxAgeMs) {
        return hasFix && nowMs - lastAccepted <= maxAgeMs;
    }

    /** Returns the distance to announce as "Doing good, N m", or -1 for nothing to say. */
    public int onFix(double lat, double lon, float accuracy, long nowMs) {
        if (accuracy > 20) return -1;
        lastAccepted = nowMs;
        hasFix = true;
        if (Double.isNaN(lastLat)) {
            lastLat = lat;
            lastLon = lon;
            return -1;
        }
        double d = meters(lastLat, lastLon, lat, lon);
        if (d > 2) {
            total += d;
            since += d;
            lastLat = lat;
            lastLon = lon;
        }
        if (every > 0 && total >= next) {
            while (next <= total) next += every;
            return (int) Math.round(total);
        }
        return -1;
    }

    public boolean shouldWarnPoorGps(long nowMs) {
        if (every <= 0) return false;
        if (nowMs - lastAccepted > 15000 && nowMs - lastWarn > 30000) {
            lastWarn = nowMs;
            return true;
        }
        return false;
    }

    static double meters(double lat1, double lon1, double lat2, double lon2) {
        double r = 6371000, dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
