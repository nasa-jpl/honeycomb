import { Group, Mesh } from 'three';
import { ObjectPool } from '../src/utilities/ObjectPool';

describe('ObjectPool', () => {
    let group, objectPool;
    beforeEach(() => {
        group = new Group();
        objectPool = new ObjectPool(group);
    });

    it('should dispose objects immediately when disposeImmediately === true.', () => {
        const createdObjects = [];
        const disposedObjects = [];

        objectPool.disposeImmediately = true;
        objectPool.createObject = () => {
            const m = new Mesh();
            createdObjects.push(m);
            return m;
        };

        objectPool.updateObject = (m, item) => {
            m.item = item;
        };

        objectPool.disposeObject = m => {
            disposedObjects.push(m);
        };

        expect(createdObjects).toEqual([]);
        expect(disposedObjects).toEqual([]);
        expect(group.children).toHaveLength(0);

        objectPool.updateData([1, 2, 3, 4]);

        expect(createdObjects).toHaveLength(4);
        expect(disposedObjects).toEqual([]);
        expect(group.children).toHaveLength(4);
        expect(group.children.map(c => c.item)).toEqual([1, 2, 3, 4]);

        objectPool.updateData([5, 6, 7]);
        expect(createdObjects).toHaveLength(4);
        expect(disposedObjects).toHaveLength(1);
        expect(group.children).toHaveLength(3);
        expect(group.children.map(c => c.item)).toEqual([5, 6, 7]);

        objectPool.updateData([8, 9, 10, 11, 12]);
        expect(createdObjects).toHaveLength(6);
        expect(disposedObjects).toHaveLength(1);
        expect(group.children).toHaveLength(5);
        expect(group.children.map(c => c.item)).toEqual([8, 9, 10, 11, 12]);

        objectPool.dispose();
        expect(createdObjects).toHaveLength(6);
        expect(disposedObjects).toHaveLength(6);
        expect(group.children).toHaveLength(0);

        expect(objectPool.disposeImmediately).toEqual(true);
    });

    it('should just remove objects when disposeImmediately === false.', () => {
        const createdObjects = [];
        const disposedObjects = [];

        objectPool.disposeImmediately = false;
        objectPool.createObject = () => {
            const m = new Mesh();
            createdObjects.push(m);
            return m;
        };

        objectPool.updateObject = (m, item) => {
            m.item = item;
        };

        objectPool.disposeObject = m => {
            disposedObjects.push(m);
        };

        expect(createdObjects).toEqual([]);
        expect(disposedObjects).toEqual([]);
        expect(group.children).toHaveLength(0);

        objectPool.updateData([1, 2, 3, 4]);

        expect(createdObjects).toHaveLength(4);
        expect(disposedObjects).toEqual([]);
        expect(objectPool.pool).toHaveLength(4);
        expect(group.children).toHaveLength(4);
        expect(group.children.map(c => c.item)).toEqual([1, 2, 3, 4]);

        objectPool.updateData([5, 6, 7]);
        expect(createdObjects).toHaveLength(4);
        expect(disposedObjects).toHaveLength(0);
        expect(objectPool.pool).toHaveLength(4);
        expect(group.children).toHaveLength(3);
        expect(group.children.map(c => c.item)).toEqual([5, 6, 7]);

        objectPool.updateData([8, 9, 10, 11, 12]);
        expect(createdObjects).toHaveLength(5);
        expect(disposedObjects).toHaveLength(0);
        expect(objectPool.pool).toHaveLength(5);
        expect(group.children).toHaveLength(5);

        // child objects will not necessarily have data applied in the data array order
        // because objects will be added and removed.
        expect(group.children.map(c => c.item).sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12]);

        objectPool.dispose();
        expect(createdObjects).toHaveLength(5);
        expect(disposedObjects).toHaveLength(5);
        expect(group.children).toHaveLength(0);

        expect(objectPool.disposeImmediately).toEqual(false);
    });
});
