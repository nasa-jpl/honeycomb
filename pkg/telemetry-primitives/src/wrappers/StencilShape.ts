import {
    Group,
    MeshBasicMaterial,
    BackSide,
    FrontSide,
    AlwaysStencilFunc,
    KeepStencilOp,
    IncrementWrapStencilOp,
    DecrementWrapStencilOp,
    Mesh,
} from 'three';
import { emptyRaycast } from './common';

const backSideIncr = new MeshBasicMaterial();
backSideIncr.side = BackSide;
backSideIncr.depthTest = false;
backSideIncr.colorWrite = false;
backSideIncr.depthWrite = false;
backSideIncr.stencilWrite = true;
backSideIncr.stencilFunc = AlwaysStencilFunc;
backSideIncr.stencilFail = KeepStencilOp;
backSideIncr.stencilZFail = KeepStencilOp;
backSideIncr.stencilZPass = IncrementWrapStencilOp;

const backSideDecr = new MeshBasicMaterial();
backSideDecr.side = BackSide;
backSideDecr.depthTest = true;
backSideDecr.colorWrite = false;
backSideDecr.depthWrite = false;
backSideDecr.stencilWrite = true;
backSideDecr.stencilFunc = AlwaysStencilFunc;
backSideDecr.stencilFail = KeepStencilOp;
backSideDecr.stencilZFail = KeepStencilOp;
backSideDecr.stencilZPass = DecrementWrapStencilOp;

const frontSideDecr = new MeshBasicMaterial();
frontSideDecr.side = FrontSide;
frontSideDecr.depthTest = false;
frontSideDecr.colorWrite = false;
frontSideDecr.depthWrite = false;
frontSideDecr.stencilWrite = true;
frontSideDecr.stencilFunc = AlwaysStencilFunc;
frontSideDecr.stencilFail = KeepStencilOp;
frontSideDecr.stencilZFail = KeepStencilOp;
frontSideDecr.stencilZPass = DecrementWrapStencilOp;

const frontSideIncr = new MeshBasicMaterial();
frontSideIncr.side = FrontSide;
frontSideIncr.depthTest = true;
frontSideIncr.colorWrite = false;
frontSideIncr.depthWrite = false;
frontSideIncr.stencilWrite = true;
frontSideIncr.stencilFunc = AlwaysStencilFunc;
frontSideIncr.stencilFail = KeepStencilOp;
frontSideIncr.stencilZFail = KeepStencilOp;
frontSideIncr.stencilZPass = IncrementWrapStencilOp;

/**
 * Class for stenciling a shape intersection into the stencil buffer. Needs to
 * be rendered after some geometry has already been rendered into the depth buffer.
 * Raycasting is disabled on the stencil geometry.
 * @extends Group
 */
export class StencilShape extends Group {
    readonly isStencilShape: boolean = true;
    readonly isPsuedoObject = true; // useful for not allowing it to be selectable in the PixelOutlinePass
    name = 'StencilShape';
    /**
     * Getter for the shape that is being rendered.
     * @member {Mesh}
     */
    get shape() {
        return this.children[0];
    }

    /**
     * Constructor that take the shape to render.
     * @param {T} shape
     */
    constructor(shape: Mesh) {
        super();
        this.add(shape.clone(), shape.clone(), shape.clone(), shape.clone());
        this.children.forEach(c => {
            c.raycast = emptyRaycast;
            (c as any).isPsuedoObject = true; // useful for not allowing it to be selectable in the PixelOutlinePass
        });

        const [c0, c1, c2, c3] = this.children as any;

        c0.material = backSideIncr;
        c1.material = backSideDecr;
        c2.material = frontSideIncr;
        c3.material = frontSideDecr;

        c0.name += '_backSideIncr';
        c1.name += '_backSideDecr';
        c2.name += '_frontSideIncr';
        c3.name += '_frontSideDecr';
    }

    /**
     * Sets the render order of the stencil.
     * @param {Number} renderOrder
     */
    setRenderOrder(renderOrder: number) {
        this.children.forEach(c => {
            c.renderOrder = renderOrder;
        });
    }

    updateMatrixWorld(force?: boolean) {
        const shape = this.shape;
        this.children.forEach(c => {
            c.position.copy(shape.position);
            c.quaternion.copy(shape.quaternion);
            c.scale.copy(shape.scale);
            (c as any).geometry = (shape as any).geometry;
        });

        super.updateMatrixWorld(force);
    }

    clone() {
        const clone = this.constructor(this.children[0]);
        clone.copy(this, false);
        return clone;
    }
}
