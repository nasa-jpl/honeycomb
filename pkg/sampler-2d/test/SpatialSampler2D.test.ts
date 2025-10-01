import { SpatialSampler2D } from '../src/SpatialSampler2D';

function readAllChannels(x, y, sampler, func) {
    return new Array(sampler.channels).fill().map((el, i) => sampler[func](x, y, i));
}

describe('SpatialSampler2D', () => {
    let sampler;
    let target;
    let result;
    beforeEach(() => {
        const data = new Float64Array([
            0, 0.5, 1, 1.5, 0, 0.5,
            1, 1.5, 2, 2.5, 1, 1.5,
            0, 0.5, 1, 1.5, 0, 0.5,
        ]);
        sampler = new SpatialSampler2D(data, 3, 2);

        target = [];
    });

    describe('spatialSample', () => {
        it('should account for offsets when sampling textures.', () => {
            sampler.setMinMax(-10, -20, 0, -15);

            result = sampler.spatialSample(-10, -20, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([0, 0.5]);
            expect(readAllChannels(-10, -20, sampler, 'spatialSampleChannel')).toEqual(target);

            result = sampler.spatialSample(0, -15, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([0, 0.5]);
            expect(readAllChannels(0, -15, sampler, 'spatialSampleChannel')).toEqual(target);

            result = sampler.spatialSample(-5, -17.5, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([2, 2.5]);
            expect(readAllChannels(-5, -17.5, sampler, 'spatialSampleChannel')).toEqual(target);

            result = sampler.spatialSample(-10 + 10 / 3, -20 + 5 / 3, target);
            expect(result).toBeTruthy();
            expect(
                readAllChannels(-10 + 10 / 3, -20 + 5 / 3, sampler, 'spatialSampleChannel'),
            ).toEqual(target);
        });

        it('should fail if the sample is outside the bounds.', () => {
            sampler.setMinMax(-10, -20, 0, -15);

            result = sampler.spatialSample(-10.01, -18, target);
            expect(result).toBeFalsy();
            expect(readAllChannels(-10.01, -18, sampler, 'spatialSampleChannel')).toEqual([
                null,
                null,
            ]);

            result = sampler.spatialSample(1e-5, -18, target);
            expect(result).toBeFalsy();
            expect(readAllChannels(1e-5, -18, sampler, 'spatialSampleChannel')).toEqual([
                null,
                null,
            ]);

            result = sampler.spatialSample(-5, -14.99, target);
            expect(result).toBeFalsy();
            expect(readAllChannels(-5, -14.99, sampler, 'spatialSampleChannel')).toEqual([
                null,
                null,
            ]);

            result = sampler.spatialSample(0, -20.01, target);
            expect(result).toBeFalsy();
            expect(readAllChannels(0, -20.01, sampler, 'spatialSampleChannel')).toEqual([
                null,
                null,
            ]);
        });
    });
});
