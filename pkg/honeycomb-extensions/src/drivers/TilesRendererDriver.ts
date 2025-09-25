import { Driver, LoadingManager } from '@gov.nasa.jpl.honeycomb/core';
import { ExtendedShaderMaterial } from '@gov.nasa.jpl.honeycomb/mixin-shaders';
import { TilesRenderer } from '3d-tiles-renderer';
import { Group, UniformsLib, UniformsUtils, MathUtils, MeshPhongMaterial, Object3D } from 'three';

import * as pathM from 'path';

const priorityCallback = (a: any, b: any) => {

    if (a.__depth !== b.__depth) {

        // load shallower tiles first
        return a.__depth > b.__depth ? - 1 : 1;

    } else if (a.__inFrustum !== b.__inFrustum) {

        // load tiles that are in the frustum at the current depth
        return a.__inFrustum ? 1 : - 1;

    } else if (a.__used !== b.__used) {

        // load tiles that have been used
        return a.__used ? 1 : - 1;

    } else if (a.__error !== b.__error) {

        // load the tile with the higher error
        return a.__error > b.__error ? 1 : - 1;

    } else if (a.__distanceFromCamera !== b.__distanceFromCamera) {

        // and finally visible tiles which have equal error (ex: if geometricError === 0)
        // should prioritize based on distance.
        return a.__distanceFromCamera > b.__distanceFromCamera ? - 1 : 1;

    }

    return 0;

};


class MeshBasicShadowMaterial extends ExtendedShaderMaterial {
    constructor(options?: any) {
        super({
            uniforms:
                UniformsUtils.clone(
                    UniformsUtils.merge([
                        UniformsLib.lights,
                        UniformsLib.common,
                    ]),
                )
            ,
            vertexShader: `
                #include <common>
                #include <uv_pars_vertex>
                #include <uv2_pars_vertex>
                #include <envmap_pars_vertex>
                #include <color_pars_vertex>
                #include <fog_pars_vertex>
                #include <shadowmap_pars_vertex>
                #include <morphtarget_pars_vertex>
                #include <skinning_pars_vertex>
                #include <logdepthbuf_pars_vertex>
                #include <clipping_planes_pars_vertex>
                void main() {
                    #include <uv_vertex>
                    #include <uv2_vertex>
                    #include <color_vertex>
                    #include <skinbase_vertex>
                    #ifdef USE_ENVMAP
                    #include <beginnormal_vertex>
                    #include <morphnormal_vertex>
                    #include <skinnormal_vertex>
                    #include <defaultnormal_vertex>
                    #endif
                    #include <begin_vertex>
                    #include <morphtarget_vertex>
                    #include <skinning_vertex>
                    #include <project_vertex>
                    #include <logdepthbuf_vertex>
                    #include <worldpos_vertex>
                    #include <beginnormal_vertex>
                    #include <morphnormal_vertex>
                    #include <skinbase_vertex>
                    #include <skinnormal_vertex>
                    #include <defaultnormal_vertex>
                    #include <shadowmap_vertex>
                    #include <clipping_planes_vertex>
                    #include <envmap_vertex>
                    #include <fog_vertex>
                }
            `,
            fragmentShader: `
                uniform vec3 diffuse;
                uniform float opacity;
                #ifndef FLAT_SHADED
                    varying vec3 vNormal;
                #endif
                #include <common>
                #include <dithering_pars_fragment>
                #include <color_pars_fragment>
                #include <uv_pars_fragment>
                #include <uv2_pars_fragment>
                #include <map_pars_fragment>
                #include <alphamap_pars_fragment>
                #include <aomap_pars_fragment>
                #include <lightmap_pars_fragment>
                #include <envmap_common_pars_fragment>
                #include <envmap_pars_fragment>
                #include <cube_uv_reflection_fragment>
                #include <fog_pars_fragment>
                #include <specularmap_pars_fragment>
                #include <logdepthbuf_pars_fragment>
                #include <clipping_planes_pars_fragment>
                #include <packing>
                #include <bsdfs>
                #include <lights_pars_begin>
                #include <shadowmap_pars_fragment>
                #include <shadowmask_pars_fragment>
                void main() {
                    #include <clipping_planes_fragment>
                    vec4 diffuseColor = vec4( diffuse, opacity );
                    #include <logdepthbuf_fragment>
                    #include <map_fragment>
                    #include <color_fragment>
                    #include <alphamap_fragment>
                    #include <alphatest_fragment>
                    #include <specularmap_fragment>
                    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
                    #ifdef USE_LIGHTMAP

                        vec4 lightMapTexel= texture2D( lightMap, vUv2 );
                        reflectedLight.indirectDiffuse += lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
                    #else
                        reflectedLight.indirectDiffuse += vec3( 1.0 );
                    #endif
                    #include <aomap_fragment>
                    reflectedLight.indirectDiffuse *= diffuseColor.rgb;
                    vec3 outgoingLight = reflectedLight.indirectDiffuse;
                    #include <envmap_fragment>

                    vec3 shadowColor = ambientLightColor;
                    gl_FragColor =
                        vec4( mix( shadowColor, vec3( 1.0 ), getShadowMask() ) * outgoingLight, diffuseColor.a );
                    #include <tonemapping_fragment>
                    #include <encodings_fragment>
                    #include <fog_fragment>
                    #include <premultiplied_alpha_fragment>
                    #include <dithering_fragment>
                }
            `,
        }, options);
        this.lights = true;
    }
}


