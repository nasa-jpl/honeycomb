import type { DataFrame, TimeRange } from "@grafana/data";

import { StateBase } from "@gov.nasa.jpl.honeycomb/common";
import { TelemetryAnimator } from "@gov.nasa.jpl.honeycomb/telemetry-animator";
import { HoneycombPanelOptions } from "../types";
import { AnimatedValue } from "./AnimatedChannel";

export abstract class GrafanaAnimator<T extends StateBase> extends TelemetryAnimator<T> implements AnimatedValue<T> {
    get ready() {
        return true;
    }

    get startTime() {
        return this._startTime;
    }

    get endTime() {
        return this._endTime;
    }

    updateTimeRange(timeRange: TimeRange) {
        if (timeRange.raw.to === 'now') {
            this.liveData = true;
        } else {
            this.liveData = false;
        }

        this._startTime = timeRange.from.valueOf() / 1000;
        this._endTime = timeRange.to.valueOf() / 1000;

        this.dispatchUpdate();
    }

    async _step(deltaTime: number): Promise<void> {
        if (this._disposed) {
            return;
        }

        await this.setTime(this.time + deltaTime);
    }

    async setTime(time: number): Promise<void> {
        this.time = time;

        // Use grafana time instead of honeycomb time
        this.state = this.at(this.time * 1000);

        this.dispatchEvent({ type: 'reset' });
        this.dispatchUpdate();
    }

    timeOfData(): number {
        // It doesn't make sense to implement this
        return -1;
    }

    abstract options(options: HoneycombPanelOptions): void;
    abstract at(time: number): T;
    abstract data(data: DataFrame[]): void;
}
