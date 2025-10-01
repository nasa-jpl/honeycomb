import { CustomTelemetryAnimator } from '../src/CustomTelemetryAnimator';

describe('CustomTelemetryAnimator', () => {
    describe('mergeMap', () => {
        it('should be called to merge data.', () => {
            const frames = [
                { time: 0, state: { a: { b: 100, c: 1 } } },
                { time: 1, state: { a: { b: 200, c: 2 } } },
            ];

            let called = 0;
            const an = new CustomTelemetryAnimator(frames, {
                mergeMap: {
                    a: {
                        b: (from, to) => {
                            called++;
                            expect(from).toEqual(100);
                            return 1000;
                        },
                    },
                },
            });

            an.setTime(0.5);
            expect(called).toEqual(1);
            expect(an.state).toEqual({ a: { b: 1000, c: 1 } });

            an.reset();
            an.setTime(0.5);

            expect(called).toEqual(2);
            expect(an.state).toEqual({ a: { b: 1000, c: 1 } });
        });

        it('should be able to accumulate array data.', () => {
            const frames = [
                { time: 0, state: { a: [1] } },
                { time: 1, state: { a: [2] } },
                { time: 2, state: { a: [3] } },
            ];

            let called = 0;
            const an = new CustomTelemetryAnimator(frames, {
                mergeMap: {
                    a: (from, to) => {
                        called++;
                        to.push(...from);
                        return to;
                    },
                },
            });

            an.setTime(4);
            expect(called).toEqual(3);
            expect(an.state).toEqual({ a: [1, 2, 3] });

            an.reset();
            an.setTime(0.5);
            expect(called).toEqual(4);
            expect(an.state).toEqual({ a: [1] });
        });
    });

    describe('interpolateMap', () => {
        it('should get called to interpolate data.', () => {
            const frames = [
                { time: 0, state: { a: [1] } },
                { time: 1, state: { a: [2] } },
                { time: 2, state: { a: [3] } },
            ];

            const ratios = [];
            const an = new CustomTelemetryAnimator(frames, {
                interpolateMap: {
                    a: (curr, next, ratio, target) => {
                        ratios.push(ratio);
                        expect(target).toHaveLength(curr.length);

                        target[0] = (next[0] - curr[0]) * 0.5 + curr[0];
                        return target;
                    },
                },
            });
            an.continuous = true;
            an.interpolate = true;
            an.traverseArrays = true;

            an.setTime(0.5);
            expect(an.state).toEqual({ a: [1.5] });
        });
    });
});
