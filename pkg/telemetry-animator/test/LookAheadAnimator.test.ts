import { TelemetryAnimator } from '../src/TelemetryAnimator';
import { LookAheadAnimatorMixin } from '../src/LookAheadAnimatorMixin';
import { Scheduler } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';

async function nextFrame() {
    await Scheduler.scheduleNextFrame(() => {}, Infinity);
}

const LookAheadAnimator = LookAheadAnimatorMixin(TelemetryAnimator);
describe('LookAheadAnimator', () => {
    const frames = [
        { time: 1, state: { a: 2 } },
        { time: 2, state: { a: 3 } },
        { time: 3, state: { a: 4 } },
        { time: 4, state: { a: 5 } },
    ];

    it('should try to preload frames.', () => {
        const an = new LookAheadAnimator(frames);

        const loadRes = [];
        an.preloadData = state => {
            loadRes.push(state);
            return Promise.resolve();
        };

        const unloadRes = [];
        an.unloadData = state => {
            unloadRes.push(state);
        };

        loadRes.length = 0;
        unloadRes.length = 0;
        an.reset();
        expect(loadRes).toHaveLength(4);
        expect(unloadRes).toHaveLength(0);

        an.setTime(3.5);
        expect(loadRes).toHaveLength(4);
        expect(unloadRes).toHaveLength(0);
    });

    it('should unload data if a preload has started.', async () => {
        const an = new LookAheadAnimator(frames);
        an.lookAhead = 10;
        an.lookBack = 0;

        const loadRes = [];
        an.preloadData = state => {
            loadRes.push(state);
            return Promise.resolve();
        };

        const unloadRes = [];
        an.unloadData = state => {
            unloadRes.push(state);
        };

        loadRes.length = 0;
        unloadRes.length = 0;
        an.reset();
        expect(loadRes).toHaveLength(4);
        expect(unloadRes).toHaveLength(0);
        await nextFrame();

        an.setTime(3.5);
        expect(loadRes).toHaveLength(4);
        expect(unloadRes).toHaveLength(2);

        an.setTime(6);
        expect(loadRes).toHaveLength(4);
        expect(unloadRes).toHaveLength(3);

        an.reset();
        expect(loadRes).toHaveLength(8);
        expect(unloadRes).toHaveLength(4);
    });

    it('resetting should unload all data always.', () => {
        const an = new LookAheadAnimator(frames);

        const loadRes = [];
        an.preloadData = state => {
            loadRes.push(state);
            return new Promise(() => {});
        };

        const unloadRes = [];
        an.unloadData = state => {
            unloadRes.push(state);
        };

        an.reset();
        expect(loadRes).toHaveLength(4);
        expect(unloadRes).toHaveLength(0);

        an.reset();
        expect(loadRes).toHaveLength(8);
        expect(unloadRes).toHaveLength(4);
    });

    it('should process state on change.', () => {
        const an = new LookAheadAnimator(frames);
        an.processState = state => {
            state.TEST = 100;
        };
        an.reset();
        expect(an.state).toEqual({ TEST: 100 });

        an.processState = state => {
            state.TEST2 = 100;
        };
        an.setTime(4);
        expect(an.state).toEqual({ TEST2: 100, a: 5 });
    });

    it('should reprocess state when preload resolves', async () => {
        const an = new LookAheadAnimator(frames);
        const pr = [];
        an.preloadData = state => {
            return new Promise(resolve => pr.push(resolve));
        };

        let calledProcess = 0;
        an.processState = state => {
            calledProcess++;
        };
        an.reset();

        expect(calledProcess).toEqual(1);
        pr[0]();
        pr[1]();
        pr[2]();
        await nextFrame();

        expect(calledProcess).toEqual(2);
    });

    it('should fire change if processState returns true.', async () => {
        const an = new LookAheadAnimator(frames);
        let called = 0;
        an.addEventListener('change', () => called++);

        const pr = [];
        an.preloadData = state => {
            return new Promise(resolve => pr.push(resolve));
        };

        an.processState = state => true;
        an.reset();
        expect(called).toEqual(1);

        pr[0]();
        await nextFrame();

        expect(called).toEqual(2);
    });

    it('should not fire change if processState returns false.', async () => {
        const an = new LookAheadAnimator(frames);
        let called = 0;
        an.addEventListener('change', () => called++);

        const pr = [];
        an.preloadData = state => {
            return new Promise(resolve => pr.push(resolve));
        };

        an.processState = state => false;
        an.reset();
        expect(called).toEqual(1);

        pr[0]();
        await nextFrame();

        expect(called).toEqual(1);
    });

    it('should run process state before calling change', async () => {
        const an = new LookAheadAnimator(frames);
        an.processState = state => {
            state.TEST = 100;
        };
        an.addEventListener('change', () => {
            expect(an.state.TEST).toEqual(100);
        });

        await an.reset();
        await an.setTime(2);
    });

    it('should only load new frames when there is overlap', async () => {
        const an = new LookAheadAnimator(frames);
        an.lookBack = 1;
        an.lookAhead = 1;

        const loaded = [];
        const unloaded = [];
        an.preloadData = state => {
            loaded.push(state);
            return Promise.resolve();
        };
        an.unloadData = state => {
            unloaded.push(state);
        };
        an.reset();

        loaded.length = 0;
        unloaded.length = 0;
        an.setTime(2);
        expect(loaded).toHaveLength(2);
        expect(loaded).toEqual([{ a: 3 }, { a: 4 }]);
        expect(unloaded).toHaveLength(0);

        loaded.length = 0;
        unloaded.length = 0;
        an.setTime(3);
        expect(loaded).toHaveLength(1);
        expect(loaded).toEqual([{ a: 5 }]);
        expect(unloaded).toHaveLength(1);
        expect(unloaded).toEqual([{ a: 2 }]);
    });

    it('should unload future frames when rewinding', async () => {
        const an = new LookAheadAnimator(frames);
        an.lookBack = 1;
        an.lookAhead = 1;

        const loaded = [];
        const unloaded = [];
        an.preloadData = state => {
            loaded.push(state);
            return Promise.resolve();
        };
        an.unloadData = state => {
            unloaded.push(state);
        };
        an.reset();

        loaded.length = 0;
        unloaded.length = 0;
        an.setTime(3);
        expect(loaded).toHaveLength(3);
        expect(loaded).toEqual([{ a: 3 }, { a: 4 }, { a: 5 }]);
        expect(unloaded).toHaveLength(1);
        expect(unloaded).toEqual([{ a: 2 }]);

        loaded.length = 0;
        unloaded.length = 0;
        an.setTime(1);
        expect(loaded).toHaveLength(1);
        expect(loaded).toEqual([{ a: 2 }]);
        expect(unloaded).toHaveLength(2);
        expect(unloaded).toEqual([{ a: 4 }, { a: 5 }]);
    });

    it('should report as stale until all previous data has loaded.', async () => {
        const an = new LookAheadAnimator(frames);
        an.lookBack = 10;
        an.lookAhead = 10;

        const pr = [];
        an.preloadData = function() {
            return new Promise(resolve => pr.push(resolve));
        };

        an.setTime(2.5);
        expect(an.stale).toEqual(true);

        pr[0]();
        await nextFrame();
        expect(an.stale).toEqual(true);

        pr[1]();
        await nextFrame();
        expect(an.stale).toEqual(false);

        pr[2]();
        await nextFrame();
        expect(an.stale).toEqual(false);
    });
});
