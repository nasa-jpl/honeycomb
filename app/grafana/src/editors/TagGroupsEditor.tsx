import { useMemo } from 'react';
import type { HoneycombPanelOptions, UiGroup } from '../types';

import {
    PanelOptionsEditorBuilder,
    StandardEditorProps
} from "@grafana/data";

import { UiGroupsEditor } from './UiGroupsEditor';

const TagGroupsEditor: React.FC<StandardEditorProps<UiGroup[], undefined, HoneycombPanelOptions>> = ({
    value,
    onChange,
    context
}) => {
    const tags = useMemo(() => {
        const out = new Set<string>();
        for (const obj of context.options?.scene ?? []) {
            for (const tag of obj.tags ?? []) {
                out.add(tag);
            }
        }

        return Array.from(out).sort().map(v => ({
            value: v,
            label: v
        }));
    }, [context.options?.scene]);

    return (
        <UiGroupsEditor
            addLabel='Tag Group'
            value={value}
            onChange={onChange}
            items={tags}
        />
    );
}

export function addTagGroupsOptions(builder: PanelOptionsEditorBuilder<HoneycombPanelOptions>) {
    return builder.addCustomEditor({
        path: 'tagGroups',
        id: 'tagGroups',
        category: ['Tag Groups'],
        name: 'Groups',
        description: 'Groups together scene object tags inside tabs to show under layers playbar menu',
        defaultValue: [],
        editor: TagGroupsEditor,
    });
}
