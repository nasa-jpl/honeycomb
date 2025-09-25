import { getArrayMinMax, isFloatArray, TypedArray } from '@gov.nasa.jpl.honeycomb/common';
import { toNormalizedByteArray } from './arrayConverters';
import { BufferAttribute, BufferGeometry, GLBufferAttribute, InterleavedBufferAttribute } from 'three';

function optimizeFloatBuffer(
    bufferAttribute: BufferAttribute | InterleavedBufferAttribute | GLBufferAttribute,
    checkBounds: boolean,
    bytes: number,
    signed?: boolean
) {
    if ("isInterleavedBufferAttribute" in bufferAttribute && bufferAttribute.isInterleavedBufferAttribute) {
        return;
    }

    if (!("array" in bufferAttribute) || !isFloatArray(bufferAttribute.array as TypedArray)) {
        return;
    }

    if ((bufferAttribute.array as TypedArray).BYTES_PER_ELEMENT === bytes) {
        return;
    }

    if (checkBounds) {
        const { min, max } = getArrayMinMax(bufferAttribute.array as TypedArray);
        if (min < -1 || max > 1) {
            return;
        }

        if (signed === undefined) {
            signed = min < 0;
        }
    } else if (signed === undefined) {
        signed = true;
    }

    (bufferAttribute as BufferAttribute).array = toNormalizedByteArray(bufferAttribute.array as TypedArray, signed, bytes);
    bufferAttribute.normalized = true;
}

/**
 * Takes a buffer geometry and optimizes the memory of the uv, uv2, normal, and index attributes
 * in place to normalized attributes. Note that UVs outside the range of [0, 1] will not normalize
 * correctly.
 *
 * !> Note that the `BufferAttributes` are modified in place instead of creating new ones.
 *
 * !> Note that InterleavedBufferAttributes are not supported.
 * 
 * !> Note that this reduces the precision of the normals which reduces the resolution of any
 * calculations that depend on the normals (e.g., visualizing a slope map)
 *
 * @param {BufferGeometry} geometry
 * @returns {void}
 */
function optimizeGeometry(geometry: BufferGeometry): void {
    const index = geometry.getIndex();
    if (index && !("isInterleavedBufferAttribute" in index && index.isInterleavedBufferAttribute)) {
        const position = geometry.getAttribute('position');
        let c;
        if (position.count < 2 ** 8 - 1) {
            c = Uint8Array;
        } else if (position.count < 2 ** 16 - 1) {
            c = Uint16Array;
        } else if (position.count < 2 ** 32 - 1) {
            c = Uint32Array;
        } else {
            throw new Error(`Invalid size of ${position.count}`);
        }

        if (!(index.array instanceof c)) {
            index.array = new c(index.array);
        }
    }

    const normal = geometry.getAttribute('normal');
    if (normal) {
        optimizeFloatBuffer(normal, false, 1, true);
    }

    const uv = geometry.getAttribute('uv');
    if (uv) {
        optimizeFloatBuffer(uv, true, 2, false);
    }

    const uv2 = geometry.getAttribute('uv2');
    if (uv2) {
        optimizeFloatBuffer(uv2, true, 2, false);
    }
}

export { optimizeGeometry };
