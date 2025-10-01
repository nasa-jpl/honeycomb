import { toNormalizedByteArray, toFloatArray } from '../src/arrayConverters';

describe('toFloatArray', () => {
    it('should be able to convert uint arrays.', () => {
        const arr8 = new Uint8Array([0, 2 ** 8 - 1]);
        const arr16 = new Uint16Array([0, 2 ** 16 - 1]);
        const arr32 = new Uint32Array([0, 2 ** 32 - 1]);

        const ans32 = new Float32Array([0, 1]);
        const ans64 = new Float64Array([0, 1]);

        expect(toFloatArray(arr8, 4)).toEqual(ans32);
        expect(toFloatArray(arr16, 4)).toEqual(ans32);
        expect(toFloatArray(arr32, 4)).toEqual(ans32);

        expect(toFloatArray(arr8, 8)).toEqual(ans64);
        expect(toFloatArray(arr16, 8)).toEqual(ans64);
        expect(toFloatArray(arr32, 8)).toEqual(ans64);
    });

    it('should be able to convert int arrays.', () => {
        const arr8 = new Int8Array([-1 * (2 ** 7 - 1), 0, 2 ** 7 - 1]);
        const arr16 = new Int16Array([-1 * (2 ** 15 - 1), 0, 2 ** 15 - 1]);
        const arr32 = new Int32Array([-1 * (2 ** 31 - 1), 0, 2 ** 31 - 1]);

        const ans32 = new Float32Array([-1, 0, 1]);
        const ans64 = new Float64Array([-1, 0, 1]);

        expect(toFloatArray(arr8, 4)).toEqual(ans32);
        expect(toFloatArray(arr16, 4)).toEqual(ans32);
        expect(toFloatArray(arr32, 4)).toEqual(ans32);

        expect(toFloatArray(arr8, 8)).toEqual(ans64);
        expect(toFloatArray(arr16, 8)).toEqual(ans64);
        expect(toFloatArray(arr32, 8)).toEqual(ans64);
    });

    it('should convert float arrays.', () => {
        const float32 = new Float32Array([-500, 0, 500]);
        const float64 = new Float64Array([-500, 0, 500]);

        expect(toFloatArray(float32, 4)).toEqual(float32);
        expect(toFloatArray(float32, 8)).toEqual(float64);

        expect(toFloatArray(float64, 4)).toEqual(float32);
        expect(toFloatArray(float64, 8)).toEqual(float64);
    });
});

describe('toNormalizedByteArray', () => {
    it('should be able to convert float arrays to uint arrays.', () => {
        const float32 = new Float32Array([-1, 0, 1]);
        const float64 = new Float64Array([-1, 0, 1]);

        const ans8 = new Uint8Array([0, 0, 2 ** 8 - 1]);
        const ans16 = new Uint16Array([0, 0, 2 ** 16 - 1]);
        const ans32 = new Uint32Array([0, 0, 2 ** 32 - 1]);

        expect(toNormalizedByteArray(float32, false, 1)).toEqual(ans8);
        expect(toNormalizedByteArray(float32, false, 2)).toEqual(ans16);
        expect(toNormalizedByteArray(float32, false, 4)).toEqual(ans32);

        expect(toNormalizedByteArray(float64, false, 1)).toEqual(ans8);
        expect(toNormalizedByteArray(float64, false, 2)).toEqual(ans16);
        expect(toNormalizedByteArray(float64, false, 4)).toEqual(ans32);
    });

    it('should be able to convert float arrays to int arrays.', () => {
        const float32 = new Float32Array([-1, 0, 1]);
        const float64 = new Float64Array([-1, 0, 1]);

        const ans8 = new Int8Array([-1 * (2 ** 7 - 1), 0, 2 ** 7 - 1]);
        const ans16 = new Int16Array([-1 * (2 ** 15 - 1), 0, 2 ** 15 - 1]);
        const ans32 = new Int32Array([-1 * (2 ** 31 - 1), 0, 2 ** 31 - 1]);

        expect(toNormalizedByteArray(float32, true, 1)).toEqual(ans8);
        expect(toNormalizedByteArray(float32, true, 2)).toEqual(ans16);
        expect(toNormalizedByteArray(float32, true, 4)).toEqual(ans32);

        expect(toNormalizedByteArray(float64, true, 1)).toEqual(ans8);
        expect(toNormalizedByteArray(float64, true, 2)).toEqual(ans16);
        expect(toNormalizedByteArray(float64, true, 4)).toEqual(ans32);
    });

    it('should be able to convert between int arrays', () => {
        const uint8 = new Uint8Array([0, 0, 255]);
        const int8 = new Int8Array([-127, 0, 127]);

        let ans;

        ans = new Uint16Array([0, 0, 2 ** 16 - 1]);
        expect(toNormalizedByteArray(uint8, false, 2)).toEqual(ans);

        ans = new Int16Array([0, 0, 2 ** 15 - 1]);
        expect(toNormalizedByteArray(uint8, true, 2)).toEqual(ans);

        ans = new Uint16Array([0, 0, 2 ** 16 - 1]);
        expect(toNormalizedByteArray(int8, false, 2)).toEqual(ans);

        ans = new Int16Array([-1 * (2 ** 15 - 1), 0, 2 ** 15 - 1]);
        expect(toNormalizedByteArray(int8, true, 2)).toEqual(ans);
    });
});
