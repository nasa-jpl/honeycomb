import {
    WebGLRenderer,
    Scene,
    Object3D,
    PerspectiveCamera,
    Clock,
    PCFSoftShadowMap,
    Vector2,
    LinearFilter,
    RGBAFormat,
    WebGLRenderTarget,
    EventDispatcher,
    OrthographicCamera,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { InfiniteGrid, FlyOrbitControls, GPUStatsPanel, GPUTimeSampler } from '@gov.nasa.jpl.honeycomb/three-extensions';
import { World } from './World';

const _ogAdd = Object3D.prototype.add;
const _ogRemove = Object3D.prototype.remove;
Object3D.prototype.add = function (...args) {
    const o = _ogAdd.apply(this, args);
    if (args.length === 1) {
        this.dispatchEvent({ type: 'childadded', child: args[0] });
    }

    return o;
};

Object3D.prototype.remove = function (...args) {
    const o = _ogRemove.apply(this, args);
    if (args.length === 1) {
        this.dispatchEvent({ type: 'childremoved', child: args[0] });
    }

    return o;
};

const tempSize = new Vector2();
interface ViewerOptions {
    antialias: boolean;
    logarithmicDepthBuffer: boolean;
    showStats: boolean;
    checkShaderErrors: boolean;
}

// Base 3D viewer that sets up a a basic scene and corrects for "up"
export class Viewer extends EventDispatcher<any> {
    private _enabled = true;
    renderer: WebGLRenderer;
    renderTarget: WebGLRenderTarget;
    scene: Scene;

    world: World;
    controls: FlyOrbitControls;

    grid: InfiniteGrid;
    perspectiveCamera: PerspectiveCamera;
    orthographicCamera: OrthographicCamera;

    _orthographic: boolean;
    _gpuTimeSampler: GPUTimeSampler;

    composer: EffectComposer;
    renderPass: RenderPass;
    gammaCorrectionPass: ShaderPass;
    clock: Clock;

    targetScale: number;
    internalTargetSize: Vector2;
    resolution: Vector2;

    stats!: Stats;
    gpuStats!: GPUStatsPanel;
    _renderHandle?: number;

    constructor(poptions?: Partial<ViewerOptions>) {
        super();

        const options: ViewerOptions = {
            antialias: false,
            logarithmicDepthBuffer: false,
            showStats: false,
            checkShaderErrors: false,
            ...poptions
        };

        if (options.showStats) {
            this.initStats();
        }

        this.enabled = true;

        // Set up world and lighting
        // Preserve drawing buffer is enabled so that the canvas data can be retrieved in tests
        // Logarithmic depth buffer disabled by default to enable orthographics camera view and
        // preserve performance because the setting relies on setting gl_fragDepth.
        // See honeycomb/Honeycomb#554 for details
        const renderer = new WebGLRenderer(options);
        renderer.debug.checkShaderErrors = options.checkShaderErrors;

        const scene = new Scene();
        const world = new World();
        const orthographicCamera = new OrthographicCamera();
        const perspectiveCamera = new PerspectiveCamera();

        const controls = new FlyOrbitControls(perspectiveCamera, renderer.domElement);
        controls.addEventListener('change', () => {
            orthographicCamera.position.copy(perspectiveCamera.position);
            orthographicCamera.rotation.copy(perspectiveCamera.rotation);
        });

        const clock = new Clock();
        const grid = new InfiniteGrid();

        // Renderer setup
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.outline = 'none';
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = PCFSoftShadowMap;
        renderer.setPixelRatio(window.devicePixelRatio);
        scene.add(world);

        // grid setup
        (grid.material as any).opacity = 0.5;
        grid.visible = false;
        scene.add(grid);

        const renderTarget = new WebGLRenderTarget(1, 1, {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
            stencilBuffer: true,
        });

        this.renderer = renderer;
        this.renderTarget = renderTarget;
        this.scene = scene;
        this.grid = grid;
        this.perspectiveCamera = perspectiveCamera;
        this.orthographicCamera = orthographicCamera;
        this.controls = controls;
        this.world = world;
        this._orthographic = false;
        this._gpuTimeSampler = new GPUTimeSampler(renderer.getContext() as WebGL2RenderingContext);

        this.clock = clock;

        // Camera setup
        perspectiveCamera.position.set(0, 0, 10);

        // Composer setup
        const composer = new EffectComposer(renderer, renderTarget);
        const renderPass = new RenderPass(scene, perspectiveCamera);
        composer.addPass(renderPass);

        const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader);
        composer.addPass(gammaCorrectionPass);

        this.composer = composer;
        this.renderPass = renderPass;
        this.gammaCorrectionPass = gammaCorrectionPass;
        this.targetScale = 1.0;
        this.internalTargetSize = new Vector2(0, 0);
        this.resolution = new Vector2(0, 0);

        // Initialize child tracking events to track when objects are added to
        // and removed from the scene.
        const addChildCb = (e: { child?: Scene }) => {
            const child = e.child;
            child?.traverse(c => {
                c.addEventListener('childadded', addChildCb as any);
                c.addEventListener('childremoved', removeChildCb as any);
            });

            child?.traverse(c => {
                this.dispatchEvent({ type: 'added', child: c });
            });
        };

        const removeChildCb = (e: { child?: Scene }) => {
            const child = e.child;
            child?.traverse(c => {
                c.removeEventListener('childadded', addChildCb as any);
                c.removeEventListener('childremoved', removeChildCb as any);
            });

            child?.traverse(c => {
                this.dispatchEvent({ type: 'removed', child: c });
            });
        };

        addChildCb({ child: scene });
    }

    get domElement(): HTMLElement {
        return this.renderer.domElement;
    }

    get enabled() {
        return this._enabled;
    }
    set enabled(v) {
        if (v !== this._enabled) {
            this._enabled = v;
            this.enableChanged(v);

            this.dispatchEvent({ type: v ? 'enabled' : 'disabled' });
        }
    }

    get gridVisibility() {
        return this.grid.visible;
    }
    set gridVisibility(value) {
        this.grid.visible = value;
    }

    get orthographic() {
        return this._orthographic;
    }
    set orthographic(v) {
        if (this._orthographic !== v) {
            this.syncCameras();
            this._orthographic = v;
        }
    }

    /* Public Functions */
    setSize(w: number, h: number) {
        // WebGL throws errors if render targets are set to 0 size
        if (w <= 0) { w = 1; }
        if (h <= 0) { h = 1; }

        const camera = this.perspectiveCamera;
        const renderer = this.renderer;
        const composer = this.composer;

        camera.aspect = w / h;
        camera.updateProjectionMatrix();

        // The renderer accounts for the pixel ratio internally and
        // scales the canvas appropriately
        renderer.setSize(w, h);

        // Scale the internal render targets to match the pixel ratio size
        const tw = Math.min(
            w * renderer.getPixelRatio() * this.targetScale,
            renderer.capabilities.maxTextureSize,
        );
        const th = Math.min(
            h * renderer.getPixelRatio() * this.targetScale,
            renderer.capabilities.maxTextureSize,
        );
        composer.setSize(tw, th);

        // cache the resolutions of the targets
        this.internalTargetSize.set(tw, th);
        this.resolution.set(w, h);
    }

    setTargetScale(scale: number) {
        this.renderer.getSize(tempSize);
        this.targetScale = scale;
        this.setSize(tempSize.width, tempSize.height);
    }

    setPixelRatio(ratio: number) {
        this.renderer.setPixelRatio(ratio);
        this.renderer.getSize(tempSize);
        this.setSize(tempSize.width, tempSize.height);
    }

    initStats() {
        if (this.stats) { return; }

        const gpuTimeSampler = this._gpuTimeSampler;
        const stats = new Stats();
        const gpuStats = new GPUStatsPanel(this.renderer.getContext() as WebGL2RenderingContext);
        stats.addPanel(gpuStats);
        stats.showPanel(3);

        gpuTimeSampler.addEventListener('query-complete', e => {
            gpuStats.update((e as any).time, gpuStats.maxTime);
        });

        document.body.appendChild(stats.dom);

        this.stats = stats;
        this.gpuStats = gpuStats;
    }

    getCamera() {
        return this.orthographic ? this.orthographicCamera : this.perspectiveCamera;
    }

    dispose() {
        this.renderer.dispose();
    }

    /* Private Functions */
    renderLoop() {
        this.render();

        if (this.enabled) {
            this._renderHandle = requestAnimationFrame(() => this.renderLoop());
        } else {
            this._renderHandle = undefined;
        }
    }

    render() {
        const composer = this.composer;
        const passes = composer.passes;
        const renderPass = this.renderPass;
        const clock = this.clock;
        const scene = this.scene;
        const camera = this.getCamera();
        const delta = clock.getDelta();
        const gammaCorrectionPass = this.gammaCorrectionPass;
        const stats = this.stats;
        const gpuTimeSampler = this._gpuTimeSampler;

        if (stats) {
            stats.update();
        }

        if (this.orthographic) {
            this.syncCameras();
        }

        // make sure the gamma correction pass is last
        if (passes[passes.length - 1] !== gammaCorrectionPass) {
            const index = passes.indexOf(gammaCorrectionPass);
            passes.splice(index, 1);
            passes.push(gammaCorrectionPass);
        }

        // ensure the last pass renders to the screen
        composer.passes.forEach(p => (p.renderToScreen = false));
        for (let i = composer.passes.length - 1; i >= 0; i--) {
            if (composer.passes[i].enabled === true) {
                composer.passes[i].renderToScreen = true;
                break;
            }
        }

        renderPass.camera = camera;
        renderPass.scene = scene;

        camera.updateMatrixWorld();

        this.dispatchEvent({ type: 'before-render', delta });
        this.beforeRender(delta);
        gpuTimeSampler.startQuery();
        composer.render(delta);
        gpuTimeSampler.endQuery();
        this.afterRender();
        this.dispatchEvent({ type: 'after-render' });
    }

    syncCameras() {
        const perspectiveCamera = this.perspectiveCamera;
        const orthographicCamera = this.orthographicCamera;

        // sync positions
        if (this.orthographic) {
            perspectiveCamera.position.copy(orthographicCamera.position);
            perspectiveCamera.rotation.copy(orthographicCamera.rotation);
        } else {
            orthographicCamera.position.copy(perspectiveCamera.position);
            orthographicCamera.rotation.copy(perspectiveCamera.rotation);
        }

        // sync aspect
        // TODO: see if we can use orthographicCamera.zoom to handle this
        const aspect = perspectiveCamera.aspect;
        const scaleFactor = perspectiveCamera.position.distanceTo(this.controls.target);
        orthographicCamera.left = (-scaleFactor * aspect) / 2;
        orthographicCamera.right = (scaleFactor * aspect) / 2;
        orthographicCamera.top = scaleFactor / 2;
        orthographicCamera.bottom = -scaleFactor / 2;

        // sync near and far planes
        if (this.orthographic) {
            // TODO: Is this the right thing to do? There may be different desires for the orthographic
            // camera near and far values.
            perspectiveCamera.far = orthographicCamera.far;
            perspectiveCamera.near = orthographicCamera.near;
            perspectiveCamera.updateProjectionMatrix();
        } else {
            // TODO: Is this the right thing to do? There may be different desires for the orthographic
            // camera near and far values.
            orthographicCamera.far = perspectiveCamera.far;
            orthographicCamera.near = perspectiveCamera.near;
        }

        // always update the ortho projection matrix because zoom may have changed
        orthographicCamera.updateProjectionMatrix();
    }

    /* Override-able Interface */
    beforeRender(_delta: number) { }

    afterRender() { }

    enableChanged(enabled: boolean) {
        // begin the render loop again
        if (enabled && !this._renderHandle) {
            this._renderHandle = requestAnimationFrame(() => this.renderLoop());
        }
    }
}
