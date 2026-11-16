package io.github.matusbob.directionassistant;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class DriftEngineTest {
    private DriftEngine engine(float th) {
        DriftEngine e = new DriftEngine();
        e.setThreshold(th);
        return e;
    }

    @Test
    public void withinTheLimitIsStraightWithAQuietTickEvery2_5s() {
        DriftEngine e = engine(15);
        int ticks = 0;
        for (long t = 0; t <= 10000; t += 50) {
            DriftEngine.Output o = e.update(3, t);
            assertEquals(DriftEngine.State.OK, o.state);
            assertNull(o.vibration);
            assertNull("no talking while on track", o.speech);
            for (DriftEngine.Beep b : o.beeps) {
                assertEquals(220f, b.freq, 0.01);
                assertEquals(0f, b.pan, 0.01);
                ticks++;
            }
        }
        assertEquals(4, ticks);
        assertEquals(0, e.getDriftEvents());
    }

    @Test
    public void limitIsInclusive() {
        assertEquals(DriftEngine.State.OK, engine(15).update(15, 0).state);
        assertEquals(DriftEngine.State.RIGHT, engine(15).update(15.5f, 0).state);
        assertEquals(DriftEngine.State.LEFT, engine(15).update(-15.5f, 0).state);
    }

    @Test
    public void nearTheEdgeWarnsOnceFromThatSide() {
        DriftEngine e = engine(20);
        e.update(0, 0);
        DriftEngine.Output o = e.update(15, 3000); // 75 % of the limit, to the right
        assertEquals(DriftEngine.State.OK, o.state);
        assertTrue(o.beeps.stream().anyMatch(b -> b.freq == 380 && b.pan > 0));
        o = e.update(15, 3100);
        assertFalse("only once", o.beeps.stream().anyMatch(b -> b.freq == 380));
        e.update(5, 3200); // back below half: armed again
        o = e.update(-15, 3300);
        assertTrue(o.beeps.stream().anyMatch(b -> b.freq == 380 && b.pan < 0));
    }

    @Test
    public void driftRightBeepsRightVibratesContinuouslyAndSays() {
        DriftEngine e = engine(15);
        e.update(0, 0);
        DriftEngine.Output o = e.update(20, 1000);
        assertEquals(DriftEngine.State.RIGHT, o.state);
        assertFalse(o.hard);
        assertTrue(o.changed);
        assertEquals(DriftEngine.Speech.DRIFT, o.speech);
        assertEquals(20, o.degrees);
        assertEquals(1, o.beeps.size());
        assertEquals(1f, o.beeps.get(0).pan, 0.001);
        assertFalse(o.beeps.get(0).triangle);
        assertArrayEquals(DriftEngine.VIBE_RIGHT, o.vibration);
        assertEquals(1, e.getDriftEvents());
    }

    @Test
    public void hardDriftLeftPulsesAndIsMarkedHard() {
        DriftEngine e = engine(15);
        e.update(0, 0);
        DriftEngine.Output o = e.update(-40, 1000);
        assertEquals(DriftEngine.State.LEFT, o.state);
        assertTrue(o.hard);
        assertEquals(-1f, o.beeps.get(0).pan, 0.001);
        assertTrue(o.beeps.get(0).triangle);
        assertArrayEquals(DriftEngine.VIBE_LEFT_HARD, o.vibration);
        o = e.update(-20, 1300);
        assertTrue("slight again: strength change is reported", o.changed);
        assertFalse(o.hard);
    }

    @Test
    public void voiceAtMostEvery3sAndBeepsFasterWhenFurtherOff() {
        DriftEngine e = engine(10);
        int speeches = 0, beepsSmall = 0, beepsBig = 0;
        for (long t = 0; t < 6000; t += 20) {
            DriftEngine.Output o = e.update(12, t);
            if (o.speech != null) speeches++;
            beepsSmall += o.beeps.size();
        }
        assertEquals("at 0 s and after 3 s", 2, speeches);
        DriftEngine f = engine(10);
        for (long t = 0; t < 6000; t += 20) beepsBig += f.update(40, t).beeps.size();
        assertTrue("further off beeps more often: " + beepsSmall + " vs " + beepsBig, beepsBig >= beepsSmall * 1.8);
    }

    @Test
    public void backOnTrackIsSaidOnceAndDriftsAreCounted() {
        DriftEngine e = engine(15);
        e.update(30, 0);
        DriftEngine.Output o = e.update(2, 500);
        assertEquals(DriftEngine.Speech.BACK_ON_TRACK, o.speech);
        assertNull(e.update(2, 700).speech);
        e.update(-30, 900);
        e.update(-31, 1000);
        e.update(0, 1200);
        assertEquals(2, e.getDriftEvents());
        e.resetState();
        assertEquals("setting the direction again keeps the count", 2, e.getDriftEvents());
        e.reset();
        assertEquals(0, e.getDriftEvents());
    }

    @Test
    public void straightIsSaidEvery8sOnlyWhenTheVoiceIsAlwaysOn() {
        DriftEngine e = engine(15);
        int n = 0;
        for (long t = 0; t <= 20000; t += 100) if (e.update(0, t).speech != null) n++;
        assertEquals(0, n);
        e = engine(15);
        e.setSpeakStraight(true);
        n = 0;
        for (long t = 0; t <= 20000; t += 100) if (e.update(0, t).speech == DriftEngine.Speech.STRAIGHT) n++;
        assertEquals("at 0, ~8 and ~16 s", 3, n);
    }
}
