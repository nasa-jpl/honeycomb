import { SubLoadingManager } from '../src/SubLoadingManager';

describe('SubLoadingManager', () => {
    it('should work independently.', () => {
        const loadingManager = new SubLoadingManager();

        let errors = 0;
        let progress = 0;
        let load = 0;
        let start = 0;
        loadingManager.onError = function() {
            errors++;
        };

        loadingManager.onProgress = function(...args) {
            progress++;
        };

        loadingManager.onLoad = function(...args) {
            load++;
        };

        loadingManager.onStart = function(...args) {
            start++;
        };

        let errorEvent = [];
        let progressEvent = [];
        let completeEvent = [];
        let startEvent = [];
        loadingManager.addEventListener('start', e => startEvent.push(e));
        loadingManager.addEventListener('error', e => errorEvent.push(e));
        loadingManager.addEventListener('progress', e => progressEvent.push(e));
        loadingManager.addEventListener('complete', e => completeEvent.push(e));

        loadingManager.itemStart('1');
        loadingManager.itemStart('2');
        loadingManager.itemEnd('1');
        loadingManager.itemStart('3');
        loadingManager.itemError('3');
        loadingManager.itemEnd('3');
        loadingManager.itemEnd('2');

        expect(start).toBe(1);
        expect(progress).toBe(3);
        expect(errors).toBe(1);
        expect(load).toBe(1);

        expect(startEvent).toHaveLength(1);
        expect(progressEvent).toHaveLength(6);
        expect(errorEvent).toHaveLength(1);
        expect(completeEvent).toHaveLength(1);

        loadingManager.itemStart('4');
        loadingManager.itemEnd('4');
        expect(start).toBe(2);
        expect(progress).toBe(4);
        expect(errors).toBe(1);
        expect(load).toBe(2);

        expect(startEvent).toHaveLength(2);
        expect(progressEvent).toHaveLength(8);
        expect(errorEvent).toHaveLength(1);
        expect(completeEvent).toHaveLength(2);
    });

    it('should propagate updates to the parent manager.', () => {
        const parentManager = new SubLoadingManager();
        const childManager = new SubLoadingManager(parentManager);

        let errors = 0;
        let progress = 0;
        let load = 0;
        let start = 0;
        parentManager.onError = function() {
            errors++;
        };

        parentManager.onProgress = function(...args) {
            progress++;
        };

        parentManager.onLoad = function(...args) {
            load++;
        };

        parentManager.onStart = function(...args) {
            start++;
        };

        let errorEvent = [];
        let progressEvent = [];
        let completeEvent = [];
        let startEvent = [];
        parentManager.addEventListener('start', e => startEvent.push(e));
        parentManager.addEventListener('error', e => errorEvent.push(e));
        parentManager.addEventListener('progress', e => progressEvent.push(e));
        parentManager.addEventListener('complete', e => completeEvent.push(e));

        childManager.itemStart('1');
        childManager.itemStart('2');
        childManager.itemEnd('1');
        childManager.itemStart('3');
        childManager.itemError('3');
        childManager.itemEnd('3');
        childManager.itemEnd('2');

        expect(start).toBe(1);
        expect(progress).toBe(3);
        expect(errors).toBe(1);
        expect(load).toBe(1);

        expect(startEvent).toHaveLength(1);
        expect(progressEvent).toHaveLength(6);
        expect(errorEvent).toHaveLength(1);
        expect(completeEvent).toHaveLength(1);

        childManager.itemStart('4');
        childManager.itemEnd('4');
        expect(start).toBe(2);
        expect(progress).toBe(4);
        expect(errors).toBe(1);
        expect(load).toBe(2);

        expect(startEvent).toHaveLength(2);
        expect(progressEvent).toHaveLength(8);
        expect(errorEvent).toHaveLength(1);
        expect(completeEvent).toHaveLength(2);
    });
});
