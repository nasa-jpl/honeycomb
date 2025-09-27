import { Driver, LoadingManager } from '@gov.nasa.jpl.honeycomb/core';
import { type CameraDefinition, CameraLoader } from '@gov.nasa.jpl.honeycomb/camera-loader';
import {
    getLinearFrustumInfo,
    CahvoreDistortionMaterial,
    frameBoundsToProjectionMatrix,
    type LinearFrustumInfo
} from '@gov.nasa.jpl.honeycomb/cahvore-utilities';
import {
    FrustumAnnotation,
    LineAnnotation,
    LinearFrustumAnnotation,
    StampShape,
} from '@gov.nasa.jpl.honeycomb/telemetry-primitives';
import { FrameTransformer } from '@gov.nasa.jpl.honeycomb/frame-transformer';
import { DisposableEventListeners } from '@gov.nasa.jpl.honeycomb/three-extensions';
import {
    Vector3,
    Group,
    PerspectiveCamera,
    Vector2,
    WebGLRenderTarget,
    RGBAFormat,
    Mesh,
    MeshBasicMaterial,
    SRGBColorSpace,
    Matrix4,
    PlaneGeometry,
    Material,
} from 'three';

import { Shaders, ExtendedShaderMaterial } from '@gov.nasa.jpl.honeycomb/mixin-shaders';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { type URDFRobot } from 'urdf-loader';

// function getProjectedRatio(minFoV: number, maxFoV: number): number {
//     const minProjected = Math.tan(minFoV / 2.0);
//     const maxProjected = Math.tan(maxFoV / 2.0);
//     return maxProjected / minProjected;
// }

const tmpMatrix = new Matrix4();

interface CameraDisplayOptions {
    cameraModels: string; // path to the camera model definitions
    robot: string;
    far?: number;
    near?: number;
}

export enum DisplayMode {
    distorted = 'distorted',
    linearMin = 'linear-min',
    linearMax = 'linear-max',
    grid = 'grid'
}

export class CameraDisplayDriver extends Driver<object> {
    type = 'CameraDisplayDriver';

    private listeners: DisposableEventListeners;
    private _disposed: boolean;

    private frustumGroup: Group;
    private _renderPlane!: Mesh;
    private camera: PerspectiveCamera;
    private _displayMode: DisplayMode;
    private fsQuad!: FullScreenQuad;

    private _tagFunction?: (b: boolean) => void;

    private _distortedRenderTarget!: WebGLRenderTarget;
    private _linearRenderTarget!: WebGLRenderTarget;
    private activeModel!: string;

    private frustumInfo: Record<string, {
        group: Group,
        model: CameraDefinition,
        info: LinearFrustumInfo;
        validFrame: boolean;
    }>;



    constructor(readonly options: Partial<CameraDisplayOptions>, manager: LoadingManager) {

        super(manager, options);
        this.type = 'CameraDisplayDriver';
        this.frustumGroup = new Group();
        this.frustumInfo = {};
        this.camera = new PerspectiveCamera();
        this.listeners = new DisposableEventListeners();
        this._disposed = false;
        this._displayMode = DisplayMode.distorted;
    }

