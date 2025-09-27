import path from 'path';
import { ModelCache, hash } from '@gov.nasa.jpl.honeycomb/model-cache';
import { optimizeGeometry } from '@gov.nasa.jpl.honeycomb/geometry-optimization-utils';
import { SubLoadingManager } from './SubLoadingManager';
import { Loader, Object3D, Group, Texture } from 'three';
import { Driver, LoadingManager, SceneObjectType, type SceneObject } from '.';
import { TelemetryAnimator } from '@gov.nasa.jpl.honeycomb/telemetry-animator';
import { type StateBase, type Disposable } from '@gov.nasa.jpl.honeycomb/common';
import { EventDispatcher } from '@gov.nasa.jpl.honeycomb/event-dispatcher';

type Options = Record<string, any>;

export class FrameObject extends Object3D {
    readonly isFrame = true;
    readonly type: string;
    constructor() {
        super();
        this.type = 'Frame';
    }
}

/**
 * Textures can be initialized and attached to models
 * while they wait for the main data to be fetched
 */
interface PromisedTexture {
    texture: Texture;
    promise: Promise<Texture>;
}

let enableCache = false;
const textureCache = new ModelCache<PromisedTexture>();
const objectCache = new ModelCache<Object3D>();
function setCacheEnabled(enabled: boolean) {
    enableCache = enabled;
    if (!enabled) {
        textureCache.clear();
        objectCache.clear();
    }
}

class CachedTextureLoader extends Loader {
    constructor(
        readonly manager: LoadingManager,
        readonly options: Options,
    ) {
        super(manager);
    }

    load(
        url: string,
        onLoad: (t: Texture) => void,
        onProgress: (e: ProgressEvent) => void,
        onError: (err: any) => void,
    ) {
        const ext = path.extname(url).substr(1);
        const { texture, promise } = loadSingleTexture(ext, url, this.options, this.manager);
        promise
            .then(() => {
                if (onLoad) {
                    onLoad(texture);
                }
            })
            .catch(err => {
                if (onError) {
                    onError(err);
                }
            });

        return texture;
    }
}

type TextureLoader = (p: string, options: any, manager: LoadingManager) => Texture;
const textureLoaders: Record<string, TextureLoader> = {};
function registerTextureLoader(ext: string | string[], loadFn: TextureLoader) {
    if (Array.isArray(ext)) {
        for (const e of ext) {
            registerTextureLoader(e, loadFn);
        }
    } else {
        ext = ext.toLowerCase();
        textureLoaders[ext] = loadFn;
    }
}

function unregisterTextureLoader(ext: string | string[]) {
    if (Array.isArray(ext)) {
        for (const e of ext) {
            unregisterTextureLoader(e);
        }
    } else {
        ext = ext.toLowerCase();
        delete textureLoaders[ext];
    }
}

// Returns an object with the texture immediately as well as a promise that resolves when the
// texture has been fully loaded.
function loadSingleTexture(type: string | undefined, _path: string, options = {}, manager = new SubLoadingManager()): PromisedTexture {
    // resolve the paths here so that they're resolved to the absolute location
    const hashPaths = path.resolve(manager.resolveURL(_path));
    const textureHash = hash(hashPaths, options);
    if (textureCache.has(textureHash)) {
        return textureCache.get(textureHash) as PromisedTexture;
    } else {
        let ext = type ?? _path.split(/\./g).pop()!;
        ext = ext.toLowerCase();
        const loader = textureLoaders[ext];
        if (!loader) {
            throw new Error(`Texture type "${ext}" not registered to load.`);
        }

        // Use a separate manager to tracker loading progress of an individual model so
        // all subparts will have been loaded by the time the function has resolved.
        const subManager = new SubLoadingManager(manager);
        const texture = loader(_path, options, subManager);
        const promise = new Promise<Texture>((resolve, reject) => {
            subManager.onLoad = () => resolve(texture);
            subManager.onError = url => reject(new Error(`Error loading "${url}".`));
        });

        const result = { texture, promise };

        if (enableCache) {
            textureCache.add(textureHash, result);
        }

        return result;
    }
}

