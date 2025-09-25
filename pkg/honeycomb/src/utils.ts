import { Terrain } from '@gov.nasa.jpl.honeycomb/terrain-rendering';
import type { URDFRobot, URDFJoint } from 'urdf-loader';
import {
    DirectionalLight,
    Light,
    BufferGeometry,
    Material,
    MeshPhongMaterial,
    MeshStandardMaterial,
    Object3D
} from 'three';

interface ObjectAdditions extends Object3D {
    material?: Material[] | Material,
    geometry?: BufferGeometry
}

export function convertStandardMaterialToPhong(obj: Object3D) {
    const materialMap = new Map();
    obj.traverse((c: ObjectAdditions) => {
        if (c.material) {
            const geom = c.geometry;
            const mat = Array.isArray(c.material) ? c.material : [c.material];
            const newMat = mat.map((ogMat: MeshStandardMaterial | (Material & { isMeshStandardMaterial?: undefined }) | any) => {
                if (ogMat.isMeshStandardMaterial) {
                    if (materialMap.has(ogMat)) {
                        return materialMap.get(ogMat);
                    } else {
                        const phongMat = new MeshPhongMaterial();
                        phongMat.map = ogMat.map;
                        phongMat.normalMap = ogMat.normalMap;
                        phongMat.normalMapType = ogMat.normalMapType;
                        phongMat.shininess = (1 - ogMat.roughness) * 100;
                        phongMat.color.copy(ogMat.color);
                        phongMat.opacity = ogMat.opacity;
                        phongMat.transparent = ogMat.transparent;
                        phongMat.flatShading = 'normal' in (geom?.attributes ?? {}) ? false : true;

                        materialMap.set(ogMat, phongMat);
                        return phongMat;
                    }
                } else {
                    return ogMat;
                }
            });

            if (Array.isArray(c.material)) {
                c.material = newMat;
            } else {
                c.material = newMat[0];
            }
        }
    });
}

export function isLight(object: Object3D): object is Light {
    return (object as any).isLight;
}

export function isDirectionalLight(object: Object3D): object is DirectionalLight {
    return (object as any).isDirectionalLight;
}

export function isTerrain(object: Object3D): object is Terrain {
    return (object as any).isTerrain;
}

export function isRobot(object: Object3D): object is URDFRobot {
    return (object as any).isURDFRobot;
}

export function isURDFJoint(object: Object3D): object is URDFJoint {
    return (object as any).isURDFJoint;
}

export function isFrame(object: Object3D): object is URDFJoint {
    return (object as any).isFrame;
}

export function isAnnotation(object: Object3D): boolean {
    return (object as any).isAnnotation;
}

export function isClickableObject(object: Object3D): boolean {
    return !(object as any).isPsuedoObject || (object as any).isClickable;
}

export function isExplicitlyClickable(object: Object3D): boolean {
    return (object as any).isClickable;
}

export function isPsuedoObject(object: Object3D): boolean {
    return (object as any).isPsuedoObject;
}