    initialize() {
        const { options, manager, camera } = this;
        const viewer = this.viewer!;

        const {
            cameraModels,
            far = 10.0,
            near = 0.085,
        } = options;

        if (!cameraModels) {
            throw new Error('CameraDisplayDriver: No camera models file provided.');
        }

        viewer.world.add(this.frustumGroup);
        this.frustumInfo = {};

        const loader = new CameraLoader();
        loader.load(manager.resolveURL(cameraModels)).then(models => {
            if (this._disposed) {
                return;
            }

            let cameraRenderOrder = 1;
            for (const name in models) {
                const cameraModel = {
                    ...models[name],
                    nearDist: near,
                    farDist: far,
                };
                cameraModel.C = cameraModel.C_LOCAL || cameraModel.C;

                // The rotation of the linear frustum does not seem _perfectly_ aligned
                // with the distorted frustum (see max linear fov corner lines vs distorted).
                // Presumably the V and H vectors are not perfectly perpendicular.

                const group = new Group();
                const info = getLinearFrustumInfo(cameraModel);
                let frustum, lines;

                // min frustum
                frustum = new LinearFrustumAnnotation();
                frameBoundsToProjectionMatrix(info.minFrameBounds, 1, 20, tmpMatrix);
                frustum.setFromProjectionMatrix(tmpMatrix, info.frame, near, far);

                lines = new LineAnnotation();
                lines.setFromGeometry(frustum.geometry, 1);
                lines.lineWidth = 1;
                viewer.tags.addTag(lines, ['linear', 'frustum', 'min', name, this.id!]);
                lines.visible = false;
                group.add(lines);

                // max frustum
                frustum = new LinearFrustumAnnotation();
                frameBoundsToProjectionMatrix(info.maxFrameBounds, 1, 20, tmpMatrix);
                frustum.setFromProjectionMatrix(tmpMatrix, info.frame, near, far);

                lines = new LineAnnotation();
                lines.setFromGeometry(frustum.geometry, 1);
                lines.lineWidth = 1;
                viewer.tags.addTag(lines, ['linear', 'frustum', 'max', name, this.id!]);
                lines.visible = false;
                group.add(lines);

                // distorted frame
                frustum = new FrustumAnnotation();
                frustum.setParameters(cameraModel);

                lines = new LineAnnotation();
                lines.setFromGeometry(frustum.geometry, 55);
                lines.lineWidth = 1;
                group.add(lines);
                viewer.tags.addTag(lines, ['frustum', 'distorted', cameraModel.type.toLowerCase(), name, this.id!]);

                // distorted stamp
                const frustumStamp = new StampShape(
                    new FrustumAnnotation(
                        new MeshBasicMaterial({
                            color: 0xffffff,
                            opacity: 0.1,
                        }),
                    ),
                );
                frustumStamp.shape.setParameters(cameraModel);
                frustumStamp.setRenderOrder(cameraRenderOrder + 1);
                cameraRenderOrder++;
                viewer.tags.addTag(frustumStamp, ['frustum', 'distorted', 'stamp', cameraModel.type.toLowerCase(), name, this.id!]);
                group.add(frustumStamp);

                this.frustumGroup.add(group);
                this.frustumInfo[name] = { group, model: cameraModel, info, validFrame: false };
            }

            // force the frustum positions to update once they're loaded
            this.update();
        });

        let enabled = true;
        this._tagFunction = function (value: boolean) {
            enabled = value;
        };
        viewer.tags.addTag(this._tagFunction as any, ['frustum-pip', this.id!]);

        const distortedRenderTarget = new WebGLRenderTarget(1, 1, {
            format: RGBAFormat,
        });
        this._distortedRenderTarget = distortedRenderTarget;

        const linearRenderTarget = new WebGLRenderTarget(1, 1, {
            format: RGBAFormat,
            colorSpace: SRGBColorSpace,
            stencilBuffer: true,
        });
        this._linearRenderTarget = linearRenderTarget;

        const fsQuad = new FullScreenQuad(
            new CahvoreDistortionMaterial(),
        );
        this.fsQuad = fsQuad;

        const renderPlane = new Mesh(
            new PlaneGeometry(),
            new ExtendedShaderMaterial(Shaders.ScreenPlaneShader, {
                tex: distortedRenderTarget.texture,
                depthTest: false,
                depthWrite: false,
            }),
        );
        renderPlane.renderOrder = 1000;
        renderPlane.frustumCulled = false;
        this._renderPlane = renderPlane;

        const tempVec3 = new Vector3();
        const fullSize = new Vector2();
        const previewSize = new Vector2();
        this.listeners.addEventListener(viewer, 'after-render', () => {
            const { scene, renderer } = viewer;

            const model = this.frustumInfo[this.activeModel];
            if (!model || !enabled || !model.validFrame) {
                return;
            }

            const { maxFrameBounds, minFrameBounds, frame } = model.info;

            // get projection display settings to use
            let passthroughValue = false;
            let gridValue = false;
            let frameBounds;

            switch (this._displayMode) {
                case DisplayMode.distorted:
                    frameBounds = maxFrameBounds;
                    break;
                case DisplayMode.linearMin:
                    passthroughValue = true;
                    frameBounds = minFrameBounds;
                    break;
                case DisplayMode.linearMax:
                    passthroughValue = true;
                    frameBounds = maxFrameBounds;
                    break;
                case DisplayMode.grid:
                    gridValue = true;
                    frameBounds = maxFrameBounds;
                    break;
            }

            // update the camera transform
            model.group.updateMatrixWorld(true);
            camera.matrixWorld
                .copy(frame)
                .premultiply(model.group.matrixWorld);
            camera.matrixWorld.decompose(
                camera.position,
                camera.quaternion,
                camera.scale,
            );

            const viewerFar = viewer.getCamera().far;
            frameBoundsToProjectionMatrix(frameBounds, near, viewerFar, camera.projectionMatrix);
            camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

            // update CSM for our preview camera
            // TODO: should this be abstracted somehow?
            const csm: CSM | undefined = (viewer as any).csm;
            if (csm) {
                tempVec3.copy(csm.lightDirection);
                csm.lightDirection.applyMatrix4(viewer.world.matrixWorld);
                csm.camera = camera;
                csm.updateFrustums();
                csm.update();
                csm.lightDirection.copy(tempVec3);
            }

            // get renderer values
            const ogRenderTarget = renderer.getRenderTarget();
            renderer.getSize(fullSize);

            // prep preview dimensions
            const sensorAspect = model.model.width / model.model.height;
            const height = Math.min(fullSize.height * 0.5, (fullSize.width * 1) / sensorAspect);
            previewSize.width = Math.floor(height * sensorAspect);
            previewSize.height = Math.floor(height);

            // hide the frustum lines
            const prevVisible = model.group.visible;
            model.group.visible = false;

            // render the frustum view
            // increase the pixel ratio by the amount that the minimum frustum will be
            // stretched by during distortion
            const pixelRatio = renderer.getPixelRatio();
            const maxScaleRatio = Math.min(Math.max(
                Math.abs(
                    (maxFrameBounds.top - maxFrameBounds.bottom) / (minFrameBounds.top - minFrameBounds.bottom)
                ),
                Math.abs(
                    (maxFrameBounds.right - maxFrameBounds.left) / (minFrameBounds.right - maxFrameBounds.left)
                ),
            ), 3);

            // render the frustum view
            linearRenderTarget.setSize(
                Math.floor(maxScaleRatio * pixelRatio * previewSize.width),
                Math.floor(maxScaleRatio * pixelRatio * previewSize.height),
            );
            renderer.setRenderTarget(linearRenderTarget);
            renderer.render(scene, camera);

            // distort
            const distortMaterial = this.fsQuad.material as CahvoreDistortionMaterial;
            distortedRenderTarget.setSize(
                Math.floor(pixelRatio * previewSize.width),
                Math.floor(pixelRatio * previewSize.height),
            );
            renderer.setRenderTarget(distortedRenderTarget);
            distortMaterial.setFromCameraModel(model.model);
            distortMaterial.tex = linearRenderTarget.texture;
            if (passthroughValue !== Boolean(distortMaterial.defines.PASSTHROUGH)) {
                distortMaterial.defines.PASSTHROUGH = Number(passthroughValue);
                distortMaterial.needsUpdate = true;
            }

            if (gridValue !== Boolean(distortMaterial.defines.DISPLAY_GRID)) {
                distortMaterial.defines.DISPLAY_GRID = Number(gridValue);
                distortMaterial.needsUpdate = true;
            }
            fsQuad.render(renderer);

            // prep plane
            renderPlane.material.uniforms.screenPosition.value.set(
                10 / fullSize.x,
                10 / fullSize.y,
                previewSize.x / fullSize.x,
                previewSize.y / fullSize.y,
            );

            // reset renderer
            renderer.setRenderTarget(ogRenderTarget);
            model.group.visible = prevVisible;

            const ogAutoClear = renderer.autoClear;
            const ogEncoding = renderer.outputColorSpace;
            renderer.autoClear = false;
            renderer.outputColorSpace = SRGBColorSpace;
            renderer.render(renderPlane, camera);
            renderer.autoClear = ogAutoClear;
            renderer.outputColorSpace = ogEncoding;
        });
    }

