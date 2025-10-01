import { TelemetryAnimator } from '../src/TelemetryAnimator';

describe('TelemetryAnimator', () => {
    it('should return the amount of time from a set of frames.', () => {
        const frames = [
            { time: 100, state: {} },
            { time: 120, state: {} },
            { time: 121, state: {} },
        ];
        const an = new TelemetryAnimator(frames);
        expect(an.frames).toEqual(frames);
        expect(an.endTime).toBe(121);
        expect(an.startTime).toBe(100);
        expect(an.ready).toBe(true);
    });

    it('should return 0 if no frames are set.', () => {
        const an = new TelemetryAnimator();
        expect(an.frames).toEqual(null);
        expect(an.endTime).toBe(0);
        expect(an.startTime).toBe(0);
        expect(an.ready).toBe(false);
    });

    it('should not sort frames automatically.', () => {
        const frames = [
            { time: 100, state: {} },
            { time: 122, state: {} },
            { time: 121, state: {} },
        ];
        const an = new TelemetryAnimator(frames);
        expect(an.frames.map(f => f.time)).toEqual([100, 122, 121]);
    });

    it('should not optimize frames automatically.', () => {
        const frames = [
            { time: 100, state: { a: 1 } },
            { time: 100, state: { b: 2 } },
            { time: 121, state: { c: 3 } },
        ];
        const an = new TelemetryAnimator(frames);
        expect(an.frames.map(f => f.time)).toEqual([100, 100, 121]);
    });

    describe('.seekBack()', () => {
        it('should iterate back through the frames starting at the current time.', () => {
            const frames = [
                { time: 0, state: { a: 1 } },
                { time: 1, state: { b: 2 } },
                { time: 2, state: { c: 3 } },
                { time: 3, state: { c: 3 } },
                { time: 4, state: { c: 3 } },
            ];
            const an = new TelemetryAnimator(frames);
            an.setTime(3);

            const times = [];
            an.seekBack((state, time) => {
                times.push(time);
            });

            expect(times).toEqual([3, 2, 1, 0]);
        });

        it('should iterate back through the frames starting at the current time until true is returned.', () => {
            const frames = [
                { time: 0, state: { a: 1 } },
                { time: 1, state: { b: 2 } },
                { time: 2, state: { c: 3 } },
                { time: 3, state: { c: 3 } },
                { time: 4, state: { c: 3 } },
            ];
            const an = new TelemetryAnimator(frames);
            an.setTime(3.5);

            const times = [];
            an.seekBack((state, time) => {
                times.push(time);
                if (time === 2) return true;
                return false;
            });

            expect(times).toEqual([3, 2]);
        });

        it('should start at the time provided.', () => {
            const frames = [
                { time: 1, state: { b: 2 } },
                { time: 2, state: { c: 3 } },
                { time: 3, state: { c: 3 } },
                { time: 4, state: { c: 3 } },
            ];
            const an = new TelemetryAnimator(frames);
            an.setTime(3.5);

            let times;
            const cbFunc = (state, time) => {
                times.push(time);
            };

            times = [];
            an.seekBack(cbFunc, 0);
            expect(times).toEqual([]);

            times = [];
            an.seekBack(cbFunc, 1);
            expect(times).toEqual([1]);

            times = [];
            an.seekBack(cbFunc, 4);
            expect(times).toEqual([4, 3, 2, 1]);

            times = [];
            an.seekBack(cbFunc, 10);
            expect(times).toEqual([4, 3, 2, 1]);

            times = [];
            an.seekBack(cbFunc, 2.5);
            expect(times).toEqual([2, 1]);
        });
    });

    describe('.forEachFrame()', () => {
        const frames = [
            { time: 100, state: { a: 1 } },
            { time: 122, state: { b: 2 } },
            { time: 130, state: { c: 3 } },
        ];
        const an = new TelemetryAnimator(frames);
        it('should iterate over all frames.', () => {
            const res = [];
            an.forEachFrame((state, time) => {
                res.push({ state: { ...state }, time });
            });

            expect(res).toEqual([
                { time: 100, state: { a: 1 } },
                { time: 122, state: { a: 1, b: 2 } },
                { time: 130, state: { a: 1, b: 2, c: 3 } },
            ]);
        });

        it('should only iterate over the specified time bounds.', () => {
            const res = [];
            an.forEachFrame(
                (state, time) => {
                    res.push({ state: { ...state }, time });
                },
                { startTime: 101, endTime: 125 },
            );
            expect(res).toEqual([{ time: 122, state: { a: 1, b: 2 } }]);
        });

        it('should not merge frames if "raw" is true.', () => {
            const res = [];
            an.forEachFrame(
                (state, time) => {
                    res.push({ state: { ...state }, time });
                },
                { raw: true },
            );
            expect(res).toEqual([
                { time: 100, state: { a: 1 } },
                { time: 122, state: { b: 2 } },
                { time: 130, state: { c: 3 } },
            ]);
        });
    });

    describe('.sort()', () => {
        it('should sort the frames by time.', () => {
            const frames = [
                { time: 100, state: {} },
                { time: 122, state: {} },
                { time: 121, state: {} },
            ];
            const an = new TelemetryAnimator(frames);
            an.sort();
            expect(an.frames.map(f => f.time)).toEqual([100, 121, 122]);
        });
    });

    describe('.optimize()', () => {
        it('should merge subsequent frames with the same time.', () => {
            const frames = [
                { time: 100, state: { a: 1 } },
                { time: 100, state: { b: 2 } },
                { time: 100, state: { b: 4 } },
                { time: 121, state: { a: 3 } },
            ];
            const an = new TelemetryAnimator(frames);
            an.optimize();
            expect(an.frames).toHaveLength(2);
            expect(an.frames).toEqual([
                { time: 100, state: { a: 1, b: 4 } },
                { time: 121, state: { a: 3 } },
            ]);
        });

        it('should not cause the frame information to become out of sync.', () => {

            const frames = [
                { time: 1, state: { a: 1 } },
                { time: 1, state: { b: 2 } },
                { time: 1, state: { b: 4 } },
                { time: 21, state: { a: 3 } },
                { time: 25, state: { a: 4 } },
                { time: 200, state: { a: 5 } },
                { time: 300, state: { a: 6 } },
            ];

            const an = new TelemetryAnimator(frames);
            an.interpolate = true;
            an.continuous = true;
            an.setTime(23);

            expect(an.state).toEqual({ a: 3.5, b: 4 });

            an.optimize();
            an.setTime(24);
            expect(an.state).toEqual({ a: 3.75, b: 4 });

        });
    });

    describe('.addFrames()', () => {
        it('should append frames to the end of the animators and update the state', () => {
            const frames = [
                { time: 0, state: { a: 1 } },
                { time: 1, state: { a: 2 } },
            ];
            const an = new TelemetryAnimator(frames);
            an.setTime(3);
            expect(an.time).toEqual(3);
            expect(an.state).toEqual({ a: 2 });

            an.addFrames([{ time: 2, state: { a: 3 } }]);
            expect(an.time).toEqual(3);
            expect(an.state).toEqual({ a: 3 });
        });

        it('should retain the added order.', () => {
            const an = new TelemetryAnimator();

            an.addFrames([{ time: 0, state: {} }]);
            an.addFrames([{ time: 1, state: {} }]);
            an.addFrames([{ time: 2, state: {} }]);
            an.addFrames([{ time: 3, state: {} }]);

            expect(an.frames).toEqual([
                { time: 0, state: {} },
                { time: 1, state: {} },
                { time: 2, state: {} },
                { time: 3, state: {} },
            ]);
        });
    });

    describe('.setTime()', () => {
        it('should set the animator to have the state up to that time.', () => {
            const frames = [
                { time: 0, state: { a: 1 } },
                { time: 1, state: { a: 2 } },
            ];
            const an = new TelemetryAnimator(frames);
            expect(an.state).toEqual({ a: 1 });
            expect(an.time).toEqual(0);

            an.setTime(0.5);
            expect(an.state).toEqual({ a: 1 });
            expect(an.time).toEqual(0.5);

            an.setTime(1);
            expect(an.state).toEqual({ a: 2 });
            expect(an.time).toEqual(1);

            an.setTime(10);
            expect(an.state).toEqual({ a: 2 });
            expect(an.time).toEqual(10);
        });

        it('should use an empty state if the time is set to something before start frame.', () => {
            const frames = [
                { time: 1, state: { a: 1 } },
                { time: 2, state: { a: 2 } },
            ];
            const an = new TelemetryAnimator(frames);
            expect(an.state).toEqual({});
            expect(an.time).toEqual(0);

            an.setTime(0.5);
            expect(an.state).toEqual({});
            expect(an.time).toEqual(0.5);

            an.setTime(1);
            expect(an.state).toEqual({ a: 1 });
            expect(an.time).toEqual(1);
        });

        it('should accumulate data from multiple frames.', () => {
            const frames = [
                { time: 1, state: { a: 1 } },
                { time: 2, state: { b: 2 } },
            ];
            const an = new TelemetryAnimator(frames);

            an.setTime(3);
            expect(an.state).toEqual({ a: 1, b: 2 });
            expect(an.time).toEqual(3);
        });

        it('should dispatch a change and reset event when called.', () => {
            const frames = [
                { time: 1, state: { a: 1 } },
                { time: 2, state: { b: 2 } },
            ];
            const an = new TelemetryAnimator(frames);

            let changeCalled = 0;
            let resetCalled = 0;
            an.addEventListener('change', () => changeCalled++);
            an.addEventListener('reset', () => resetCalled++);
            an.setTime(3);
            expect(changeCalled).toEqual(1);
            expect(resetCalled).toEqual(0);

            an.setTime(1);
            expect(changeCalled).toEqual(2);
            expect(resetCalled).toEqual(1);
        });

        it('should not traverse nested objects', () => {
            const frames = [
                { time: 1, state: { a: { b: 1 } } },
                { time: 2, state: { a: { c: 2 } } },
            ];

            const an = new TelemetryAnimator(frames);
            an.setTime(3);
            expect(an.state).toEqual({ a: { c: 2 } });
        });
    });

    describe('.findFrameAtTime()', () => {
        it('should find the appropriate frame.', () => {
            const frames = [{ time: 10 }, { time: 20 }, { time: 30 }, { time: 40 }, { time: 60 }];
            const an = new TelemetryAnimator(frames);

            expect(an.findFrameAtTime(0)).toBe(null);
            expect(an.findFrameAtTime(10)).toBe(frames[0]);
            expect(an.findFrameAtTime(20)).toBe(frames[1]);
            expect(an.findFrameAtTime(30)).toBe(frames[2]);
            expect(an.findFrameAtTime(40)).toBe(frames[3]);
            expect(an.findFrameAtTime(60)).toBe(frames[4]);

            expect(an.findFrameAtTime(160)).toBe(frames[4]);

            expect(an.findFrameAtTime(35)).toBe(frames[2]);
            expect(an.findFrameAtTime(15)).toBe(frames[0]);
        });

        it('should return the last instance of a frame.', () => {
            const frames = [{ time: 10 }, { time: 10 }, { time: 10 }, { time: 60 }, { time: 60 }];
            const an = new TelemetryAnimator(frames);

            expect(an.findFrameAtTime(10)).toBe(frames[2]);
            expect(an.findFrameAtTime(60)).not.toBe(frames[4]);
        });
    });

    describe('.getNextSignificantTime(), .getPrevSignificantTime()', () => {
        it('should return the next significant frame time.', () => {
            const frames = [{ time: 1 }, { time: 20 }, { time: 50 }];
            const an = new TelemetryAnimator(frames);

            an.setTime(-10);

            expect(an.getNextSignificantTime()).toBe(1);
            expect(an.getPrevSignificantTime()).toBe(null);
            an.setTime(1);

            expect(an.getNextSignificantTime()).toBe(20);
            expect(an.getPrevSignificantTime()).toBe(null);
            an.setTime(20);

            expect(an.getNextSignificantTime()).toBe(50);
            expect(an.getPrevSignificantTime()).toBe(1);
            an.setTime(50);

            expect(an.getNextSignificantTime()).toBe(null);
            expect(an.getPrevSignificantTime()).toBe(20);

            an.setTime(100);
            expect(an.getNextSignificantTime()).toBe(null);
            expect(an.getPrevSignificantTime()).toBe(50);
        });
    });

    describe('.reset()', () => {
        it('should reset the animator state entirely to time 0.', () => {
            const frames = [
                { time: 1, state: { a: 1 } },
                { time: 2, state: { b: 2 } },
            ];
            const an = new TelemetryAnimator(frames);

            let changeCalled = 0;
            let resetCalled = 0;
            an.setTime(3);
            expect(an.state).not.toEqual({});

            an.addEventListener('change', () => changeCalled++);
            an.addEventListener('reset', () => resetCalled++);
            an.reset();
            expect(changeCalled).toEqual(1);
            expect(resetCalled).toEqual(1);
            expect(an.time).toEqual(0);
            expect(an.state).toEqual({});
        });
    });

    describe('options', () => {
        const frames = [
            { time: 1, state: { a: 1 } },
            { time: 2, state: { a: 2 } },
        ];
        describe('interpolate', () => {
            it('should cause data to be interpolated if true and data is continuous', () => {
                const an = new TelemetryAnimator(frames);
                an.continuous = true;
                an.interpolate = true;
                an.setTime(1.5);
                expect(an.state).toEqual({ a: 1.5 });
            });

            it('should not interpolate if data is not continuous', () => {
                const an = new TelemetryAnimator(frames);
                an.continuous = false;
                an.interpolate = true;
                an.setTime(1.5);
                expect(an.state).toEqual({ a: 1 });
            });

            it('should skip strings', () => {
                const frames2 = [
                    { time: 1, state: { s: 'a' } },
                    { time: 2, state: { s: 'b' } },
                ];
                const an = new TelemetryAnimator(frames2);
                an.continuous = true;
                an.interpolate = true;
                an.setTime(1.5);
                expect(an.state).toEqual({ s: 'a' });
            });
        });

        describe('seekable', () => {
            it('should allow the animator to be rewound if true.', async () => {
                const an = new TelemetryAnimator(frames);
                an.seekable = true;
                an.setTime(2);
                expect(an.state).toEqual({ a: 2 });

                let threwError = false;
                an.seekable = false;
                try {
                    await an.setTime(1);
                } catch {
                    threwError = true;
                }
                expect(threwError).toEqual(true);
            });

            it('should trim the frames when moving forward.', () => {
                const an = new TelemetryAnimator();
                an.seekable = false;

                an.addFrames([{ time: 0, state: {} }]);
                an.addFrames([{ time: 1, state: {} }]);
                an.addFrames([{ time: 2, state: {} }]);
                an.addFrames([{ time: 3, state: {} }]);

                expect(an.frames).toHaveLength(4);

                an.setTime(0.5);
                expect(an.frames).toHaveLength(3);

                an.setTime(2.5);
                expect(an.frames).toHaveLength(1);

                an.setTime(3.5);
                expect(an.frames).toHaveLength(0);
            });

            it('should only trim the frames within the non seekable range when moving forward.', () => {
                const an = new TelemetryAnimator();
                an.seekable = false;
                an.nonSeekableBuffer = 2;

                an.addFrames([{ time: 0, state: {} }]);
                an.addFrames([{ time: 1, state: {} }]);
                an.addFrames([{ time: 2, state: {} }]);
                an.addFrames([{ time: 3, state: {} }]);

                expect(an.frames).toHaveLength(4);

                an.setTime(0.5);
                expect(an.frames).toHaveLength(4);

                an.setTime(2.5);
                expect(an.frames).toHaveLength(3);

                an.setTime(3.5);
                expect(an.frames).toHaveLength(2);
            });
        });
    });
});
