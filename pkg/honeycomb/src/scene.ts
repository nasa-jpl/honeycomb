import { UpOrientation } from "@gov.nasa.jpl.honeycomb/scene-viewers";
import {
    Channel,
    Joints,
    Orientation,
    Pose,
    Position
} from "./channel";

export interface SceneObjectPlacement {
    /**
     * Pose offset from parent frame
     */
    pose?: Partial<Pose>;

    /**
     * Frame or path to frame where this object lives
     */
    frame?: string | string[];
}

export interface ModelObjectData {
    /**
     * Model type
     * i.e. 'urdf', 'fbx', 'ht', etc.
     * 
     * This is optional as its inferred from the file extension
     * given in the path.
     */
    type?: string;

    /**
     * Path to the model. If 'type' is not specified, the file extension
     * will determine with model loader to use when loading the object into
     * the scene.
     */
    path: string;

    /**
     * For use internally in the system to remember the raw path because
     * the path value gets updated to use a webview uri; we need the raw
     * path for re-saving the .rsf file back to disk.
     */
    rawPath?: string;

    /**
     * Options specific to this model's loader. Example options may include:
     * - receiveShadow (boolean)
     * - useCustomDepthShaderMaterial (boolean)
     * - useOptimizedRaycast (boolean) -- default true; via three-mesh-bvh
     * - renderOrder (number)
     * - isTerrain (boolean) -- TODO: may remove in the future...
     * - optimizeGeometry (boolean)
     * - zScale (number)
     * - zOffset (number)
     * - orthophotoPath (string)
     */
    options?: any;
}

export enum SceneObjectType {
    /**
     * Loads an external resource referenced by an absolute
     * path on the filesystem or a relative path (relative to)
     * RSF file.
     */
    model = 'model',

    /**
     * A frame is just an arbitrary coordinate reference without a model
     * No data is required for the frame to load in.
     * 
     * It is useful for labeling transformations and placing other geometry
     * under different coordinate references.
     */
    frame = 'frame',

    /**
     * A custom visualization/ThreeJS object class that is registered at bootup
     * Custom channels may be hooked up to animate it in the viewer
     */
    annotation = 'annotation',
}

export interface SceneObjectBase {
    id: string;
    type: SceneObjectType;

    /**
     * Display name in the scene graph configuration
     */
    name: string;

    /**
     * Description to show under coresponding widgets
     */
    description?: string;

    parent?: string | null;

    /**
     * Transform relative to parent
     */
    position: Position;
    orientation: Orientation;

    /**
     * Used for custom kinematic channels that are registered at load time
     */
    joints?: Joints;

    /**
     * Optional label to display over the object
     */
    label?: {
        text: string;
        x: number;
        y: number;
        z: number;
    };

    tags?: string[];
}

export interface ModelSceneObject extends SceneObjectBase {
    type: SceneObjectType.model;
    model: ModelObjectData;
}

export interface FrameSceneObject extends SceneObjectBase {
    type: SceneObjectType.frame;
}

export enum AnnotationStaleBehavior {
    invisible = 'invisible',
    defaults = 'defaults'
}

export interface Table {
    refId?: string | null;

    // If this is not specified, the first table will be used
    table?: string | null;

    ignoreFirstSegment?: boolean;

    // Strip this leading dot-path prefix from every field name before
    // reconstructing the nested object (e.g. "navlib.EnavHeightmap.value").
    // Generalizes ignoreFirstSegment for multi-level prefixes.
    stripPath?: string;
}

export interface AnnotationOptions<TOptions> {
    /**
     * Links to a actual registered annotation that controls the rendering the viewer
     */
    type?: string;

    /**
     * Parent frame to place annotation in
     */
    parent?: string | null;

    /**
     * Tell the animator what to do when at least one channel
     * is older than the threshold or no previous data.
     */
    staleBehavior: AnnotationStaleBehavior;

    /**
     * Mark channels older than this as stale
     * `number` is the oldest a channel can be in ms before the annotation is marked stale
     * `false` will never mark it stale
     */
    staleThreshold: number | boolean;

    /**
     * Used for channelized data model
     */
    channels?: Record<string, Channel<any>>;

    /**
     * Used for structured data model
     */
    tables?: Record<string, Table>;

    /**
     * Type specific options to pass to the animator
     */
    options: TOptions;
}

export interface AnnotationSceneObject<T = any> extends SceneObjectBase {
    type: SceneObjectType.annotation;
    annotation: AnnotationOptions<T>;
}

export type SceneObject = (
    | ModelSceneObject
    | FrameSceneObject
    | AnnotationSceneObject
);

export type Scene = SceneObject[];

export interface SceneOptions {
    playbackSpeed: number;
    gridVisibility: boolean;
    up: UpOrientation;
    viewCube: boolean;

    // lighting
    lightDirection: [number, number, number];
    lightIntensity: number; // directional light
    ambientLightIntensity: number;
    sunAzimuth?: number;
    sunElevation?: number;

    // near, far plane, targetFocusOffset options
    // note that targetFocusOffset is in the robot frame
    camera?: any;
}

