import { Object3D } from 'three';
import { DisposableEventListeners } from '../src/utilities/DisposableEventListeners';

describe('DisposableEventListeners', () => {
    it('should add events as expected.', () => {
        const obj = new Object3D();
        const eventListeners = new DisposableEventListeners();

        eventListeners.addEventListener(obj, 'test', () => {});
        expect(obj._listeners.test).toHaveLength(1);

        eventListeners.addEventListener(obj, 'test', () => {});
        expect(obj._listeners.test).toHaveLength(2);

        eventListeners.addEventListener(obj, 'test2', () => {});
        expect(obj._listeners.test2).toHaveLength(1);

        expect(Object.keys(obj._listeners)).toEqual(['test', 'test2']);
    });

    it('should dispose only of events added through the object.', () => {
        const obj = new Object3D();
        const eventListeners = new DisposableEventListeners();

        eventListeners.addEventListener(obj, 'test', () => {});
        eventListeners.addEventListener(obj, 'test', () => {});
        eventListeners.addEventListener(obj, 'test2', () => {});

        expect(obj._listeners.test).toHaveLength(2);
        expect(obj._listeners.test2).toHaveLength(1);
        expect(Object.keys(obj._listeners)).toEqual(['test', 'test2']);

        obj.addEventListener('test', () => {});
        obj.addEventListener('test', () => {});
        obj.addEventListener('test3', () => {});

        expect(obj._listeners.test).toHaveLength(4);
        expect(obj._listeners.test2).toHaveLength(1);
        expect(obj._listeners.test3).toHaveLength(1);
        expect(Object.keys(obj._listeners)).toEqual(['test', 'test2', 'test3']);

        eventListeners.dispose();

        expect(obj._listeners.test).toHaveLength(2);
        expect(obj._listeners.test2).toHaveLength(0);
        expect(obj._listeners.test3).toHaveLength(1);
        expect(Object.keys(obj._listeners)).toEqual(['test', 'test2', 'test3']);
    });

    it('should work on multiple objects.', () => {
        const obj1 = new Object3D();
        const obj2 = new Object3D();
        const eventListeners = new DisposableEventListeners();

        eventListeners.addEventListener(obj1, 'test', () => {});
        eventListeners.addEventListener(obj2, 'test', () => {});

        expect(obj1._listeners.test).toHaveLength(1);
        expect(obj2._listeners.test).toHaveLength(1);

        eventListeners.dispose();
        expect(obj1._listeners.test).toHaveLength(0);
        expect(obj2._listeners.test).toHaveLength(0);
    });
});
