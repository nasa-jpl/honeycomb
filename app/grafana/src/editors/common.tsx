import { createContext, useContext, useMemo } from "react";

import {
    DataFrame,
    FieldMatcher,
    FieldMatcherID,
    IconName,
    StandardEditorContext
} from "@grafana/data";
import { fieldMatchersUI } from "@grafana/ui";

import { SceneObjectType } from "@gov.nasa.jpl.honeycomb/core";

import { HoneycombPanelOptions } from "../types";

export interface EditorProps<T> {
    value: T;
    onChange: (diff: Partial<T>) => void;
}

export const EditorContext = createContext<StandardEditorContext<
    HoneycombPanelOptions, any>
>(null!);

export const CategoryContext = createContext<string[]>([]);

export function useEditorContext() {
    return useContext(EditorContext);
}

export function useCategoryContext() {
    return useContext(CategoryContext);
}

export interface LeniantEditorProps<T> {
    value: T | undefined;
    onChange: (diff: Partial<T>) => void;
}

function getFirstField(matcher: FieldMatcher, data: DataFrame[]) {
    for (const frame of data) {
        for (const field of frame.fields) {
            if (matcher(field, frame, data)) {
                return field;
            }
        }
    }

    return null;
}

export function iconFromObjectType(objType: SceneObjectType): IconName {
    switch (objType) {
        case SceneObjectType.model:
            return 'cube';
        case SceneObjectType.frame:
            return 'user-arrows';
        case SceneObjectType.annotation:
            return 'capture';
    }
}

interface FieldSelectorProps {
    onChange: (fieldName: string) => void;
    value: string | undefined;
    data: DataFrame[] | null;
}

export const FieldSelector: React.FC<FieldSelectorProps> = ({
    onChange,
    value,
    data
}) => {
    const matcherUI = useMemo(() => (
        fieldMatchersUI.get(FieldMatcherID.byName)
    ), []);

    return (
        <matcherUI.component
            matcher={matcherUI.matcher}
            onChange={onChange}
            options={value}
            data={data ?? []}
        />
    )
}

export function useFieldFromName(data: DataFrame[], name: string | undefined) {
    return useMemo(() => {
        const matcher = fieldMatchersUI.get(FieldMatcherID.byName).matcher.get(name);
        return data ? getFirstField(matcher, data) : null;
    }, [data, name]);
}
