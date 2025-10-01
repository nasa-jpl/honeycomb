import { Group, Mesh, MeshPhongMaterial } from 'three';
import { MaterialReducer } from '../src/utilities/MaterialReducer';

describe('areEquals', () => {
    it('should correctly return whether the objects are equal.', () => {
        const reducer = new MaterialReducer();

        expect(reducer.areEqual({}, {})).toBeTruthy();
        expect(reducer.areEqual({ a: 1 }, { b: 1 })).toBeFalsy();
        expect(reducer.areEqual({ a: 1 }, { a: 1 })).toBeTruthy();
        expect(reducer.areEqual({ a: { c: 2 } }, { a: { c: 2 } })).toBeTruthy();
        expect(reducer.areEqual({ a: 1, b: 2 }, { a: 1 })).toBeFalsy();
        expect(reducer.areEqual({ a: 1 }, { a: 1, b: 2 })).toBeFalsy();

        expect(reducer.areEqual({ uuid: 1 }, { uuid: 2 })).toBeTruthy();

        // Temporarily removed because Jest does not correctly handle instanceof at the moment.
        // Should be fixed in the next release.
        // expect(reducer.areEqual(
        //     { arr: new Float32Array(100) },
        //     { arr: new Float32Array(100) },
        // )).toBeTruthy();
        // expect(reducer.areEqual(
        //     { arr: new Float32Array([1]) },
        //     { arr: new Float32Array([2]) },
        // )).toBeFalsy();

        expect(reducer.areEqual(
            new MeshPhongMaterial(),
            new MeshPhongMaterial(),
        )).toBeTruthy();

        expect(reducer.areEqual(
            new MeshPhongMaterial({ color: 0xff0000 }),
            new MeshPhongMaterial({ color: 0xffffff }),
        )).toBeFalsy();
    });
});

describe('process', () => {
    it('should remove redundant materials.', () => {
        const reducer = new MaterialReducer();

        const group = new Group();
        for (let i = 0; i < 100; i ++) {
            group.add(new Mesh(
                undefined,
                new MeshPhongMaterial({ color: (i % 2) === 0 ? 0xff0000 : 0xffffff })
            ));
        }

        const removed = reducer.process(group);
        expect(removed).toEqual(98);

        const materials = new Set();
        group.traverse(c => {
            if (c.material) materials.add(c.material);
        });
        expect(materials.size).toEqual(2);

        const materialArray = Array.from(materials);
        const colors = materialArray.map(m => m.color.getHex()).sort();
        expect(colors).toEqual([0xff0000, 0xffffff]);
    });
});
