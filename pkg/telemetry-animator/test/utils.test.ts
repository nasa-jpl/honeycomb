import {
    isArrayBuffer,
    copyOnTo,
    rollUpState,
    createNewInstanceOfType,
} from '../src/utils';

describe('rollUpState()', () => {
    it('should roll up state from frames.', () => {
        const frames = [
            { time: 0, state: { a: 1 } },
            { time: 1, state: { b: 1 } },
            { time: 2, state: { c: 2 } },
        ];

        const runFrames = [];
        const finishFrame = rollUpState(frames, -1, 2, s => {
            runFrames.push(s);
        });

        expect(runFrames).toEqual(frames.map(f => f.state));
        expect(finishFrame).toEqual(2);
    });

    it('should roll up state from frames excluding the current frame.', () => {
        const frames = [
            { time: 0, state: { a: 1 } },
            { time: 1, state: { b: 1 } },
            { time: 2, state: { c: 2 } },
        ];

        const runFrames = [];
        const finishFrame = rollUpState(frames, 0, 2, s => {
            runFrames.push(s);
        });

        frames.shift();
        expect(runFrames).toEqual(frames.map(f => f.state));
        expect(finishFrame).toEqual(2);
    });

    it('should roll up state from frames up to a time.', () => {
        const frames = [
            { time: 0, state: { a: 1 } },
            { time: 1, state: { b: 1 } },
            { time: 2, state: { c: 2 } },
        ];

        const runFrames = [];
        const finishFrame = rollUpState(frames, -1, 1.999, s => {
            runFrames.push(s);
        });

        frames.pop();
        expect(runFrames).toEqual(frames.map(f => f.state));
        expect(finishFrame).toEqual(1);
    });

    it('should return the same frame if there is no progress to be made.', () => {
        const frames = [
            { time: 0, state: { a: 1 } },
            { time: 1, state: { b: 1 } },
            { time: 2, state: { c: 2 } },
        ];

        const runFrames = [];
        const finishFrame = rollUpState(frames, -1, -1, s => {
            runFrames.push(s);
        });

        expect(runFrames).toEqual([]);
        expect(finishFrame).toEqual(-1);
    });
});

describe('isArrayBuffer()', () => {
    it('identify array buffers correctly.', () => {
        expect(isArrayBuffer(0)).toEqual(false);
        expect(isArrayBuffer(null)).toEqual(false);
        expect(isArrayBuffer(undefined)).toEqual(false);
        expect(isArrayBuffer('test')).toEqual(false);
        expect(isArrayBuffer('')).toEqual(false);
        expect(isArrayBuffer(true)).toEqual(false);
        expect(isArrayBuffer({})).toEqual(false);
        expect(isArrayBuffer([])).toEqual(false);

        expect(isArrayBuffer(new ArrayBuffer())).toEqual(true);
        expect(isArrayBuffer(new Float32Array())).toEqual(true);
        expect(isArrayBuffer(new Float64Array())).toEqual(true);

        expect(isArrayBuffer(new Uint8Array())).toEqual(true);
        expect(isArrayBuffer(new Uint16Array())).toEqual(true);
        expect(isArrayBuffer(new Uint32Array())).toEqual(true);

        expect(isArrayBuffer(new Int8Array())).toEqual(true);
        expect(isArrayBuffer(new Int16Array())).toEqual(true);
        expect(isArrayBuffer(new Int32Array())).toEqual(true);
    });
});

