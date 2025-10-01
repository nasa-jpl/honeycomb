import { FileCache } from '../src/FileCache';
import { IndexedDBCache } from '../src/IndexedDBCache';
// import setGlobalVars from 'indexeddbshim/dist/indexeddbshim-node';

// stub to afford the beforeunload callback registration
// global.window = {
//     addEventListener: () => {},
// };
// setGlobalVars(undefined, {
//     checkOrigin: false,
//     memoryDatabase: ':memory:',
// });

// IDBTransaction.commit API not supported in the shim so just stub it here on
// the Object prototype (cannot modify internal shim prototypes).
// https://github.com/indexeddbshim/IndexedDBShim/issues/335
Object.defineProperty(Object.prototype, 'commit', {
    enumerable: false,
    value: () => {},
});

describe('FileCache', () => runSuite(FileCache));

// this line is causing the tests to fail with "SIGSEGV" possibly due to the indexedDBshim library
describe.skip('IndexedDBCache', () => runSuite(IndexedDBCache));

function runSuite(CacheType) {
    let cache;
    beforeEach(() => {
        cache = new CacheType();
    });

    afterEach(() => {
        cache.clear();
    });

    it('should be able to immediately add and delete without having to await a promise.', async () => {
        const obj = {};

        expect(await cache.has('test')).toEqual(false);
        cache.set('test', obj);
        await cache.delete('test');
        expect(await cache.has('test')).toEqual(false);
        cache.set('test', obj);
        expect(await cache.has('test')).toEqual(true);
    });

    it('should serialize and deserialize basic json.', async () => {
        const obj = {
            a: 10,
            b: 'asdf',
            c: {
                d: [1, 2, 3, 100],
            },
        };

        await cache.set('test', obj);
        expect(await cache.has('test')).toEqual(true);
        expect(await cache.get('test')).toEqual(obj);
        await cache.delete('test');
        expect(await cache.has('test')).toEqual(false);
    });

    it('should serialize and deserialize typed arrays.', async () => {
        const obj = {
            arrays: {
                uint8: new Uint8Array([0, 100, 255, 30]),
                uint32: new Uint32Array([0, 100, 1000, 30]),
                int8: new Int8Array([0, -100, 100, 30]),
                int32: new Int32Array([0, -1000, 100, 30]),

                ab: new Uint8Array([1, 2, 3, 4, 5, 6]).buffer,
            },
        };

        await cache.set('test', obj);
        expect(await cache.has('test')).toEqual(true);
        expect(await cache.get('test')).toEqual(obj);
    });

    it('should correctly handle buffers that share underlying ArrayBuffers', async () => {
        const ab = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
        const obj = {
            b1: new Uint8Array(ab, 0, 4),
            b2: new Uint16Array(ab, 4, 2),
        };

        await cache.set('test', obj);
        expect(await cache.get('test')).toEqual(obj);
    });

    it('should be able to serialize and deserialize large arrays.', async () => {
        const obj = {
            arr: new Array(1e5).fill(0).map(() => Math.random()),
        };
        const clone = JSON.parse(JSON.stringify(obj));

        await cache.set('test', obj);
        expect(await cache.get('test')).toEqual(clone);
    });

    it('should be able to serialize and deserialize large strings.', async () => {
        const obj = {
            str: new Array(1e5).fill(0).map(() => String.fromCharCode(Math.random() * 255)),
        };
        const clone = JSON.parse(JSON.stringify(obj));

        await cache.set('test', obj);
        expect(await cache.get('test')).toEqual(clone);
    });

    // To test this, find the the folder where the cache was stored (e.g., use
    // ls -tlr /tmp/ to find newer folders in /tmp/). Next, find the file
    // "hash-test-avoid-duplication.json" and ensure that the indices for
    // "arrays1" and "arrays2" are both 0 through 5. Finally, in the subfolder
    // suffixed with "-bin", check that there's only 6 .bin files.
    it('should serialize and deserialize typed arrays with the same values.', async () => {
        const obj = {
            arrays1: {
                uint8: new Uint8Array([0, 100, 255, 30]),
                uint32: new Uint32Array([0, 100, 1000, 30]),
                int8: new Int8Array([0, -100, 100, 30]),
                int32: new Int32Array([0, -1000, 100, 30]),

                ab: new Uint8Array([1, 2, 3, 4, 5, 6]).buffer,

                astring: '10char str'.repeat(1001),
            },
            arrays2: {
                uint8: new Uint8Array([0, 100, 255, 30]),
                uint32: new Uint32Array([0, 100, 1000, 30]),
                int8: new Int8Array([0, -100, 100, 30]),
                int32: new Int32Array([0, -1000, 100, 30]),

                ab: new Uint8Array([1, 2, 3, 4, 5, 6]).buffer,

                astring: '10char str'.repeat(1001),
            },
        };

        await cache.set('hash-test-avoid-duplication', obj);
        expect(await cache.has('hash-test-avoid-duplication')).toEqual(true);
        expect(await cache.get('hash-test-avoid-duplication')).toEqual(obj);
    });

    // TODO: verify hash collisions with known values that produce collisions
    // (e.g., see https://github.com/Cyan4973/xxHash/issues/165)
    // The listed values there are too large for testing with xxHash32, so the
    // current workaround is to uncomment the test case below and modify the
    // src/utils.js to just not use the hash function; instead set it to a
    // constant value.

    // To test this, find the the folder where the cache was stored (e.g., use
    // ls -tlr /tmp/ to find newer folders in /tmp/). Next, find the file
    // "hash-test-collision.json" and ensure that the indices for "arrays1" and
    // "arrays2" are different (i.e., 0 and 1). Also, in the subfolder suffixed
    // with "-bin", check that there's 2 .bin files.

    // it('should serialize and deserialize typed arrays with the same values with hash collision.', async () => {
    //     const obj = {
    //         arrays1: {
    //             uint8: new Uint8Array([0, 100, 255, 30]),
    //             //biguint64: new BigUint64Array([BigInt(90343688)]),
    //         },
    //         arrays2: {
    //             uint8: new Uint8Array([1, 1, 1, 1]),
    //             //biguint64: new BigUint64Array([BigInt(4387316452)]),
    //         },
    //     };

    //     await cache.set('hash-test-collision', obj);
    //     expect(await cache.has('hash-test-collision')).toEqual(true);
    //     expect(await cache.get('hash-test-collision')).toEqual(obj);
    // });
}
