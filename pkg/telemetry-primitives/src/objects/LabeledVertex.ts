import { FrameTransformer } from '@gov.nasa.jpl.honeycomb/frame-transformer';
import { LabeledMixin } from '../mixins/LabeledMixin';
import { SphereAnnotation } from '../shapes/SphereAnnotation';
import { Camera, Renderer, Scene, WebGLRenderer } from 'three';

/**
 * Spherical vertex rendered with a label above it.
 * @extends SphereAnnotation
 */
class LabeledVertex extends LabeledMixin(SphereAnnotation) {
    /**
     * The text in the label.
     * @member {String}
     * @default ''
     */
    set text(v) {
        this._textEl.innerHTML = v;
        if (!v) {
            this.labelVisible = false;
        } else {
            this.labelVisible = true;
        }
    }

    get text() {
        return this._textEl.innerHTML;
    }

    private _textEl: Element;

    constructor(...args: any) {
        super(...args);

        const label = this.label;
        label.style.width = '0';
        label.style.color = 'white';

        label.innerHTML = `
            <div style="
                display: inline-block;
                transform: translate(-50%, 0);
                position: absolute;
                bottom: 5px;
                background: #2b373e;
                padding: 5px;
                white-space: nowrap;
                text-align: center;
            "></div>
            <div style="
                width:0;
                border-width: 5px 5px 0 5px;
                border-color: transparent;
                border-top-color: #2b373e;
                border-style: solid;
                transform: translate(-50%, 0);
                position: absolute;
                bottom: 0;
            "></div>
        `;
        this._textEl = label.children[0];
        this.text = '';
    }

    updateLabelPosition(renderer: Renderer, scene: Scene, camera: Camera) {
        const offset = this.labelOffset;
        offset.copy(camera.up);
        FrameTransformer.transformDirection(camera.matrixWorld, this.matrixWorld, offset, offset);
        offset.multiplyScalar(this.radius * 1.5);
        super.updateLabelPosition(renderer as WebGLRenderer, scene, camera);
    }

    copy(source: this) {
        super.copy(source);
        this.text = source.text;
        return this;
    }
}

export { LabeledVertex };
