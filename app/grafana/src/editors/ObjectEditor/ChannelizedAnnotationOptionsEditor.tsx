import React, { useMemo } from "react";

import { PanelOptionsEditorProps } from "@grafana/data";

import {
    AnnotationSceneObject,
    AnnotationSchemaDataModel,
    Channel
} from "@gov.nasa.jpl.honeycomb/core";

import { ChannelEditor } from "../ChannelEditor";
import { annotationRegistry } from "../../module";

export const ChannelizedAnnotationOptionsEditor: React.FC<PanelOptionsEditorProps<Record<string, Channel<any>>>> = ({
    context,
    onChange,
    value
}) => {
    const options: AnnotationSceneObject = context.options;

    const item = useMemo(() => annotationRegistry.getIfExists(
        options.annotation.type
    ), [options.annotation.type]);

    if (item?.schema.dataModel !== AnnotationSchemaDataModel.channelized) {
        return null;
    }

    return (
        <React.Fragment>
            {item?.schema && item.schema.fields.map((field, idx) => (
                <ChannelEditor
                    key={idx}
                    {...field}
                    value={value?.[field.name]}
                    onChange={(diff) => onChange({
                        ...value,
                        [field.name]: {
                            ...value?.[field.name],
                            ...diff
                        } as Channel<any>
                    })}
                    {...item.schema}
                />
            ))}
        </React.Fragment>
    );
}
