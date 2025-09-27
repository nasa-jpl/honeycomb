import { Loaders } from '@gov.nasa.jpl.honeycomb/core';
import { loadGLTF } from './models/gltfModelLoader';
import { loadCollada } from './models/colladaModelLoader';
import { loadSTL } from './models/stlModelLoader';
import { loadFBX } from './models/fbxModelLoader';
import { loadObj } from './models/objModelLoader';
import { loadURDF } from './models/urdfModelLoader';
import { loadXacro } from './models/xacroModelLoader';
import { loadVicarHeightMap } from './models/vicarModelLoader';
import { loadPGMHeightMap } from './models/pgmModelLoader';
import { loadGeoTiff } from './models/geoTiffModelLoader';

export * from './drivers/KinematicsDriver';
export * from './drivers/AnnotationDriver';
import { loadRos } from './telemetry/loadRos';
import { loadCSV } from './telemetry/loadCSV';

import {
    loadSGITextureFunction,
    loadPGMTextureFunction,
    loadTextureFunction,
} from './textures/loadTextureFunctions';

export function registerCommonLoaders() {
    Loaders.registerDriver('CameraDisplayDriver', async (options, manager) => {
        const { CameraDisplayDriver } = await import('./drivers/CameraDisplayDriver');
        return new CameraDisplayDriver(options, manager);
    });

    Loaders.registerDriver('TilesRendererDriver', async (options, manager) => {
        const { TilesRendererDriver } = await import('./drivers/TilesRendererDriver');
        return new TilesRendererDriver(options, manager);
    });

    Loaders.registerTelemetryAnimatorLoader(['ros', 'rosbag'], loadRos);

    Loaders.registerDriver('RosDriver', async ( options, manager ) => {
        const { RosDriver } = await import('./drivers/RosDriver');
        return new RosDriver(options);
    });

    Loaders.registerDriver('KinematicsDriver', async ( options, manager ) => {
        const { KinematicsDriver } = await import('./drivers/KinematicsDriver');
        return new KinematicsDriver(manager, options);
    });

    Loaders.registerTelemetryAnimatorLoader('csv', loadCSV);

    Loaders.registerDriver('KinematicsDriver', async (_, manager) => {
        const { KinematicsDriver } = await import('./drivers/KinematicsDriver');
        return new KinematicsDriver(manager);
    });

    // register model loaders
    Loaders.registerModelLoader({
        name: 'GTLF',
        description: 'Supports binary .glb and text JSON .gtlf',
        ext: ['gltf', 'glb'],
        load: loadGLTF
    });

    Loaders.registerModelLoader({
        name: 'Collada',
        ext: 'dae',
        load: loadCollada
    });

    Loaders.registerModelLoader({
        name: 'STL',
        description: 'Raw mesh (no textures)',
        ext: 'stl',
        load: loadSTL
    });

    Loaders.registerModelLoader({
        name: 'FBX',
        ext: 'fbx',
        load: loadFBX
    });

    Loaders.registerModelLoader({
        name: 'OBJ',
        ext: 'obj',
        load: loadObj
    });

    Loaders.registerModelLoader({
        name: 'URDF',
        description: 'ROS2 Unified Robotics Description Format',
        ext: 'urdf',
        load: loadURDF,
        optionSchema: {
            type: "object",
            properties: {
                ignoreJointLimits: {
                    type: "boolean",
                    title: "Ignore Joint Limits",
                    description: "Allow unbounded joints motion in visualization",
                    default: false
                },
                parseVisual: {
                    type: "boolean",
                    title: "Visual",
                    description: "Load the visual mesh",
                    default: true
                },
                parseCollision: {
                    type: "boolean",
                    title: "Collision",
                    description: "Load the collision volume",
                    default: true
                },
                packages: {
                    type: "object",
                    title: "Packages",
                    description: "Handles 'package://' entries in the URDF",
                    additionalProperties: { type: "string" }
                }
            }
        }
    });

    Loaders.registerModelLoader({
        name: 'XACRO (URDF)',
        description: 'Macro XML that wraps a URDF',
        ext: 'xacro',
        load: loadXacro
    });

    Loaders.registerModelLoader({
        name: 'VICAR',
        description: 'VICAR Heightmap',
        ext: 'ht',
        load: loadVicarHeightMap
    });

    Loaders.registerModelLoader({
        name: 'PGM',
        description: 'Portable graymap file for text-based heightmap',
        ext: 'pgm',
        load: loadPGMHeightMap
    });

    Loaders.registerModelLoader({
        name: 'GeoTIFF',
        description: 'GeoTIFF Textured heightmaps',
        ext: 'tif',
        load: loadGeoTiff
    });

    // register texture loaders
    Loaders.registerTextureLoader('rgb', loadSGITextureFunction);

    Loaders.registerTextureLoader('pgm', loadPGMTextureFunction);

    Loaders.registerTextureLoader(['png', 'jpg', 'jpeg'], loadTextureFunction);
}
