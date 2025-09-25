import { SceneOptions, Scene } from "@gov.nasa.jpl.honeycomb/core";
import { UpOrientation } from "@gov.nasa.jpl.honeycomb/scene-viewers";

export interface DataVolumeField {
    field?: string;
    name: string;
    color: string;
}

export interface FrameTrajectoryField {
    id: undefined;
    frame?: string | null;
    color: string;
}


export interface FrameTrajectoriesOptions {
    timeStep: number;
    renderOrder: number;
    frameTrajectories: FrameTrajectoryField[];
}

export interface UiGroup {
    name?: string;
    description?: string;
    items?: string[];
}

export type Vec3 = [x: number, y: number, z: number];

export interface WorldOptions {
    playbackSpeed: number;
    gridVisibility: boolean;
    up: UpOrientation;
    viewCube: boolean;
    sunDirection: Vec3;
    sunIntensity: number;
}

export interface HoneycombPanelOptions {
    worldOptions: SceneOptions;
    scene: Scene;
    dataVolumes: DataVolumeField[];
    frameTrajectoriesOptions: FrameTrajectoriesOptions;
    tagGroups: UiGroup[];
    widgetGroups: UiGroup[];
}
