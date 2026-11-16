package io.github.matusbob.directionassistant;

/**
 * Compass math on Android rotation matrices (3x3, row-major, device coordinates to world East-North-Up,
 * as produced by SensorManager.getRotationMatrixFromVector).
 *
 * Two device axes can serve as "the way I'm walking": the top edge of the phone when it lies flat, and the
 * back of the phone (the camera side) when it is held upright or carried upright in a pocket. Whichever of the
 * two is closer to horizontal when the direction is set is used for the whole walk.
 */
public final class Heading {
    public static final int AXIS_TOP = 0;
    public static final int AXIS_BACK = 1;

    private Heading() {}

    /** East, north and up components of the chosen axis in world coordinates. */
    public static float east(float[] r, int axis) { return axis == AXIS_TOP ? r[1] : -r[2]; }
    public static float north(float[] r, int axis) { return axis == AXIS_TOP ? r[4] : -r[5]; }
    public static float up(float[] r, int axis) { return axis == AXIS_TOP ? r[7] : -r[8]; }

    /** Compass heading of the axis, 0 = north, 90 = east. */
    public static float headingOf(float[] r, int axis) {
        return fromVector(east(r, axis), north(r, axis));
    }

    public static float fromVector(float east, float north) {
        return normalize((float) Math.toDegrees(Math.atan2(east, north)));
    }

    public static int bestAxis(float[] r) {
        return Math.abs(up(r, AXIS_TOP)) <= Math.abs(up(r, AXIS_BACK)) ? AXIS_TOP : AXIS_BACK;
    }

    public static float normalize(float deg) {
        float d = deg % 360f;
        return d < 0 ? d + 360f : d;
    }

    /** Signed difference current - target in (-180, 180]: positive means turned to the right. */
    public static float angleDiff(float current, float target) {
        float d = (current - target + 540f) % 360f;
        if (d < 0) d += 360f;
        return d - 180f;
    }
}
