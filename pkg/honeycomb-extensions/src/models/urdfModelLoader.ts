import * as pathM from 'path';
import {
    Loaders,
    LoadingManager,
    convertStandardMaterialToPhong
} from '@gov.nasa.jpl.honeycomb/core';

import { MaterialReducer } from '@gov.nasa.jpl.honeycomb/three-extensions';
import { Material, MeshPhongMaterial, Object3D } from 'three';
import type { URDFRobot } from 'urdf-loader';


export interface URDFOptions {
    ignoreJointLimits: boolean;
    parseVisual: boolean;
    parseCollision: boolean;
    packages: Record<string, string> | ((pkg: string) => string);
}

async function loadURDF(path: string, options: Partial<URDFOptions>, manager: LoadingManager): Promise<Object3D> {
    const URDFLoader = await import('urdf-loader');

    return await new Promise((resolve, reject) => {
        const COLLISION_COLOR = 16720639;
        let result: URDFRobot | null = null;
        manager = new LoadingManager(manager);
        manager.addEventListener('complete', () => {
            if (result === null) {
                return;
            }

            // reduce the materials
            const materialReducer = new MaterialReducer();
            materialReducer.process(result);

            // convert srgb colors to linear
            const materials: Set<Material> = new Set();
            result.traverse((c: any) => {
                if (c.material) {
                    if (Array.isArray(c.material)) {
                        c.material.forEach((m: any) => materials.add(m));
                    } else {
                        materials.add(c.material);
                    }
                }
            });
            materials.forEach(material => {
                (material as any).color.convertSRGBToLinear();
            });

            // color the collision meshes
            const collisionMaterial = new MeshPhongMaterial({
                color: COLLISION_COLOR,
                opacity: 0.25,
                transparent: true,
                depthWrite: false,
            });
            result.traverse((c_1: any) => {
                if (c_1.isURDFCollider) {
                    c_1.traverse((m_1: any) => {
                        if (m_1.isMesh) {
                            m_1.material = collisionMaterial;
                        }
                    });
                }
            });

            convertStandardMaterialToPhong(result);
            result.traverse((c: any) => {
                if (c.isMesh && !c.material.transparent || !c.isMesh) {
                    c.castShadow = true;
                }
                c.receiveShadow = true;
            });

            (result as any).type = "URDFRobot";

            // finish the load
            resolve(result);
        });

        const urdfDirectory = pathM.dirname(path);

        const packageOptions = options.packages;
        options.packages = (pkg: string) => {
            if (packageOptions && typeof packageOptions !== "function" && packageOptions[pkg]) {
                return packageOptions[pkg];
            } else {
                return urdfDirectory;
            }
        };

        const loader = new URDFLoader.default(manager);
        Object.assign(
            loader,
            {
                loadMeshCb: (path_2: string, manager_1: LoadingManager, done: (res: any) => void) => {
                    // add an item to the loading manager so we don't "complete" until we've
                    // had a chance to process the materials.
                    manager_1.itemStart(`${path_2}-materials`);
                    Loaders.loadModel(undefined, path_2, options, manager_1)
                        .then(res => {
                            done(res);
                        })
                        .catch(() => {
                        })
                        .finally(() => {
                            manager_1.itemEnd(`${path_2}-materials`);
                        });
                }
            },
            options);

        const resolvedPath = manager.resolveURL(path);
        manager.itemStart(resolvedPath);
        loader.load(
            resolvedPath,
            robot => {
                if (options.ignoreJointLimits) {
                    const joints = robot.joints;
                    for (const key in joints) {
                        joints[key].ignoreLimits = true;
                    }
                }

                result = robot;
                manager.itemEnd(resolvedPath);
            },
            undefined,
            err => {
                manager.itemEnd(resolvedPath);
                reject(err);
            });
    });
}

export { loadURDF };
