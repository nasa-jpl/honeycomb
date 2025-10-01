import { Debouncer } from '../src/Debouncer';

function nextFrame() {
    return new Promise(resolve => {
        requestAnimationFrame(resolve);
    });
}

describe('Debouncer', () => {
    describe('run', () => {
        it('should run functions on the next tick in order.', async () => {
            const results = [];
            const debouncer = new Debouncer();
            debouncer.run('3', () => results.push(3), 3);
            debouncer.run('1', () => results.push(1), 1);
            debouncer.run('2', () => results.push(2), 2);

            await nextFrame();

            expect(results).toEqual([1, 2, 3]);
        });

        it('should cancel the previous function if another with the same id is run.', async () => {
            let callCount = 0;
            const debouncer = new Debouncer();
            debouncer.run('test', () => callCount++);
            debouncer.run('test', () => callCount++);

            await nextFrame();
            await nextFrame();
            await nextFrame();

            expect(callCount).toEqual(1);
        });
    });

    describe('cancel', () => {
        it('should cancel an upcoming callback.', async () => {
            let callCount = 0;
            let didCancel;
            const debouncer = new Debouncer();
            debouncer.run('test', () => callCount++);

            expect(callCount).toEqual(0);

            didCancel = debouncer.cancel('test');
            await nextFrame();
            expect(callCount).toEqual(0);
            expect(didCancel).toBeTruthy();

            didCancel = debouncer.cancel('test');
            await nextFrame();
            expect(callCount).toEqual(0);
            expect(didCancel).toBeFalsy();
        });
    });

    describe('flush', () => {
        it('should not cause a command to run twice', async () => {
            let callCount = 0;
            const debouncer = new Debouncer();
            debouncer.run('1', () => callCount++, 1);
            debouncer.run('2', () => debouncer.flush('1'), 2);

            await nextFrame();

            expect(callCount).toEqual(1);
        });

        it('should force a callback to run immediately.', () => {
            let callCount = 0;
            let didFlush;
            const debouncer = new Debouncer();
            debouncer.run('test', () => callCount++);

            expect(callCount).toEqual(0);

            didFlush = debouncer.flush('test');
            expect(callCount).toEqual(1);
            expect(didFlush).toBeTruthy();

            didFlush = debouncer.flush('test');
            expect(callCount).toEqual(1);
            expect(didFlush).toBeFalsy();
        });
    });
});
