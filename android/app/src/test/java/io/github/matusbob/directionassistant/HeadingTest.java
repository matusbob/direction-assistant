package io.github.matusbob.directionassistant;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class HeadingTest {
    /** Rotation matrix (device to world ENU) for a phone lying flat, its top pointing to compass heading h. */
    static float[] flat(float h) {
        double a = Math.toRadians(h);
        float c = (float) Math.cos(a), s = (float) Math.sin(a);
        // device x -> (c, -s, 0), device y (top) -> (s, c, 0), device z -> up
        return new float[] {c, s, 0, -s, c, 0, 0, 0, 1};
    }

    /** Phone held upright, screen facing the walker, the back (camera) pointing to compass heading h. */
    static float[] upright(float h) {
        double a = Math.toRadians(h);
        float c = (float) Math.cos(a), s = (float) Math.sin(a);
        // device x -> (c, -s, 0); device y (top) -> up; device z (screen, towards the walker) -> (-s, -c, 0)
        return new float[] {c, 0, -s, -s, 0, -c, 0, 1, 0};
    }

    /** Upright but upside down in a pocket (top pointing to the ground), back still pointing to h. */
    static float[] upsideDown(float h) {
        double a = Math.toRadians(h);
        float c = (float) Math.cos(a), s = (float) Math.sin(a);
        // device x -> (-c, s, 0); device y -> down; device z -> (-s, -c, 0)
        return new float[] {-c, 0, -s, s, 0, -c, 0, -1, 0};
    }

    @Test
    public void flatPhoneUsesTheTopEdge() {
        for (float h : new float[] {0, 45, 90, 180, 270, 359}) {
            float[] r = flat(h);
            assertEquals(Heading.AXIS_TOP, Heading.bestAxis(r));
            assertEquals(h, Heading.headingOf(r, Heading.AXIS_TOP), 0.01);
        }
    }

    @Test
    public void uprightPhoneUsesTheBack() {
        for (float h : new float[] {0, 30, 90, 200, 315}) {
            float[] r = upright(h);
            assertEquals(Heading.AXIS_BACK, Heading.bestAxis(r));
            assertEquals(h, Heading.headingOf(r, Heading.AXIS_BACK), 0.01);
            r = upsideDown(h);
            assertEquals(Heading.AXIS_BACK, Heading.bestAxis(r));
            assertEquals(h, Heading.headingOf(r, Heading.AXIS_BACK), 0.01);
        }
    }

    @Test
    public void angleDiffWrapsAndKeepsTheSign() {
        assertEquals(20f, Heading.angleDiff(10, 350), 0.001);
        assertEquals(-20f, Heading.angleDiff(350, 10), 0.001);
        assertEquals(0f, Heading.angleDiff(123, 123), 0.001);
        assertEquals(180f, Math.abs(Heading.angleDiff(180, 0)), 0.001);
        assertEquals(-90f, Heading.angleDiff(270, 0), 0.001);
        assertEquals(359f, Heading.normalize(-1), 0.001);
    }

    @Test
    public void filterAveragesAcrossNorthWithoutFlipping() {
        HeadingFilter f = new HeadingFilter(0.5f);
        for (int i = 0; i < 20; i++) f.add(flat(i % 2 == 0 ? 355 : 5));
        float h = f.heading(Heading.AXIS_TOP);
        assertTrue("near north, was " + h, h > 350 || h < 10);
        assertTrue(f.usable(Heading.AXIS_TOP));
        assertFalse("the back of a flat phone points down", f.usable(Heading.AXIS_BACK));
        assertEquals(Heading.AXIS_TOP, f.bestAxis());
    }

    @Test
    public void filterFollowsATurnSmoothly() {
        HeadingFilter f = new HeadingFilter(0.25f);
        f.add(upright(0));
        for (int i = 0; i < 40; i++) f.add(upright(90));
        assertEquals(90f, f.heading(Heading.AXIS_BACK), 0.5);
        assertEquals(Heading.AXIS_BACK, f.bestAxis());
    }
}
