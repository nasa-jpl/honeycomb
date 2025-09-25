/**
 * Kinematic state of model
 */
export type StateBase = Record<string, any>;

/**
 * Describes a single knot in RKSML or time-point in
 * other data formats
 *
 * ```js
 * {
 *     time: 0,
 *     state: {
 *         ROVER_X: 0.0,
 *         ROVER_Y: 0.0,
 *         ROVER_Z: 0.0,
 *         // ...
 *     }
 * }
 * ```
 */
export interface Frame<T extends StateBase> {
    /**
     *An object that represents a set of data for this time.
     */
    state: T;

    /**
     * The time _in milliseconds_ that this frame is associated with.
     */
    time: number;
}