function updateOptions(renderer: any, options: any) {
    ['displayBounds', 'errorTarget', 'errorThreshold', 'loadSiblings', 'maxDepth'].forEach(str => {
        if (str in options) {
            renderer[str] = options[str];
        }
    });
}

class TilesRendererDriver extends Driver<object> {
    private _sceneFrames?: Record<string, Group>;
    private _sceneRoot?: Group;
    private _tilesRenderers: TilesRenderer[];
    _sceneImages: { uri: string }[];

    constructor(readonly options: Record<string, any>, readonly manager: LoadingManager) {
        options = {
            terrainId: '3d-tiles-renderer',
            terrainName: '3D Tiles',
            ...options
        };

        super(manager);

        this._tilesRenderers = [];
        this._sceneImages = [];
    }

    initialize() {
        const { manager, options } = this;
        const {
            fetchOptions = {},
            isScene,
        } = options;

        let paths: string[] = options.path;
        if (!Array.isArray(paths)) {
            paths = [paths];
        }

        if (isScene) {
            for (const p of paths) {
                const url = manager.resolveURL(p);
                fetch(url, fetchOptions).then(resp => {
                    if (!resp.ok) {
                        throw new Error(`TilesRendererDriver: failed to load file ${url} with status ${resp.status} : ${resp.statusText}`);
                    }

                    return resp.json();
                })
                    .then((json: {
                        frames: {
                            parent_id?: string,
                            frame_id: string,
                            translation: { x: number, y: number, z: number },
                            rotation: { x: number, y: number, z: number, w: number },
                            scale: { x: number, y: number, z: number },
                        }[],
                        tilesets: { uri: string, frameId?: string }[],
                        images: { uri: string }[]
                    }) => {
                        const groupFrames: Record<string, Group> = {};
                        for (const fr of json.frames) {
                            const frame = new Group();
                            groupFrames[fr.frame_id] = frame;

                            const pos = fr.translation;
                            frame.position.set(pos.x, pos.y, pos.z);

                            const rot = fr.rotation;
                            frame.quaternion.set(rot.x, rot.y, rot.z, rot.w);

                            const scale = fr.scale;
                            frame.scale.set(scale.x, scale.y, scale.z);

                            if (fr.parent_id && fr.parent_id !== '') {
                                if (fr.parent_id in groupFrames) {
                                    groupFrames[fr.parent_id].add(frame);
                                } else {
                                    console.error(`TilesRendererDriver: frame parent ${fr.parent_id} does not exist`);
                                }
                            } else {
                                this.viewer!.world.add(frame);
                                this._sceneRoot = frame;
                            }
                        }

                        this._sceneFrames = groupFrames;

                        const scenePaths = json.tilesets.map(tileset => {
                            const splits = url.split(/[\\/]/g);
                            splits.pop();
                            const basePath = splits.join('/');
                            tileset.uri = pathM.resolve(basePath, tileset.uri);
                            return tileset;
                        });
                        this.initTilesRenderers(scenePaths);

                        this._sceneImages = json.images;
                    });
            }
        } else {
            this.initTilesRenderers(paths);
        }
    }

    private _beforeRenderCallback() {
        const viewer = this.viewer!;

        for (const renderer of this._tilesRenderers) {
            updateOptions(renderer, this.options);
            if (viewer.orthographic) {
                renderer.deleteCamera(viewer.perspectiveCamera);
                renderer.setCamera(viewer.orthographicCamera);
                renderer.setResolutionFromRenderer(viewer.orthographicCamera, viewer.renderer);
            } else {
                renderer.deleteCamera(viewer.orthographicCamera);
                renderer.setCamera(viewer.perspectiveCamera);
                renderer.setResolutionFromRenderer(viewer.perspectiveCamera, viewer.renderer);
            }
            renderer.update();
        }
    }

