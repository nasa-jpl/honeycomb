import { Coroutine } from '../src/Coroutine';
import { Scheduler } from '../src/Scheduler';

function nextFrame() {
    return new Promise(resolve => {
        requestAnimationFrame(resolve);
    });
}

describe('Coroutine', () => {
    describe('run', () => {
        it('it should be able to run a generator task to completion.', async () => {
            const results = [];
            const cr = new Coroutine(function* (iterations) {
                for ( let i = 0; i < iterations; i ++) {
                    results.push(i);
                    yield;
                }

                results.push('done');
            });

            expect(cr.running).toBeFalsy();

            cr.run(3);

            expect(cr.running).toBeTruthy();
            expect(results).toEqual([]);

            await nextFrame();
            expect(cr.running).toBeTruthy();
            expect(results).toEqual([0]);

            await nextFrame();
            expect(cr.running).toBeTruthy();
            expect(results).toEqual([0, 1]);

            await nextFrame();
            expect(cr.running).toBeTruthy();
            expect(results).toEqual([0, 1, 2]);

            await nextFrame();
            expect(cr.running).toBeFalsy();
            expect(results).toEqual([0, 1, 2, 'done']);
        });

        it('should throw an error if you try to run a task twice.', () => {
            const cr = new Coroutine(function* () { yield; });
            cr.run();
            expect(() => cr.run()).toThrow();
        });
    });

    describe('priority', () => {
        it('should specify when the coroutine gets run in the queue.', async () => {
            const stack = [];
            const cr = new Coroutine(function* () {
                stack.push(1);
                yield;
                stack.push(1);
            });
            cr.priority = 1;

            cr.run();
            Scheduler.schedule(() => stack.push(0), 0);

            await nextFrame();

            expect(stack).toEqual([0, 1]);
            Scheduler.schedule(() => stack.push(0), 0);

            await nextFrame();

            expect(stack).toEqual([0, 1, 0, 1]);
        });
    });

    describe('cancel', () => {
        it('should return false if nothing is running.', () => {
            const cr = new Coroutine(function* () { yield; });
            expect(cr.cancel()).toBeFalsy();
        });

        it('should stop a coroutine from running', async () => {
            const results = [];
            const cr = new Coroutine(function* (iterations) {
                for ( let i = 0; i < iterations; i ++) {
                    results.push(i);
                    yield;
                }
            });
            cr.run(5);

            await nextFrame();
            await nextFrame();

            expect(results).toEqual([0, 1]);
            expect(cr.cancel()).toBeTruthy();
            expect(cr.running).toBeFalsy();

            await nextFrame();

            expect(results).toEqual([0, 1]);
        });

        it('should call the cancel function if runnnig.', () => {
            let cancelled = false;
            const cr = new Coroutine(
                function* () { yield; },
                () => cancelled = true,
            );

            cr.cancel();
            expect(cancelled).toBeFalsy();

            cr.run();
            cr.cancel();
            expect(cancelled).toBeTruthy();
        });
    });
});
