import { Scheduler, RENDER_PRIORITY, type CancellablePromiseTask } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';
import { Camera, Scene, WebGLRenderer } from 'three';
import { Viewer } from './Viewer';

// Extension for Viewer that schedules a draw when "dirty" is set to true
type Constructor = new (...args: any) => Viewer;
export function DirtyViewerMixin<TBase extends Constructor>(base: TBase) {
    return class extends base {
        get orthographic() {
            return super.orthographic;
        }

        set orthographic(v) {
            if (v !== this.orthographic) {
                super.orthographic = v;
                this.dirty = true;
            }
        }

        readonly isDirtyViewer = true;
        private _staticRenderIteration = 0;

        dirty: boolean = false;
        private _dirty = false;

        private _scheduledRender?: CancellablePromiseTask<void>;

        constructor(...args: any) {
            super(...args);

            this.controls.addEventListener('change', () => (this.dirty = true));

            // This is some jenk we have to do because swc-loader is initializing this.dirty somewhere
            // and overriding the getter/setting. I'm not sure what exactly is causing this but I'm using
            // a fool proof way of initializing the view instead.
            const _this = this;
            requestAnimationFrame(() => {
                Object.defineProperty(this, "dirty", {
                    get() {
                        return _this._dirty;
                    },
                    set(v: boolean) {
                        if (v !== _this._dirty) {
                            _this._dirty = v;
                            _this.updateRenderSchedule();
                        }
                    }
                });
            });
        }

        /* Interface */
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        staticRender(renderer: WebGLRenderer, scene: Scene, camera: Camera, iteration: number) {
            return false;
        }

        /* Overrides */
        renderLoop() { }

        setSize(w: number, h: number) {
            super.setSize(w, h);
            this.dirty = true;
        }

        setTargetScale(scale: number) {
            super.setTargetScale(scale);
            this.dirty = true;
        }

        setPixelRatio(ratio: number) {
            super.setPixelRatio(ratio);
            this.dirty = true;
        }

        beforeRender(delta: number) {
            // set dirty to false right before rendering in case any event handlers
            // with before-render set dirty to true again.
            super.beforeRender(delta);
            this.dirty = false;
        }

        render() {
            let renderAgain = false;
            if (this.dirty) {
                super.render();
                this._staticRenderIteration = 0;

                renderAgain = true;
            } else {
                renderAgain = !!this.staticRender(
                    this.renderer,
                    this.scene,
                    this.getCamera(),
                    this._staticRenderIteration,
                );
                this._staticRenderIteration++;
            }

            if (renderAgain) {
                this._scheduledRender = Scheduler.scheduleNextFrame(() => this.render(), RENDER_PRIORITY);
            } else {
                this._scheduledRender = undefined;
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        enableChanged(enabled?: boolean) {
            this.updateRenderSchedule();
        }

        /* Private Functions */
        protected updateRenderSchedule() {
            // If we're enabled and dirty and there's no draw coming up then
            // schedule one
            if (this.enabled) {
                if (this.dirty && !this._scheduledRender) {
                    this._scheduledRender = Scheduler.schedule(() => this.render(), RENDER_PRIORITY);
                }
            }
        }
    };
}
