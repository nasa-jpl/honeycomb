import type { DataFrame, Field } from "@grafana/data";
import {
    AnnotationOptions,
    AnnotationStaleBehavior,
    Channel,
    ChannelType
} from "@gov.nasa.jpl.honeycomb/core";

import {
    binarySearch,
    getValueAndTimeFields
} from "./utils";

export enum TimeAggregation {
    oldest,
    newest,
    mean
}

export interface AnimatedValue<T> {
    /**
     * Set the state of this channel/value to be at a certain time,
     * and return the state at that time.
     * @param time Milliseconds since unix epoch (Jan 1 1970)
     * @returns State at this time
     */
    at(time: number): T;

    /**
     * Get the actual (non-interpolated or extrapolated) time that
     * we are pointing. AKA time of the keyframe from the data query.
     * 
     * @param method If this value is a merger between multiple channels, choose how to aggregate these times together
     * @returns MS since epoch, -1 if we are not pointing at a keyframe
     */
    timeOfData(aggregateMethod: TimeAggregation): number;

    /**
     * Update the data we are pointing to. This invalidates the current
     * frame we are pointing to.
     * @param data Series from Grafana query
     */
    data(data: DataFrame[]): void;
}

export function aggregateTimes(method: TimeAggregation, ...times: number[]): number {
    if (times.length === 0) {
        return -1;
    }

    switch (method) {
        case TimeAggregation.oldest:
            return Math.min(...times);
        case TimeAggregation.newest:
            return Math.max(...times, -1);
        case TimeAggregation.mean: {
            // Filter out any values that don't have a keyframe
            const filtered = times.filter(v => v !== -1);
            if (filtered.length > 0) {
                return filtered.reduce((a, b) => a + b) / filtered.length;
            } else {
                return -1;
            }
        }
    }
}

export abstract class AnimatedChannelBase<T> implements AnimatedValue<T> {
    protected abstract timeField?: Field<number>;

    currentFrame = -1;
    currentFrameWithValue = -1;
    time = -1;

    data(_data: DataFrame[]): void {
        this.currentFrame = -1;
        this.currentFrameWithValue = -1;
        this.time = -1;
    }

    /**
     * Compute the last index that has data
     * @param index index to start searching at
     */
    protected abstract lastFilledIndex(index: number): number;

    /**
     * Updates the {@link currentFrame} (frame index)
     * and {@link currentFrameWithValue} (frame index of last filled cell)
     * @param time Time to point to in data
     */
    setTime(time: number): void {
        this.time = time;

        if (!this.timeField) {
            return;
        }

        const n = this.timeField.values.length;
        const lastFrame = this.currentFrame;

        let currentFrameNeedsUpdate: boolean;
        if (this.currentFrame === -1) {
            currentFrameNeedsUpdate = true;
        } else if (this.currentFrame + 1 < n) {
            if (
                time >= this.timeField.values[this.currentFrame] &&
                time <= this.timeField.values[this.currentFrame + 1]
            ) {
                // We are still in the same keyframe range
                // No need to search for another keyframe again
                currentFrameNeedsUpdate = false;
            } else {
                // We need to find the proper frame again
                currentFrameNeedsUpdate = true;
            }
        } else {
            if (time >= this.timeField.values[this.currentFrame]) {
                // We are still pointing at the last frame
                currentFrameNeedsUpdate = false;
            } else {
                currentFrameNeedsUpdate = true;
            }
        }

        if (currentFrameNeedsUpdate) {
            this.currentFrame = binarySearch(this.timeField.values, time);
        }

        if (this.currentFrame !== -1) {
            this.currentFrameWithValue = (lastFrame !== this.currentFrame || this.currentFrameWithValue === -1) ?
                this.lastFilledIndex(this.currentFrame)
                : this.currentFrameWithValue;
        } else {
            this.currentFrameWithValue = -1;
        }
    }

    timeOfData(): number {
        if (!this.timeField) {
            return -1;
        }

        if (this.currentFrameWithValue === -1) {
            return -1;
        }

        return this.timeField.values[this.currentFrameWithValue];
    }

    abstract at(time: number): T;
}

/**
 * A 'sub'-animator that queries a single value field over a time field
 */
export class AnimatedChannel<T> extends AnimatedChannelBase<T> {

    protected timeField?: Field<number>;
    protected valueField?: Field<T>;

    protected lastFilledIndex(index: number): number {
        if (!this.valueField) {
            return -1;
        }

        for (; index >= 0; index--) {
            const value = this.valueField.values[index];
            if (value !== undefined) {
                return index;
            }
        }

        return -1;
    }

    constructor(readonly channel: Channel<T>) {
        super();
    }

    setTime(time: number): void {
        this.time = time;

        // Short circuit the search if we don't have data yet
        if (!this.timeField || !this.valueField) {
            return;
        }

        super.setTime(time);
    }

    data(data: DataFrame[]) {
        this.timeField = undefined;
        this.valueField = undefined;

        switch (this.channel.type) {
            case ChannelType.constant:
                break;
            case ChannelType.animated:
                if (this.channel.field) {
                    const fields = getValueAndTimeFields<T>(data, this.channel.field);
                    if (fields) {
                        this.timeField = fields.time;
                        this.valueField = fields.value;
                    }
                }
                break;
        }

        super.data(data);
    }

    at(time: number): T {
        this.setTime(time);

        if (!this.timeField || !this.valueField) {
            return this.channel.value;
        }

        const n = this.timeField.values.length;

        if (this.currentFrameWithValue !== -1 && this.currentFrameWithValue + 1 < n) { // valid frame found (nominal)
            // Current value in the last frame
            return this.valueField.values[this.currentFrameWithValue];
        } else if (this.currentFrameWithValue !== -1) {
            // Final frame
            return this.valueField.values[this.currentFrameWithValue];
        }

        // Time is before data or there is no data
        return this.channel.value;
    }

    timeOfData(): number {
        if (this.channel.type === ChannelType.constant) {
            // Constants are always up to date
            return this.time;
        }

        return super.timeOfData();
    }
}

export abstract class AnimatedValueMerged<T> implements AnimatedValue<T | null> {
    abstract fields: Record<string, AnimatedValue<any>>;

    constructor(readonly options: AnnotationOptions<unknown>) {

    }

    timeOfData(aggregateMethod: TimeAggregation): number {
        return aggregateTimes(aggregateMethod, ...Object.values(
            this.fields
        ).map(v => v.timeOfData(aggregateMethod)));
    }

    at(time: number) {
        const out = Object.fromEntries(
            Object.entries(this.fields).map(([k, v]) => [k, v.at(time)])
        ) as T;

        // Check if the data is up to date
        const oldestChannel = this.timeOfData(TimeAggregation.oldest);
        let isStale;
        if (oldestChannel < 0) {
            // No data
            isStale = true;
        } else {
            // Check if stale
            if (typeof this.options.staleThreshold === "number") {
                isStale = time - oldestChannel > (this.options.staleThreshold);
            } else {
                isStale = this.options.staleThreshold;
            }
        }

        if (isStale) {
            switch (this.options.staleBehavior) {
                case AnnotationStaleBehavior.invisible:
                    // If not `null` indicates to the driver to make this invisible
                    return null;
                case AnnotationStaleBehavior.defaults:
                    // Fallthrough to the default/current state
                    break;
            }
        }

        return out;
    }

    data(data: DataFrame[]): void {
        for (const fields of Object.values(this.fields)) {
            fields.data(data);
        }
    }
}
