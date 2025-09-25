import {
    DataFrame,
    Field,
    FieldType,
    getFrameDisplayName
} from "@grafana/data";

import { JSONSchema7, JSONSchema7TypeName } from "json-schema";
import {
    AnnotationOptions,
    Table,
    StructuredAnnotationSchema
} from "@gov.nasa.jpl.honeycomb/core";

import { base64ToArrayBuffer, getFirstTimeField } from "./utils";
import {
    AnimatedChannelBase,
    AnimatedValueMerged
} from "./AnimatedChannel";

enum ValuePathSegmentKind {
    struct,
    array
}

interface ValuePathStructSegment {
    type: ValuePathSegmentKind.struct;
    name: string;
}

interface ValuePathArraySegment {
    type: ValuePathSegmentKind.array;
    index: number;
}

type ValuePathSegment = (
    | ValuePathArraySegment
    | ValuePathStructSegment
)

interface SegmentedPath<T> {
    // Custom constructor to use to load the data
    type?: Field<string>;
    field: Field<T>;
    segments: ValuePathSegment[];
}

const arraySegmentRegex = /^([A-Za-z_][A-Za-z0-9_]*)\[([0-9]+)\]$/;

/**
 * Given a table column, parse where in the nested structure it will appear.
 * @param field Grafana table column (field)
 * @returns Intermediate parsed path
 */
function extractSegments<T>(field: Field<T>, ignoreFirstSegment = false): SegmentedPath<T> {
    // Split `key.nested.array[0]` into `["key", "nested", "array[0]"]`
    const subSegments = field.name.split('.');

    if (ignoreFirstSegment) {
        subSegments.shift();
    }

    const path: SegmentedPath<T> = {
        segments: [],
        field
    };

    for (const seg of subSegments) {
        const m = arraySegmentRegex.exec(seg);

        if (m) {
            // This subpath has array indexing in it `subpath[index]`
            path.segments.push(
                {
                    type: ValuePathSegmentKind.struct,
                    name: m[1]
                },
                {
                    type: ValuePathSegmentKind.array,
                    index: parseInt(m[2], 10)
                }
            );
        } else {
            // This just references part of a struct
            path.segments.push({
                type: ValuePathSegmentKind.struct,
                name: seg
            });
        }
    }

    return path;
}

function createNextSkeleton(nextSegment: ValuePathSegment | undefined) {
    if (!nextSegment) {
        return null;
    } else {
        switch (nextSegment.type) {
            case ValuePathSegmentKind.struct:
                return new Object();
            case ValuePathSegmentKind.array:
                return [];
        }
    }
}

function jsonTypeFromGrafanaType(type: FieldType): JSONSchema7TypeName {
    switch (type) {
        case FieldType.time:
        case FieldType.number:
            return 'number';
        case FieldType.string:
        case FieldType.enum:
            return 'string';
        case FieldType.boolean:
            return 'boolean';
        case FieldType.trace:
        case FieldType.geo:
        case FieldType.other:
        case FieldType.frame:
        case FieldType.nestedFrames:
            // unknown object
            return 'object';
    }
}

/**
 * Compute the JSON schema of the next item in this path
 * @param field Original field to give us the primitive type
 * @param nextSegment Next segment (if it exists), if not we are as deep as we go so we must be at the primtiive
 * @returns JSON schema describing the field or a parent of the field
 */
function createNextSchema(
    field: SegmentedPath<any>,
    nextSegment: ValuePathSegment | undefined
): JSONSchema7 {
    if (!nextSegment) {
        return {
            type: jsonTypeFromGrafanaType(field.field.type),
            // TODO(tumbar) Are we going to have more special constructors
            format: field.type !== undefined ? (
                // Grab the first value and assume the are all the same
                field.type.values.find(v => v !== null)
            ) : undefined
        };
    } else {
        switch (nextSegment.type) {
            case ValuePathSegmentKind.struct:
                return {
                    type: 'object',
                    properties: {}
                };
            case ValuePathSegmentKind.array:
                return {
                    type: 'array'
                };
        }
    }
}

