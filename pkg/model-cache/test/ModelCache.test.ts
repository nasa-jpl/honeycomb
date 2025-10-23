import { ModelCache, hash } from '../src/ModelCache';
import { Group, DataTexture, Texture } from 'three';

function nextTick() {
    return new Promise(resolve => process.nextTick(resolve));
}

describe('ModelCache', () => {
    it('should add and get objects to the cache.', () => {
        const A = {};
        const B = [1, 2, 3];
        const C = new Float32Array([1, 2, 3]);
        const D = new Group();
        const E = new Texture();
        const F = new DataTexture();

        const cache = new ModelCache();
        cache.add('A', A);
        expect(A).toEqual(cache.getClone('A'));
        expect(A).not.toBe(cache.getClone('A'));
        expect(A).toBe(cache.get('A'));
        expect(A).toBeTruthy();

        cache.add('B', B);
        expect(B).toEqual(cache.getClone('B'));
        expect(B).not.toBe(cache.getClone('B'));
        expect(B).toBe(cache.get('B'));
        expect(B).toBeTruthy();

        cache.add('C', C);
        expect(C).toEqual(cache.getClone('C'));
        expect(C).not.toBe(cache.getClone('C'));
        expect(C).toBe(cache.get('C'));
        expect(C).toBeTruthy();

        cache.add('D', D);
        expect(D).not.toBe(cache.getClone('D'));
        expect(D).toBe(cache.get('D'));
        expect(D).toBeTruthy();

        cache.add('E', E);
        expect(E).not.toBe(cache.getClone('E'));
        expect(E).toBe(cache.get('E'));
        expect(E).toBeTruthy();

        cache.add('F', F);
        expect(F).not.toBe(cache.getClone('F'));
        expect(F).toBe(cache.get('F'));
        expect(F).toBeTruthy();
    });

    it('should return promises if the value is pending.', done => {
        let resolve;
        const pr = new Promise(res => (resolve = res));

        const cache = new ModelCache();
        cache.add('pr', pr);

        const clonedPr = cache.getClone('pr');
        expect(clonedPr instanceof Promise).toBeTruthy();
        expect(clonedPr).not.toBe(pr);

        Promise.all([pr, clonedPr]).then(([item, clonedPr]) => {
            expect(item).toEqual({ a: 10 });
            expect(clonedPr).toEqual(item);
            expect(clonedPr).not.toBe(item);
            done();
        });

        resolve({ a: 10 });
    });

    it('should not return that an cached object is pending', () => {
        const cache = new ModelCache();
        cache.add('a', {});
        expect(cache.isPending('a')).toEqual(false);
    });

    it('should return that a promise is pending until it has resolved.', done => {
        let resolve;
        const pr = new Promise(res => (resolve = res));

        const cache = new ModelCache();
        cache.add('a', pr);
        expect(cache.isPending('a')).toBeTruthy();

        pr.then(() => {
            expect(cache.isPending('a')).toBeFalsy();
            done();
        });
        resolve({});
    });

    it('should allow items to be deleted', () => {
        const cache = new ModelCache();
        const pr = new Promise(() => {});

        cache.add('a', {});
        cache.add('pr', pr);

        expect(cache.has('a')).toBeTruthy();
        expect(cache.isPending('a')).toBeFalsy();
        expect('a' in cache.cache).toBeTruthy();

        expect(cache.has('pr')).toBeTruthy();
        expect(cache.isPending('pr')).toBeTruthy();
        expect('pr' in cache.cache).toBeTruthy();

        cache.delete('a');
        cache.delete('pr');
        cache.delete('d');

        expect(cache.has('a')).toBeFalsy();
        expect(cache.isPending('a')).toBeFalsy();
        expect('a' in cache.cache).toBeFalsy();
        expect(cache.getClone('a')).toEqual(null);

        expect(cache.has('pr')).toBeFalsy();
        expect(cache.isPending('pr')).toBeFalsy();
        expect('pr' in cache.cache).toBeFalsy();
        expect(cache.getClone('pr')).toEqual(null);
    });

    it('should remove any models that fail to load.', async () => {
        let reject;
        const pr = new Promise((res, rej) => {
            reject = rej;
        });

        const cache = new ModelCache();
        cache.add('hash', pr);
        expect(cache.has('hash')).toBeTruthy();

        reject();
        await nextTick();
        expect(cache.has('hash')).toBeFalsy();
    });

    it('should propagate errors of models that fail to load.', async () => {
        let reject;
        const pr = new Promise((res, rej) => {
            reject = rej;
        });

        const cache = new ModelCache();
        cache.add('hash', pr);

        const otherPr = cache.getClone('hash');
        expect(otherPr).toBeTruthy();

        const error = new Error();
        let caughtError = null;
        otherPr.catch(err => {
            caughtError = err;
        });

        reject(error);
        await nextTick();
        expect(caughtError).toBe(error);
    });

    it('should clear all items when calling "clear".', async () =>{
        const cache = new ModelCache();
        cache.add('a', {});
        cache.add('b', new Promise(() => {}));
        cache.add('c', Promise.resolve({}));

        await nextTick();

        expect(cache.has('a')).toBeTruthy();
        expect(cache.has('b')).toBeTruthy();
        expect(cache.has('c')).toBeTruthy();

        cache.clear();

        expect(cache.has('a')).toBeFalsy();
        expect(cache.has('b')).toBeFalsy();
        expect(cache.has('c')).toBeFalsy();
    });

    it('should be able to clear items that have been marked unused.', () => {
        const cache = new ModelCache();
        cache.add('a', {});
        cache.markUnused();

        cache.add('b', {});
        cache.markUnused();

        cache.add('c', {});
        cache.markUnused();

        cache.add('d', {});
        cache.markUnused();

        cache.add('e', {});

        expect(cache.has('a')).toBeTruthy();
        cache.cullUnused(4);
        expect(cache.has('a')).toBeFalsy();

        expect(cache.has('b')).toBeTruthy();
        expect(cache.has('c')).toBeTruthy();
        expect(cache.has('d')).toBeTruthy();
        expect(cache.has('e')).toBeTruthy();
        cache.cullUnused();
        expect(cache.has('b')).toBeFalsy();
        expect(cache.has('c')).toBeFalsy();
        expect(cache.has('d')).toBeFalsy();
        expect(cache.has('e')).toBeTruthy();
    });

    it('should ensure items remain deleted even after being resolved.', async () => {
        const cache = new ModelCache();
        let resolve = null;
        cache.add(
            'a',
            new Promise(res => {
                resolve = res;
            }),
        );

        let cloned = null;
        cache.getClone('a').then(res => {
            cloned = res;
        });

        await nextTick();

        expect(cache.has('a')).toBeTruthy();
        cache.clear();
        expect(cache.has('a')).toBeFalsy();

        expect(cloned).toBeFalsy();
        resolve({});
        await nextTick();
        expect(cache.has('a')).toBeFalsy();

        expect(cloned).toBeTruthy();
    });

    it('should return the same instance of a promise if nested.', async () => {
        const promise = Promise.resolve();
        const cache = new ModelCache();
        const obj = { promise };
        cache.add('a', obj);

        const clone = cache.getClone('a');

        expect(clone).not.toBe(obj);
        expect(clone.promise).toBe(obj.promise);
    });
});

describe('hash function', () => {
    it('should properly hash objects.', () => {
        const obj = { A: 1, B: 2 };
        const res = hash('test', obj);

        expect(res).toEqual('test|{"A":1,"B":2}');
    });
});
