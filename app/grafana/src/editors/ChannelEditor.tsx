import React, { useCallback, useEffect, useState } from "react";

import { FieldType } from "@grafana/data";

import {
    Box,
    Field,
    InlineLabel,
    InlineSwitch,
    Input,
    Stack
} from "@grafana/ui";

import { Channel, ChannelSchema, ChannelSchemaType, ChannelType } from "@gov.nasa.jpl.honeycomb/core";

import {
    FieldSelector,
    LeniantEditorProps,
    useEditorContext,
    useFieldFromName
} from "../editors/common";

interface ChannelEditorProps {
    type: ChannelSchemaType;
    setError: (err: string | undefined) => void;
}

function fieldTypeFromSchema(schema: ChannelSchemaType): FieldType {
    switch (schema) {
        case ChannelSchemaType.number:
            return FieldType.number;
        case ChannelSchemaType.boolean:
            return FieldType.boolean;
        case ChannelSchemaType.string:
            return FieldType.string;
    }
}

function AnimatedChannelEditor<T>({
    type,
    value,
    onChange,
    setError,
    showInterpolate=true
}: LeniantEditorProps<Channel<T>> & ChannelEditorProps & { showInterpolate?: boolean }) {
    const { data } = useEditorContext();
    const field = useFieldFromName(data ?? [], value?.field);

    useEffect(() => {
        // Validate the field type
        if (field) {
            const expectedFieldType = fieldTypeFromSchema(type);
            if (field.type !== expectedFieldType) {
                setError(`Field must be ${expectedFieldType} type`);
            } else {
                setError(undefined);
            }
        } else {
            // '(not found)' already indicated
            setError(undefined);
        }
    }, [field, type, setError]);

    const onFieldChange = useCallback((value: string) => {
        onChange({ field: value });
    }, [onChange]);

    const onChangeInterpolate = useCallback((event: React.FormEvent<HTMLInputElement>) => {
        onChange({ interpolate: event.currentTarget.checked });
    }, [onChange]);

    return (
        <Stack direction="row" grow={1}>
            <Box
                width={0}
                flex={1}
            >
                <FieldSelector
                    onChange={onFieldChange}
                    value={value?.field}
                    data={data ?? []}
                />
            </Box>
            {showInterpolate && field?.type === FieldType.number && (
                <InlineSwitch
                    label="Interpolate"
                    value={value?.interpolate}
                    onChange={onChangeInterpolate}
                    showLabel
                />
            )}
        </Stack>
    );
}

function defaultValueOfSchema<T>(type: ChannelSchemaType): T {
    switch (type) {
        case ChannelSchemaType.number:
            return 0 as T;
        case ChannelSchemaType.boolean:
            return false as T;
        case ChannelSchemaType.string:
            return '' as T;
    }
}

function valueAsCache<T>(type: ChannelSchemaType, value: T): string {
    switch (type) {
        case ChannelSchemaType.number:
        case ChannelSchemaType.boolean:
            return String(value ?? defaultValueOfSchema(type));
        case ChannelSchemaType.string:
            return (value ?? defaultValueOfSchema(type)) as string;
    }
}

function cacheAsValue<T>(type: ChannelSchemaType, cache: string): T {
    switch (type) {
        case ChannelSchemaType.number: {
            const value = parseFloat(cache);
            if (Number.isNaN(value)) {
                throw "Invalid number";
            }

            return value as T;
        }
        case ChannelSchemaType.boolean:
            return (cache === 'true') as T;
        case ChannelSchemaType.string:
            return cache as T;
    }
}

function getCacheFromElement<T>(type: ChannelSchemaType, input: HTMLInputElement): string {
    switch (type) {
        case ChannelSchemaType.number:
        case ChannelSchemaType.string:
            return valueAsCache<T>(type, input.value as T);
        case ChannelSchemaType.boolean:
            return valueAsCache<T>(type, input.value as T);
    }
}