function fillNextSchema(
    lastSchema: JSONSchema7,
    currentSegment: ValuePathSegment,
    schema: JSONSchema7,
): JSONSchema7 {
    switch (currentSegment.type) {
        case ValuePathSegmentKind.struct:
            if (lastSchema.properties?.[currentSegment.name] === undefined) {
                if (!lastSchema.properties) {
                    lastSchema.properties = {};
                }

                lastSchema.properties[currentSegment.name] = schema;
            }

            return lastSchema.properties[currentSegment.name] as JSONSchema7;
        case ValuePathSegmentKind.array:
            // Don't overwrite multiple array elements
            if (lastSchema.items === undefined) {
                lastSchema.items = schema;
            }

            return lastSchema.items as JSONSchema7;
    }
}

export type TypedArray =
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array
    | BigInt64Array
    | BigUint64Array;

const typedArrayConstructors: Record<string, {
    new(arr: ArrayBufferLike): TypedArray
}> = {
    'Int8Array': Int8Array,
    'Uint8Array': Uint8Array,
    'Uint8ClampedArray': Uint8ClampedArray,
    'Int16Array': Int16Array,
    'Uint16Array': Uint16Array,
    'Int32Array': Int32Array,
    'Uint32Array': Uint32Array,
    'Float32Array': Float32Array,
    'Float64Array': Float64Array,
    'BigInt64Array': BigInt64Array,
    'BigUint64Array': BigUint64Array
};

function constructPrimitive(value: any, typeConstructor: string) {
    const specialConstructor = typedArrayConstructors[typeConstructor];
    if (specialConstructor !== undefined) {
        return new specialConstructor(base64ToArrayBuffer(value));
    } else {
        console.warn('Unsupported type contructor:', typeConstructor);
        return value;
    }
}


/**
 * Parses the name of a field as if its a 'flat' path within a nested object.
 * 
 * For example if we have the following object coming from RSVP Lite (or whatever):
 * ```json
 * {
 *      "top": {
 *          "nested": {
 *              "arr": [0, 1, 2],
 *              "key2": false
 *          },
 *          "key3": "hello world"
 *      }
 * }
 * ```
 * 
 * To get this into a tabular format we need to "flatten" all the primitives into column fields:
 * ```
 * top.nested.arr[0]: 0
 * top.nested.arr[1]: 1
 * top.nested.arr[2]: 2
 * top.nested.key2: false
 * top.key3: "hello world"
 * ```
 * 
 * Now on our end we need to convert these paths back into the original object
 * This is done by parsing the segments of the path and iteratively building
 * the object back up.
 * 
 * There are also some custom constructors that are specified by `type:path...`
 * which can be used to construct a primitive in another way
 * (base64 decoding of TypedArrays).
 */
export class StructuredValue<T> {
    fields: Array<SegmentedPath<any>>;
    schema: JSONSchema7;
    skeleton: T;

    constructor(
        table: DataFrame,
        time: Field<number>,
        ignoreFirstSegment = false
    ) {
        // Collect the special `type:` fields to mark the path
        // segments with their special contructors
        const typeFields: Record<string, Field<string>> = {};
        for (const field of table.fields) {
            // Don't track the time field
            if (field === time) {
                continue;
            }

            if (field.name.startsWith('type:')) {
                // Special field attached to RSVP Lite to mark a special constructor
                typeFields[field.name.substring('type:'.length)] = field;
            }
        }

        // Parse out path segments
        this.fields = [];
        for (const field of table.fields) {
            if (field === time) {
                continue;
            }

            if (field.name.startsWith('type:')) {
                // Skip special fields
                continue;
            }

            const path = extractSegments(field, ignoreFirstSegment);
            if (typeFields[field.name]) {
                path.type = typeFields[field.name];
            }

            this.fields.push(path);
        }

        // Build the skeleton and the schema
        this.skeleton = {} as T;
        this.schema = {
            type: 'object',
            properties: {}
        };

        for (const field of this.fields) {
            let last = this.skeleton as any;
            let lastSchema = this.schema;

            for (let i = 0; i < field.segments.length; i++) {
                const segment = field.segments[i];
                const nextSegment = field.segments[i + 1];

                switch (segment.type) {
                    case ValuePathSegmentKind.struct:
                        if (last[segment.name] === undefined) {
                            last[segment.name] = createNextSkeleton(nextSegment);
                        }

                        last = last[segment.name];
                        lastSchema = fillNextSchema(
                            lastSchema,
                            segment,
                            createNextSchema(
                                field,
                                nextSegment
                            )
                        );
                        break;
                    case ValuePathSegmentKind.array:
                        if (last[segment.index] === undefined) {
                            last[segment.index] = createNextSkeleton(nextSegment);
                        }

                        last = last[segment.index];
                        lastSchema = fillNextSchema(
                            lastSchema,
                            segment,
                            createNextSchema(
                                field,
                                nextSegment
                            )
                        );
                        break;
                }
            }
        }
    }

