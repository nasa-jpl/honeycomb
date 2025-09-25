import React, { useEffect, useMemo, useState } from "react";
import { JSONSchema7, JSONSchema7TypeName } from "json-schema";

import {
    DataFrame,
    getFrameDisplayName,
    PanelOptionsEditorProps
} from "@grafana/data";

import { Checkbox, CodeEditor, Field, InlineLabel, Select, Stack } from "@grafana/ui";

import { AnnotationSceneObject, AnnotationSchemaDataModel, Table, TableSchema } from "@gov.nasa.jpl.honeycomb/core";

import { getFirstTimeField } from "../../honeycomb/utils";
import { EditorProps } from "../common";
import { StructuredValue } from "../../honeycomb/AnnotationStructured";
import { annotationRegistry } from "../../module";

function schemaToTypescriptHelper(schema: JSONSchema7, indent = 0): string {
    switch (schema.type as JSONSchema7TypeName) {
        case "string":
            return 'string';
        case "number":
        case "integer":
            return 'number';
        case "boolean":
            return 'boolean';
        case "null":
            return 'null';
        case "object":
            const fieldsTypescript = Object.entries(schema.properties!).map(([key, value]) => (
                `${" ".repeat(indent * 4)}${key}: ${schemaToTypescript(value as JSONSchema7, indent + 1, true)}`
            ));

            return [`{`, ...fieldsTypescript, `${" ".repeat((indent - 1) * 4)}}`].join('\n');
        case "array":
            return `${schemaToTypescript(
                schema.items! as JSONSchema7,
                indent
            )}[]`;
    }
}

function schemaToTypescript(schema: JSONSchema7, indent = 1, semi = false): string {
    const term = semi ? ';' : '';
    if (schema.format) {
        return `${schema.format}${term} // Decoded from ${schema.type}`;
    }

    const s = schemaToTypescriptHelper(schema, indent);
    return `${s}${term}`;
}

interface TableEditorProps extends EditorProps<Table | undefined> {
    data: DataFrame[];
    field: TableSchema;
}

const TableEditor: React.FC<TableEditorProps> = ({ data, onChange, value, field }) => {
    const [error, setError] = useState<string>();

    const filteredTables = useMemo(() => (
        data.filter(series => series.refId === value?.refId)
    ), [data, value?.refId]);

    const queryOptions = useMemo(() => {
        const queries = new Set<string>();
        for (const table of data) {
            if (table.refId) {
                // TODO(tumbar) Should we support tables without refIds?
                queries.add(table.refId)
            }
        }

        return Array.from(queries.values()).sort().map((refId) => ({
            label: refId,
            value: refId
        }));
    }, [data]);

    // Update the error if we can't construct a structured value
    useEffect(() => {
        const table = value?.table ? filteredTables.find(v =>
            getFrameDisplayName(v) === value?.table
        ) : filteredTables[0];

        let timeField
        if (table) {
            // Find the time field
            timeField = getFirstTimeField(table, data);
            if (timeField) {
                try {
                    new StructuredValue(table, timeField);
                    setError(undefined);
                } catch (e) {
                    setError(`Can't construct value: ${e}`);
                }
            } else {
                setError('No time field in table series');
            }
        } else {
            setError(value !== undefined ? 'Table not found' : undefined);
        }
    }, [data, filteredTables, value]);

    const tableOptions = useMemo(() => (
        [
            {
                label: '[First Table]',
                value: ''
            },
            ...filteredTables.map((frame) => {
                const name = getFrameDisplayName(frame);
                return {
                    label: name,
                    value: name,
                };
            })
        ]
    ), [filteredTables]);

    return (
        <Field
            key={field.name}
            label={field.name}
            description={field.description}
            error={error}
        >
            <Stack direction="column">
                <Stack direction="row">
                    <InlineLabel width="auto">Query</InlineLabel>
                    <Select
                        onChange={(v) => onChange({
                            ...value,
                            refId: v.value ? v.value : null
                        })}
                        options={queryOptions}
                        value={value?.refId}
                        placeholder="Query ID"
                        data={data}
                    />
                </Stack>

                <Stack direction="row">
                    <InlineLabel width="auto">Table</InlineLabel>
                    <Select
                        onChange={(v) => onChange({
                            ...value,
                            table: v.value ? v.value : null
                        })}
                        options={tableOptions}
                        value={value?.table ?? ''}
                        placeholder="Table ID"
                        data={data}
                    />
                </Stack>
                <Checkbox
                    label="Extract"
                    description="Ignore the first path segment, the equivalent of doing {...data}"
                    value={value?.ignoreFirstSegment}
                    onChange={(e) => onChange({ ...value, ignoreFirstSegment: e.currentTarget.checked })}
                />
            </Stack>
        </Field>
    );
}

export const StructuredAnnotationOptionsEditor: React.FC<
    PanelOptionsEditorProps<Record<string, Table> | undefined>
> = ({ context, value, onChange }) => {
    const options: AnnotationSceneObject = context.options;

    const item = useMemo(() => annotationRegistry.getIfExists(
        options.annotation.type
    ), [options.annotation.type]);

    const structuredValues = useMemo<Record<string, StructuredValue<unknown>> | null>(() => {
        if (item?.schema.dataModel !== AnnotationSchemaDataModel.structured) {
            return null;
        }

        const out: Record<string, StructuredValue<unknown>> = {};

        for (const field of item.schema.fields) {
            const tableValue = value?.[field.name];
            const filteredTables = context.data.filter(series => series.refId === tableValue?.refId);

            const table = tableValue?.table ? filteredTables.find(v =>
                getFrameDisplayName(v) === tableValue.table
            ) : filteredTables[0];

            let timeField;

            if (table) {
                // Find the time field
                timeField = getFirstTimeField(table, context.data);
                if (timeField) {
                    out[field.name] = new StructuredValue(
                        table,
                        timeField,
                        tableValue?.ignoreFirstSegment
                    );
                }
            }
        }

        return out;
    }, [context.data, item?.schema.dataModel, item?.schema.fields, value]);

    const schemaCode = useMemo(() => {
        if (structuredValues) {
            return `interface Data ${schemaToTypescript({
                type: 'object',
                properties: Object.fromEntries(Object.entries(structuredValues).map(([name, value]) => [
                    name, value.schema
                ]))
            })}`;
        }

        return;
    }, [structuredValues]);

    if (item?.schema.dataModel !== AnnotationSchemaDataModel.structured) {
        return null;
    }

    return (
        <React.Fragment>
            {item?.schema && item.schema.fields.map((field) => (
                <TableEditor
                    key={field.name}
                    field={field}
                    data={context.data}
                    value={value?.[field.name]}
                    onChange={(diff) => onChange({
                        ...value,
                        [field.name]: {
                            ...value?.[field.name],
                            ...diff
                        } as Table
                    })}
                    {...item.schema}
                />
            ))}

            <CodeEditor
                showMiniMap={false}
                height={200}
                readOnly
                value={schemaCode ?? 'Failed to create schema'}
                language={schemaCode !== undefined ? "typescript" : 'plaintext'}
            />
        </React.Fragment>
    );
}
