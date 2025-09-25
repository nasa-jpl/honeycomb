import { isTypedArray } from "@gov.nasa.jpl.honeycomb/common";
import { Material, Mesh, Object3D, Texture } from "three";

/**
 * Utility class for sharing equivelant textures and materials between objects
 * in a hierarchy of objects.
 */
export class MaterialReducer {
    /**
     * A set of keys to ignore when comparing materials and textures. Defaults to
     * just include "uuid".
     * @member {Set}
     * @default ['uuid']
     */
    ignoreKeys: Set<string>;

    /**
     * Whether to share texture instances between the final materials.
     * @member {Boolean}
     * @default true
     */
    shareTextures: boolean;

    textures: Texture[];
    materials: Material[];

    constructor() {
        this.ignoreKeys = new Set(['uuid']);
        this.shareTextures = true;
        this.textures = [];
        this.materials = [];
    }

    areEqual(objectA: any, objectB: any) {
        const keySet = new Set<string>();
        const traverseSet = new Set<string>();
        const ignoreKeys = this.ignoreKeys;

        const traverse = (a: any, b: any): boolean => {
            if (a === b) {
                return true;
            }

            if (a && b && a instanceof Object && b instanceof Object) {
                if (traverseSet.has(a) || traverseSet.has(b)) {
                    throw new Error('MaterialReducer: Material is recursive.');
                }

                const aIsElement = a instanceof Element;
                const bIsElement = b instanceof Element;
                if (aIsElement || bIsElement) {
                    if (aIsElement !== bIsElement || !(a instanceof Image) || !(b instanceof Image)) {
                        return false;
                    }
                    return a.src === b.src;
                }

                if ('equals' in a) {
                    return (a.equals as any)(b);
                }

                const aIsTypedArray = isTypedArray(a);
                const bIsTypedArray = isTypedArray(b);
                if (aIsTypedArray || bIsTypedArray) {
                    if (aIsTypedArray !== bIsTypedArray || a.constructor !== b.constructor || a.length !== b.length) {
                        return false;
                    }

                    for (let i = 0, l = a.length; i < l; i++) {
                        if (a[i] !== b[i]) {
                            return false;
                        }
                    }
                    return true;
                }

                traverseSet.add(a);
                traverseSet.add(b);

                keySet.clear();
                for (const key in a) {
                    if (!Object.prototype.hasOwnProperty.call(key, a) || a[key] instanceof Function || ignoreKeys.has(key)) {
                        continue;
                    }
                    keySet.add(key);
                }
                for (const key in b) {
                    if (!Object.prototype.hasOwnProperty.call(b, key) || b[key] instanceof Function || ignoreKeys.has(key)) {
                        continue;
                    }
                    keySet.add(key);
                }

                const keys = Array.from(keySet.values());
                let result = true;
                for (const key of keys) {
                    if (ignoreKeys.has(key)) {
                        continue;
                    }

                    result = traverse(a[key], b[key]);
                    if (!result) {
                        break;
                    }
                }

                traverseSet.delete(a);
                traverseSet.delete(b);
                return result;
            }

            return false;
        };

        return traverse(objectA, objectB);
    }

    /**
     * Process the given hierarchy of objects to reduce the number of materials and textures.
     * Returns the number of materials removed. Materials and textures are shared over subsequent
     * runs of the function.
     * @param {Object3D} object
     * @returns {Number}
     */
    process(object: Object3D): number {
        const { materials, textures } = this;
        let replaced = 0;

        const processMaterial = (material: Material) => {
            // Check if another material matches this one
            let foundMaterial: Material | null = null;
            for (const otherMaterial of materials) {
                if (this.areEqual(material, otherMaterial)) {
                    foundMaterial = otherMaterial;
                }
            }

            if (foundMaterial) {
                replaced++;
                return foundMaterial;
            } else {
                materials.push(material);

                if (this.shareTextures) {
                    // See if there's another texture that matches the ones on this material
                    for (const key in material) {
                        if (!Object.prototype.hasOwnProperty.call(material, key)) {
                            continue;
                        }

                        const value = (material as any)[key];
                        if (value && value.isTexture && value.image instanceof Image) {
                            let foundTexture: Texture | null = null;
                            for (const texture of textures) {
                                if (this.areEqual(texture, value)) {
                                    foundTexture = texture;
                                    break;
                                }
                            }

                            if (foundTexture) {
                                (material as any)[key] = foundTexture;
                            } else {
                                textures.push(value);
                            }
                        }
                    }
                }

                return material;
            }
        };

        object.traverse(c => {
            if ((c as Mesh).isMesh && (c as Mesh).material) {
                const material = (c as Mesh).material;
                if (Array.isArray(material)) {
                    for (let i = 0; i < material.length; i++) {
                        material[i] = processMaterial(material[i]);
                    }
                } else {
                    (c as Mesh).material = processMaterial(material);
                }
            }
        });
        return replaced;
    }
}
