import { JobRunner } from '../src/JobRunner';

function nextFrame() {
    return new Promise(resolve => {
        requestAnimationFrame(resolve);
    });
}

describe('JobRunner', () => {
    describe('run', () => {
        it('should run up to the max number of jobs at once.', async () => {
            const runner = new JobRunner();
            runner.maxJobs = 2;

            let results = [];
            runner.run(async () => results.push(1));
            runner.run(async () => results.push(2));
            runner.run(async () => results.push(3));

            expect(results).toEqual([1, 2]);

            await nextFrame();

            expect(results).toEqual([1, 2, 3]);
        });

        it('should be able to cancel a job.', async () => {
            const runner = new JobRunner();
            runner.maxJobs = 2;

            let cancelled = false;
            let results = [];
            runner.run(async () => results.push(1));
            runner.run(async () => results.push(2));
            const task = runner.run(async () => {
                while(!cancelled) await nextFrame();
                results.push(3);
            }, () => {
                cancelled = true;
            });

            expect(results).toEqual([1, 2]);

            await nextFrame();
            task.cancel();

            expect(results).toEqual([1, 2]);
            expect(cancelled).toEqual(true);
        });
    });
});
