import { NestedTelemetryAnimator } from '../src/NestedTelemetryAnimator';

describe('NestedTelemetryAnimator', () => {
    describe('.setTime()', () => {
        it('should traverse nested objects', () => {
            const frames = [
                { time: 1, state: { a: { b: 1 } } },
                { time: 2, state: { a: { c: 2 } } },
            ];

            const an = new NestedTelemetryAnimator(frames);
            an.setTime(3);
            expect(an.state).toEqual({ a: { b: 1, c: 2 } });
        });
    });

    describe('interpolate', () => {
        describe('interpolate', () => {
            it('should interpolate nested values', () => {
                const frames = [
                    { time: 1, state: { a: { b: 1 } } },
                    { time: 2, state: { a: { b: 2 } } },
                ];
                const an = new NestedTelemetryAnimator(frames);
                an.continuous = true;
                an.interpolate = true;
                an.setTime(1.5);
                expect(an.state).toEqual({ a: { b: 1.5 } });
            });
        });

        describe('traverseArrays', () => {
            it('should merge objects in arrays if true', () => {
                const frames = [
                    { time: 1, state: { a: [{ b: 1 }] } },
                    { time: 2, state: { a: [{ c: 2 }] } },
                ];
                const an = new NestedTelemetryAnimator(frames);
                an.traverseArrays = false;
                an.setTime(3);
                expect(an.state).toEqual({ a: [{ c: 2 }] });

                an.reset();
                an.traverseArrays = true;
                an.setTime(3);
                expect(an.state).toEqual({ a: [{ b: 1, c: 2 }] });
            });

            it('should interpolate arrays if true', () => {
                const frames = [{ time: 1, state: { a: [1] } }, { time: 2, state: { a: [2] } }];
                const an = new NestedTelemetryAnimator(frames);
                an.traverseArrays = false;
                an.continuous = true;
                an.interpolate = true;
                an.setTime(1.5);
                expect(an.state).toEqual({ a: [1] });

                an.reset();
                an.traverseArrays = true;
                an.setTime(1.5);
                expect(an.state).toEqual({ a: [1.5] });
            });

            it('should retain the length of the previous array when merging.', () => {
                const frames = [
                    { time: 1, state: { a: [{ b: 1 }, { d: 1 }] } },
                    { time: 2, state: { a: [{ c: 2 }] } },
                ];
                const an = new NestedTelemetryAnimator(frames);
                an.traverseArrays = true;
                an.setTime(1.5);
                expect(an.state).toEqual({ a: [{ b: 1 }, { d: 1 }] });

                an.reset();
                an.setTime(3);
                expect(an.state).toEqual({ a: [{ b: 1, c: 2 }, { d: 1 }] });
            });
        });
    });
});
