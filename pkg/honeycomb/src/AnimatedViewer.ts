import { ViewerMixin } from './viewer';
import { JoinedTelemetryAnimator, TelemetryAnimator, copyOnTo } from '@gov.nasa.jpl.honeycomb/telemetry-animator';
import { StateDiff } from './StateDiff';
import { Scheduler, RENDER_PRIORITY, type CancellablePromiseTask } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';
import {
    DirtyViewerMixin,
    OptimizedViewerMixin,
    Viewer,
    CSS2DViewerMixin,
    ColorBlindViewerMixin,
    SelectionViewerMixin,
} from '@gov.nasa.jpl.honeycomb/scene-viewers';
import { Driver } from './Driver';
import type { Frame, StateBase } from '@gov.nasa.jpl.honeycomb/common';

const CHANGED_STATE_DIFF = new StateDiff(true);

type Constructor = new (...args: any) => Viewer;
export function AnimatedMixin<T extends StateBase, TBase extends Constructor>(baseClass: TBase) {
    return class extends ViewerMixin<T, TBase>(DirtyViewerMixin(baseClass)) {
        animator: JoinedTelemetryAnimator<T>;
        orderedDrivers: Driver<Partial<T>>[];
        diffObj: StateDiff<T>;
        lastState: T;

        isPlaying: boolean;
        isLive: boolean;
        playbackSpeed: number;

        private _animation?: CancellablePromiseTask<void>;

        get animators() {
            return this.animator.animators;
        }

        constructor(...args: any) {
            super(...args);

            const animator = new JoinedTelemetryAnimator<T>();

            const lastState = {} as T;
            const diffObj = new StateDiff();
            animator.addEventListener('added-frames', () => {
                if (animator.seekable === false) {
                    animator.setTime(animator.endTime);
                }
            });

            animator.addEventListener('change', () => {
                this.updateAllDrivers();
            });

            animator.addEventListener('reset', () => {
                for (const stateKey in this.lastState) {
                    delete lastState[stateKey];
                }

                this.dirty = true;
            });

            animator.addEventListener('error', e => {
                this.dispatchEvent(e);
            });

            this.animator = animator;
            this.orderedDrivers = [];
            this.diffObj = diffObj;
            this.lastState = lastState;
            this.isPlaying = false;
            this.isLive = false;
            this.playbackSpeed = 1;
        }

        // Animator accessors
        addAnimator<P extends Partial<T>>(animator: TelemetryAnimator<P>, id: string) {
            if (this.getAnimator(id)) {
                this.removeAnimator(id);
            }

            this.animator.addAnimator(animator, id);
            this.dispatchEvent({ type: 'add-animator', animator, id });
        }

        getAnimator(id: string) {
            return this.animator.animators[id];
        }

        removeAnimator(id: string) {
            const an = this.animators[id];
            this.animator.removeAnimator(id);
            return an;
        }

        // Drive updates
        addDriver<P extends Partial<T>>(driver: Driver<P>, id: string): void {
            super.addDriver(driver, id);

            this.updateOrderedDrivers();
            try {
                driver.setState(this.animator.state as any as P, CHANGED_STATE_DIFF);
            } catch (e) {
                this.dispatchEvent({
                    type: 'error',
                    error: e,
                    source: driver,
                });
            }
        }

        removeDriver<P extends Partial<T>>(id: string): Driver<P> {
            const result = super.removeDriver(id);
            this.updateOrderedDrivers();
            return result as Driver<P>;
        }

        updateOrderedDrivers() {
            this.orderedDrivers = Object.values(this.drivers).sort((a, b) => {
                return a.updateOrder - b.updateOrder;
            });
        }

        updateAllDrivers(force = false) {
            const animator = this.animator;
            const diffObj = this.diffObj;
            const lastState = this.lastState;

            if (force) {
                for (const stateKey in lastState) {
                    delete lastState[stateKey];
                }
            }

            this._debouncer.run(
                'update-drivers',
                () => {
                    const state = animator.state;
                    const time = animator.time;
                    const frames: Record<string, Frame<Partial<T>>[]> = {};
                    for (const key in animator.animators) {
                        frames[key] = animator.animators[key].frames;
                    }

                    diffObj.update(state, lastState);
                    copyOnTo(state, lastState, false, false, true);

                    for (const driver of this.orderedDrivers) {
                        try {
                            driver.setState(state, diffObj);
                        } catch (e) {
                            this.dispatchEvent({
                                type: 'error',
                                error: e,
                                source: driver,
                            });
                        }
                    }

                    this.dispatchEvent({ type: 'change', state, time });
                    this.dirty = true;
                },
                RENDER_PRIORITY - 1,
            );
        }

        play() {
            if (this._animation) {
                return;
            }

            const { animator } = this;
            if (!animator.seekable) {
                this.isPlaying = true;
                this.isLive = true;
                return;
            }

            let lastTime = window.performance.now();
            const _do = () => {
                const time = window.performance.now();

                if (this.isLive) {
                    animator.setTime(animator.endTime);
                    this._animation = Scheduler.scheduleNextFrame(_do, RENDER_PRIORITY - 2);
                    lastTime = time;
                } else {
                    const delta = time - lastTime;
                    const multiplier = this.playbackSpeed * 0.001;
                    lastTime = time;

                    const newTime = Math.min(
                        animator.time + delta * multiplier,
                        animator.endTime,
                    );
                    animator.setTime(newTime);

                    if (newTime === animator.endTime) {
                        if (animator.liveData) {
                            this.isLive = true;
                            this._animation = Scheduler.scheduleNextFrame(_do, RENDER_PRIORITY - 2);
                        } else {
                            this.pause();
                        }
                    } else {
                        this._animation = Scheduler.scheduleNextFrame(_do, RENDER_PRIORITY - 2);
                    }
                }
            };

            // If the playback time is at the end of the data meaning there's nothing
            // more to play back then restart the data.
            if (animator.time >= animator.endTime) {
                this.stop();
            }

            this.isPlaying = true;
            this.dispatchEvent({ type: 'play' });
            _do();
        }

        pause() {
            if (this._animation) {
                this._animation.cancel();
                this._animation = undefined;
            }

            if (!this.animator.seekable) {
                return;
            }

            this.isPlaying = false;
            this.isLive = false;
            this.dispatchEvent({ type: 'pause' });
        }

        stop(resetTime?: number) {
            this.pause();
            if (!this.animator.seekable) {
                return;
            }

            this.animator.setTime(resetTime ?? this.animator.startTime);
            this.dispatchEvent({ type: 'stop' });
        }

        dispose() {
            const animators = this.animators;
            for (const key in animators) {
                this.removeAnimator(key);
            }

            this.animator.dispose();
            super.dispose();
        }
    };
}

export class AnimatedViewer extends AnimatedMixin(
    SelectionViewerMixin(
        ColorBlindViewerMixin(
            CSS2DViewerMixin(
                OptimizedViewerMixin(
                    DirtyViewerMixin(
                        Viewer))),
        ),
    ),
) {
}
