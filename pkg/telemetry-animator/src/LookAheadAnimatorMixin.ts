// TODO: It's important to know that if you just set the functions WITHOUT
// calling reset the data preloading will not occur as expected. This is a bit
// of a frustrating pattern and should maybe be reconsidered in other animators, too.

import { Frame, StateBase } from "@gov.nasa.jpl.honeycomb/common";
import { TelemetryAnimator } from "./TelemetryAnimator";
import { CancellablePromiseTask } from "@gov.nasa.jpl.honeycomb/scheduling-utilities";

type GConstructor<T> = new (...args: any[]) => T;

/**
 * Mixin function that produces a new class that inherits from base and mixes
 * in {@link #LookAheadAnimator LookAheadAnimator}. Base class is expected to
 * derive from {@link #TelemetryAnimator TelemetryAnimator}.
 * @function
 * @param {class} base
 */
export function LookAheadAnimatorMixin<T extends StateBase, TBase extends GConstructor<TelemetryAnimator<T>>>(Base: TBase) {
    /**
     * Mixin class used for premptively loading data for upcoming (and previous) frames
     * within some threshold. Used when frame data contains references to external data
     * that must be loaded ahead of time. When frames leave the provided window any loaded
     * data is unloaded and pending loads are cancelled.
     * @class LookAheadAnimator
     */
    return class extends Base {
        isLookAheadAnimator = true;

        /**
         * The amount of time in milliseconds to look ahead to prep loaded data.
         * @memberof LookAheadAnimator
         * @member {Number}
         * @default 1000
         */
        lookAhead = 1000;

        /**
         * The amount of time in milliseconds to look back to prep loaded data.
         * @memberof LookAheadAnimator
         * @member {Number}
         * @default 100
         */
        lookBack = 100;

        private _loadedFrames: Record<string, { frame: Frame<T>, completed: boolean }>;

        private _loadedStartTime: number;
        private _loadedEndTime: number;
        private _debounceProcessState: () => CancellablePromiseTask<void>;

        constructor(...args: any) {
            super(...args);

            this._loadedStartTime = -1;
            this._loadedEndTime = -1;
            this._loadedFrames = {};

            this._debounceProcessState = () => {
                return this._debouncer.run('process-state', () => {
                    const oldStale = this.stale;
                    this._updateStale();
                    const newStale = this.stale;
                    const successProcess = this.processState(this.state);
                    if (oldStale !== newStale || successProcess) {
                        this.dispatchEvent({
                            type: 'change',
                            time: this.time,
                            state: this.state,
                        });
                    }
                });
            };
        }

        /* Overrides */
        async setTime(time: number) {
            if (this._disposed) {
                return;
            }

            this._suppressChangeEvent = true;
            const pr = super.setTime(time);
            this._preloadFrom(time);
            this._unload();
            this.processState(this.state);
            this._updateStale();
            this.dispatchEvent({
                type: 'change',
                time: this.time,
                state: this.state,
            });
            this._suppressChangeEvent = false;
            return pr;
        }

        async reset() {
            if (this._disposed) {
                return;
            }

            super._reset();
            this._clearPreloads();
            return this.setTime(0);
        }

        dispose() {
            super.dispose();
            this._clearPreloads();
        }

        // async forEachFrame()
        // It's important to note that forEachFrame will NOT include the
        // preprocessed look ahead information. Maybe it could with an option?

        /* Private */
        _clearPreloads() {
            this._loadedStartTime = -1;
            this._loadedEndTime = -1;
            for (const key in this._loadedFrames) {
                const { frame } = this._loadedFrames[key];
                this.unloadData(frame.state);
                delete this._loadedFrames[key];
            }
            this._loadedFrames = {};
        }

        _rerunPreloads() {
            this._clearPreloads();
            this._preloadFrom(this.time);
            this._debounceProcessState();
        }

        _preloadFrom(time: number) {
            const frames = this.frames;
            if (frames.length === 0) {
                return;
            }

            const targetStartTime = time - this.lookBack;
            const targetEndTime = time + this.lookAhead;

            let startIndex = Math.max(0, this._currFrame);
            let endIndex = Math.max(0, this._currFrame);
            while (startIndex > 0 && frames[startIndex - 1].time >= targetStartTime) {
                startIndex--;
            }
            while (endIndex < frames.length - 1 && frames[endIndex + 1].time <= targetEndTime) {
                endIndex++;
            }

            for (let i = startIndex; i <= endIndex; i++) {
                if (!(i in this._loadedFrames)) {
                    const frame = frames[i];
                    const promises = this.preloadData(frame.state);
                    if (promises) {
                        const obj = { frame, completed: false };
                        this._loadedFrames[i] = obj;
                        let promiseSuccessCount = 0;
                        let promiseArray: Promise<any>[];
                        if (!Array.isArray(promises)) {
                            promiseArray = [promises];
                        } else {
                            promiseArray = promises;
                        }
                        promiseArray.forEach(pr => {
                            pr.catch((e: any) => {
                                // dispatch error if it wasn't an abort fetch error
                                if (e.name !== 'AbortError') {
                                    this.dispatchEvent({
                                        type: 'error',
                                        error: e,
                                        source: this,
                                    });
                                }
                            }).finally(() => {
                                promiseSuccessCount++;
                                this._debounceProcessState();
                                if (promiseSuccessCount === promiseArray.length) {
                                    obj.completed = true;
                                }
                            });
                        });
                    }
                }
            }

            this._loadedStartTime = frames[startIndex].time;
            this._loadedEndTime = frames[endIndex].time;
        }

        _updateStale() {
            this.stale = false;
            const currFrame = this._currFrame;
            const loadedFrames = this._loadedFrames;
            for (const key in loadedFrames) {
                const index = parseInt(key, 10);
                if (index <= currFrame && !loadedFrames[key].completed) {
                    this.stale = true;
                    break;
                }
            }
        }

        _unload(force?: boolean) {
            if (!this._loadedFrames) {
                return;
            }

            const loadedFrames = this._loadedFrames;
            for (const key in loadedFrames) {
                const { frame } = loadedFrames[key];
                if (
                    frame.time < this._loadedStartTime ||
                    frame.time > this._loadedEndTime ||
                    force
                ) {
                    this.unloadData(frame.state);
                    delete loadedFrames[key];
                }
            }
        }

        /* Private Interface */
        /**
         * Overrideable function that is called for each frame that must have data
         * preloaded for it.
         *
         * Must return a promise that resolves when the data has been preloaded.
         * @param {Object} state
         * @returns {Promise}
         */
        preloadData(state: T): Promise<void> | Promise<void>[] | null {
            return null;
        }

        /**
         * Overrideable function called on every state that had data preloaded to unload
         * the data when the frame moves outside of the preload window.
         * @param {Object} state
         * @returns {void}
         */
        unloadData(state: T): void { }

        /**
         * Overrideable function called every time the time is changed to step forward and
         * is responsible for setting the necessary data on the given state object.
         *
         * Should return "true" if the state was modified, false otherwise.
         *
         * @returns {Boolean}
         */
        processState(state: T): boolean {
            return false;
        }
    };
}
