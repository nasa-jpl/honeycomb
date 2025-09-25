import { FC, useCallback } from "react";
import { PanelOptionsEditorBuilder } from "@grafana/data";

import { Annotation } from "@gov.nasa.jpl.honeycomb/core";
import { AnnotationComponentProps } from "@gov.nasa.jpl.honeycomb/ui";

import { OptionsBuilderEditor } from "../../editors/OptionsBuilderEditor";

export function widgetFromBuilder<
    T extends Record<string, any>
>(builder: PanelOptionsEditorBuilder<T>): FC<AnnotationComponentProps<
    Annotation<any, T>
>> {
    return function BuilderWidget({ options, setOptions }) {
        const onChange = useCallback((diff: Partial<T>) => {
            setOptions({
                ...options,
                ...diff
            });
        }, [setOptions, options]);

        return (
            <OptionsBuilderEditor
                builder={builder}
                value={options}
                onChange={onChange}
                parentOptions={null}
            />
        )
    };
}