function ConstantChannelEditor<T>({
    type,
    value,
    placeholder,
    onChange,
    setError
}: LeniantEditorProps<Channel<T>> & ChannelEditorProps & { placeholder: string }) {
    const [cacheValue, setCacheValue] = useState(
        valueAsCache(type, value?.value ?? defaultValueOfSchema(type))
    );

    const onInputChange = useCallback((ev: React.FormEvent<HTMLInputElement>) => {
        setCacheValue(getCacheFromElement(
            type,
            ev.currentTarget
        ));
    }, [type]);

    const onInputBlur = useCallback((ev: React.FormEvent<HTMLInputElement>) => {
        try {
            const value = (
                cacheAsValue<T>(
                    type,
                    getCacheFromElement(
                        type,
                        ev.currentTarget
                    )
                )
            );

            setError(undefined);
            onChange({ value });
        } catch (e) {
            setError(e as string);
        }
    }, [type, onChange, setError]);

    useEffect(() => {
        setCacheValue(valueAsCache(type, value?.value));
    }, [type, value?.value]);

    if (value?.value === undefined) {
        onChange({
            ...value,
            value: defaultValueOfSchema(type)
        });
        return null;
    }

    // We don't support defaults for string channels
    if (type === 'string' && value.type === ChannelType.animated) {
        return null;
    }

    return (
        <React.Fragment>
            <InlineLabel width="auto">
                {value.type === ChannelType.animated ? 'Fallback' : 'Value'}
            </InlineLabel>
            <Input
                placeholder={placeholder}
                type={type}
                value={cacheValue}
                onChange={onInputChange}
                onBlur={onInputBlur}
            />
        </React.Fragment>
    )
}

export function ChannelEditor<T>({
    type,
    name,
    description,
    value,
    onChange
}: LeniantEditorProps<Channel<T>> & ChannelSchema) {
    const [error, setError] = useState<string>();

    const onChangeAnimated = useCallback((event: React.FormEvent<HTMLInputElement>) => {
        onChange({
            ...value,
            type: (
                event.currentTarget.checked ?
                    ChannelType.animated
                    : ChannelType.constant
            )
        });
    }, [onChange, value]);

    const onChangeUseSeparateTimeChannel = useCallback((event: React.FormEvent<HTMLInputElement>) => {
        onChange({
            ...value,
            useSeparateTimeChannel: event.currentTarget.checked
        });
    }, [onChange, value]);

    const onChangeTimeChannel = useCallback((event: Partial<Channel<number>>) => {
        onChange({
            ...value,
            timeChannel: {
                type: ChannelType.animated,
                interpolate: false,
                value: 0,
                field: (event as any).field
            } as Channel<number>
        });
    }, [onChange, value]);

    if (!value) {
        onChange({
            type: ChannelType.constant
        });

        return null;
    }

    return (
        <React.Fragment>
            <Field
                label={name}
                description={description}
                invalid={Boolean(error)}
                error={error}
            >
                <Stack direction="column">
                    <Stack direction="row">
                        <InlineSwitch
                            label="Animate"
                            showLabel
                            value={value.type === ChannelType.animated}
                            onChange={onChangeAnimated}
                        />
                        <ConstantChannelEditor
                            placeholder="Constant"
                            setError={setError}
                            onChange={onChange}
                            value={value}
                            type={type}
                        />
                    </Stack>
                    {value.type === ChannelType.animated && 
                    <Stack direction="row">
                        <AnimatedChannelEditor
                            setError={setError}
                            onChange={onChange}
                            value={value}
                            type={type}
                        />
                    </Stack>}
                    {value.type === ChannelType.animated && 
                    <Stack direction="row">
                        <InlineSwitch
                            label="Separate Time Channel"
                            showLabel
                            value={value.useSeparateTimeChannel}
                            onChange={onChangeUseSeparateTimeChannel}
                        />
                        {value.useSeparateTimeChannel && 
                        <AnimatedChannelEditor
                            setError={setError}
                            onChange={onChangeTimeChannel}
                            value={value.timeChannel}
                            type={type}
                            showInterpolate={false}
                        />}
                    </Stack>}
                </Stack>
            </Field>
        </React.Fragment>
    );
}
