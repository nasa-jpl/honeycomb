import { RosTransformTrackerBase } from '@gov.nasa.jpl.honeycomb/ros-transform-tracker';

const instances = new WeakMap();

export class RosAnimatorTransformTracker extends RosTransformTrackerBase {
    // Return the transform manager associated with the given
    // telemetry animator.
    static getInstance(animator) {
        if (!instances.has(animator)) {
            const rtm = new RosAnimatorTransformTracker(animator, animator.transformTracker.fixedFrame);
            instances.set(animator, rtm);
        }
        return instances.get(animator);
    }

    // Animator: the animator to look for `/tf` and `/tf_static` frames
    // in to keep track of.
    constructor(animator, fixedFrame = 'world') {
        super(fixedFrame);

        this._lastUpdateTime = -1;
        this._animator = animator;

        animator.addEventListener('added-frames', () => this.update(true));
        animator.addEventListener('change', () => this.update());
    }

    /* Public API */
    update(force = false) {
        // Reinitialize the transforms if the animator has rewound or hasn't
        // been initialized, yet.
        const animator = this._animator;
        if (animator.time < this._lastUpdateTime || this._frames === null) {
            this.reset();
        }

        // If we haven't updated for this frame yet then update all the transforms
        if (animator.time !== this._lastUpdateTime || force) {
            this._needsUpdate = false;
            this._lastUpdateTime = animator.time;

            const state = animator.state;
            if ('/tf_static' in state) {
                this.applyMessage(state['/tf_static'], '/tf_static');
            }

            if ('/tf' in state) {
                this.applyMessage(state['/tf'], '/tf');
            }
        }
    }

    reset() {
        super.reset();
        this._lastUpdateTime = -1;
    }

    seekBack(cb) {
        this._animator.seekBack(cb);
    }
}