    initTilesRenderers(paths: (string | { uri: string, frameId?: string })[]) {
        // create all renderers
        const { manager, options } = this;
        const viewer = this.viewer!;

        const renderer = viewer.renderer;
        const {
            maxDepth = Infinity,
            errorTarget = 6,
            errorThreshold = Infinity,
            loadSiblings = true,
            lruMinSize = 600,
            lruMaxSize = 800,
            fetchOptions = {},
            receiveShadow = false,
            castShadow = false,
            renderOrder = -3,
            rotate = null,
            translate = null,
            usePhongMaterial = false,
        } = options;

        const renderers = paths.map(p => {
            let url;
            if (typeof p === 'string') {
                url = manager.resolveURL(p);
            } else {
                url = manager.resolveURL(p.uri);
            }

            const tilesRenderer = new TilesRenderer(url);
            tilesRenderer.setCamera(viewer.getCamera());
            tilesRenderer.setResolutionFromRenderer(viewer.getCamera(), renderer);

            tilesRenderer.maxDepth = maxDepth;
            tilesRenderer.errorTarget = errorTarget;
            tilesRenderer.errorThreshold = errorThreshold;
            (tilesRenderer as any).loadSiblings = loadSiblings;
            Object.assign(tilesRenderer.fetchOptions, fetchOptions);

            tilesRenderer.group.name = options.terrainName;
            (tilesRenderer as any).onLoadModel = (model: Object3D) => {
                if (receiveShadow || castShadow) {
                    model.traverse(c => {
                        const cm = c as any;
                        if (cm.material && cm.material.isMeshBasicMaterial && receiveShadow) {
                            cm.material = new MeshBasicShadowMaterial({
                                map: cm.material.map,
                            });
                        }

                        if (cm.material && usePhongMaterial) {
                            cm.material = new MeshPhongMaterial({
                                map: cm.material.map,
                                specular: 0,
                                shininess: 0,
                            });
                        }
                        c.receiveShadow = receiveShadow;
                        c.castShadow = castShadow;
                        c.renderOrder = renderOrder;
                    });
                }
                viewer.dirty = true;
            };
            (tilesRenderer as any).onDisposeModel = (model: Object3D) => {
                if (receiveShadow) {
                    model.traverse(c => {
                        if ((c as any).material) {
                            (c as any).material.dispose();
                        }
                    });
                }
            };
            (tilesRenderer as any).onLoadTileSet = () => {
                viewer.dirty = true;
            };

            if (typeof p !== 'string' && p.frameId) {
                const frame = this._sceneFrames![p.frameId];
                if (frame) {
                    frame.add(tilesRenderer.group);
                }
            }

            tilesRenderer.fetchOptions = {
                ...tilesRenderer.fetchOptions,
                ...options.fetchOptions
            };

            return tilesRenderer;
        });

        renderers[0].downloadQueue.priorityCallback = priorityCallback;
        renderers[0].parseQueue.priorityCallback = priorityCallback;
        renderers.forEach(renderer => {
            renderer.lruCache = renderers[0].lruCache;
            renderer.downloadQueue = renderers[0].downloadQueue;
            renderer.parseQueue = renderers[0].parseQueue;
        });

        const lruCache = renderers[0].lruCache;
        lruCache.minSize = lruMinSize;
        lruCache.maxSize = lruMaxSize;

        const group = new Group();
        group.name = options.terrainName;
        if (this._sceneRoot) {
            group.add(this._sceneRoot);
        } else {
            group.add(...renderers.map(tr => tr.group));
        }
        if (rotate && Array.isArray(rotate) && rotate.length === 3) {
            group.rotation.set(
                MathUtils.degToRad(rotate[0]),
                MathUtils.degToRad(rotate[1]),
                MathUtils.degToRad(rotate[2])
            );
        }
        if (translate && Array.isArray(translate) && translate.length === 3) {
            group.position.set(translate[0], translate[1], translate[2]);
        }

        group.name = options.terrainId;
        viewer.addObject(group, {});

        // Update the tiles tree before every render
        this._tilesRenderers = renderers;
        viewer.addEventListener('before-render', this._beforeRenderCallback);
    }

    update() { }

    dispose() {
        const { viewer, options, _tilesRenderers, _beforeRenderCallback } = this;
        viewer?.removeObject(options.terrainId);
        viewer?.removeEventListener('before-render', _beforeRenderCallback);
        _tilesRenderers.forEach(renderer => renderer.dispose());
    }
}

export { TilesRendererDriver };