async function loadTexture(type: string | undefined, _path: string, options: Options, manager: LoadingManager) {
    if (Array.isArray(_path)) {
        return await Promise.all(_path.map(p => loadSingleTexture(type, p, options, manager)));
    } else {
        return loadSingleTexture(type, _path, options, manager);
    }
}

function parseTexture(type: string | undefined, data: BlobPart, options: Options, manager: LoadingManager) {
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const pr = loadTexture(type, url, options, manager);
    pr.finally(() => URL.revokeObjectURL(url));
    return pr;
}

export interface ModelLoader {
    name: string;
    description?: string;
    icon?: string;
    ext: string | string[];

    /**
     * JSON Schema descripting the options that this loader supports
     */
    optionSchema?: any;
    optionUiSchema?: any;

    load: (path: string, options: any, manager: LoadingManager) => Promise<Object3D>;
}

class ModelLoaderRegistry extends EventDispatcher {
    private _exts: Record<string, ModelLoader>;
    private _all: Map<string, ModelLoader>;

    constructor() {
        super();
        this._exts = {};
        this._all = new Map();
    }

    register(loader: ModelLoader): Disposable {
        if (Array.isArray(loader.ext)) {
            for (const ext of loader.ext) {
                this._exts[ext.toLowerCase()] = loader;
            }
        } else {
            this._exts[loader.ext.toLowerCase()] = loader;
        }

        this._all.set(loader.name, loader);

        this.dispatchEvent({
            type: 'registerLoader',
            value: loader
        });

        return {
            dispose: () => {
                if (Array.isArray(loader.ext)) {
                    for (const ext of loader.ext) {
                        delete this._exts[ext.toLowerCase()];
                    }
                } else {
                    delete this._exts[loader.ext.toLowerCase()];
                }

                this._all.delete(loader.name);

                this.dispatchEvent({
                    type: 'unregisterLoader',
                    value: loader
                });
            }
        };
    }

    getFromPath(_path: string, type?: string): ModelLoader | undefined {
        let ext = type ?? _path.split(/\./g).pop()!;
        ext = ext.toLowerCase();

        return this._exts[ext];
    }

    get(name: string) {
        return this._all.get(name);
    }

    all() {
        return Array.from(this._all.values());
    }
}


export const modelLoaderRegistry = new ModelLoaderRegistry();

function registerModelLoader(loader: ModelLoader) {
    return modelLoaderRegistry.register(loader);
}

