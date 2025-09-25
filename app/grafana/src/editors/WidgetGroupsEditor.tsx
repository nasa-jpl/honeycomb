import { useMemo } from 'react';
import { type HoneycombPanelOptions, type UiGroup } from '../types';

import {
    PanelOptionsEditorBuilder,
    SelectableValue,
    StandardEditorProps
} from "@grafana/data";

import { UiGroupsEditor } from './UiGroupsEditor';
import { SceneObjectType } from '@gov.nasa.jpl.honeycomb/core';
import { annotationRegistry } from '../module';

const WidgetGroupsEditor: React.FC<StandardEditorProps<UiGroup[], undefined, HoneycombPanelOptions>> = ({
    value,
    onChange,
    context
}) => {
    const annotationsWithWidgets = useMemo<Array<SelectableValue<string>>>(() => {
        const out: Array<SelectableValue<string>> = [];
        for (const obj of context.options?.scene ?? []) {
            if (obj.type === SceneObjectType.annotation) {
                const item = annotationRegistry.getIfExists(obj.annotation.type);
                if (item?.widget) {
                    out.push({
                        label: obj.name,
                        description: obj.description,
                        value: obj.id
                    });
                }
            }
        }

        return out;
    }, [context.options?.scene]);

    return (
        <UiGroupsEditor
            addLabel='Widget Group'
            value={value}
            onChange={onChange}
            items={annotationsWithWidgets}
        />
    );
}

export function addWidgetGroupsOptions(builder: PanelOptionsEditorBuilder<HoneycombPanelOptions>) {
    return builder.addCustomEditor({
        path: 'widgetGroups',
        id: 'widgetGroups',
        category: ['Widget Groups'],
        name: 'Groups',
        description: 'Groups together annotation widgets inside tabs under the widget playbar menu',
        defaultValue: [],
        editor: WidgetGroupsEditor,
    });
}
