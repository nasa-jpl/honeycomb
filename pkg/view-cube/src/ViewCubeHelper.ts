import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

import CubeModelUrl from './models/ViewCube_LowPoly_AdjustedUVmap.fbx';
import WireCubeUrl from './models/ViewCubeWireframe.fbx';
import HoverTextureUrl from './models/ViewCube_Textures_Hover_Grey70_2_2X-y-up.png';

/* eslint-disable */
const AXES_LENGTH = 215;
const tempVec = new THREE.Vector3();

export enum OrientationLerpType {
    SLERP = 'slerp',
    LOOKAT = 'lookat',
    LERP = 'lerp'
}

export enum RollButtonType {
    ALWAYS_ON = 'always_on', // always available (careful, doesn't immediately work with OrbitControls)
    ALWAYS_OFF = 'always_off', // hide always
    SHOW_DISABLED = 'show_disabled', // show but as disabled
    ONLY_AT_FACES = 'only_at_faces', // show disabled when not at a face
    ONLY_AT_TOP_OR_BOTTOM_FACES = 'only_at_top_or_bottom_faces' // show disabled when not at top/bottom faces
}

const VIEW_CUBE_CANVAS_WIDTH = 135;
const VIEW_CUBE_CANVAS_HEIGHT = 135;

const VIEW_CUBE_CAMERA_DISTANCE_OFFSET = -500;

function vec3to2(v: THREE.Vector3): THREE.Vector2 {
    return new THREE.Vector2(v.x, v.y);
}

/**
 * Class that renders a 3d cube for camera control manipulation.
 */
export default class ViewCubeHelper {
    // Original design led by Christiahn Roman <christiahn.roman@jpl.nasa.gov>
    // Original implementation led by Benjamin Nuernberger <benjamin.nuernberger@jpl.nasa.gov>
    // Made originally for ProtoSpace at JPL.

    // Note 1: if the view cube is positioned absolutely on top of another canvas
    // (whose dom element is called mainViewDomElement) and if that canvas needs
    // to receive mouse events as well, one can use the following to make
    // sure the mouse events are passed to that other canvas:
    //
    //   const viewCubeHelper = new ViewCubeHelper(...);
    //   viewCubeHelper.domElement.addEventListener('mouseup', e => {
    //     if (viewCubeHelper.hitFace) {
    //       // do nothing
    //     } else {
    //       mainViewDomElement.dispatchEvent(new MouseEvent(e.type, e));
    //     }
    //   }
    //
    // See also:
    // https://stackoverflow.com/questions/11974262/how-to-clone-or-re-dispatch-dom-events

    // Note 2: ViewCubeHelper currently lerps position and rotation of the camera.
    // This works for perspective cameras, but not for orthographic cameras. Handling
    // for orthographic cameras can be achieved via the callback functions onLerpStart(),
    // onLerping(), and onLerpFinished().

    /**
   * The camera to mirror the angle of and control the transformation of.
   * @member {Camera}
   */
    camera: THREE.Camera;

    /**
     * The dom element that the view cube is rendered to.
     * @member {Canvas}
     */
    domElement: HTMLElement;
    xDomElement: HTMLElement;
    yDomElement!: HTMLElement;
    zDomElement!: HTMLElement;

    // callbacks
    /**
     * Called before initializing the lerp (before recording start/end poses)
     * supplies one boolean parameter: atTopOrBottomFace
     * @member {ViewCubeHelper~onLerpInitializeCallback}
     * @default null
     */
    onLerpInitialize?: (atTopOrBottomFace: boolean) => void;

    /**
     * Called after initializing the lerp (after recording start/end poses)
     * supplies no parameters
     * @member {ViewCubeHelper~voidCallback}
     * @default null
     */
    onLerpStart?: () => void;

    /**
     * Called each frame after we've done some lerping
     * supplies one parameter: the lerp factor (between 0 to 1)
     * @member {ViewCubeHelper~onLerpCallback}
     * @default null
     */
    onLerping?: (lerpFactor: number) => void;

    /**
     * Called after all lerping is finished
     * supplies no parameters
     * @member {ViewCubeHelper~voidCallback}
     * @default null
     */
    onLerpFinished?: () => void;

    /**
     * Function that can be used for applications to manually specify the orbit distance to use.
     * it's useful for if the camera is panning and we need to maintain a certain orbit distance
     * even though the actual distance to this.orbitCenter may be large/small due to panning.
     * @member {ViewCubeHelper~getOrbitDistanceCallback}
     * @default null
     */
    getOrbitDistance?: () => number;

    // application code can check this value to disable camera manipulation during lerps
    lerping: boolean = false;

    // by default, we orbit around the origin
    // TODO: organize this so that application code doesn't know about previousOrbitCenter
    orbitCenter: THREE.Vector3;
    private previousOrbitCenter: THREE.Vector3;

    // if true, we won't move the camera to this.defaultCameraDistance on each face click;
    // rather, we'll maintain the user's specified distance to the orbit center
    maintainDistanceToOrbitCenter: boolean = true;

    // if this.maintainDistanceToOrbitCenter === false, clicking on a face will
    // move the camera to this.defaultCameraDistance.
    // The default distance is really application dependent.
    defaultCameraDistance: number = 3.0;

    // if true, we'll never let lerping bring the camera below the default camera
    // distance to this.orbitCenter (given by this.defaultCameraDistance).
    enforceMinimumCameraDistance: boolean = true;

    // the type of lerping that should be applied to the camera's orientation
    // see notes in doLerp() for more details on lerp types
    orientationLerpType: OrientationLerpType = OrientationLerpType.LOOKAT;

    // set via setRollButtonType(), do not set directly
    rollButtonType: RollButtonType = RollButtonType.ONLY_AT_TOP_OR_BOTTOM_FACES;

    // these variables are for workarounds in the various orientation lerp types.
    private tempUseSlerp = false;
    private tempLerpUp = false;
    private tempDirectlyLerpPosition = false;

    // Some camera controls (e.g., OrbitControls) maintain a certain up
    // vector, whereas others (e.g., TrackballControls) actually modify
    // the up vector during interaction. this.resetCameraUpOnLerpFinished
    // can be used to facilitate whichever type of up-vector modification
    // is necessary.
    // set to true for OrbitControls
    // set to false for TrackballControls
    resetCameraUpOnLerpFinished = true;

    // UX optimization: in some instances, for ORIENTATION_LERP_TYPE.LOOKAT,
    // if we lerp the up-vector, there'll be some small swaying of the up
    // direction (e.g., the up-axis, if showing axes). Thus, we choose to only
    // temporarily lerp up in certain situations. However, it's easier to
    // always lerp-up for other camera controls (e.g., TrackballControls).
    // See also this.tempLerpUp.
    // set to false for OrbitControls
    // set to true for TrackballControls
    alwaysLerpUp = false;

    // for ViewCubeHelper.ORIENTATION_LERP_TYPE.LERP, we'll temporarily switch
    // to using slerps if the change in up-direction exceeds this.tempSlerpDegreeThreshold.
    //this.tempSlerpDegreeThreshold = 90; // use 29.0 if you want to slerp between bevel edges

    // how long the lerp should last
    lerpTime = 1000.0; // 1.0 seconds

    // true if the user clicked on a face and subsequently only zoomed in/out or rolled the camera
    atFace = false;

    atTopOrBottomFace = false; // same as atFace but just for top or bottom faces
    onlyLerpingRoll = false; // true if we're only lerping camera roll (via the roll button)

    debug = false;

    private _viewCubeRenderer: THREE.WebGLRenderer;
    private viewCubeCamera: THREE.OrthographicCamera;
    private viewCubeScene: THREE.Scene;

    private lerpCameraUp: THREE.Vector3;
    private lerpCameraBackward: THREE.Vector3;
    private lerpMatrixWorld: THREE.Matrix4;
    lerpCenter: THREE.Vector3;
    private lerpQuaternion: THREE.Quaternion;