function loadSingleModel(type: string | undefined, _path: string, options: Options = {}, manager = new SubLoadingManager()): Promise<Object3D> {
    // resolve the paths here so that they're resolved to the absolute location
    const hashPaths = Array.isArray(_path)
        ? _path.map(p => path.resolve(manager.resolveURL(p)))
        : path.resolve(manager.resolveURL(_path));

    const modelHash = hash(hashPaths, options);
    if (objectCache.has(modelHash)) {
        // add in itemStart and itemEnd calls here to emulate the
        // LoadingManager mechanisms
        manager.itemStart(_path);

        let res = objectCache.getClone(modelHash);
        if (!(res instanceof Promise)) {
            res = Promise.resolve(res);
        }

        res.catch(err => {
            console.error(err);
            manager.itemError(_path);
        }).finally(() => {
            manager.itemEnd(_path);
        });

        return res;
    } else {
        const loader = modelLoaderRegistry.getFromPath(_path, type);
        if (!loader) {
            throw new Error(`Model loader for "${_path}" not registered`);
        }

        // Use a separate manager to tracker loading progress of an individual model so
        // all subparts will have been loaded by the time the function has resolved.
        const pr = new Promise<Object3D>((resolve, reject) => {
            let result: Object3D | null = null;
            const subManager = new SubLoadingManager(manager, () => {
                // If there's no result we've errored out
                if (result !== null) {
                    // https://github.com/mrdoob/three.js/issues/21483
                    // shadows will not work for some graphics cards unless normals
                    // are explicitly sethttps://typescript-eslint.io/rules/no-unsafe-call
                    result.traverse((c: any) => {
                        if (c.isMesh) {
                            const geometry = c.geometry;

                            if (!geometry.hasAttribute('normal')) {
                                geometry.computeVertexNormals();

                                // material will be deduped later if possible
                                c.material = c.material.clone();
                                c.material.flatShading = true;
                            }

                            if (options.optimizeGeometry ?? true) {
                                optimizeGeometry(geometry);
                            } else {
                                // in some instances we may not want to optimize the geometry
                                // because it will reduce the precision of the some attributes
                                // such as the normals, which are important to keep at full
                                // precision if we want to visualize slope, for example.
                                console.log('not optimizing geometry for ' + _path);
                            }
                        }
                    });

                    result.name = path.basename(_path);

                    resolve(result);
                }
            });

            const textureExtensions = Object.keys(textureLoaders);
            const textureRegex = new RegExp(`(${textureExtensions.join('|')})$`);
            subManager.addHandler(textureRegex, new CachedTextureLoader(subManager, options));

            subManager.itemStart(_path);
            loader.load(_path, options, subManager)
                .then(async (model) => {
                    result = model;

                    if (options.receiveShadow) {
                        model.traverse(c => {
                            c.receiveShadow = true;
                        });
                    }

                    if (options.useOptimizedRaycast === undefined || options.useOptimizedRaycast) {
                        const filename = _path.split('/').pop();
                        const timeStart = performance.now();
                        let lastUpdate = performance.now();
                        // await subManager.itemProgress(`Computing bounds tree for ${filename}...`);
                        await model.traverse(async (c: any) => {
                            if (c.isMesh && !c.boundsTree) {

                                c.geometry.computeBoundsTree({
                                    onProgress : (v: number) => {
                                        const now = performance.now();
                                        if (now - lastUpdate > 5000) {
                                            lastUpdate = now;
                                            const perc = ( v * 100 ).toFixed( 0 );
                                            console.log(`${filename}: Computing bounds tree for fast raycasts: ${perc}%`);
                                        }
                            }
                        });
                            }
                        });

                        // await subManager.itemProgress(`${filename}: Loading2...`);

                        // only display stats if it takes over a second
                        if (performance.now() - timeStart > 1000) {
                            console.log(`${filename}: Took ${(performance.now() - timeStart)}ms to compute bounds tree`);
                        }
                    }

                    if (options.renderOrder) {
                        // we may want to render terrain meshes first, which helps especially
                        // for when we want to render StencilShape's
                        // see:
                        // - comment in honeycomb/modules/telemetry-primitives/src/wrappers/StencilShape.ts 
                        // - TERRAIN_RENDER_ORDER=-10 in mobsketch/packages/terrain-manager/src/TerrainManager.js
                        // - honeycomb/modules/honeycomb-extensions/src/drivers/ArksmlDriver.ts shows that currently
                        //   keep in zones have a renderOrder of -2 and keep out zones -1
                        // - mobsketch/packages/app/src/classes/KiozManager.js modifies this to -4 and -3, respectively
                        // - honeycomb/modules/honeycomb/src/scene.ts
                        result.renderOrder = options.renderOrder;
                    }
                })
                .catch(err => {
                    (subManager as any).itemError(_path, err);
                    reject(err);
                })
                .finally(() => {
                    subManager.itemEnd(_path);
                });
        });

        if (enableCache) {
            objectCache.add(modelHash, pr);
            return objectCache.getClone(modelHash) as Promise<Object3D>;
        }

        return pr;
    }
}

