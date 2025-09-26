import { Quaternion, MathUtils } from 'three';
import { KinematicState, TelemetryAnimator } from '@gov.nasa.jpl.honeycomb/telemetry-animator';

const q1 = new Quaternion();
const q2 = new Quaternion();
export class TransformAnimator extends TelemetryAnimator<KinematicState> {
    options: any;
    rotationMaps: [any];
    usedKeys: any;
    isTransformAnimator: boolean;

    constructor(frames: any = [], options: any = {}) {
        options = Object.assign({ rotationMaps: [] }, options);
        super(frames);
        this.options = options;

        this.rotationMaps = options.rotationMaps;
        this.usedKeys = {};
        this.rotationMaps.forEach(map => {
            for (const name in map) { this.usedKeys[map[name]] = true; }
        });

        this.isTransformAnimator = true;
    }

    /* Overrides */
    interpolateState(currState: any, nextState: any, ratio: number, target: any) {
        const usedKeys = this.usedKeys || {};
        const maps = this.rotationMaps || [];
        for (let i = 0, l = maps.length; i < l; i++) {
            const map = maps[i];
            let inBoth = true;
            for (const key in map) {
                const name = map[key];
                if (!(name in currState) || !(name in nextState)) {
                    inBoth = false;
                    break;
                }
            }

            if (inBoth) {
                q1.set(currState[map.qx], currState[map.qy], currState[map.qz], currState[map.qw]);
                q2.set(nextState[map.qx], nextState[map.qy], nextState[map.qz], nextState[map.qw]);

                q1.slerp(q2, ratio);
                target[map.qx] = q1.x;
                target[map.qy] = q1.y;
                target[map.qz] = q1.z;
                target[map.qw] = q1.w;
            }
        }

        for (const name in nextState) {
            const nextVal = nextState[name];
            if (!(name in usedKeys) && name in currState) {
                if (typeof nextVal === 'number') {
                    target[name] = MathUtils.lerp(currState[name], nextVal, ratio);
                } else if (typeof nextVal === 'object') {
                    super.interpolateState(currState[name], nextVal, ratio, target[name]);
                }
            }
        }
    }
}
