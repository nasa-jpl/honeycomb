import { TelemetryAnimator } from '../src/TelemetryAnimator';
import { BufferedAnimatorMixin } from '../src/BufferedAnimatorMixin';

async function nextFrame() {
    await new Promise(resolve => process.nextTick(resolve));
}

const BufferedAnimator = BufferedAnimatorMixin(TelemetryAnimator);

describe('BufferedAnimator', () => {
    it('should report a start and end time of 0 0 by default.', () => {
        const an = new BufferedAnimator();
        expect(an.startTime).toEqual(0);
        expect(an.endTime).toEqual(0);
    });

    it('should allow for manually setting the start and end times.', () => {
        const an = new BufferedAnimator();

        an.startTime = 1;
        an.endTime = 2;
        expect(an.startTime).toEqual(1);
        expect(an.endTime).toEqual(2);
    });

    it('should load upcoming chunks.', async () => {
        const an = new BufferedAnimator();

        an.getFrames = async (time, duration) => {
            const res = new Array(10).fill();
            return res.map((item, i) => {
                return {
                    time: time + (i * duration) / 10,
                    state: {
                        a: i,
                    },
                };
            });
        };

        await an.reset();

        expect(an.time).toEqual(0);
        expect(an.state).toEqual({ a: 0 });
    });

    it('should report itself as stale until data has loaded.', async () => {
        const an = new BufferedAnimator();
        expect(an.stale).toEqual(false);

        const funcs = [];
        an.getFrames = () => {
            const pr = new Promise(resolve => {
                funcs.push(resolve);
            });
            return pr;
        };

        let changeCalled = 0;
        an.addEventListener('change', () => {
            changeCalled++;
        });

        expect(an.stale).toEqual(true);

        funcs[0]([]);
        await nextFrame();

        expect(changeCalled).toEqual(1);
        expect(an.stale).toEqual(false);

        an.setTime(1500);
        await nextFrame();

        expect(changeCalled).toEqual(1);
        expect(an.stale).toEqual(true);

        funcs.shift();
        funcs.forEach(f => f([]));
        await nextFrame();

        expect(changeCalled).toEqual(2);
        expect(an.stale).toEqual(false);
    });

    it('reset and setTime should only resolve when the data has loaded.', async () => {
        const an = new BufferedAnimator();

        const funcs = [];
        an.getFrames = () => {
            const pr = new Promise(resolve => {
                funcs.push(resolve);
            });
            return pr;
        };

        let resetResolved = false;
        an.reset().then(() => (resetResolved = true));
        expect(funcs).toHaveLength(6);

        expect(resetResolved).toEqual(false);
        await nextFrame();
        expect(resetResolved).toEqual(false);
        funcs[0]([]);
        expect(resetResolved).toEqual(false);
        await nextFrame();
        expect(resetResolved).toEqual(true);

        let setTimeResolved = false;
        an.setTime(1.5).then(() => (setTimeResolved = true));
        expect(funcs).toHaveLength(7);

        expect(setTimeResolved).toEqual(false);
        await nextFrame();
        expect(setTimeResolved).toEqual(false);
        funcs[0]([]);
        expect(setTimeResolved).toEqual(false);
        await nextFrame();
        expect(setTimeResolved).toEqual(false);
        funcs[1]([]);
        expect(setTimeResolved).toEqual(false);
        await nextFrame();
        expect(setTimeResolved).toEqual(true);
    });

    it('should accumulate state as expected', async () => {
        const an = new BufferedAnimator();
        an.getFrames = async time => {
            return [{ time, state: { [time]: time } }];
        };

        await an.setTime(2);
        await an.setTime(4);
        await an.setTime(6);
        await an.setTime(7);
        await an.setTime(9);
        await an.setTime(10.001);

        expect(Object.keys(an.state)).toHaveLength(11);
    });

    it('should accumulate a small buffer ahead of the set time when jumping a large amount.', async () => {
        const an = new BufferedAnimator();
        an.getFrames = async time => {
            return [{ time, state: { [time]: time } }];
        };

        await an.setTime(10.001);

        expect(Object.keys(an.state)).toEqual(['5', '6', '7', '8', '9', '10']);
    });

    it('should be resilient to data resolving out of order.', async () => {
        const an = new BufferedAnimator();

        const funcs = [];
        an.getFrames = time => {
            const pr = new Promise(resolve => {
                funcs.push(() => resolve([{ time, state: { time } }]));
            });
            return pr;
        };

        an.setTime(3.001);
        expect(funcs).toHaveLength(9);
        await nextFrame();

        expect(an.state).toEqual({});
        expect(an.stale).toEqual(true);
        funcs[funcs.length - 1]();
        await nextFrame();

        expect(an.state).toEqual({});
        expect(an.stale).toEqual(true);
        funcs[3]();
        await nextFrame();

        expect(an.state).toEqual({});
        expect(an.stale).toEqual(true);
        funcs[0]();
        await nextFrame();

        expect(an.state).toEqual({ time: 0 });
        expect(an.stale).toEqual(true);

        funcs[2]();
        funcs[1]();
        await nextFrame();

        expect(an.state).toEqual({ time: 3 });
        expect(an.stale).toEqual(false);
    });

    it('should be able to have the time set to before the start time.', async () => {
        const an = new BufferedAnimator();
        an.getFrames = async time => {
            return [{ time, state: { [time]: time } }];
        };
        an.startTime = 1000;
        an.endTime = 10000;

        await an.setTime(10);
    });

    it('should clean up chunks when they are out of range.', async () => {
        const an = new BufferedAnimator();
        an.getFrames = async time => {
            return [{ time, state: { time } }];
        };

        await nextFrame();
        expect(an.frames).toHaveLength(6);
        expect(an.frames[0].time).toEqual(0);

        await an.setTime(4);
        await an.setTime(8);
        await an.setTime(10);
        expect(an.frames).toHaveLength(11);
        expect(an.frames[0].time).toEqual(5);
    });

    it('should only load the chunks within the buffer range.', async () => {
        const an = new BufferedAnimator();
        an.getFrames = time => {
            return Promise.resolve([]);
        };

        expect(an.frames.map(f => f.time)).toEqual([0, 1, 2, 3, 4, 5]);

        an.setTime(20);

        expect(an.frames.map(f => f.time)).toEqual([
            15, 16, 17, 18, 19, 20,
            21, 22, 23, 24, 25,
        ]);
    });

    describe('.seekBack()', () => {
        it('should iterate back through all currently available frames', async () => {
            const an = new BufferedAnimator();
            an.getFrames = async (time, length) => {
                return [
                    { time: time, state: {} },
                    { time: time + length / 2 },
                    { time: time + length },
                ];
            };

            await an.setTime(10.55);

            const times = [];
            an.seekBack((state, time) => {
                times.push(time);
                if (time === 8.5) return true;
                return false;
            });

            expect(times).toEqual([10.5, 10, 10, 9.5, 9, 9, 8.5]);
        });
    });

    it.todo(
        'should be able to iterate over all frames using forEachFrame until terminated with null.',
    );

    it.todo('test jumping ahead and cancelling events.');

    describe('.getNextSignificantFrame(), .getPrevSignificantFrame()', () => {
        it('should look ahead to the next chunks to retrieve the time.', async () => {
            const an = new BufferedAnimator();
            const funcs = [];
            an.getFrames = time => {
                if (time >= 23) {
                    return Promise.resolve(null);
                }

                const pr = new Promise(resolve => {
                    funcs.push(() => resolve([{ time: time + 0.001 }, { time: time + 0.002 }]));
                });
                return pr;
            };

            funcs.length = [];
            an.setTime(20);

            expect(an.getNextSignificantTime()).toBe(20);
            expect(an.getPrevSignificantTime()).toBe(20);

            funcs[0](); // 16
            funcs[1](); // 17
            funcs[2](); // 18
            funcs[3](); // 18
            funcs[4](); // 19
            funcs[5](); // 20
            funcs[6](); // 21

            await nextFrame();

            expect(an.getNextSignificantTime()).toBe(20.001);
            expect(an.getPrevSignificantTime()).toBe(19.002);
            an.setTime(20.001);

            expect(an.getNextSignificantTime()).toBe(20.002);
            expect(an.getPrevSignificantTime()).toBe(19.002);
            an.setTime(20.002);

            expect(an.getNextSignificantTime()).toBe(21.001);
            expect(an.getPrevSignificantTime()).toBe(20.001);
            an.setTime(21.002);

            expect(an.getNextSignificantTime()).toBe(22.000);
            expect(an.getPrevSignificantTime()).toBe(21.001);
            an.setTime(22.000);

            expect(an.getNextSignificantTime()).toBe(22.000);
            expect(an.getPrevSignificantTime()).toBe(21.002);
            funcs[7](); // 22.000

            await nextFrame();
            expect(an.getNextSignificantTime()).toBe(22.001);
            expect(an.getPrevSignificantTime()).toBe(21.002);

            an.setTime(22.002);
            expect(an.getNextSignificantTime()).toBe(null);
            expect(an.getPrevSignificantTime()).toBe(22.001);
        });
    });
});