    at(index: number): T {
        // Clone the skeleton object
        const out = structuredClone(this.skeleton);

        // Fill in the primitives
        for (const field of this.fields) {
            let ref = out as any;
            for (let i = 0; i < field.segments.length; i++) {
                const segment = field.segments[i];
                if (i + 1 < field.segments.length) {
                    // There is more to nest
                    switch (segment.type) {
                        case ValuePathSegmentKind.struct:
                            ref = ref[segment.name];
                            break;
                        case ValuePathSegmentKind.array:
                            ref = ref[segment.index];
                            break;
                    }
                } else {
                    // We have arrived at the primitive's parent

                    // Apply a custom constructor if needed
                    let prim;
                    if (field.type) {
                        try {
                            prim = constructPrimitive(
                                field.field.values[index],
                                field.type.values[index]
                            );
                        } catch (e) {
                            throw new Error(`Failed to construct primitive from field '${field.field.name}': ${e} (value=${field.field.values[index].length} type=${field.type.values[index]})`);
                        }
                    } else {
                        prim = field.field.values[index];
                    }

                    switch (segment.type) {
                        case ValuePathSegmentKind.struct:
                            ref[segment.name] = prim;
                            break;
                        case ValuePathSegmentKind.array:
                            ref[segment.index] = prim;
                            break;
                    }
                }
            }
        }

        return out;
    }
}

class AnnotationValueTable<T extends object> extends AnimatedChannelBase<T | null> {
    currentFrame = -1;
    currentFrameWithValue = -1;
    time = -1;

    row?: StructuredValue<T>;
    state?: T;

    protected timeField?: Field<number>;

    constructor(readonly table?: Table) {
        super();
    }

    protected lastFilledIndex(index: number): number {
        // All rows are filled in our eyes
        return index;
    }

    at(time: number): T | null {
        const oldIndex = this.currentFrame;
        this.setTime(time);

        if (this.currentFrame < 0 || !this.row || !this.timeField) {
            return null;
        }

        // Don't rebuild our state if we don't need to
        if (this.currentFrame === oldIndex && this.state) {
            return this.state;
        }

        // Build an object by extracting the rows
        this.state = this.row.at(this.currentFrame);
        return this.state;
    }

    data(data: DataFrame[]): void {
        this.row = undefined;
        this.timeField = undefined;

        const filteredTables = data.filter(series => series.refId === this.table?.refId);

        // Select the proper data frame
        const table = this.table?.table ? filteredTables.find(v =>
            getFrameDisplayName(v) === this.table
        ) : filteredTables[0];

        if (table) {
            // Find the time field
            this.timeField = getFirstTimeField(table, data);
            if (this.timeField) {
                this.row = new StructuredValue(
                    table,
                    this.timeField,
                    this.table?.ignoreFirstSegment
                );
            }
        }

        super.data(data);
    }
}

export class AnnotationValueStructured extends AnimatedValueMerged<any> {
    fields: Record<string, AnnotationValueTable<any>>;

    constructor(
        options: AnnotationOptions<unknown>,
        schema: StructuredAnnotationSchema
    ) {
        super(options);

        this.fields = Object.fromEntries(schema.fields.map(field => [
            field.name,
            new AnnotationValueTable(options.tables?.[field.name])
        ]));
    }
}
