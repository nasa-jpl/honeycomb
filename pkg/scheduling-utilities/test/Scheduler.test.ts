import { Scheduler } from '../src/Scheduler';

function nextFrame() {
    return new Promise(resolve => {
        requestAnimationFrame(resolve);
    });
}

describe('Scheduler', () => {
    describe('schedule', () => {
        it('should schedule a run in a priority order.', async () => {
            const results = [];
            Scheduler.schedule(() => results.push(3), 3);
            Scheduler.schedule(() => results.push(1), 1);
            Scheduler.schedule(() => results.push(2), 2);

            expect(results).toEqual([]);
            await nextFrame();
            expect(results).toEqual([1, 2, 3]);
        });

        it('should return an object that allows you to cancel the task.', async () => {
            let called = false;
            const task = Scheduler.schedule(() => called = true);

            expect(called).toEqual(false);
            task.cancel();
            await nextFrame();
            expect(called).toEqual(false);
        });

        it('should return a promise that resolves with the result when finished.', async () => {
            const task = Scheduler.schedule(() => 100);

            let result;
            task.then(res => {
                result = res;
            });

            await nextFrame();
            expect(result).toEqual(100);
        });

        it('should not be able to inadvertantly run infinitely.', async () => {
            let totalRun = 0;
            let lastTask = null;
            addTask();

            await nextFrame();
            expect(totalRun).toEqual(500);

            lastTask.cancel();
            function addTask() {
                lastTask = Scheduler.schedule(() => {
                    totalRun++;
                    addTask();
                });
            }
        });
    });

    describe('scheduleNextFrame', () => {
        it('should schedule tasks to run the next frame.', async () => {
            const results = [];
            Scheduler.schedule(() => results.push(1), 1);
            Scheduler.scheduleNextFrame(() => results.push(2), 2);

            expect(results).toEqual([]);

            await nextFrame();
            expect(results).toEqual([1]);

            await nextFrame();
            expect(results).toEqual([1, 2]);
        });
    });
});
