import { ObjectCache } from '@gov.nasa.jpl.honeycomb/object-cache/src/browser';
import { TelemetryAnimator } from '../src/TelemetryAnimator';
import { KeyframeAnimatorMixin } from '../src/KeyframeAnimatorMixin';

const asyncForEachFrame = async function(cb, options = null) {
    const startTime = (options && options.startTime) || -Infinity;
    const endTime = (options && options.endTime) || Infinity;
    const raw = (options && options.raw) || false;

    const frames = this.frames;
    const state = {};
    for (let i = 0, l = frames.length; i < l; i++) {
        const frame = frames[i];
        const time = frame.time;
        let _state = null;
        if (raw) {
            _state = frame.state;
        } else {
            this.mergeState(frame.state, state);
            _state = state;
        }

        if (time > startTime && time < endTime) {
            cb(_state, time);
        }

        await Promise.resolve();
    }
};


const KeyframeAnimator = KeyframeAnimatorMixin(TelemetryAnimator);
describe('KeyframeAnimator', () => {
    let an;
    beforeEach(async () => {
        const frames = [
            { time: 100, state: { a: 1 } },
            { time: 120, state: { b: 1 } },
            { time: 121, state: { c: 1 } },
            { time: 5001, state: { a: 2 } },
            { time: 5500, state: { b: 2 } },
            { time: 5600, state: { e: 2 } },
            { time: 8000, state: { d: 2 } },
            { time: 10000, state: { a: 3 } },
            { time: 11000, state: { b: 3 } },
            { time: 11001, state: { c: 3 } },
        ];
        an = new KeyframeAnimator(frames);
        an.keyframeStride = 5000;

        // replace the disk cache with a Map so it's more
        // inspectable.
        an.keyframes = new ObjectCache();
        await an.generateKeyframes();
    });

    it('should generate keyframes from frames.', async () => {
        expect(an._resolveToKeyframeTime(100)).toEqual(0);
        expect(an._resolveToKeyframeTime(5001)).toEqual(5000);
        expect(an._resolveToKeyframeTime(11001)).toEqual(10000);

        expect(an._resolveToNextKeyframeTime(100)).toEqual(5000);
        expect(an._resolveToNextKeyframeTime(5001)).toEqual(10000);
        expect(an._resolveToNextKeyframeTime(11001)).toEqual(15000);

        expect(Array.from(an.keyframes._keys())).toEqual([5000, 10000]);
        expect(Array.from(an.keyframes._values())).toEqual([
            { a: 1, b: 1, c: 1 },
            { a: 2, b: 2, c: 1, e: 2, d: 2 },
        ]);

        expect(await an.getKeyframe(5001)).toEqual({ a: 1, b: 1, c: 1 });
        expect(await an.getKeyframe(10001)).toEqual({ a: 2, b: 2, c: 1, e: 2, d: 2 });
    });

    it('should use keyframes when jumping rewinding.', async () => {
        an.frames = [];
        await an.reset();
        expect(an.state).toEqual({});

        await an.setTime(50000);
        await an.setTime(5001);
        expect(an.state).toEqual({ a: 1, b: 1, c: 1 });

        await an.setTime(50000);
        await an.setTime(10001);
        expect(an.state).toEqual({ a: 2, b: 2, c: 1, e: 2, d: 2 });
    });

    it('should continue to write keyframes once more frames are added.', async () => {
        await an.addFrames([{ time: 14000, state: { a: 5 } }, { time: 14999, state: { e: 3 } }]);
        expect(Array.from(an.keyframes._keys())).toEqual([5000, 10000]);

        await an.addFrames([{ time: 15001, state: { d: 4 } }, { time: 15002, state: { e: 4 } }]);
        expect(Array.from(an.keyframes._keys())).toEqual([5000, 10000, 15000]);

        expect(Array.from(an.keyframes._values())).toEqual([
            { a: 1, b: 1, c: 1 },
            { a: 2, b: 2, c: 1, e: 2, d: 2 },
            { a: 5, b: 3, c: 3, e: 3, d: 2 },
        ]);
    });

    it('should not allow for generating keyframes twice at the same time.', done => {
        an.forEachFrame = asyncForEachFrame;
        an.keyframes = new Map();
        an.generateKeyframes();
        an.generateKeyframes()
            .catch(() => done());
    });

    it('should fire an update once a keyframe was been generated for the current frame.', done => {
        an.forEachFrame = asyncForEachFrame;
        an.keyframes = new Map();
        an.setTime(5001).then(() => {
            an.state = { other: 5 };
            an.addEventListener('change', e => {
                expect(e.time).toBe(5001);
                expect(e.state).toEqual({ a: 1, b: 1, c: 1, other: 5 });
                done();
            });

            an.generateKeyframes();
        });
    });

    it.todo('should write frames to disk if possible.');
    it.todo('should update if a keyframe is generated late.');
    it.todo('should be able to generate keyframes asynchronously.');
    it.todo('should be able to asynchronously read a keyframe.');
});
