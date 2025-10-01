import { optimizeGeometry } from '../src/geometryOptimizers';
import { BoxBufferGeometry } from 'three';

describe('optimizeGeometry', () => {
    it('should not change a geometry if it is optimized twice.', () => {
        const geom = new BoxBufferGeometry(1, 1, 1, 5, 5, 5);

        const index1 = geom.index.array;
        const uv1 = geom.attributes.uv.array;
        const normal1 = geom.attributes.normal.array;
        optimizeGeometry(geom);
        expect(geom.index.array).not.toBe(index1);
        expect(geom.attributes.uv.array).not.toBe(uv1);
        expect(geom.attributes.normal.array).not.toBe(normal1);

        const index2 = geom.index.array;
        const uv2 = geom.attributes.uv.array;
        const normal2 = geom.attributes.normal.array;
        optimizeGeometry(geom);
        expect(geom.index.array).toBe(index2);
        expect(geom.attributes.uv.array).toBe(uv2);
        expect(geom.attributes.normal.array).toBe(normal2);
    });

    it('should optimize attributes to normalized buffers.', () => {
        const geom = new BoxBufferGeometry(1, 1, 1, 5, 5, 5);
        optimizeGeometry(geom);

        expect(geom.index.array instanceof Uint8Array).toBeTruthy();
        expect(geom.index.normalized).toBeFalsy();

        expect(geom.attributes.uv.array instanceof Uint16Array).toBeTruthy();
        expect(geom.attributes.uv.normalized).toBeTruthy();

        expect(geom.attributes.normal.array instanceof Int8Array).toBeTruthy();
        expect(geom.attributes.normal.normalized).toBeTruthy();
    });

    it('should not optimize attributes that cannot be normalized.', () => {
        const geom = new BoxBufferGeometry(1, 1, 1, 5, 5, 5);
        const uvArray = geom.attributes.uv.array;

        uvArray[0] = -1.1;
        optimizeGeometry(geom);
        expect(geom.attributes.uv.array).toBe(uvArray);

        uvArray[0] = 1.1;
        optimizeGeometry(geom);
        expect(geom.attributes.uv.array).toBe(uvArray);

        uvArray[0] = -0.5;
        optimizeGeometry(geom);
        expect(geom.attributes.uv.array).not.toBe(uvArray);
    });
});