    private viewCubeRaycaster: THREE.Raycaster;
    private viewCubeMouse: THREE.Vector2;
    private viewCubeMouseNDC: THREE.Vector2;

    private viewCubeRoot: THREE.Group;
    private viewCubeMat!: THREE.MeshPhongMaterial;
    private viewCube!: THREE.Mesh;

    private viewCubeMatVertexColors!: THREE.MeshBasicMaterial;
    private defaultColor!: THREE.Color;
    private viewCubeWireframe!: THREE.Object3D;
    private viewCubeWireframeMat!: THREE.MeshPhongMaterial;
    private viewCubeWireframeRoot!: THREE.Object3D;

    private viewCubeNeedToCastRay: boolean;
    private viewCubeIntersects: THREE.Intersection[] = [];
    private lastFaceIntersect?: THREE.Face | null;

    private viewCubeMouseDownPos!: THREE.Vector2;
    hitFace!: boolean;

    private startLerpDistance: number = 0;
    private cameraStartPosition!: THREE.Vector3;
    private cameraStartQuaternion!: THREE.Quaternion;
    private cameraStartUp!: THREE.Vector3;
    private cameraStartBackward!: THREE.Vector3;
    private cameraEndPosition!: THREE.Vector3;
    private cameraEndQuaternion!: THREE.Quaternion;
    private cameraEndUp!: THREE.Vector3;
    private cameraEndBackward!: THREE.Vector3;

    private lerpingToTopOrBottomFace: boolean = false;
    private finishedLerpOnThisFrame: boolean = false;
    private cameraStartLerpTime?: number;

    private rollButtonRect!: SVGRectElement;
    private svg!: SVGSVGElement;
    private path1!: SVGPathElement;
    private path2!: SVGPathElement;

    private rollButtonDisabled?: boolean;

    private tooltip!: HTMLElement;
    private svgEnabledAndHoveredOver!: boolean;
    private svgMouseEnterWhileLerping!: boolean;

    private axes!: THREE.AxesHelper;
    private axesGroup!: THREE.Group;
    private x!: THREE.Vector3;
    private y!: THREE.Vector3;
    private z!: THREE.Vector3;
    private x2D!: THREE.Vector3;
    private y2D!: THREE.Vector3;
    private z2D!: THREE.Vector3;

    private svgMouseDownPos: THREE.Vector2 = new THREE.Vector2(0, 0);
    private readonly rollDisabledMsg = {
        [RollButtonType.ALWAYS_ON]: '',
        [RollButtonType.ALWAYS_OFF]: 'Disabled',
        [RollButtonType.SHOW_DISABLED]: 'Disabled',
        [RollButtonType.ONLY_AT_FACES]: 'Click on Face to enable 90º roll button',
        [RollButtonType.ONLY_AT_TOP_OR_BOTTOM_FACES]: 'Click on Top or Bottom face to enable 90º roll button',
    };

