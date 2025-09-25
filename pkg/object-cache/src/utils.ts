import { xxHash32 } from './xxHash32';

function toF64(arr: number[]) {
    const f64 = new Float64Array(arr.length);
    for (let i = 0, l = f64.length; i < l; i++) {
        f64[i] = arr[i];
    }
    return f64;
}

function fromF64(f64: Float64Array) {
    const arr = new Array(f64.length);
    for (let i = 0, l = arr.length; i < l; i++) {
        arr[i] = f64[i];
    }
    return arr;
}

interface KeyToHashToIndex {
    [name: string]: {
        [hash: string]: number;
    }
}

// Fast serialize and deserialize functions that break out typed arrays into
// separate data structures so they cached separately because they take a long
// time to serialize and the type is lost. The same could be done for long numeric
// arrays and strings to keep things fast.
const nameToType: { [name: string]: any } = {
    UInt8Array: Uint8Array,
    UInt16Array: Uint16Array,
    UInt32Array: Uint32Array,

    Int8Array: Int8Array,
    Int16Array: Int16Array,
    Int32Array: Int32Array,

    Float32Array: Float32Array,
    Float64Array: Float64Array,

    ArrayBuffer: ArrayBuffer
};

const typeToName = new Map<any, keyof typeof nameToType>();
for (const key in nameToType) {
    typeToName.set(nameToType[key], key);
}

/**
 * getBestIndexRaw takes a buffer and returns the best index to
 * use in the "bin" array of the serialize function.
 */
function getBestIndexRaw(keyToHashToIndex: KeyToHashToIndex, buffer: Uint8Array | string, key: string, bin: (Uint8Array | string)[]) {
    const hash = xxHash32(buffer); // To test hash collisions, change this line
    const index = bin.length;
    let bestIndex = index;
    if (key in keyToHashToIndex && hash in keyToHashToIndex[key]) {
        bestIndex = keyToHashToIndex[key][hash];

        // if we found the hash of this buffer, then it's most likely duplicate value
        // that we don't need to cache separately; but we better make sure it truly
        // is a duplicate and not an extremely rare hash collision.
        const existing = bin[bestIndex];

        // it's not a duplicate if the buffers are of different lengths or have
        // different values
        if (existing.length !== buffer.length) {
            bestIndex = index;
            console.warn('found hash collision during object cache serialization');
        } else {
            for (let i = 0; i < buffer.length; i++) {
                if (existing[i] !== buffer[i]) {
                    bestIndex = index;
                    console.warn('found hash collision during object cache serialization');
                    break;
                }
            }
        }
    } else {
        if (!(key in keyToHashToIndex))
            keyToHashToIndex[key] = {};
        keyToHashToIndex[key][hash] = index;
    }
    return bestIndex;
}