describe('copyOnTo()', () => {
    it('should copy the structure of a shallow object.', () => {
        const from = {
            a: 1,
            b: 'a',
            c: null,
            d: undefined,
        };

        const to = {};
        copyOnTo(from, to, false);
        expect(from).toEqual(to);
        expect(from).not.toBe(to);
    });

    it('should copy objects.', () => {
        const from = {
            a: {},
            b: {
                c: {},
                d: 1,
            },
        };

        const to = {};
        copyOnTo(from, to, false);
        expect(from).toEqual(to);
        expect(from).not.toBe(to);
        expect(from.a).not.toBe(to.a);
        expect(from.b).not.toBe(to.b);
        expect(from.b.c).not.toBe(to.b.c);
    });

    it('should not create new objects if not needed.', () => {
        const from = {
            a: {},
            b: {
                c: {},
            },
        };

        const to = {
            a: {},
            b: {},
        };
        const a = to.a;
        const b = to.b;
        copyOnTo(from, to, false);
        expect(to.a).toBe(a);
        expect(to.b).toBe(b);
        expect(b.c).toEqual({});
    });

    it('should remove unused fields.', () => {
        const from = {
            a: {},
            b: {
                c: {},
            },
        };

        const to = {
            d: {},
            e: 10,
            b: null,
        };

        copyOnTo(from, to, false);
        expect(from).toEqual(to);
    });

    describe('traverseArrays', () => {
        it('should just move arrays if false.', () => {
            const from = {
                a: [1, 2, 3],
                b: {
                    c: [2, 3, 4],
                    d: new Float32Array([1, 2, 3, 4]),
                },
            };

            const to = {};
            copyOnTo(from, to, false);
            expect(from).toEqual(to);
            expect(from.a).toBe(to.a);
            expect(from.b.c).toBe(to.b.c);
            expect(from.b.d).toBe(to.b.d);
        });

        it('should replace arrays if false.', () => {
            const from = {
                a: [1, 2, 3],
                b: {
                    c: [{}, {}, {}],
                    d: new Float32Array([1, 2, 3, 4]),
                },
            };

            const to = {
                a: [],
                b: {
                    c: [{}],
                    d: new Float32Array([1]),
                },
            };

            copyOnTo(from, to, false);
            expect(from).toEqual(to);
            expect(from.a).toBe(to.a);
            expect(from.b.c).toBe(to.b.c);
            expect(from.b.d).toBe(to.b.d);
        });

        it('should make new arrays if true.', () => {
            const from = {
                a: [1, 2, 3],
                b: {
                    c: [{ a: 10 }, { b: 2 }, {}],
                    d: [],
                },
            };

            const to = {};
            copyOnTo(from, to, true);
            expect(from).toEqual(to);
            expect(from.a).not.toBe(to.a);
            expect(from.b).not.toBe(to.b);
            expect(from.b.c).not.toBe(to.b.c);
            expect(from.b.d).not.toBe(to.b.d);
            expect(from.b.c[0]).not.toBe(to.b.c[0]);
        });

        it('should ensure objects are not shared if true.', () => {
            const from = {
                a: [1, 2, 3],
                b: {
                    c: [{ a: 10 }, { b: 2 }, {}],
                    d: [],
                },
                c: [],
            };

            const to = {
                a: from.a,
                b: from.b,
                c: from.c,
            };
            copyOnTo(from, to, true);
            expect(from).toEqual(to);
            expect(from.a).not.toBe(to.a);
            expect(from.b).not.toBe(to.b);
            expect(from.c).not.toBe(to.c);
            expect(from.b.c[0]).not.toBe(to.b.c[0]);
        });
    });

    describe('copyTypedArrays', () => {
        it('should just move typed arrays if false', () => {
            const from = {
                a: new Float32Array([1, 2, 3, 4]),
            };

            const to = {
                a: from.a,
            };
            copyOnTo(from, to, true, false, false, false);
            expect(from).toEqual(to);
            expect(from.a).toEqual(to.a);
            expect(from.a).toBe(to.a);
        });

        it('should copy typed arrays if true', () => {
            const from = {
                a: new Float32Array([1, 2, 3, 4]),
            };

            const to = {
                a: from.a,
            };
            copyOnTo(from, to, true, false, false, true);
            expect(from).toEqual(to);
            expect(from.a).toEqual(to.a);
            expect(from.a).not.toBe(to.a);
        });
    });

    describe('shallow', () => {
        it('should only do a shallow copy if true.', () => {
            const from = {
                a: {
                    b: 100,
                },
            };
            const to = {};

            copyOnTo(from, to, false, true);
            expect(to.a).toBe(from.a);
        });

        it('should do a deep copy if false.', () => {
            const from = {
                a: {
                    b: 100,
                },
            };
            const to = {};

            copyOnTo(from, to, false, false);
            expect(to.a).not.toBe(from.a);
        });
    });

    describe('removeUnusedKeys', () => {
        it('should remove unused keys if true.', () => {
            const from = { a: 100, b: { c: 100 } };
            const to = { a: 200, b: { d: 200 }, c: 200 };
            copyOnTo(from, to, false, false, true);
            expect(to).toEqual({ a: 100, b: { c: 100 } });
        });

        it('should not remove unused keys if false.', () => {
            const from = { a: 100, b: { c: 100 } };
            const to = { a: 200, b: { d: 200 }, c: 200 };
            copyOnTo(from, to, false, false, false);
            expect(to).toEqual({ a: 100, b: { c: 100, d: 200 }, c: 200 });
        });
    });
});