function _loadObject(object: SceneObject, manager: LoadingManager): Promise<Object3D | Object3D[]> {
    switch (object.type) {
        case SceneObjectType.model:
            return loadModel(object.model.type, object.model.path, object.model.options, manager);
        case SceneObjectType.frame:
            return Promise.resolve(new FrameObject());
        case SceneObjectType.annotation:
            throw new Error("Annotations cannot be loaded with loadObject");
    }
}

async function loadObject(object: SceneObject, manager: LoadingManager): Promise<Object3D> {
    let obj = await _loadObject(object, manager);

    if (Array.isArray(obj)) {
        const group = new Group();
        for (const obji of obj) {
            group.add(obji);
        }
        obj = group;
    }

    obj.name = object.name;
    return obj;
}

async function loadModel(type: string | undefined, _path: string, options: Record<string, any> | undefined, manager: LoadingManager): Promise<Object3D | Object3D[]> {
    if (Array.isArray(_path)) {
        return await Promise.all(_path.map(p => loadSingleModel(type, p, options, manager)));
    } else {
        return loadSingleModel(type, _path, options, manager);
    }
}

function parseModel(type: string | undefined, data: BlobPart, options: any, manager: LoadingManager): Promise<Object3D | Object3D[]> {
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const pr = loadModel(type, url, options, manager);
    pr.finally(() => URL.revokeObjectURL(url));
    return pr;
}

type TelemetryLoader<T extends StateBase> = (paths: string[], options: any, manager: LoadingManager) => Promise<TelemetryAnimator<T>>;
const telemetryLoaders: Record<string, TelemetryLoader<any>> = {};
function registerTelemetryAnimatorLoader<T extends StateBase>(type: string | string[], loadFn: TelemetryLoader<T>) {
    if (Array.isArray(type)) {
        type.forEach(e => registerTelemetryAnimatorLoader(e, loadFn));
    } else {
        type = type.toLowerCase();
        telemetryLoaders[type] = loadFn;
    }
}

function unregisterTelemetryAnimatorLoader(type: string) {
    if (Array.isArray(type)) {
        type.forEach(e => unregisterTelemetryAnimatorLoader(e));
    } else {
        type = type.toLowerCase();
        delete telemetryLoaders[type];
    }
}

function loadTelemetryAnimator(type: string, _path: string | string[], options = {}, manager = new SubLoadingManager()) {
    type = type.toLowerCase();

    const loader = telemetryLoaders[type];
    if (!loader) {
        throw new Error(`Telemetry type "${type}" not registered to load.`);
    }
    return loader(Array.isArray(_path) ? _path : [_path], options, manager);
}

function parseTelemetryAnimator(type: string, data: BlobPart, options = {}) {
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const pr = loadTelemetryAnimator(type, url, options);
    pr.finally(() => URL.revokeObjectURL(url));
    return pr;
}

type DriverLoader<T> = (options: Record<string, any>, manager: LoadingManager) => Promise<Driver<T>>;
const drivers: Record<string, DriverLoader<any>> = {};
function registerDriver<T>(type: string, cb: DriverLoader<T>) {
    type = type.toLowerCase();
    drivers[type] = cb;
}

function unregisterDriver(type: string) {
    type = type.toLowerCase();
    delete drivers[type];
}

async function createDriver(type: string, options: any, manager: LoadingManager) {
    type = type.toLowerCase();
    const driverInstance = drivers[type];
    if (driverInstance) {
        manager.itemStart(type);
        const instance = await driverInstance(options, manager);
        manager.itemEnd(type);
        return instance;
    } else {
        throw new Error(`Driver type "${type}" not registered to load.`);
    }
}

export {
    textureCache,
    objectCache,
    setCacheEnabled,
    registerTextureLoader,
    unregisterTextureLoader,
    loadTexture,
    parseTexture,
    registerModelLoader,
    loadObject,
    loadModel,
    parseModel,
    registerTelemetryAnimatorLoader,
    unregisterTelemetryAnimatorLoader,
    loadTelemetryAnimator,
    parseTelemetryAnimator,
    registerDriver,
    unregisterDriver,
    createDriver,
};