    update() {
        const { options, frustumInfo } = this;
        const viewer = this.viewer!;
        const robot = viewer.objects[options.robot!] as URDFRobot;

        if (robot && robot.isURDFRobot) {
            for (const name in frustumInfo) {
                const info = frustumInfo[name];
                const { group, model } = info;
                const frameName = model.frameName;

                const frame = robot.frames[frameName];
                if (frame) {
                    group.position.set(0, 0, 0);
                    group.quaternion.set(0, 0, 0, 1);

                    FrameTransformer.transformPoint(
                        frame.matrixWorld,
                        viewer.world.matrixWorld,
                        group.position,
                        group.position,
                    );

                    FrameTransformer.transformQuaternion(
                        frame.matrixWorld,
                        viewer.world.matrixWorld,
                        group.quaternion,
                        group.quaternion,
                    );
                    info.validFrame = true;

                    const reparentFrame = model.reparentFrameName ? robot.frames[model.reparentFrameName] : undefined;
                    if (reparentFrame) {
                        console.log('Attaching camera frustum ' + name + ' to ' + reparentFrame.name);
                        reparentFrame.attach(group);
                    }
                } else {
                    group.visible = false;
                    info.validFrame = false;
                }
            }
        }
    }

    setActiveModel(name: string, displayMode: DisplayMode = DisplayMode.distorted) {
        this.activeModel = name;
        for (const name in this.frustumInfo) {
            const { group, validFrame } = this.frustumInfo[name];
            group.visible = name === this.activeModel && validFrame;
            this.update();
        }
        this._displayMode = displayMode;
        this.viewer!.dirty = true;
    }

    dispose() {
        this._disposed = true;

        this.frustumGroup.traverse((c: any) => {
            if (c.material) {
                c.material.dispose();
                c.geometry.dispose();
            }
        });

        this.listeners.dispose();
        this.viewer!.tags.removeObject(this._tagFunction as any);
        this._renderPlane.geometry.dispose();
        (this._renderPlane.material as Material).dispose();
        this._distortedRenderTarget.dispose();
        this._linearRenderTarget.dispose();
    }
}
