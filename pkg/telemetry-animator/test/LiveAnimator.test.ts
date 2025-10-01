import { LiveAnimator } from '../src/LiveAnimator';
import { TelemetryAnimator } from '../src/TelemetryAnimator';
import { BufferedAnimatorMixin } from '../src/BufferedAnimatorMixin';
import { KeyframeAnimatorMixin } from '../src/KeyframeAnimatorMixin';
import { Scheduler } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';

// some of the operations within the live animator require using the scheduler
// which will only flush once per frame.
async function nextFrame() {
    await Scheduler.scheduleNextFrame(() => {}, Infinity);
}

describe('LiveAnimator', () => {
    let anim;
    beforeEach(() => {
        const cacheAnim = new (KeyframeAnimatorMixin(BufferedAnimatorMixin(TelemetryAnimator)))();
        cacheAnim.keyframeStride = 1000;
        cacheAnim.chunkSize = 1000;
        const liveAnim = new TelemetryAnimator();
        anim = new LiveAnimator(liveAnim, cacheAnim);
    });

    it('should report the state correctly when using live data.', async () => {
        anim.addFrames([
            {
                time: 1,
                state: { a: 1 },
            },
        ]);
        await anim.setTime(2);
        expect(anim.state).toEqual({ a: 1 });

        await anim.setTime(0.5);
        expect(anim.state).toEqual({});
    });

    it('should cache data when passing the chunk size.', async () => {
        anim.addFrames([
            {
                time: 1,
                state: { a: 1 },
            },
            {
                time: 2,
                state: { a: 2 },
            },
            {
                time: 1001,
                state: { a: 3 },
            },
        ]);

        expect(anim.streamingAnimator.state).toEqual({ a: 3 });
        expect(anim.state).toEqual({});

        await anim.setTime(1001);
        await nextFrame();

        expect(anim.state).toEqual({ a: 3 });
        expect(anim.streamingAnimator.frames).toHaveLength(1);

        expect(await anim.cacheAnimator.keyframes.has(1000)).toEqual(true);
        expect(await anim.cacheAnimator.keyframes.get(1000)).toEqual({ a: 2 });
        expect(await anim.framesCache.has(0)).toEqual(true);
        expect(await anim.framesCache.get(0)).toEqual([
            { time: 1, state: { a: 1 } },
            { time: 2, state: { a: 2 } },
        ]);

        expect(await anim.cacheAnimator.keyframes.has(2000)).toEqual(false);
        expect(await anim.framesCache.has(1000)).toEqual(false);
        anim.addFrames([{ time: 2001, state: { a: 4 } }]);
        expect(anim.streamingAnimator.state).toEqual({ a: 4 });

        await anim.setTime(1001);
        await nextFrame();

        expect(anim.state).toEqual({ a: 3 });
        expect(anim.streamingAnimator.frames).toHaveLength(1);

        expect(await anim.cacheAnimator.keyframes.has(2000)).toEqual(true);
        expect(await anim.cacheAnimator.keyframes.get(2000)).toEqual({ a: 3 });
        expect(await anim.framesCache.has(1000)).toEqual(true);
        expect(await anim.framesCache.get(1000)).toEqual([{ time: 1001, state: { a: 3 } }]);

        await anim.setTime(2500);
        await nextFrame();

        expect(anim.state).toEqual({ a: 4 });

        await anim.setTime(500);
        await nextFrame();

        expect(anim.state).toEqual({ a: 2 });

        anim.addFrames([{ time: 3000, state: { a: 5 } }]);

        await anim.setTime(3000);
        await nextFrame();

        expect(anim.state).toEqual({ a: 5 });
    });

    it.todo('.getNextSignificantTime()');
});
