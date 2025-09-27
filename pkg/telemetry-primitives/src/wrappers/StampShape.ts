import { BackSide, NotEqualStencilFunc, ZeroStencilOp, CustomBlending, Mesh } from 'three';
import { StencilShape } from './StencilShape';
import { emptyRaycast } from './common';

/**
 * Renders a color where the given shape intersects any data in the depth buffer.
 * @extends StencilShape
 */
export class StampShape<T extends Mesh> extends StencilShape {
    readonly isPsuedoObject = true; // useful for not allowing it to be selectable in the PixelOutlinePass
    name = 'StampShape';
    
    /**
     * Getter for the mesh with material that will be rendered.
     * @member {Mesh}
     */
    get stamp() {
        return this.children[4];
    }

    get shape(): T {
        return this.shape as T;
    }

    /**
     * Takes a shape with a material to be rendered at the shape overlap. The object itself
     * is stored as a reference in this StampShape instance and the material on the shape has
     * the necessary stencil and depth properties set on it. Raycasting is disabled on the stencil
     * stamp geometry.
     *
     * @param {T} shape
     */
    constructor(shape: T) {
        super(shape);
        this.add(shape);
        (shape as any).isPsuedoObject = true;
        shape.raycast = emptyRaycast;

        Object.assign(shape.material, {
            blending: CustomBlending,
            depthTest: false,
            depthWrite: false,
            // transparent: true,
            alphaWrite: true,

            side: BackSide,
            stencilWrite: true,
            stencilFunc: NotEqualStencilFunc,
            stencilRef: 0,
            stencilFail: ZeroStencilOp,
            stencilZFail: ZeroStencilOp,
            stencilZPass: ZeroStencilOp,
        });

        this.setRenderOrder(0);
    }

    setRenderOrder(renderOrder: number) {
        super.setRenderOrder(renderOrder);
        this.stamp.renderOrder = renderOrder + 0.01;
    }

    clone() {
        const stamp = this.stamp.clone();
        (stamp as any).material = (stamp as any).material.clone();

        const clone = this.constructor(stamp as any);
        clone.copy(this, false);

        this.setRenderOrder(this.children[0].renderOrder);
        return clone;
    }
}
