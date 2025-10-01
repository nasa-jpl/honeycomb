import { TagTracker, compileExpression } from '../src/TagTracker';

describe('TagTracker', () => {
    let tracker;
    beforeEach(() => {
        tracker = new TagTracker();
    });

    it('should return all objects if nothing is passed to getObjects', () => {
        const objA = { a: 1 };
        const objB = { b: 2 };
        tracker.addTag(objA, ['a', 'b', 'c']);
        tracker.addTag(objB, ['b', 'c', 'd']);

        expect(tracker.getObjects()).toEqual([objA, objB]);
    });

    it('should report back the objects added.', () => {
        const objA = { a: 1 };
        const objB = { b: 2 };
        tracker.addTag(objA, ['a', 'b', 'c']);
        tracker.addTag(objB, ['b', 'c', 'd']);

        expect(tracker.hasTag(objA, 'a')).toEqual(true);
        expect(tracker.hasTag(objA, 'b')).toEqual(true);
        expect(tracker.hasTag(objA, 'c')).toEqual(true);
        expect(tracker.hasTag(objB, 'd')).toEqual(true);
        expect(tracker.hasTag(objA, 'e')).toEqual(false);

        expect(tracker.getTags(objA)).toEqual(['a', 'b', 'c']);
        expect(tracker.getTags(objB)).toEqual(['b', 'c', 'd']);

        expect(tracker.getObjects('a')).toEqual([objA]);
        expect(tracker.getObjects('b')).toEqual([objA, objB]);
        expect(tracker.getObjects('d')).toEqual([objB]);
        expect(tracker.getObjects('e')).toEqual(null);
    });

    it('should remove tags correctly.', () => {
        const objA = { a: 1 };
        tracker.addTag(objA, ['a', 'b', 'c']);
        tracker.removeTag(objA, ['a', 'b']);

        expect(tracker.hasTag(objA, 'a')).toEqual(false);
        expect(tracker.hasTag(objA, 'b')).toEqual(false);
        expect(tracker.hasTag(objA, 'c')).toEqual(true);
    });

    it('should remove an object correctly.', () => {
        const objA = { a: 1 };
        tracker.addTag(objA, ['a', 'b', 'c']);
        tracker.removeObject(objA);

        expect(tracker.getObjects('a')).toEqual(null);
        expect(tracker.getObjects('b')).toEqual(null);
        expect(tracker.getObjects('c')).toEqual(null);
        expect(tracker.hasTag(objA, 'a')).toEqual(false);
        expect(tracker.hasTag(objA, 'b')).toEqual(false);
        expect(tracker.hasTag(objA, 'c')).toEqual(false);
    });

    it('should not allow a name that looks like an expression.', () => {
        const obj = {};
        tracker.addTag(obj, 'a@#$,.%*-');

        let failed = 0;
        ['!', '<', '>', '=', ' ', '~', '\t', '\n', '(', ')', '~', '|', '&'].forEach(c => {
            try {
                tracker.addTag(obj, 'tag-' + c);
            } catch {
                failed++;
            }
        });

        expect(failed).toEqual(13);
    });

    it('should compile expressions on the fly.', () => {
        const objA = { a: 1 };
        const objB = { b: 2 };
        const objC = { c: 3 };

        tracker.addTag(objA, ['a', 'b', 'c']);
        tracker.addTag(objB, ['a', 'c']);
        tracker.addTag(objC, ['a', 'd']);

        expect(tracker.getObjects('a && c && !d')).toEqual([objA, objB]);
    });

    it('should take a pre-compiled expression.', () => {
        const objA = { a: 1 };
        const objB = { b: 2 };
        const objC = { c: 3 };

        tracker.addTag(objA, ['a', 'b', 'c']);
        tracker.addTag(objB, ['a', 'c']);
        tracker.addTag(objC, ['a', 'd']);

        const expr = compileExpression('a && c && !d');
        expect(tracker.getObjects(expr)).toEqual([objA, objB]);
    });

    it('should treat numeric tags as strings', () => {
        const obj = {};
        tracker.addTag(obj, 1);
        tracker.addTag(obj, '2');

        expect(tracker.getObjects('1')).toHaveLength(1);
        expect(tracker.getObjects('1 && 1')).toHaveLength(1);
        expect(tracker.getObjects(2)).toHaveLength(1);
        expect(tracker.getObjects('2 && 2')).toHaveLength(1);

        tracker.removeTag(obj, '1');
        tracker.removeTag(obj, 2);

        expect(tracker.getObjects(1)).toEqual(null);
        expect(tracker.getObjects('2')).toEqual(null);
    });

    it('should not throw an error when removing an object that has not been added', () => {
        const obj = {};
        tracker.removeObject(obj);
    });

    it('should filter an array of objects', () => {
        const A = {};
        const B = {};
        const C = { children: [A, B] };

        tracker.addTag(A, 'a');
        tracker.addTag(B, 'b');

        expect(tracker.filter([A, B], 'a')).toEqual([A]);
        expect(tracker.filter([A, B, C], 'a')).toEqual([A]);
        expect(tracker.filter([A, B, C], '!a')).toEqual([B, C]);
        expect(tracker.filter([A, B, C], '!a', true)).toEqual([B, C, B]);
    });
});
