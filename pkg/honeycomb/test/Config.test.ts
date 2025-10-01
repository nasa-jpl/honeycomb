import { merge, load, CONFIG_LINEAGE } from '../../../app/caspian/src/config';

describe('merge', () => {
    it('should merge keys.', () => {
        const A = { a: 1, b: 2 };
        const B = { b: 3 };
        const C = { c: 4 };

        expect(merge(A, B, C)).toEqual({ a: 1, b: 3, c: 4 });
        expect(merge(C, B, A)).toEqual({ a: 1, b: 2, c: 4 });
    });

    it('should deep merge objects.', () => {
        const A = { a: { b: 1 } };
        const B = { a: { c: 2 } };
        expect(merge(A, B)).toEqual({ a: { b: 1, c: 2 } });
    });

    it('should not modify the inputs.', () => {
        const A = { a: { b: 1 } };
        const B = { a: { c: 2 } };
        const C = merge(A, B);

        expect(A).toEqual({ a: { b: 1 } });
        expect(B).toEqual({ a: { c: 2 } });
        expect(A.a).not.toBe(C.a);
        expect(B.a).not.toBe(C.a);
    });

    it('should merge arrays.', () => {
        const A = { a: [1, 2, 3] };
        const B = { a: [4, 5, 6] };

        expect(merge(A, B)).toEqual({ a: [1, 2, 3, 4, 5, 6] });
        expect(merge(B, A)).toEqual({ a: [4, 5, 6, 1, 2, 3] });
    });
});

describe('load', () => {
    let files = null;
    function fetch(url) {
        return Promise
            .resolve({
                json() { return Promise.resolve(files[url]); },
            });
    }

    beforeEach(() => {
        files = null;
        global.fetch = fetch;
    });

    afterEach(() => {
        files = null;
        delete global.fetch;
    });

    it('should load a config.', async () => {
        files = {
            'path/to/a.json': { data: 1 },
        };

        const config = await load('path/to/a.json');
        expect(config.basePath).toEqual('path/to');
        expect(config.data).toEqual(1);

        const lineage = config[CONFIG_LINEAGE];
        expect(lineage).toHaveLength(1);
        expect(lineage.map(c => c.data)).toEqual([1]);
    });

    it('should throw an error if a cyclic config is loaded.', async () => {
        files = {
            'path/to/a.json': { root: 'b.json', data: 1 },
            'path/to/b.json': { root: 'a.json', data: 2 },
        };

        let caught = false;
        try {
            await load('path/to/a.json');
        } catch(e) {
            caught = true;
        }
        expect(caught).toEqual(true);
    });

    it('should retain a configs lineage.', async () => {
        files = {
            'path/to/a.json': { data: 1 },
            'path/to/b.json': { root: 'a.json', data: 2 },
            'path/to/c.json': { root: 'b.json', data: 3 },
            'path/to/d.json': { root: 'c.json', data: 4, data2: 4 },
        };

        const config = await load('path/to/d.json');
        expect(config.data).toEqual(4);

        const lineage = config[CONFIG_LINEAGE];
        expect(lineage).toHaveLength(4);
        expect(lineage.map(c => c.data)).toEqual([1, 2, 3, 4]);
        expect(lineage.map(c => c.data2)).toEqual([undefined, undefined, undefined, 4]);
        expect(lineage.map(c => c[CONFIG_LINEAGE])).toEqual(new Array(4).fill());
    });

    it('should reeturn base path in the lineage configs.', async () => {
        files = {
            '../../a.json': { data: 1 },
            'b.json': { root: '../../a.json', data: 2 },
        };

        const config = await load('b.json');
        expect(config.data).toEqual(2);

        const lineage = config[CONFIG_LINEAGE];
        expect(lineage.map(c => c.basePath)).toEqual(['../..', '.']);
    });
});
