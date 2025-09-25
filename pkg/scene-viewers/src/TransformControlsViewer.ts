import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { Viewer } from "./Viewer";


type Constructor = new (...args: any) => Viewer & { dirty: boolean; fixedCamera: boolean; };
export function TransformControlsViewerMixin<TBase extends Constructor>(base: TBase) {
    return class extends base {
        transformControls: TransformControls;
        private _lastFixedCamera: boolean;

        constructor(...args: any) {
            super(...args);
            this.transformControls = new TransformControls(
                this.perspectiveCamera,
                this.renderer.domElement
            );

            // Re-attach the orbit control DOM listeners
            // A little hack needed to make sure the transform control DOM listeners
            // run before the orbit control listeners
            // This is needed because when the transformControls activate we need to
            // disable the orbit controls so that we don't rotate the camera while we are moving an object
            this.controls.disconnect();
            this.controls.connect();

            const gizmo = this.transformControls.getHelper();
            this.scene.add(gizmo);

            // Don't show the transform controls unless enabled externally
            this.transformControls.enabled = false;

            this.transformControls.addEventListener(
                'dragging-changed',
                this._onTransformDraggingChanged.bind(this)
            );

            this._lastFixedCamera = this.fixedCamera;
        }

        private _onTransformDraggingChanged = (ev: any) => {
            if (ev.value) {
                // Started moving transform controls
                // Temporarily disable the orbit controls and the focus target
                this.controls.enabled = false;
                this._lastFixedCamera = this.fixedCamera;
                this.fixedCamera = false;
            } else {
                // Transform dragging finished
                // Re-able the orbit controls
                this.controls.enabled = true;
                this.fixedCamera = this._lastFixedCamera;
            }

            this.dirty = true;
        };
    };
}