// serialize the object -- returns an object with a string of data
// and array of binary assets that are needed to deserialize the object.
function serialize(obj: any) {
    const bin: (Uint8Array | string)[] = [];
    const reset: { obj: any, key: string, val: any }[] = [];

    /**
     * keyToHashToIndex is a helper variable for checking for duplicate values that don't
     * need to be stored separately in the "bin" array. keyToHashToIndex maps keys to
     * hash values to "bin" array indices. For example:
     * {
     *     "actual_position": {
     *         "hash-of-value-at-index-23": 23, // hashes are ordered randomly of course
     *         "hash-of-value-at-index-0": 0,
     *         ...
     *     },
     *     ...
     *     "motor_on": {
     *         "hash-of-value-at-index-15": 15, // hashes are ordered randomly of course
     *         ...
     *     }
     * }
     * If there's no hash for a particular key-value pair, then we know that it's a new
     * value, and we simply append that value to the "bin" array. However, if there is
     * a hash already existing for a particular key-value pair, then it's most likely a
     * duplicate value and we simply reference the "bin" array index for the first
     * appearance of that value as specified by this helper variable keyToHashToIndex.
     * Of course, we also need to check for hash collisions, which we do as well.
     */
    const keyToHashToIndex: KeyToHashToIndex = {};

    const recurse = (o: any) => {
        // If the arrays is not an array of objects then skip it assuming it's all the same
        // type and we can't do anything to win with it.
        if (
            Array.isArray(o) && o[0] instanceof Object ||
            !Array.isArray(o) && o instanceof Object
        ) {
            for (const key in o) {
                // If it's a typed buffer then save it out.
                const val = o[key];
                if (typeToName.has(val.constructor)) {
                    const consName = typeToName.get(val.constructor);
                    const index = bin.length;
                    let buffer;
                    if (val instanceof ArrayBuffer) {
                        buffer = new Uint8Array(val);
                    } else {
                        buffer = new Uint8Array(
                            val.buffer,
                            val.byteOffset,
                            val.length * val.BYTES_PER_ELEMENT,
                        );
                    }

                    const bestIndex = getBestIndexRaw(keyToHashToIndex, buffer, key, bin);

                    // only add if it's a new value...
                    if (bestIndex === index) {
                        bin.push(buffer);
                    }

                    reset.push({
                        obj: o,
                        key,
                        val,
                    });
                    o[key] = `${consName};;;${bestIndex}`;
                } else if (Array.isArray(val) && typeof val[0] === 'number' && val.length > 1e4) {
                    const index = bin.length;
                    const f64 = toF64(val);
                    const buffer = new Uint8Array(f64.buffer);

                    const bestIndex = getBestIndexRaw(keyToHashToIndex, buffer, key, bin);

                    // only add if it's a new value...
                    if (bestIndex === index) {
                        bin.push(buffer);
                    }

                    reset.push({
                        obj: o,
                        key,
                        val,
                    });
                    o[key] = `array;;;${bestIndex}`;
                } else if (typeof val === 'string' && val.length > 1e4) {
                    const index = bin.length;

                    const bestIndex = getBestIndexRaw(keyToHashToIndex, val, key, bin);

                    // only add if it's a new value...
                    if (bestIndex === index) {
                        bin.push(val);
                    }

                    reset.push({
                        obj: o,
                        key,
                        val,
                    });
                    o[key] = `string;;;${bestIndex}`;
                } else if (val instanceof Object) {
                    recurse(val);
                }
            }
        }
    };

    recurse(obj);
    const data = JSON.stringify(obj);
    reset.forEach(data => (data.obj[data.key] = data.val));

    return { data, bin };
}

// deserializes a string that was serialized with the above function. The `getBinCb`
// retrieves bin data.
async function deserialize<T>(data: string, getBinCb: (index: string, type: string) => Promise<any>): Promise<T> {
    const recurse = async (o: any) => {
        const isArrayOfObjects = Array.isArray(o) && o[0] instanceof Object;
        const isObject = !Array.isArray(o) && o instanceof Object;
        if (isArrayOfObjects || isObject) {
            for (const key in o) {
                const val = o[key];
                if (typeof val === 'string' && /^.+?;;;\d+$/.test(val)) {
                    const [consName, index] = val.split(';;;');

                    if (consName === 'array') {
                        const buffer = await getBinCb(index, 'buffer');
                        const arr = fromF64(
                            new Float64Array(
                                buffer.buffer,
                                buffer.byteOffset,
                                buffer.byteLength / Float64Array.BYTES_PER_ELEMENT
                            )
                        );
                        o[key] = arr;
                    } else if (consName === 'string') {
                        o[key] = await getBinCb(index, 'string');
                    } else {
                        const buffer = await getBinCb(index, 'buffer');
                        const cons = nameToType[consName];

                        const result =
                            cons === ArrayBuffer
                                ? buffer.buffer
                                : new cons(
                                    buffer.buffer,
                                    buffer.byteOffset,
                                    buffer.byteLength / cons.BYTES_PER_ELEMENT,
                                );
                        o[key] = result;
                    }
                } else if (val instanceof Object) {
                    await recurse(val);
                }
            }
        }
    };

    const obj = JSON.parse(data);
    await recurse(obj);
    return obj;
}

export { serialize, deserialize };