    /**
     * @param {Camera} camera
     */
    constructor(camera: THREE.Camera) {
        this.camera = camera;

        this.orbitCenter = new THREE.Vector3();
        this.previousOrbitCenter = new THREE.Vector3();

        this.domElement = document.createElement('div');
        this.domElement.style.display = "inherit";

        this._viewCubeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this._viewCubeRenderer.setSize(VIEW_CUBE_CANVAS_WIDTH, VIEW_CUBE_CANVAS_HEIGHT);
        this._viewCubeRenderer.setClearColor(0x000000, 0);
        this._viewCubeRenderer.setPixelRatio(window.devicePixelRatio);
        this.domElement.appendChild(this._viewCubeRenderer.domElement);

        this.viewCubeScene = new THREE.Scene();

        // camera
        this.viewCubeCamera = new THREE.OrthographicCamera(
            -1.5 * VIEW_CUBE_CANVAS_WIDTH, 1.5 * VIEW_CUBE_CANVAS_WIDTH,
            1.5 * VIEW_CUBE_CANVAS_HEIGHT, -1.5 * VIEW_CUBE_CANVAS_HEIGHT, 1, 2000
        );

        this.xDomElement = document.createElement('div');
        this.setupAxes();

        this.setupRollButton();

        this.viewCubeScene.add(new THREE.AmbientLight(0xFFFFFF));

        // fields for render loop
        this.lerpCameraUp = new THREE.Vector3();
        this.lerpCameraBackward = new THREE.Vector3();
        //this.lerpCameraRight = new THREE.Vector3();
        this.lerpMatrixWorld = new THREE.Matrix4();
        this.lerpCenter = new THREE.Vector3();
        this.lerpQuaternion = new THREE.Quaternion();

        // fields for mouse events
        this.viewCubeRaycaster = new THREE.Raycaster();
        this.viewCubeMouse = new THREE.Vector2();
        this.viewCubeMouseNDC = new THREE.Vector2();

        const loader = new FBXLoader();

        const recursiveAssignMaterial = (mat: any, node: any) => {
            if (node.geometry) node.material = mat;
            node.children.forEach((child: any) => recursiveAssignMaterial(mat, child));
        }

        // TODO: maybe this cube could be procedurally generated at runtime?
        this.viewCubeRoot = new THREE.Group();
        this.viewCubeScene.add(this.viewCubeRoot);
        loader.load(CubeModelUrl, model => {
            this.viewCube = model.children[0] as THREE.Mesh;
            this.viewCubeMat = new THREE.MeshPhongMaterial({ flatShading: true });
            recursiveAssignMaterial(this.viewCubeMat, model);

            // TODO: scale cube or texture to get nicer looking text?
            const texture = new THREE.TextureLoader().load(HoverTextureUrl);

            // https://github.com/mrdoob/three.js/blob/master/examples/webgl_geometry_colors.html
            this.viewCubeMatVertexColors = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                vertexColors: true,
                map: texture
            });
            this.viewCube.material = this.viewCubeMatVertexColors;
            const geometry = this.viewCube.geometry;
            const count = geometry.attributes.position.count;
            // TODO: the white text from the texture isn't fully white all the time...
            this.defaultColor = new THREE.Color(0xA1ADB3); // this value multiplied by the texture color 0x494E50 gives the default color 0x2E3538 (from figma design)
            geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
            for (let i = 0; i < count; i++) {
                (geometry.attributes.color as any).setXYZ(i, this.defaultColor.r, this.defaultColor.g, this.defaultColor.b);
            }

            this.viewCubeRoot.add(model);

            this.setupMouseEvents();
            this.setupRenderLoop();
        });

        // we use a separate wireframe model so that raycasts aren't able to hit the wireframe
        loader.load(WireCubeUrl, model => {
            this.viewCubeWireframe = model;
            this.viewCubeWireframeMat = new THREE.MeshPhongMaterial({ flatShading: true, color: 0x66696B }); // per figma design
            recursiveAssignMaterial(this.viewCubeWireframeMat, this.viewCubeWireframe);
            this.viewCubeWireframeRoot = new THREE.Object3D();
            this.viewCubeWireframeRoot.add(this.viewCubeWireframe);
            this.viewCubeScene.add(this.viewCubeWireframeRoot);
        });

        this.viewCubeNeedToCastRay = false;
    }

    private setupMouseEvents() {
        this._viewCubeRenderer.domElement.addEventListener('mousemove', e => {
            this.viewCubeMouse.set(e.offsetX, e.offsetY);
            this.viewCubeNeedToCastRay = true;
        });

        this._viewCubeRenderer.domElement.addEventListener('mouseover', e => {
            this.viewCubeMouse.set(e.offsetX, e.offsetY);
            this.viewCubeNeedToCastRay = true;
        });

        this._viewCubeRenderer.domElement.addEventListener('mouseout', e => {
            if (this.lastFaceIntersect) this.colorFaces(this.defaultColor.getHex());
            this.lastFaceIntersect = undefined;
            this.viewCubeNeedToCastRay = false;
        });

        this._viewCubeRenderer.domElement.addEventListener('mousedown', e => {
            this.viewCubeMouseDownPos = new THREE.Vector2(e.pageX, e.pageY);
            this.viewCubeNeedToCastRay = false;
        });

        this._viewCubeRenderer.domElement.addEventListener('mouseup', e => {
            this.hitFace = false;
            if (e.button !== 0) { // only allow left clicks
                return;
            }

            const moveTolerance = 0.0; // let users move a little bit...?
            const mouseMovedSinceDown = this.viewCubeMouseDownPos &&
                (Math.abs(this.viewCubeMouseDownPos.x - e.pageX) > moveTolerance ||
                    Math.abs(this.viewCubeMouseDownPos.y - e.pageY) > moveTolerance);

            if (mouseMovedSinceDown) {
                return;
            }

            this.intersectViewCube();
            const faceNormal = new THREE.Vector3();

            if (this.viewCubeIntersects && this.viewCubeIntersects.length > 0) {
                this.hitFace = true;
                // if we've intersected a face, use the face's normal to determine the new camera position & orientation
                faceNormal.copy(this.viewCubeIntersects[0]!.face!.normal);
                faceNormal.transformDirection(this.viewCubeRoot.matrixWorld);

                this.onClickFace(faceNormal);
            }
        });
    }

    // overridable by application code if necessary;
    // if so, should probably override doLerp() as well.
    onClickFace(faceNormal: THREE.Vector3) {
        this.doLerpInitialize();

        const newCameraPosition = new THREE.Vector3();
        newCameraPosition.copy(faceNormal);
        if (this.maintainDistanceToOrbitCenter) {
            // using this.previousOrbitCenter will help in situations where the model moved
            this.startLerpDistance = this.getOrbitDistance ?
                this.getOrbitDistance() : this.camera.position.distanceTo(this.previousOrbitCenter);
            newCameraPosition.multiplyScalar(this.startLerpDistance);
        } else {
            newCameraPosition.multiplyScalar(this.defaultCameraDistance);
        }
        newCameraPosition.add(this.orbitCenter);

        // remember the start position & rotation for lerping
        this.cameraStartPosition = this.camera.position.clone();
        this.cameraStartQuaternion = this.camera.quaternion.clone();
        if (this.orientationLerpType !== OrientationLerpType.SLERP) {
            // See http://www.songho.ca/opengl/gl_transform.html#matrix
            this.cameraStartUp = new THREE.Vector3();
            this.cameraStartUp.setFromMatrixColumn(this.camera.matrixWorld, 1);
            this.cameraStartBackward = new THREE.Vector3();
            this.cameraStartBackward.setFromMatrixColumn(this.camera.matrixWorld, 2);
            //this.cameraStartRight = new THREE.Vector3();
            //this.cameraStartRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
        }

        if (this.debug && this.alwaysLerpUp)
            console.log('alwaysLerpUp is true');

        // Usually the "up" direction is (0,1,0). However, for the top or bottom faces,
        // the default "up" of (0,1,0) doesn't make sense anymore since "up" for the top or bottom face
        // is orthogonal to (0,1,0). Therefore, we instead use the (positive or negative) X or Y direction
        // that is closest to the current camera "up" direction.
        // TODO: allow the user to define "up", rather than have (0,1,0) be the default "up".
        // TODO: have an option to keep the most recent "up" wrt. the cube.
        const up = new THREE.Vector3(0, 1, 0);
        const left = new THREE.Vector3(-1, 0, 0);
        const right = new THREE.Vector3(1, 0, 0);
        const forward = new THREE.Vector3(0, 0, 1);
        const backward = new THREE.Vector3(0, 0, -1);
        const down = new THREE.Vector3(0, -1, 0);
        const cameraUp = new THREE.Vector3();
        let bestNewUp = up.clone();
        const fiveDegreesInRad = 0.0872664626;
        if (faceNormal.angleTo(up) < fiveDegreesInRad || faceNormal.angleTo(down) < fiveDegreesInRad) {
            if (!this.alwaysLerpUp && this.orientationLerpType === OrientationLerpType.LOOKAT) {
                //this.tempUseSlerp = true;
                //if (this.debug) console.log('temporarily using slerp since clicked on top/bottom face and using lookat');
                this.tempLerpUp = true;
                if (this.debug) console.log('temporarily lerping up since clicked on top/bottom face and using lookat');
            }

            cameraUp.set(this.camera.matrixWorld.elements[4],
                this.camera.matrixWorld.elements[5],
                this.camera.matrixWorld.elements[6]);

            let smallestAngle = Math.PI;
            bestNewUp = left;
            if (cameraUp.angleTo(left) < smallestAngle) {
                smallestAngle = cameraUp.angleTo(left);
                bestNewUp = left;
            }
            if (cameraUp.angleTo(right) < smallestAngle) {
                smallestAngle = cameraUp.angleTo(right);
                bestNewUp = right;
            }
            if (cameraUp.angleTo(forward) < smallestAngle) {
                smallestAngle = cameraUp.angleTo(forward);
                bestNewUp = forward;
            }
            if (cameraUp.angleTo(backward) < smallestAngle) {
                //smallestAngle = cameraUp.angleTo(backward);
                bestNewUp = backward;
            }
            this.lerpingToTopOrBottomFace = true;
        } else {
            this.lerpingToTopOrBottomFace = false;
        }

        // check if the user panned away from the orbit center or the orbit center (model) moved
        const cameraBackward = new THREE.Vector3();
        cameraBackward.setFromMatrixColumn(this.camera.matrixWorld, 2);
        const orbitCenterToCamera = this.camera.position.clone().sub(this.previousOrbitCenter);
        const notLookingAtOrbitCenter = cameraBackward.angleTo(orbitCenterToCamera) > 0.0001745329; // 0.01 degrees

        if (!this.previousOrbitCenter.equals(this.orbitCenter) || notLookingAtOrbitCenter) {
            if (this.debug)
                console.log('temporarily using slerp since the orbit center was updated or camera panned away from orbit center');
            this.previousOrbitCenter.copy(this.orbitCenter);
            this.tempUseSlerp = true; // TODO: try lerping the orbitCenter instead?
            this.tempDirectlyLerpPosition = true;
        }

        if (!this.alwaysLerpUp && this.orientationLerpType === OrientationLerpType.LOOKAT) {
            // if there's camera roll, we'll using slerping or lerp up since it's smoother
            if (this.cameraRollExists()) {
                //this.tempUseSlerp = true;
                //if (this.debug) console.log('temporarily using slerp since camera roll exists and using lookat');
                this.tempLerpUp = true;
                if (this.debug) console.log('temporarily lerping up since camera roll exists and using lookat');
                // if we're close to the top/bottom faces, the "up" direction may change quickly,
                // so we'll also use slerping or lerp up
            } else {
                const eightyFiveDegreesRad = 1.4835298642;
                const ninetyFiveDegreesRad = 1.6580627894;
                if (eightyFiveDegreesRad < this.cameraStartUp.angleTo(up) && this.cameraStartUp.angleTo(down) < ninetyFiveDegreesRad) {
                    this.tempUseSlerp = true;
                    if (this.debug) console.log('temporarily using slerp since we\'re close to the top or bottom face and using lookat');
                    // lerping the "up" vector causes an instantaneous "180" jump when going from top/bottom faces
                    // to the bevel edge directly above that face; this jump occurs halfway between the lerp.
                    //this.tempLerpUp = true;
                    //if (this.debug) console.log('temporarily lerping up since we\'re close to the top or bottom face and using lookat');
                }
            }
        }

        // save end position & rotation
        this.cameraEndPosition = newCameraPosition.clone();

        const endMatrix = new THREE.Matrix4();
        endMatrix.lookAt(newCameraPosition, this.orbitCenter, bestNewUp);
        this.cameraEndQuaternion = new THREE.Quaternion();
        this.cameraEndQuaternion.setFromRotationMatrix(endMatrix);

        this.cameraEndUp = new THREE.Vector3(); // used during the lerping
        this.cameraEndUp.setFromMatrixColumn(endMatrix, 1);

        this.cameraEndBackward = new THREE.Vector3();
        this.cameraEndBackward.setFromMatrixColumn(endMatrix, 2);

        //if (this.orientationLerpType === ViewCubeHelper.ORIENTATION_LERP_TYPE.LERP) {
        //this.cameraEndRight = new THREE.Vector3();
        //this.cameraEndRight.setFromMatrixColumn(endMatrix, 0);

        //const upDegreesChange = this.cameraEndUp.angleTo(this.cameraStartUp) * 180.0 / Math.PI;
        //if (this.debug) console.log('up direction will change by ' + upDegreesChange + ' degrees');
        //if (upDegreesChange > this.tempSlerpDegreeThreshold) {
        //  this.tempUseSlerp = true;

        //  if (this.debug)
        //    console.log('temporarily slerping since the up direction is changing by ' +
        //      upDegreesChange + ' > ' + this.tempSlerpDegreeThreshold + ' degrees');
        //}
        //}

        this.onlyLerpingRoll = false;
        if (this.debug) console.log('Starting lerp using this.orientationLerpType === ' + this.orientationLerpType);

        this.doLerpStart();
    }

    private setupRenderLoop() {
        const viewCubeCameraDirection = new THREE.Vector3();
        const lastCameraPosition = new THREE.Vector3();

        const lastCameraQuaternion = new THREE.Quaternion();

        // TODO: try not to render every frame to save on performance
        const renderLoop = () => {

            // do lerping if necessary
            this.doLerp();

            // set view cube camera based on main view camera
            this.viewCubeCamera.rotation.copy(this.camera.rotation);
            this.viewCubeCamera.position.copy(this.viewCubeScene.position);
            this.viewCubeCamera.getWorldDirection(viewCubeCameraDirection);
            this.viewCubeCamera.position.addScaledVector(viewCubeCameraDirection, VIEW_CUBE_CAMERA_DISTANCE_OFFSET);
            this.viewCubeCamera.updateMatrixWorld(true);

            //const tt = window.performance.now();
            this._viewCubeRenderer.render(this.viewCubeScene, this.viewCubeCamera);
            //console.log('rendered in', window.performance.now() - tt);

            const cameraPositionChanged = lastCameraPosition.distanceTo(this.camera.position) > 0.000001;
            const cameraRotationChanged = lastCameraQuaternion.angleTo(this.camera.quaternion) > 0.0001745329; // 0.01 degrees
            const cameraMoved = cameraPositionChanged || cameraRotationChanged;

            if (cameraMoved) {
                // if the camera moved, we may need to update the visibility of the axis labels
                this.updateAxesLabels();

                // if the camera moved, we may need to disable the roll button
                if (this.atFace && !this.finishedLerpOnThisFrame && !this.lerping) {
                    let noLongerAtFace = false;

                    if (cameraRotationChanged) {
                        noLongerAtFace = true;
                        if (this.debug) console.log('no longer at a face due to camera rotation...');
                    } else {
                        // check if we just zoomed out
                        const cameraBackward = new THREE.Vector3();
                        cameraBackward.setFromMatrixColumn(this.camera.matrixWorld, 2);
                        const posChangeDir = this.camera.position.clone().sub(lastCameraPosition).normalize();
                        if (posChangeDir.angleTo(cameraBackward) > 0.000001 &&
                            posChangeDir.multiplyScalar(-1).angleTo(cameraBackward) > 0.000001) {
                            noLongerAtFace = true;
                            if (this.debug) console.log('no longer at a face due to panning...');
                        } else if (this.debug) {
                            console.log('must have zoomed out, still "at face"...');
                        }
                    }

                    if (noLongerAtFace) {
                        this.atFace = false;
                        this.atTopOrBottomFace = false;

                        if (this.rollButtonType === RollButtonType.ONLY_AT_FACES ||
                            this.rollButtonType === RollButtonType.ONLY_AT_TOP_OR_BOTTOM_FACES) {
                            this.setRollButtonEnabled(false, this.rollDisabledMsg[this.rollButtonType]);
                        }
                    }
                }
            }

            lastCameraPosition.copy(this.camera.position);
            lastCameraQuaternion.copy(this.camera.quaternion);

            // update view cube colors if the mouse moved or a lerp finished.
            // Note: this currently doesn't cover at least the following corner case:
            // - during a lerp, the mouse won't update its highlights; arguably it's better not
            //   to do this during the lerp for performance reasons since animating the camera
            //   view in the first place is already a performance hit.
            if (this.viewCubeNeedToCastRay || this.finishedLerpOnThisFrame) {
                this.viewCubeNeedToCastRay = false;

                this.intersectViewCube();

                if (this.viewCubeIntersects.length > 0) {
                    // if we're intersected a different face, reset the previous face's color
                    if (this.lastFaceIntersect && this.lastFaceIntersect !== this.viewCubeIntersects[0].face) {
                        this.colorFaces(this.defaultColor.getHex());
                    }
                    // color the newly intersected face
                    this.lastFaceIntersect = this.viewCubeIntersects[0].face;
                    this.colorFaces(0xffffff); // this value multiplied with the texture gives the full texture color 0x494E50 (from figma)
                } else {
                    // if no mouse intersecting the view cube, reset cube colors
                    if (this.lastFaceIntersect) this.colorFaces(this.defaultColor.getHex());
                    this.lastFaceIntersect = null;
                }
            }

            // TODO: do we need to call cancelAnimationFrame at some point?
            requestAnimationFrame(renderLoop);
        };
        renderLoop();
    }

    // overridable by application code if necessary;
    // if so, should probably override onClickFace() as well.
    doLerp() {
        this.finishedLerpOnThisFrame = false;
        if (!this.lerping) return;

        const t = window.performance.now();
        if (this.cameraStartLerpTime !== undefined && t - this.cameraStartLerpTime < this.lerpTime) {
            let lerpFactor = (t - this.cameraStartLerpTime) / this.lerpTime;
            lerpFactor = lerpFactor * lerpFactor * (3 - 2 * lerpFactor); // smoothstep

            this.camera.position.lerpVectors(this.cameraStartPosition, this.cameraEndPosition, lerpFactor);
            // push camera to correct distance
            if (!this.tempDirectlyLerpPosition) {
                // TODO: the following might not work if this.orbitCenter got updated!
                if (this.maintainDistanceToOrbitCenter) {
                    this.camera.position.sub(this.orbitCenter);
                    this.camera.position.normalize();
                    this.camera.position.multiplyScalar(this.startLerpDistance);
                    this.camera.position.add(this.orbitCenter);
                } else if (this.enforceMinimumCameraDistance) {
                    if (this.camera.position.distanceTo(this.orbitCenter) < this.defaultCameraDistance) {
                        this.camera.position.sub(this.orbitCenter);
                        this.camera.position.normalize();
                        this.camera.position.multiplyScalar(this.defaultCameraDistance);
                        this.camera.position.add(this.orbitCenter);
                    }
                }
            }

            // There are several possible ways to interpolate the orientation of the camera
            // during a lerp. Each has its pros and cons. Here's the options that we've looked
            // at so far (defined in ORIENTATION_LERP_TYPE):
            // SLERP:  Uses THREE.Quaternion.slerp() to apply spherical linear interpolation directly
            //         on the camera's quaternion. The major downside of this approach is that the
            //         "look at" direction will not always point at this.orbitCenter and camera roll
            //         can be introduced during the lerping. As a result, during lerping,
            //         this.orbitCenter may appear to sway back and forth. If origin axes are
            //         present, the "up" axis can noticeably sway left and right when doing motion
            //         orthogonal to the "up" direction (e.g., clicking on the "FRONT" face, then
            //         going toward "RIGHT").
            //
            //         On the one hand, a possibly good reason to use slerp is that the camera
            //         orientation appears to never quickly "jump" in its orientation; instead,
            //         the motion seems to follow the lerpFactor fairly well, unlike the
            //         following two approaches (LOOKAT and LERP). On the other hand, it's arguable
            //         whether or not the quick jump in orientation is truly a negative attribute
            //         or not; perhaps a quick jump in orientation is less disorienting than a slow
            //         change over time where this.orbitCenter is no longer in the center of the
            //         screen and camera roll is also introduced.
            //
            //         This approach is probably the least complicated.
            //
            // LOOKAT: Mostly calls .lookAt() without any direct interpolation of the camera's
            //         orientation. This approach is good since this.orbitCenter is always in the
            //         center of the user's view and if the user never introduced camera roll,
            //         the lerping with this approach will never introduce camera roll either.
            //         However, in some cases a direct interpolation of the "up" or "look at"
            //         directions may be necessary to avoid a sudden jump in camera orientation;
            //         in particular:
            //         - when clicking on a top/bottom face, the final "up" direction is orthogonal
            //           to the global "up"; thus, if we do not lerp "up", a sudden jump in the
            //           camera's orientation may occur at the beginning of the lerp.
            //         - if at a top/bottom face, the starting "up" direction is orthogonal to
            //           the global "up"; thus, if we do not lerp "up", a sudden jump in the
            //           camera's orientation may occur at the beginning of the lerp.
            //         - if camera roll exists, we'll need to lerp the "up" direction to avoid a
            //           sudden jump due to .lookAt()'s using the default "up".
            //         So why not just lerp "up" all the time? Well, that's because sometimes
            //         lerping "up" actually introduces camera roll. For example, when clicking
            //         between a 45-degree bevel edge and corner, camera roll gets introduced
            //         during the lerp. The camera roll goes away by the end of the lerp, but
            //         seeing that camera roll during the lerp is not as smooth of a motion as
            //         one might like.
            //
            //         Another consequence of this approach is that occasionally there can be large
            //         changes in orientation over a short period of time; for example, if at the
            //         "TOP" face and clicking on the bevel edge directly above it (in screen space),
            //         the orientation will "jump" halfway between the lerp. It is arguable whether
            //         or not this approach is good or bad; a couple of alternatives could be to
            //         temporarily slerp the orientation, or to first lerp only the camera's roll
            //         and then subsequently do the normal lerp.
            //
            //         This approach with its workarounds is fairly complicated.
            //
            // LERP:   Directly lerps the "look at" and "up" directions of the camera's orientation.
            //         While this does allow this.orbitCenter to remain in the center of the screen,
            //         the lerping of "up" can cause some camera roll to be induced, thus making the
            //         camera motion feel not as smooth as LOOKAT or SLERP. In particular, if the
            //         origin axes are present, the "up" axis can noticeably sway due to the camera
            //         roll that is introduced by this approach.
            //
            //         Similarly to LOOKAT:
            //         Another consequence of this approach is that occasionally there can be large
            //         changes in orientation over a short period of time; for example, if at the
            //         "TOP" face and clicking on the bevel edge directly above it (in screen space),
            //         the orientation will "jump" halfway between the lerp. It is arguable whether
            //         or not this approach is good or bad; a couple of alternatives could be to
            //         temporarily slerp the orientation, or to first lerp only the camera's roll
            //         and then subsequently do the normal lerp.
            //
            //         This approach with its workarounds is fairly complicated.

            if (this.orientationLerpType === OrientationLerpType.SLERP || this.tempUseSlerp) {
                this.camera.quaternion.copy(this.cameraStartQuaternion);
                this.camera.quaternion.slerp(this.cameraEndQuaternion, lerpFactor);
                if (this.onLerping) this.onLerping(lerpFactor);
            } else if (this.orientationLerpType === OrientationLerpType.LOOKAT) {
                // lerping the "up" vector causes swaying of the blue z-axis when clicking between
                // a 45-degree bevel edge and corner.
                // lerping the "up" vector causes an instantaneous "180" jump when going from top/bottom faces
                // to the bevel edge directly above that face; this jump occurs halfway between the lerp.
                if (this.tempLerpUp || this.alwaysLerpUp) {
                    this.lerpCameraUp.lerpVectors(this.cameraStartUp, this.cameraEndUp, lerpFactor);
                    this.lerpCameraUp.normalize();
                    this.camera.up.copy(this.lerpCameraUp);
                }
                this.camera.lookAt(this.orbitCenter);
                if (this.onLerping) this.onLerping(lerpFactor);
            } else { // this.orientationLerpType === OrientationLerpType.LERP
                this.lerpCameraUp.lerpVectors(this.cameraStartUp, this.cameraEndUp, lerpFactor);
                this.lerpCameraUp.normalize();
                this.lerpCameraBackward.lerpVectors(this.cameraStartBackward, this.cameraEndBackward, lerpFactor);
                this.lerpCameraBackward.normalize();
                //this.lerpCameraRight.copy(this.lerpCameraUp).cross(this.lerpCameraBackward);
                //this.lerpCameraRight.normalize();
                //this.lerpCameraUp.copy(this.lerpCameraBackward).cross(this.lerpCameraRight);
                //this.lerpCameraUp.normalize();
                this.lerpCenter.copy(this.camera.position).sub(this.lerpCameraBackward);
                this.lerpMatrixWorld.lookAt(this.camera.position, this.lerpCenter, this.lerpCameraUp);
                this.lerpQuaternion.setFromRotationMatrix(this.lerpMatrixWorld);
                this.camera.quaternion.copy(this.lerpQuaternion);
            }

            // force camera to remain a fixed distance at the current.
            this.camera.updateMatrixWorld();
            const dist = this.camera.position.distanceTo(this.orbitCenter);
            this.camera.getWorldDirection(tempVec);
            this.camera.position.copy(this.orbitCenter).addScaledVector(tempVec, -dist);

            if (this.onLerping) this.onLerping(lerpFactor);
        } else {
            this.cameraStartLerpTime = undefined;
            this.lerping = false;
            this.tempUseSlerp = false;
            this.tempDirectlyLerpPosition = false;
            this.tempLerpUp = false;

            // Some camera controls (e.g., OrbitControls) maintain a certain up
            // vector, whereas others (e.g., TrackballControls) actually modify
            // the up vector during interaction. this.resetCameraUpOnLerpFinished
            // can be used to facilitate whichever type of up-vector modification
            // is necessary.
            if (this.resetCameraUpOnLerpFinished) {
                this.camera.up.set(0, 1, 0);
            } else {
                this.camera.up.copy(this.cameraEndUp);
            }

            this.camera.position.copy(this.cameraEndPosition);
            this.camera.quaternion.copy(this.cameraEndQuaternion);

            this.finishedLerpOnThisFrame = true;

            if (this.rollButtonType === RollButtonType.ALWAYS_ON ||
                this.rollButtonType === RollButtonType.ONLY_AT_FACES ||
                (this.rollButtonType === RollButtonType.ONLY_AT_TOP_OR_BOTTOM_FACES &&
                    (this.lerpingToTopOrBottomFace || this.atTopOrBottomFace))) {

                this.setRollButtonEnabled(true);

                if (this.svgEnabledAndHoveredOver || this.svgMouseEnterWhileLerping) {
                    // turn it back on
                    this.tooltip.style.display = 'block';
                    this.tooltip.style.visibility = 'visible';
                    this.tooltip.style.opacity = '1';
                    this.setRollButtonColors(true, true);
                }
            } else if (this.svgMouseEnterWhileLerping) {
                // turn it back on, disabled
                this.tooltip.style.display = 'block';
                this.tooltip.style.visibility = 'visible';
                this.tooltip.style.opacity = '1';
                this.setRollButtonColors(false, true);
            }

            if (this.lerpingToTopOrBottomFace) {
                this.atTopOrBottomFace = true;
                this.lerpingToTopOrBottomFace = false;
            }

            // offset the position of the camera by a small amount to account for cases where
            // the camera is looking directly down it's "up" vector which will cause jumps
            // when using look at (as OrbitControls uses).
            this.camera.updateMatrixWorld();
            tempVec.copy(this.camera.up).transformDirection(this.camera.matrixWorld);
            this.camera.position.addScaledVector(tempVec, -0.001);
            this.camera.lookAt(this.orbitCenter);
            this.camera.updateMatrixWorld();

            this.atFace = true;

            if (this.onLerpFinished) this.onLerpFinished();
        }
    }

    private setupAxes() {
        this.xDomElement.innerText = 'X';
        this.xDomElement.style.position = 'absolute';
        this.xDomElement.style.color = '#FF0522';
        this.xDomElement.style.textAlign = 'center';
        this.xDomElement.style.fontFamily = "'Inter', 'Roboto', Arial, Helvetica, sans-serif";
        this.xDomElement.style.fontWeight = 'bold';
        this.xDomElement.style.fontStyle = 'normal';
        this.xDomElement.style.fontSize = '9px';
        this.xDomElement.style.pointerEvents = 'none';
        this.xDomElement.style.userSelect = 'none';

        this.yDomElement = this.xDomElement.cloneNode(true) as HTMLElement;
        this.yDomElement.innerText = 'Y';
        this.yDomElement.style.color = '#13FF00';

        this.zDomElement = this.xDomElement.cloneNode(true) as HTMLElement;
        this.zDomElement.innerText = 'Z';
        this.zDomElement.style.color = '#005EFF';

        this.domElement.appendChild(this.xDomElement);
        this.domElement.appendChild(this.yDomElement);
        this.domElement.appendChild(this.zDomElement);

        this.axes = new THREE.AxesHelper(AXES_LENGTH);
        this.axes.position.set(-115, -115, -115);

        // set axes colors per figma design
        // https://stackoverflow.com/questions/45825495/how-to-change-axeshelper-colors-in-three-js
        const colors = this.axes.geometry.attributes.color as any;
        colors.setXYZ(0, 1, 5.0 / 255.0, 34.0 / 255.0); // FF0522
        colors.setXYZ(1, 1, 5.0 / 255.0, 34.0 / 255.0);
        colors.setXYZ(2, 19.0 / 255.0, 1, 0); // 13FF00
        colors.setXYZ(3, 19.0 / 255.0, 1, 0);
        colors.setXYZ(4, 0, 94.0 / 255.0, 1); // 005EFF
        colors.setXYZ(5, 0, 94.0 / 255.0, 1);

        const axesGroup = new THREE.Group();
        axesGroup.add(this.axes);
        this.axesGroup = axesGroup;
        this.viewCubeScene.add(axesGroup);

        // these variables hold the 3D position of the X, Y, and Z axes labels
        this.x = new THREE.Vector3();
        this.y = new THREE.Vector3();
        this.z = new THREE.Vector3();

        // these variables hold the 2D position of the axes labels
        this.x2D = new THREE.Vector3();
        this.y2D = new THREE.Vector3();
        this.z2D = new THREE.Vector3();

        // force update the positions of the dom elements
        this.setAxesOrientation(new THREE.Quaternion());
    }

    private setupRollButton() {
        /*
    <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0.876953" y="0.761719" width="24" height="24" rx="4" fill="#2E3538"/>
    <path d="M11.877 15.7617L16.354 19.9686L20.8311 15.7617" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <path d="M16.377 18.7617V11.7617C16.377 8.44801 13.6907 5.76172 10.377 5.76172H5.87695" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>
        */
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute('id', 'view-cube-roll-button');
        svg.setAttribute('width', '25');
        svg.setAttribute('height', '25');
        svg.setAttribute('viewBox', '0 0 25 25');
        svg.setAttribute('fill', 'none');
        svg.style.position = 'absolute';
        svg.style.left = '125px';
        svg.style.top = '20px';

        const rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
        rect.setAttribute('x', '0.876953');
        rect.setAttribute('y', '0.761719');
        rect.setAttribute('width', '24');
        rect.setAttribute('height', '24');
        rect.setAttribute('rx', '4');
        rect.setAttribute('fill', '#2E3538');
        svg.appendChild(rect);

        this.rollButtonRect = rect;

        const path1 = document.createElementNS("http://www.w3.org/2000/svg", 'path');
        path1.setAttribute('d', 'M11.877 15.7617L16.354 19.9686L20.8311 15.7617');
        path1.setAttribute('stroke', '#cccccc');
        path1.setAttribute('stroke-width', '2');
        path1.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path1);

        this.path1 = path1;

        const path2 = document.createElementNS("http://www.w3.org/2000/svg", 'path');
        path2.setAttribute('d', 'M16.377 18.7617V11.7617C16.377 8.44801 13.6907 5.76172 10.377 5.76172H5.87695');
        path2.setAttribute('stroke', '#cccccc');
        path2.setAttribute('stroke-width', '2');
        path2.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path2);

        this.path2 = path2;

        const tooltip = document.createElement('div');
        tooltip.style.display = 'none';
        tooltip.style.position = 'absolute';
        tooltip.style.left = '155px';
        tooltip.style.top = '21px';
        tooltip.style.fontSize = '12px';
        tooltip.style.width = '100px';
        tooltip.style.background = '#2E3538';
        tooltip.style.color = 'white';
        tooltip.style.textAlign = 'center';
        tooltip.style.letterSpacing = '0.02em';
        tooltip.style.padding = '12px 16px 12px 16px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.visibility = 'hidden';
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'visibility 0s, opacity 0.5s linear'; // TODO
        tooltip.style.pointerEvents = 'none';
        tooltip.style.userSelect = 'none';
        this.domElement.appendChild(tooltip);

        this.tooltip = tooltip;

        this.svgEnabledAndHoveredOver = false;
        this.svgMouseEnterWhileLerping = false;

        svg.addEventListener('mouseenter', e => {
            if (this.lerping) {
                this.svgMouseEnterWhileLerping = true;
                return; // don't show tooltip while lerping
            }

            tooltip.style.display = 'block';
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';

            if (this.rollButtonDisabled) return;

            this.setRollButtonColors(true, true);
            this.svgEnabledAndHoveredOver = true;
        });

        svg.addEventListener('mouseleave', e => {
            if (this.rollButtonDisabled || this.lerping) {
                this.setRollButtonColors(false, false);
            } else {
                this.setRollButtonColors(true, false);
            }

            tooltip.style.display = 'none';
            tooltip.style.visibility = 'hidden';
            tooltip.style.opacity = '0';
            this.svgEnabledAndHoveredOver = false;
            this.svgMouseEnterWhileLerping = false;
        });

        this.svgMouseDownPos = new THREE.Vector2(0, 0);
        svg.addEventListener('mousedown', e => {
            if (this.rollButtonDisabled || this.lerping) return;

            this.svgMouseDownPos = new THREE.Vector2(e.pageX, e.pageY);
        });

        svg.addEventListener('mouseup', e => {
            // clicking doesn't work for:
            // - when it's disabled only allow left clicks
            // - we're lerping
            // - didn't use left-click
            if (this.rollButtonDisabled || this.lerping || e.button !== 0) return;

            const moveTolerance = 0.0; // let users move a little bit...?
            const mouseMovedSinceDown = this.svgMouseDownPos &&
                (Math.abs(this.svgMouseDownPos.x - e.pageX) > moveTolerance ||
                    Math.abs(this.svgMouseDownPos.y - e.pageY) > moveTolerance);

            if (mouseMovedSinceDown) return;

            this.doLerpInitialize();

            // remember the start position & rotation for lerping
            this.cameraStartPosition = this.camera.position.clone();
            this.cameraStartQuaternion = this.camera.quaternion.clone();
            if (this.orientationLerpType !== OrientationLerpType.SLERP) {
                // See http://www.songho.ca/opengl/gl_transform.html#matrix
                this.cameraStartUp = new THREE.Vector3();
                this.cameraStartUp.setFromMatrixColumn(this.camera.matrixWorld, 1);
                this.cameraStartBackward = new THREE.Vector3();
                this.cameraStartBackward.setFromMatrixColumn(this.camera.matrixWorld, 2);
            }

            if (this.maintainDistanceToOrbitCenter) {
                // using this.previousOrbitCenter will help in situations where the model moved
                this.startLerpDistance = this.getOrbitDistance ?
                    this.getOrbitDistance() : this.camera.position.distanceTo(this.previousOrbitCenter);
            }

            // save end position & rotation
            this.cameraEndPosition = this.cameraStartPosition.clone();

            // set camera end up to the current "left" vector
            this.cameraEndUp = new THREE.Vector3();
            this.cameraEndUp.setFromMatrixColumn(this.camera.matrixWorld, 0).multiplyScalar(-1);
            this.cameraEndBackward = new THREE.Vector3();
            this.cameraEndBackward.setFromMatrixColumn(this.camera.matrixWorld, 2);

            this.tempLerpUp = true;

            const endMatrix = new THREE.Matrix4();
            endMatrix.lookAt(this.cameraEndPosition, this.orbitCenter, this.cameraEndUp);
            this.cameraEndQuaternion = new THREE.Quaternion();
            this.cameraEndQuaternion.setFromRotationMatrix(endMatrix);

            this.onlyLerpingRoll = true;
            if (this.debug) console.log('Starting lerp from svg click using this.orientationLerpType === ' + this.orientationLerpType);

            this.doLerpStart();
        });

        this.svg = svg
        this.setRollButtonType();
        this.domElement.appendChild(svg);
    }

    doLerpInitialize() {
        if (this.onLerpInitialize) this.onLerpInitialize(this.atTopOrBottomFace);
    }

    doLerpStart() {
        // disable the roll button while lerping
        if (this.rollButtonType === RollButtonType.ONLY_AT_FACES ||
            this.rollButtonType === RollButtonType.ONLY_AT_TOP_OR_BOTTOM_FACES)
            this.setRollButtonEnabled(false, this.rollDisabledMsg[this.rollButtonType]);
        else
            this.setRollButtonEnabled(false);

        this.cameraStartLerpTime = window.performance.now();
        this.lerping = true;

        this.atFace = false;
        if (this.onlyLerpingRoll && this.atTopOrBottomFace) {
            // still at top or bottom face
            if (this.debug) console.log('rolling at top or bottom face...');
        } else {
            this.atTopOrBottomFace = false;
        }

        this.tooltip.style.display = 'none';

        if (this.onLerpStart) this.onLerpStart();
    }

    setRollButtonType(type?: RollButtonType, disabledMsg?: string) {
        if (type) this.rollButtonType = type;

        if (disabledMsg) this.rollDisabledMsg[this.rollButtonType] = disabledMsg;

        if (this.rollButtonType === RollButtonType.ALWAYS_ON)
            this.setRollButtonEnabled(true);
        else if (this.rollButtonType === RollButtonType.ONLY_AT_FACES) {
            if (!this.atFace)
                this.setRollButtonEnabled(false, this.rollDisabledMsg[this.rollButtonType]);
        }
        else if (this.rollButtonType === RollButtonType.ONLY_AT_TOP_OR_BOTTOM_FACES) {
            if (!this.atTopOrBottomFace)
                this.setRollButtonEnabled(false, this.rollDisabledMsg[this.rollButtonType]);
        }
        else
            this.setRollButtonEnabled(false, this.rollDisabledMsg[this.rollButtonType]);

        if (this.rollButtonType === RollButtonType.ALWAYS_OFF)
            this.svg.style.display = 'none';
        else
            this.svg.style.display = 'block';
    }

    setRollButtonEnabled(enabled: boolean, disabledMsg: string = 'Disabled') {
        if (this.debug) console.log('setRollButtonEnabled', enabled, disabledMsg);

        if (enabled) {
            this.tooltip.innerHTML = 'Roll view 90º';
            this.tooltip.style.width = '100px';
            this.setRollButtonColors(true, false);
        } else {
            this.tooltip.innerHTML = disabledMsg;
            this.tooltip.style.width = '250px';
            this.setRollButtonColors(false, false);
        }
        this.rollButtonDisabled = !enabled;
    }

    setRollButtonColors(enabled: boolean, hovered: boolean) {
        if (enabled) {
            if (hovered) {
                this.rollButtonRect.setAttribute('fill', '#494E50');
                this.path1.setAttribute('stroke', 'white');
                this.path2.setAttribute('stroke', 'white');
            } else {
                this.rollButtonRect.setAttribute('fill', '#2E3538');
                this.path1.setAttribute('stroke', '#cccccc');
                this.path2.setAttribute('stroke', '#cccccc');
            }
        } else {
            this.rollButtonRect.setAttribute('fill', '#192024'); // gray 88
            this.path1.setAttribute('stroke', '#868888');
            this.path2.setAttribute('stroke', '#868888');
        }
    }

    // raycasts the view cube
    private intersectViewCube() {
        this.viewCubeMouseNDC.set(
            (this.viewCubeMouse.x / this._viewCubeRenderer.domElement.clientWidth) * 2 - 1,
            -(this.viewCubeMouse.y / this._viewCubeRenderer.domElement.clientHeight) * 2 + 1
        );
        this.viewCubeRaycaster.setFromCamera(this.viewCubeMouseNDC, this.viewCubeCamera);
        this.viewCube.updateMatrixWorld();
        this.viewCubeIntersects = this.viewCubeRaycaster.intersectObject(this.viewCubeRoot, true);
    }

    // updates the view cube axes labels appropriately per design
    private updateAxesLabels() {
        this.x2D.copy(this.x);
        this.x2D.project(this.viewCubeCamera);
        this.x2D.z = 0;

        this.y2D.copy(this.y);
        this.y2D.project(this.viewCubeCamera);
        this.y2D.z = 0;

        this.z2D.copy(this.z);
        this.z2D.project(this.viewCubeCamera);
        this.z2D.z = 0;

        // first check if we should just hide certain labels based on if they're overlapping in 2D.
        // if so, hide the label that's further away from the camera.
        const xDist = this.x.distanceTo(this.viewCubeCamera.position);
        const yDist = this.y.distanceTo(this.viewCubeCamera.position);
        const zDist = this.z.distanceTo(this.viewCubeCamera.position);
        const overlapThreshold = 2 * 10.0 / VIEW_CUBE_CANVAS_WIDTH; // in NDC, set empirically after trial and error
        let hideX = false;
        let hideY = false;
        let hideZ = false;
        if (this.x2D.distanceTo(this.y2D) < overlapThreshold) {
            if (xDist < yDist) hideY = true;
            else hideX = true;
        } else if (this.x2D.distanceTo(this.z2D) < overlapThreshold) {
            if (xDist < zDist) hideZ = true;
            else hideX = true;
        } else if (this.y2D.distanceTo(this.z2D) < overlapThreshold) {
            if (yDist < zDist) hideZ = true;
            else hideY = true;
        }

        // helper function to show a axis label and place it appropriately
        const ShowLabel = (element: HTMLElement, pixel2D: THREE.Vector2) => {
            element.style.display = "block";
            pixel2D.x = ((pixel2D.x * VIEW_CUBE_CANVAS_WIDTH) + VIEW_CUBE_CANVAS_WIDTH) / 2.0;
            pixel2D.y = ((-pixel2D.y * VIEW_CUBE_CANVAS_HEIGHT) + VIEW_CUBE_CANVAS_HEIGHT) / 2.0;
            // TODO: cache getBoundingClientRect() if possible
            const xBounds = element.getBoundingClientRect();
            element.style.left = `${pixel2D.x - 0.5 * xBounds.width}px`;
            element.style.top = `${pixel2D.y - 0.5 * xBounds.height}px`;
        };

        if (hideX) {
            this.xDomElement.style.display = "none";
        } else {
            this.viewCubeRaycaster.setFromCamera(vec3to2(this.x2D), this.viewCubeCamera);
            const labelIntersects = this.viewCubeRaycaster.intersectObject(this.viewCube, true);
            if (labelIntersects.length > 0 && labelIntersects[0].distance < xDist) {
                this.xDomElement.style.display = "none";
            } else {
                ShowLabel(this.xDomElement, vec3to2(this.x2D));
            }
        }

        if (hideY) {
            this.yDomElement.style.display = "none";
        } else {
            this.viewCubeRaycaster.setFromCamera(vec3to2(this.y2D), this.viewCubeCamera);
            const labelIntersects = this.viewCubeRaycaster.intersectObject(this.viewCube, true);
            if (labelIntersects.length > 0 && labelIntersects[0].distance < yDist) {
                this.yDomElement.style.display = "none";
            } else {
                ShowLabel(this.yDomElement, vec3to2(this.y2D));
            }
        }

        if (hideZ) {
            this.zDomElement.style.display = "none";
        } else {
            this.viewCubeRaycaster.setFromCamera(vec3to2(this.z2D), this.viewCubeCamera);
            const labelIntersects = this.viewCubeRaycaster.intersectObject(this.viewCube, true);
            if (labelIntersects.length > 0 && labelIntersects[0].distance < zDist) {
                this.zDomElement.style.display = "none";
            } else {
                ShowLabel(this.zDomElement, vec3to2(this.z2D));
            }
        }
    }

    // colors the last intersected view cube's face a specified hex color
    private colorFaces(hexColor: number) {
        const colors = (this.viewCube as any).geometry.attributes.color;
        this.colorFace(this.lastFaceIntersect!.a, this.lastFaceIntersect!.b, this.lastFaceIntersect!.c, hexColor, colors);

        // hack: check "previous" and "next" faces in buffer attributes for the other triangle
        // that composes a face of the view cube (three.js doesn't support quad faces, only triangles).
        const prevIndex = this.lastFaceIntersect!.a - 3;
        const nextIndex = this.lastFaceIntersect!.a + 3;
        if (this.faceNormalsSame(prevIndex, this.lastFaceIntersect!.a))
            this.colorFace(prevIndex, prevIndex + 1, prevIndex + 2, hexColor, colors);
        else if (this.faceNormalsSame(nextIndex, this.lastFaceIntersect!.a))
            this.colorFace(nextIndex, nextIndex + 1, nextIndex + 2, hexColor, colors);

        colors.needsUpdate = true;
    }

    // sets the color for a face in mesh buffer attribute
    private colorFace(a: number, b: number, c: number, hexColor: number, colors: any) {
        const red = ((hexColor & 0xff0000) >> 16) / 255.0;
        const green = ((hexColor & 0x00ff00) >> 8) / 255.0;
        const blue = ((hexColor & 0x0000ff)) / 255.0;
        colors.array[a * 3 + 0] = red;
        colors.array[a * 3 + 1] = green;
        colors.array[a * 3 + 2] = blue;
        colors.array[b * 3 + 0] = red;
        colors.array[b * 3 + 1] = green;
        colors.array[b * 3 + 2] = blue;
        colors.array[c * 3 + 0] = red;
        colors.array[c * 3 + 1] = green;
        colors.array[c * 3 + 2] = blue;
    }

    // returns true if the two specified triangles in the view cube have equal triplets of normals
    // (3 vertices, each with 3 XYZ components = 9 total values).
    // otherwise, returns false
    private faceNormalsSame(index1: number, index2: number) {
        const normals = (this.viewCube as any).geometry.attributes.normal;
        index1 *= 3;
        index2 *= 3;
        if (index1 < 0 || index2 < 0 || index1 + 9 > normals.array.length || index2 + 9 > normals.array.length)
            return false;
        for (let i = 0; i < 9; i++) {
            if (normals.array[index1 + i] !== normals.array[index2 + i])
                return false;
        }
        return true;
    }

    private cameraRollExists() {
        // camera roll exists if we cannot rotate around the current "right" axis/direction to align
        // the current "up" direction with the global "up" direction.
        const cameraUp = new THREE.Vector3();
        const cameraBackward = new THREE.Vector3();
        cameraUp.setFromMatrixColumn(this.camera.matrixWorld, 1);
        cameraBackward.setFromMatrixColumn(this.camera.matrixWorld, 2);

        const up = new THREE.Vector3(0, 1, 0);
        const angle = cameraUp.angleTo(up)
            * Math.sign(cameraBackward.dot(up));

        //if (this.debug) {
        //  console.log('current cameraUp:', cameraUp);
        //  console.log('current degree angle to global "up":', (angle * 180.0 / Math.PI));
        //}

        const newCamera = new THREE.Object3D();
        newCamera.setRotationFromMatrix(this.camera.matrixWorld);
        newCamera.updateMatrixWorld(true);

        const newCameraUp = new THREE.Vector3();
        newCameraUp.setFromMatrixColumn(newCamera.matrixWorld, 1);
        //if (this.debug) console.log('new cameraUp before:', newCameraUp);

        newCamera.rotateOnAxis(new THREE.Vector3(1, 0, 0), angle);
        newCamera.updateMatrixWorld(true);

        newCameraUp.setFromMatrixColumn(newCamera.matrixWorld, 1);
        const newAngle = newCameraUp.angleTo(up);
        const rollExists = newAngle > 0.00001;

        if (this.debug) {
            //console.log('new cameraUp after rotating along x-axis:', newCameraUp);
            //console.log('new degree angle to global "up":', (newAngle * 180.0 / Math.PI));
            console.log('Camera roll ' + (rollExists ? 'EXISTS' : 'does not exist'));
        }

        return rollExists;
    }

    /**
     * Set the axes orientation relative to the cube. This affects how the RGB
     * lines representing the XYZ axes are rotated.
     * @param {(Quaternion)} quat
     */
    setAxesOrientation(quat: THREE.Quaternion) {
        this.axesGroup.quaternion.copy(quat);

        const tempPos = this.axes.position.clone().applyQuaternion(quat);
        const labelAxesOffset = 35;
        this.x
            .set(AXES_LENGTH + labelAxesOffset, 0, 0)
            .applyQuaternion(quat)
            .add(tempPos);

        this.y
            .set(0, AXES_LENGTH + labelAxesOffset, 0)
            .applyQuaternion(quat)
            .add(tempPos);

        this.z
            .set(0, 0, AXES_LENGTH + labelAxesOffset)
            .applyQuaternion(quat)
            .add(tempPos);

    }

    /**
     * Set the face orientation so top, bottom, left, right, etc are aligned to the
     * notional directions of the scene.
     * @param {(Quaternion|Euler)} quatOrEuler
     */
    setFaceOrientation(quatOrEuler: THREE.Quaternion | THREE.Euler) {
        if (quatOrEuler instanceof THREE.Quaternion) {
            this.viewCubeRoot.quaternion.copy(quatOrEuler);
        } else {
            this.viewCubeRoot.rotation.copy(quatOrEuler);
        }
    }

    /**
     * Sets the scene orientation to match a scene target that is not necessarily world
     * axis aligned.
     * @param {(Quaternion|Euler)} quatOrEuler
     * @return {void}
     */
    setTargetOrientation(quatOrEuler: THREE.Quaternion | THREE.Euler): void {
        if (quatOrEuler instanceof THREE.Quaternion) {
            this.viewCubeScene.quaternion.copy(quatOrEuler);
        } else {
            this.viewCubeScene.rotation.copy(quatOrEuler);
        }
    }

    /**
     * Disposes of the renderer used for the ViewCube.
     * @returns {void}
     */
    dispose(): void {
        this._viewCubeRenderer.dispose();
    }
}
