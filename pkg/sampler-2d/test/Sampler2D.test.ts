import { Sampler2D } from '../src/Sampler2D';

function readAllChannels(x, y, sampler, func) {
    return new Array(sampler.channels).fill().map((el, i) => sampler[func](x, y, i));
}

describe('Sampler2D', () => {
    let sampler;
    let target;
    let result;
    beforeEach(() => {
        const data = new Float64Array([
            0, 0.5, 1, 1.5, 0, 0.5,
            1, 1.5, 2, 2.5, 1, 1.5,
            0, 0.5, 1, 1.5, 0, 0.5,
        ]);
        sampler = new Sampler2D(data, 3, 2);

        target = [];
    });

    describe('samplePixel', () => {
        it('should sample pixel values.', () => {
            result = sampler.samplePixel(0, 0, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([0, 0.5]);
            expect(readAllChannels(0, 0, sampler, 'samplePixelChannel')).toEqual(target);

            result = sampler.samplePixel(1, 0, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([1, 1.5]);
            expect(readAllChannels(1, 0, sampler, 'samplePixelChannel')).toEqual(target);

            result = sampler.samplePixel(1, 1, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([2, 2.5]);
            expect(readAllChannels(1, 1, sampler, 'samplePixelChannel')).toEqual(target);

            result = sampler.samplePixel(2, 2, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([0, 0.5]);
            expect(readAllChannels(2, 2, sampler, 'samplePixelChannel')).toEqual(target);
        });

        it('should fail if the sample is outside the bounds.', () => {
            result = sampler.samplePixel(-1, 0, target);
            expect(result).toBeFalsy();
            expect(readAllChannels(-1, 0, sampler, 'samplePixelChannel')).toEqual([null, null]);

            result = sampler.samplePixel(0, -1, target);
            expect(result).toBeFalsy();
            expect(readAllChannels(0, -1, sampler, 'samplePixelChannel')).toEqual([null, null]);

            result = sampler.samplePixel(3, 0, target);
            expect(result).toBeFalsy();
            expect(readAllChannels(3, 0, sampler, 'samplePixelChannel')).toEqual([null, null]);

            result = sampler.samplePixel(0, 3, target);
            expect(result).toBeFalsy();
            expect(readAllChannels(0, 3, sampler, 'samplePixelChannel')).toEqual([null, null]);

            result = sampler.samplePixel(-1e-5, 0, target);
            expect(result).toBeFalsy();
            expect(readAllChannels(-1e-5, 0, sampler, 'samplePixelChannel')).toEqual([null, null]);

            result = sampler.samplePixel(0, -1e-5, target);
            expect(result).toBeFalsy();
            expect(readAllChannels(0, -1e-5, sampler, 'samplePixelChannel')).toEqual([null, null]);

            result = sampler.samplePixel(2 + 1e-5, 0, target);
            expect(result).toBeFalsy();
            expect(readAllChannels(2 + 1e-5, 0, sampler, 'samplePixelChannel')).toEqual([
                null,
                null,
            ]);

            result = sampler.samplePixel(0, 2 + 1e-5, target);
            expect(result).toBeFalsy();
            expect(readAllChannels(0, 2 + 1e-5, sampler, 'samplePixelChannel')).toEqual([
                null,
                null,
            ]);
        });
    });

    describe('generateMipmap', () => {
        it('should generate a new even, non power of two child mipmap.', () => {
            const data = [
                0, 1, 2, 3, 4, 5,
                0, 1, 2, 3, 4, 5,
            ];
            const sampler = new Sampler2D(data, 6, 1);
            sampler.interpolate = false;

            const mipmap = sampler.generateMipMap();
            expect(sampler.interpolate).toEqual(false);
            expect(mipmap.data.constructor).toBe(sampler.data.constructor);
            expect(mipmap.data).toEqual([0.5, 2.5, 4.5]);
            expect(mipmap.width).toEqual(3);
            expect(mipmap.height).toEqual(1);
        });

        it('should generate a new power of two child mipmap.', () => {
            const data = [
                0, 1,
                1, 0,
            ];
            const sampler = new Sampler2D(data, 2, 1);
            const mipmap = sampler.generateMipMap();
            expect(mipmap.data.constructor).toBe(sampler.data.constructor);
            expect(mipmap.data).toEqual([0.5]);
            expect(mipmap.width).toEqual(1);
            expect(mipmap.height).toEqual(1);

            const mipmap2 = mipmap.generateMipMap();
            expect(mipmap2).toEqual(null);
        });

        it('should work on rectangular power of two samplers.', () => {
            const data = [
                0, 1, 0, 1,
                1, 0, 1, 0,
            ];
            const sampler = new Sampler2D(data, 4, 1);
            const mipmap = sampler.generateMipMap();
            expect(mipmap.data).toEqual([0.5, 0.5]);
            expect(mipmap.width).toEqual(2);
            expect(mipmap.height).toEqual(1);

            const mipmap2 = mipmap.generateMipMap();
            expect(mipmap2).toEqual(null);
        });

        it('should generate mipmaps for non power of two samplers.', () => {
            {
                const data = [
                    0, 1, 0,
                    1, 0, 1,
                ];
                const sampler = new Sampler2D(data, 3, 1);
                const mipmap = sampler.generateMipMap();
                expect(mipmap.data).toEqual([0.5]);
                expect(mipmap.width).toEqual(1);
                expect(mipmap.height).toEqual(1);

                const mipmap2 = mipmap.generateMipMap();
                expect(mipmap2).toEqual(null);
            }
            {
                const data = [
                    0, 1,
                    1, 0,
                    0, 1,
                ];
                const sampler = new Sampler2D(data, 2, 1);
                const mipmap = sampler.generateMipMap();
                expect(mipmap.data).toEqual([0.5]);
                expect(mipmap.width).toEqual(1);
                expect(mipmap.height).toEqual(1);

                const mipmap2 = mipmap.generateMipMap();
                expect(mipmap2).toEqual(null);
            }
            {
                const data = [
                    0, 1, 0,
                    1, 0, 1,
                    0, 1, 0,
                ];
                const sampler = new Sampler2D(data, 3, 1);
                const mipmap = sampler.generateMipMap();
                expect(mipmap.data).toEqual([4 / 9]);
                expect(mipmap.width).toEqual(1);
                expect(mipmap.height).toEqual(1);

                const mipmap2 = mipmap.generateMipMap();
                expect(mipmap2).toEqual(null);
            }
            {
                const data = [
                    0, 1, 2,
                    0, 1, 2,
                ];
                const sampler = new Sampler2D(data, 3, 1);
                const mipmap = sampler.generateMipMap();
                expect(mipmap.data).toEqual([1]);
                expect(mipmap.width).toEqual(1);
                expect(mipmap.height).toEqual(1);

                const mipmap2 = mipmap.generateMipMap();
                expect(mipmap2).toEqual(null);
            }
            {
                const data = [
                    0, 0,
                    1, 1,
                    2, 2,
                ];
                const sampler = new Sampler2D(data, 2, 1);
                const mipmap = sampler.generateMipMap();

                expect(mipmap.data).toEqual([1]);
                expect(mipmap.width).toEqual(1);
                expect(mipmap.height).toEqual(1);

                const mipmap2 = mipmap.generateMipMap();
                expect(mipmap2).toEqual(null);
            }
            {
                const data = [
                    0, 1, 0, 1, 0,
                    1, 0, 1, 0, 1,
                    0, 1, 0, 1, 0,
                    1, 0, 1, 0, 1,
                    0, 1, 0, 1, 0,
                ];
                const sampler = new Sampler2D(data, 5, 1);
                const mipmap = sampler.generateMipMap();

                const value = 1 * 2 + 0.5 * 2;
                const totalWeightPerQuadrant = 4 + 4 / 2 + 1 / 4;
                const finalValue = value / totalWeightPerQuadrant;
                const trimmedData = mipmap.data.map(d => Math.floor(1e6 * d) * 1e-6 );

                expect(trimmedData).toEqual([finalValue, finalValue, finalValue, finalValue]);
                expect(mipmap.width).toEqual(2);
                expect(mipmap.height).toEqual(2);
            }
        });
    });

    describe('sample', () => {
        it('should clamp values at edge.', () => {
            result = sampler.sample(0, 0, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([0, 0.5]);
            expect(readAllChannels(0, 0, sampler, 'sampleChannel')).toEqual(target);

            result = sampler.sample(1, 1, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([0, 0.5]);
            expect(readAllChannels(1, 1, sampler, 'sampleChannel')).toEqual(target);
        });

        it('should interpolate between pixels.', () => {
            result = sampler.sample(1 / 3, 0, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([0.5, 1]);
            expect(readAllChannels(1 / 3, 0, sampler, 'sampleChannel')).toEqual(target);

            result = sampler.sample(0, 1 / 3, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([0.5, 1]);
            expect(readAllChannels(0, 1 / 3, sampler, 'sampleChannel')).toEqual(target);

            result = sampler.sample(1 / 3, 1 / 3, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([1, 1.5]);
            expect(readAllChannels(1 / 3, 1 / 3, sampler, 'sampleChannel')).toEqual(target);

            result = sampler.sample(0.5, 0.5, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([2, 2.5]);
            expect(readAllChannels(0.5, 0.5, sampler, 'sampleChannel')).toEqual(target);
        });

        it('should not interpolate between pixels if false.', () => {
            sampler.interpolate = false;

            result = sampler.sample(1 / 4, 0, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([0, 0.5]);
            expect(readAllChannels(1 / 4, 0, sampler, 'sampleChannel')).toEqual(target);

            result = sampler.sample(0, 3 / 4, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([0, 0.5]);
            expect(readAllChannels(0, 3 / 4, sampler, 'sampleChannel')).toEqual(target);

            result = sampler.sample(1 / 4, 1 / 4, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([0, 0.5]);
            expect(readAllChannels(1 / 4, 1 / 4, sampler, 'sampleChannel')).toEqual(target);

            result = sampler.sample(3 / 4, 3 / 4, target);
            expect(result).toBeTruthy();
            expect(target).toEqual([0, 0.5]);
            expect(readAllChannels(3 / 4, 3 / 4, sampler, 'sampleChannel')).toEqual(target);
        });

        it('should sample the pixel centers as expected.', () => {
            {
                const data = [
                    0, 0,
                    1, 1,
                    2, 2,
                ];
                const sampler = new Sampler2D(data, 2, 1);
                sampler.sample(0.5, 0.5, target);
                expect(target).toEqual([1]);
                expect(readAllChannels(0.5, 0.5, sampler, 'sampleChannel')).toEqual(target);

                sampler.sample(0.5, 5 / 6, target);
                expect(target).toEqual([2]);
                expect(readAllChannels(0.5, 5 / 6, sampler, 'sampleChannel')).toEqual(target);
            }
            {
                const data = [
                    0, 1, 2,
                    0, 1, 2,
                ];
                const sampler = new Sampler2D(data, 3, 1);
                sampler.sample(0.5, 0.5, target);
                expect(target).toEqual([1]);
                expect(readAllChannels(0.5, 0.5, sampler, 'sampleChannel')).toEqual(target);

                sampler.sample(5 / 6, 0.5, target);
                expect(target).toEqual([2]);
                expect(readAllChannels(5 / 6, 0.5, sampler, 'sampleChannel')).toEqual(target);
            }
        });
    });

    describe('options', () => {
        beforeEach(() => {
            const data = new Float64Array([
                0, 0.5, 1, 0.5, 2, 0.5,
                0, 1.5, 1, 1.5, 2, 1.5,
                0, 2.5, 1, 2.5, 2, 2.5,
            ]);
            sampler = new Sampler2D(data, 3, 2);
            target = [];
        });

        describe('rowMajor', () => {
            it('should sample column major if false', () => {
                sampler.interpolate = false;
                sampler.rowMajor = true;
                sampler.samplePixel(0, 1, target);
                expect(target).toEqual([0, 1.5]);
                expect(readAllChannels(0, 1, sampler, 'samplePixelChannel')).toEqual(target);

                sampler.sample(0, 0.5, target);
                expect(target).toEqual([0, 1.5]);
                expect(readAllChannels(0, 0.5, sampler, 'sampleChannel')).toEqual(target);

                sampler.rowMajor = false;
                sampler.samplePixel(0, 1, target);
                expect(target).toEqual([1, 0.5]);
                expect(readAllChannels(0, 1, sampler, 'samplePixelChannel')).toEqual(target);

                sampler.sample(0, 0.5, target);
                expect(target).toEqual([1, 0.5]);
                expect(readAllChannels(0, 0.5, sampler, 'sampleChannel')).toEqual(target);
            });
        });

        describe('invertX', () => {
            it('should invert the x value if true', () => {
                sampler.interpolate = false;
                sampler.invertX = false;
                sampler.samplePixel(0, 0, target);
                expect(target).toEqual([0, 0.5]);
                expect(readAllChannels(0, 0, sampler, 'samplePixelChannel')).toEqual(target);

                sampler.sample(0, 0, target);
                expect(target).toEqual([0, 0.5]);
                expect(readAllChannels(0, 0, sampler, 'sampleChannel')).toEqual(target);

                sampler.invertX = true;
                sampler.samplePixel(0, 0, target);
                expect(target).toEqual([2, 0.5]);
                expect(readAllChannels(0, 0, sampler, 'samplePixelChannel')).toEqual(target);

                sampler.sample(0, 0, target);
                expect(target).toEqual([2, 0.5]);
                expect(readAllChannels(0, 0, sampler, 'sampleChannel')).toEqual(target);
            });
        });

        describe('invertY', () => {
            it('should invert the y value if true', () => {
                sampler.interpolate = false;
                sampler.invertY = false;
                sampler.samplePixel(0, 0, target);
                expect(target).toEqual([0, 0.5]);
                expect(readAllChannels(0, 0, sampler, 'samplePixelChannel')).toEqual(target);

                sampler.sample(0, 0, target);
                expect(target).toEqual([0, 0.5]);
                expect(readAllChannels(0, 0, sampler, 'sampleChannel')).toEqual(target);

                sampler.invertY = true;
                sampler.samplePixel(0, 0, target);
                expect(target).toEqual([0, 2.5]);
                expect(readAllChannels(0, 0, sampler, 'samplePixelChannel')).toEqual(target);

                sampler.sample(0, 0, target);
                expect(target).toEqual([0, 2.5]);
                expect(readAllChannels(0, 0, sampler, 'sampleChannel')).toEqual(target);
            });
        });
    });
});
