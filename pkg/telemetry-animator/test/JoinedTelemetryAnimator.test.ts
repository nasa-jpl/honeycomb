import { TelemetryAnimator } from '../src/TelemetryAnimator';
import { JoinedTelemetryAnimator } from '../src/JoinedTelemetryAnimator';
import { Scheduler } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';

async function nextFrame() {
    await Scheduler.scheduleNextFrame(() => {}, Infinity);
}

describe('JoinedTelemetryAnimator', () => {
    let an1, an2, an3;
    beforeEach(() => {
        an1 = new TelemetryAnimator([
            { time: 0, state: { a: 1 } },
            { time: 1, state: { a: 2 } },
            { time: 3, state: { a: 3 } },
        ]);

        an2 = new TelemetryAnimator([
            { time: 0.5, state: { a: 10 } },
            { time: 1.5, state: { a: 20 } },
            { time: 3.5, state: { a: 30 } },
        ]);

        an3 = new TelemetryAnimator();
    });

    it('should take a set of animators in the constructor.', () => {
        const an = new JoinedTelemetryAnimator({ an1, an2 });
        expect(an.animators.an1).toBe(an1);
        expect(an.animators.an2).toBe(an2);
        expect(an.state).toEqual({ an1: an1.state, an2: an2.state });
    });

    it('should should fire events when adding and removing animators.', () => {
        const an = new JoinedTelemetryAnimator();

        expect(an.animators).toEqual({});

        const addRes = [];
        an.addEventListener('add-animator', ({ name, animator }) =>
            addRes.push({ name, animator }),
        );
        an.addAnimator(an1, 'an1');
        expect(an.animators.an1).toBe(an1);

        an.addAnimator(an2, 'an2');
        expect(an.animators.an1).toBe(an1);
        expect(an.animators.an2).toBe(an2);

        expect(addRes).toHaveLength(2);
        expect(addRes).toEqual([{ name: 'an1', animator: an1 }, { name: 'an2', animator: an2 }]);

        expect(an.state.an1).toBe(an1.state);
        expect(an.state.an2).toBe(an2.state);

        const remRes = [];
        an.addEventListener('remove-animator', ({ name, animator }) =>
            remRes.push({ name, animator }),
        );
        an.removeAnimator('an1');
        expect('an1' in an.animators).toEqual(false);
        expect('an2' in an.animators).toEqual(true);

        an.removeAnimator('an2');
        expect('an1' in an.animators).toEqual(false);
        expect('an2' in an.animators).toEqual(false);
        expect(remRes).toEqual([{ name: 'an1', animator: an1 }, { name: 'an2', animator: an2 }]);

        expect('an1' in an.state).toEqual(false);
        expect('an2' in an.state).toEqual(false);
    });

    it('should report the time bounds of the child animators.', () => {
        const an = new JoinedTelemetryAnimator({ an1, an2 });
        expect(an.startTime).toEqual(0);
        expect(an.endTime).toEqual(3.5);
    });

    it('should not read times from child animators with no frames.', () => {
        const an = new JoinedTelemetryAnimator({ an2, an3 });
        expect(an.startTime).toEqual(0.5);
        expect(an.endTime).toEqual(3.5);
    });

    it('should set the times of all animators.', () => {
        const an = new JoinedTelemetryAnimator({ an1, an2 });
        expect(an.time).toEqual(0);
        expect(an1.time).toEqual(0);
        expect(an2.time).toEqual(0);

        an.setTime(1.5);
        expect(an.time).toEqual(1.5);
        expect(an1.time).toEqual(1.5);
        expect(an2.time).toEqual(1.5);

        expect(an.state).toEqual({ an1: { a: 2 }, an2: { a: 20 } });
    });

    it('should properly retain state across reset.', () => {
        const an = new JoinedTelemetryAnimator({ an1, an2 });
        an.setTime(1.5);
        expect(an.state.an1).toBe(an1.state);
        expect(an.state.an2).toBe(an2.state);

        an.reset();
        expect(an.time).toEqual(0);
        expect(an.state.an1).toBe(an1.state);
        expect(an.state.an2).toBe(an2.state);
    });

    it('should fire change events', () => {
        return new Promise(resolve => {
            const an = new JoinedTelemetryAnimator({ an1, an2 });
            an.addEventListener('change', e => {
                expect(e.state).toBe(an.state);
                expect(e.time).toBe(1.5);
                resolve();
            });
            an.setTime(1.5);
        });
    });

    it('should fire reset events', () => {
        return new Promise(resolve => {
            const an = new JoinedTelemetryAnimator({ an1, an2 });
            an.addEventListener('reset', () => {
                expect(an.time).toBe(0);
                resolve();
            });
            an.setTime(1);
            an.reset();
        });
    });

    it('should synchronize the times of late animator additions', () => {
        const an = new JoinedTelemetryAnimator({ an1 });
        an.setTime(1.5);

        expect(an.time).toEqual(1.5);
        expect(an2.time).toEqual(0);

        an.addAnimator(an2, 'an2');
        expect(an2.time).toEqual(1.5);
    });

    it('should report the readiness state of all animators.', () => {
        const an = new JoinedTelemetryAnimator({ an1 });
        expect(an.ready).toBe(true);

        an.addAnimator(new TelemetryAnimator(), 'an2');
        expect(an.ready).toBe(false);
    });

    it('should not be able to add two animators with the same name.', () => {
        const an = new JoinedTelemetryAnimator({ an1 });
        let caught = false;
        try {
            an.addAnimator(an1, 'an1');
        } catch {
            caught = true;
        }
        expect(caught).toEqual(true);
    });

    it('should support nested animators.', () => {
        const an = new JoinedTelemetryAnimator();
        const nested = new JoinedTelemetryAnimator({ an1, an2 });
        an.addAnimator(nested, 'nested');

        expect(an.state).toEqual({
            nested: {
                an1: {
                    a: 1,
                },
                an2: {},
            },
        });
    });

    it('should properly retain state between rewinds.', () => {
        const an = new JoinedTelemetryAnimator({ an1, an2 });

        an.setTime(2);
        expect(an.state.an1).toBe(an1.state);
        expect(an.state.an2).toBe(an2.state);

        an.setTime(0);
        expect(an.state.an1).toBe(an1.state);
        expect(an.state.an2).toBe(an2.state);
    });

    it('should reflect the seekable state of the child animators', () => {
        const an = new JoinedTelemetryAnimator();
        const a = new TelemetryAnimator();
        a.seekable = false;
        an.addAnimator(a, 'an1');
        expect(an.seekable).toEqual(false);

        const an2 = new JoinedTelemetryAnimator();
        a.seekable = true;
        an2.addAnimator(a, 'an1');
        expect(an2.seekable).toEqual(true);
    });

    it('should require that all added animators have the same seekable state', () => {
        const an1 = new TelemetryAnimator();
        an1.seekable = false;

        const an2 = new TelemetryAnimator();
        an2.seekable = true;

        const an = new JoinedTelemetryAnimator();
        an.addAnimator(an1, 'an1');

        let caught = false;
        try {
            an.addAnimator(an2, 'an2');
        } catch {
            caught = true;
        }
        expect(caught).toEqual(true);
    });

    it('should be able to trigger change multiple times from child animators.', async () => {
        const an1 = new TelemetryAnimator([]);
        const an2 = new TelemetryAnimator([]);
        const an = new JoinedTelemetryAnimator({ an1, an2 });
        let called = 0;
        an.addEventListener('change', () => called++);

        an1.setTime(1);
        await nextFrame();
        expect(called).toEqual(1);

        an1.setTime(2);
        await nextFrame();
        expect(called).toEqual(2);
    });

    it.todo('should be able to iterate over all frames in all children using forEachFrame.');

    describe('.getNextSignificantTime()', () => {
        it('should return the nearest time among all animators.', () => {
            const ja = new JoinedTelemetryAnimator({ an1, an2 });

            expect(ja.getNextSignificantTime()).toBe(0.5);
            expect(ja.getPrevSignificantTime()).toBe(null);

            expect(ja.getNextSignificantTime(['an1'])).toBe(1);
            expect(ja.getNextSignificantTime(['an2'])).toBe(0.5);
            expect(ja.getPrevSignificantTime(['an1'])).toBe(null);
            expect(ja.getPrevSignificantTime(['an2'])).toBe(null);
            ja.setTime(0.5);

            expect(ja.getNextSignificantTime()).toBe(1);
            expect(ja.getPrevSignificantTime()).toBe(0);

            expect(ja.getNextSignificantTime(['an1'])).toBe(1);
            expect(ja.getNextSignificantTime(['an2'])).toBe(1.5);
            expect(ja.getPrevSignificantTime(['an1'])).toBe(0);
            expect(ja.getPrevSignificantTime(['an2'])).toBe(null);
            ja.setTime(1);

            expect(ja.getNextSignificantTime()).toBe(1.5);
            expect(ja.getPrevSignificantTime()).toBe(0.5);

            expect(ja.getNextSignificantTime(['an1'])).toBe(3);
            expect(ja.getNextSignificantTime(['an2'])).toBe(1.5);
            expect(ja.getPrevSignificantTime(['an1'])).toBe(0);
            expect(ja.getPrevSignificantTime(['an2'])).toBe(0.5);
            ja.setTime(3.25);

            expect(ja.getNextSignificantTime()).toBe(3.5);
            expect(ja.getPrevSignificantTime()).toBe(3);

            expect(ja.getNextSignificantTime(['an1'])).toBe(null);
            expect(ja.getNextSignificantTime(['an2'])).toBe(3.5);
            expect(ja.getPrevSignificantTime(['an1'])).toBe(3);
            expect(ja.getPrevSignificantTime(['an2'])).toBe(1.5);
            ja.setTime(3.75);

            expect(ja.getNextSignificantTime()).toBe(null);
            expect(ja.getPrevSignificantTime()).toBe(3.5);

            expect(ja.getNextSignificantTime(['an1'])).toBe(null);
            expect(ja.getNextSignificantTime(['an2'])).toBe(null);
            expect(ja.getPrevSignificantTime(['an1'])).toBe(3);
            expect(ja.getPrevSignificantTime(['an2'])).toBe(3.5);
        });
    });
});
