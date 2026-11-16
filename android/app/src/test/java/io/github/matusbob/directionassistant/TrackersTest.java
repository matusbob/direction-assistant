package io.github.matusbob.directionassistant;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class TrackersTest {
    private static final double LAT = 47.9766298, LON = 18.1608662;
    private static double north(double m) { return LAT + m / 111320.0; }

    @Test
    public void doingGoodEveryTenMeters() {
        DistanceTracker d = new DistanceTracker();
        d.reset(10, 0);
        java.util.List<Integer> said = new java.util.ArrayList<>();
        // Walking 1.3 m a second: steps under 2 m wait until they add up, so the count moves in 2.6 m jumps
        for (int i = 0; i <= 25; i++) {
            int m = d.onFix(north(i * 1.3), LON, 5, i * 1000L);
            if (m > 0) said.add(m);
        }
        assertEquals(said.toString(), 3, said.size());
        assertTrue(said.toString(), said.get(0) >= 10 && said.get(0) <= 13);
        assertTrue(said.toString(), said.get(1) >= 20 && said.get(1) <= 23);
        assertTrue(said.toString(), said.get(2) >= 30 && said.get(2) <= 33);
        assertEquals(32.5, d.total(), 1.5);
    }

    @Test
    public void inaccurateFixesAndJitterAreIgnored() {
        DistanceTracker d = new DistanceTracker();
        d.reset(10, 0);
        d.onFix(LAT, LON, 5, 0);
        assertEquals(-1, d.onFix(north(50), LON, 35, 1000));
        assertEquals(0, d.total(), 0.001);
        for (int i = 0; i < 20; i++) d.onFix(north(i % 2 == 0 ? 1 : 0), LON, 5, 2000 + i * 1000L);
        assertEquals("standing still with 1 m jitter adds nothing", 0, d.total(), 0.001);
    }

    @Test
    public void weakGpsIsReportedAfter15sAndAtMostEvery30s() {
        DistanceTracker d = new DistanceTracker();
        d.reset(10, 0);
        assertFalse(d.shouldWarnPoorGps(10000));
        assertTrue(d.shouldWarnPoorGps(16000));
        assertFalse(d.shouldWarnPoorGps(30000));
        assertTrue(d.shouldWarnPoorGps(47000));
        d.reset(0, 0);
        assertFalse("not used when Doing good is off", d.shouldWarnPoorGps(60000));
    }

    @Test
    public void compassJumpsWarnAtMostOnceAMinute() {
        CompassCheck c = new CompassCheck();
        boolean warned = false;
        for (int i = 0; i < 8; i++) warned |= c.add(i % 2 == 0 ? 0 : 90, i * 300L);
        assertTrue(warned);
        boolean again = false;
        for (int i = 0; i < 8; i++) again |= c.add(i % 2 == 0 ? 0 : 90, 5000 + i * 300L);
        assertFalse(again);
        CompassCheck smooth = new CompassCheck();
        boolean any = false;
        for (int i = 0; i < 100; i++) any |= smooth.add(i * 2, i * 50L);
        assertFalse("a normal turn is not a jump", any);
    }

    @Test
    public void beepIsPannedAndFadesOut() {
        short[] right = Beeper.render(1f, 500, 140, false);
        short[] left = Beeper.render(-1f, 280, 140, true);
        long r0 = 0, r1 = 0, l0 = 0, l1 = 0;
        for (int i = 0; i < right.length / 2; i++) { r0 += Math.abs(right[2 * i]); r1 += Math.abs(right[2 * i + 1]); }
        for (int i = 0; i < left.length / 2; i++) { l0 += Math.abs(left[2 * i]); l1 += Math.abs(left[2 * i + 1]); }
        assertTrue("right beep is in the right ear", r1 > 1000 * Math.max(1, r0));
        assertTrue("left beep is in the left ear", l0 > 1000 * Math.max(1, l1));
        assertEquals(0, right[right.length - 1]);
    }
}
