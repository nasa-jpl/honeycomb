// from https://raw.githubusercontent.com/gkjohnson/threejs-sandbox/master/pixel-outline-pass/src/PixelOutlinePass.js

import {
    Scene,
    MeshBasicMaterial,
    Color,
    ShaderMaterial,
    Vector2,
    WebGLRenderTarget,
    LinearFilter,
    RGBAFormat,
    Camera,
    WebGLRenderer,
    Object3D,
    Material
} from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Object3DMaterial, ShaderReplacement } from './ShaderReplacement';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { isPsuedoObject } from '@gov.nasa.jpl.honeycomb/core';

const originalClearColor = new Color();
const compositeShader = {

    uniforms: {

        opacity: { value: 1 },
        thickness: { value: 1 },
        resolution: { value: new Vector2() },
        mainTex: { value: null },
        outlineTex: { value: null },

    },
    vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {

			#include <begin_vertex>
			#include <project_vertex>
			vUv = uv;

		}
	`,
    fragmentShader: /* glsl */`
		varying vec2 vUv;
		uniform sampler2D mainTex;
		uniform sampler2D outlineTex;
		uniform float thickness;
		uniform float opacity;
		uniform vec2 resolution;
		void main() {

			vec2 resMult = 1.0 / resolution;
			vec2 offset1 = vec2( 0.0, 1.0 ) * thickness * resMult;
			vec2 offset2 = vec2( 0.0, -1.0 ) * thickness * resMult;
			vec2 offset3 = vec2( 1.0, 0.0 ) * thickness * resMult;
			vec2 offset4 = vec2( -1.0, 0.0 ) * thickness * resMult;

			vec4 pix = texture2D( outlineTex, vUv );
			vec4 pix1 = texture2D( outlineTex, vUv + offset1 );
			vec4 pix2 = texture2D( outlineTex, vUv + offset2 );
			vec4 pix3 = texture2D( outlineTex, vUv + offset3 );
			vec4 pix4 = texture2D( outlineTex, vUv + offset4 );

			bool onBorder =
				pix.a != 0.0 &&
				(
					pix.rgb != pix1.rgb ||
					pix.rgb != pix2.rgb ||
					pix.rgb != pix3.rgb ||
					pix.rgb != pix4.rgb
				);

			float weights = pix1.a + pix2.a + pix3.a + pix4.a;
			vec3 color = pix1.rgb * pix1.a + pix2.rgb * pix2.a + pix3.rgb * pix3.a + pix4.rgb * pix4.a;
			color /= weights;
			color = clamp( color, 0.0, 1.0 );

			float alpha = onBorder || weights != 0.0 && pix.a == 0.0 ? opacity : 0.0;
			vec4 main = texture2D( mainTex, vUv );
			gl_FragColor = mix( main, vec4( color, 1.0 ), alpha );

		}
	`,

};

class BasicShaderReplacement extends ShaderReplacement {
    constructor() {
        super();
        // this.colorMap = new WeakMap();
    }

    createMaterial(object: any) {
        if (object.isLine2) {
            return new LineMaterial();
        } else {
            return new MeshBasicMaterial();
        }
    }

    updateUniforms(material: Material, target: Material): void {
        let color = 0;
        let opacity = 0;
        target.side = material.side;
        target.opacity = opacity;
        if ((target as any).color) {
            (target as any).color.set(color);
        }

        if (target instanceof LineMaterial) {
            target.linewidth = (material as LineMaterial).linewidth;
            target.resolution.copy((material as LineMaterial).resolution);
            target.uniforms.opacity.value = opacity;
        }
    }

}

export class PixelOutlinePass extends Pass {
    quad: FullScreenQuad;
    replacer: BasicShaderReplacement;
    colorMap: Map<Object3DMaterial, Color>;

    camera: Camera;
    renderTarget: WebGLRenderTarget;

    objects: Object3DMaterial[];
    renderDepth: boolean;
    thickness: number;
    opacity: number;

    scene: Scene | null;
    auxScene: Scene;

    constructor(camera: Camera) {
        super();

        const auxScene = new Scene();
        (auxScene as any).autoUpdate = false;

        this.renderTarget = new WebGLRenderTarget(1, 1, {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat
        });
        this.quad = new FullScreenQuad(new ShaderMaterial(compositeShader));
        this.replacer = new BasicShaderReplacement();
        this.colorMap = new Map();
        this.objects = [];
        this.auxScene = auxScene;
        this.scene = null;
        this.camera = camera;
        this.needsSwap = true;

        this.renderDepth = false;
        this.thickness = 1;
        this.opacity = 1;
    }

    setOutline(color: Color, newObjects: Object3D[]) {
        const colors = this.colorMap;
        const objects = this.objects;
        for (let i = 0, l = newObjects.length; i < l; i++) {
            const o = newObjects[i];
            if (!colors.has(o)) {
                objects.push(o);
            }

            colors.set(o, color);
        }
    }

    removeOutline(removeObjects: Object3D[]) {
        const colors = this.colorMap;
        const objects = this.objects;
        for (let i = 0, l = removeObjects.length; i < l; i++) {
            const o = removeObjects[i];
            colors.delete(o);

            const index = objects.indexOf(o);
            objects.splice(index, 1);
        }
    }

    clearOutlines() {
        this.colorMap.clear();
        this.objects.length = 0;
    }

    dispose() {
        this.clearOutlines();
        this.replacer.dispose();
        this.renderTarget.dispose();
    }

    setSize(w: number, h: number) {
        this.renderTarget.setSize(w, h);
        (this.quad.material as ShaderMaterial).uniforms.resolution.value.set(w, h);
    }

    render(
        renderer: WebGLRenderer,
        writeBuffer: WebGLRenderTarget,
        readBuffer: WebGLRenderTarget,
        delta: any,
        maskActive: boolean
    ) {
        const colorMap = this.colorMap;
        const objects = this.objects;
        const replacer = this.replacer;
        const camera = this.camera;
        const renderTarget = this.renderTarget;
        const quad = this.quad;

        let scene: Scene | null;
        if (this.renderDepth) {
            scene = this.scene;
        } else {
            scene = this.auxScene;
            scene.children = objects;
        }

        if (!scene) {
            throw new Error("No active scene");
        }

        const originalSceneBackground = scene.background;
        renderer.getClearColor(originalClearColor);
        const originalClearAlpha = renderer.getClearAlpha();
        scene.background = null;
        renderer.setClearColor(0);
        renderer.setClearAlpha(0);
        replacer.replace(scene, true, true, true);
        colorMap.forEach((color, object) => {
            object.traverse(c => {
                if (isPsuedoObject(c)) {
                    c.layers.disableAll(); // don't even try to render the pseudo object
                    return;
                }

                if (c.material) {
                    c.material.opacity = 1;
                    if ((c.material as any).color) {
                        if (color instanceof Color) {
                            (c.material as any).color.copy(color);
                        } else {
                            (c.material as any).color.set(color);
                        }
                    }

                    if (c.material instanceof LineMaterial) {
                        c.material.uniforms.opacity.value = 1;
                    }
                }
            });
        });

        renderer.setRenderTarget(renderTarget);
        renderer.clear();
        renderer.render(scene, camera);

        renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);

        const material = quad.material as ShaderMaterial;
        material.uniforms.mainTex.value = readBuffer.texture;
        material.uniforms.outlineTex.value = renderTarget.texture;
        material.uniforms.thickness.value = this.thickness;
        material.uniforms.opacity.value = this.opacity;
        quad.render(renderer);

        // TODO: The reset can result in the original material of some items staying changed in color
        scene.background = originalSceneBackground;
        renderer.setClearColor(originalClearColor);
        renderer.setClearAlpha(originalClearAlpha);
        replacer.reset(scene, true);
    }
}
