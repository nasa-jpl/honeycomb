import type { DataFrame } from "@grafana/data";
import { lerp } from "three/src/math/MathUtils.js";
import { KinematicChannel } from "@gov.nasa.jpl.honeycomb/core";

import { AnimatedChannel } from "./AnimatedChannel";

/**
 * A 'sub'-animator that queries a single value field over a time field
 */
export class AnimatedKinematicChannel extends AnimatedChannel<number> {

    /**
     * In some instances, we may have a frame (e.g., an annotation) that
     * follows a certain pose but is updated at a different rate compared
     * to the pose's update frequency. In this situation, it is desirable
     * to sample that pose based on a different time channel.
     */
    timeChannel: AnimatedChannel<number> | undefined;

    constructor(channel: KinematicChannel) {
        super(channel);

        if (channel.useSeparateTimeChannel && channel.timeChannel) {
            this.timeChannel = new AnimatedChannel(channel.timeChannel);
        }
    }

    at(time: number): number {
        if (this.channel.useSeparateTimeChannel && this.timeChannel) {
            time = 1000 * this.timeChannel.at(time);
        }

        this.setTime(time);

        if (!this.timeField || !this.valueField) {
            return this.channel.value;
        }

        const n = this.timeField.values.length;
        if (this.currentFrameWithValue !== -1 && this.currentFrameWithValue + 1 < n) { // valid frame found (nominal)
            // Check if the next time value has data
            // TODO(tumbar) Do we want to OPTIONALLY look at the next frame with data and interpolate over that whole interval
            const nextIndex = (
                this.valueField.values[this.currentFrame + 1] !== undefined ?
                    this.currentFrame + 1
                    : this.currentFrameWithValue
            );

            const currV = this.valueField.values[this.currentFrameWithValue];

            if (this.currentFrameWithValue === nextIndex) {
                // Nothing to interpolate, state has not changed
                return currV;
            }

            const currT = this.timeField.values[this.currentFrameWithValue];
            const nextT = this.timeField.values[nextIndex];
            const nextV = this.valueField.values[nextIndex];

            if (this.channel.interpolate) {
                const ratio = (time - currT) / (nextT - currT);
                return lerp(currV, nextV, ratio);
            } else {
                return currV;
            }
        } else if (this.currentFrameWithValue !== -1) {
            // Final frame
            return this.valueField.values[this.currentFrameWithValue];
        }

        // Time is before data or there is no data
        return this.channel.value;
    }

    data(data: DataFrame[]) {
        super.data(data);
        if (this.timeChannel) {
            this.timeChannel.data(data);
        }
    }

    getStartTime(): number | undefined {
        if (this.timeField?.values?.length) {
            return this.timeField.values[0];
        }
        return undefined;
    }

    getEndTime(): number | undefined {
        if (this.timeField?.values?.length) {
            return this.timeField.values[this.timeField.values.length - 1];
        }
        return undefined;
    }
}
