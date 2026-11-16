package io.github.matusbob.directionassistant;

/**
 * Light smoothing of the walking direction. The world vector of each candidate axis is averaged (not the angle,
 * so 359 and 1 degrees average to 0, not 180).
 */
public final class HeadingFilter {
    // Readings where the axis points this steeply up or down give no usable direction
    public static final float MAX_TILT = 0.9f;

    private final float alpha;
    private final float[] east = new float[2];
    private final float[] north = new float[2];
    private final float[] up = new float[2];
    private int samples;

    public HeadingFilter(float alpha) {
        this.alpha = alpha;
    }

    public void reset() {
        samples = 0;
    }

    public void add(float[] r) {
        for (int a = 0; a < 2; a++) {
            float e = Heading.east(r, a), n = Heading.north(r, a), u = Heading.up(r, a);
            if (samples == 0) {
                east[a] = e;
                north[a] = n;
                up[a] = u;
            } else {
                east[a] += alpha * (e - east[a]);
                north[a] += alpha * (n - north[a]);
                up[a] += alpha * (u - up[a]);
            }
        }
        samples++;
    }

    public int samples() {
        return samples;
    }

    public float heading(int axis) {
        return Heading.fromVector(east[axis], north[axis]);
    }

    public boolean usable(int axis) {
        return Math.abs(up[axis]) < MAX_TILT;
    }

    public int bestAxis() {
        return Math.abs(up[Heading.AXIS_TOP]) <= Math.abs(up[Heading.AXIS_BACK]) ? Heading.AXIS_TOP : Heading.AXIS_BACK;
    }
}
