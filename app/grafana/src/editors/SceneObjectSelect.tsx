import { useMemo } from "react";
import { Select } from "@grafana/ui";

import { EditorProps, iconFromObjectType, useEditorContext } from "./common";
import { SelectableValue } from "@grafana/data";

export const SceneObjectSelect: React.FC<EditorProps<string | undefined | null> & { filterOutId?: string; }> = ({
    filterOutId,
    value,
    onChange
}) => {
    const { options } = useEditorContext();
    const scene = useMemo(() => options?.scene ?? [], [options?.scene]);

    const parentOptions = useMemo<Array<SelectableValue<string>>>(() => [{
        label: 'World',
        icon: 'globe',
        value: ''
    }, ...scene.filter(obj => obj.id !== filterOutId).map((obj) => ({
        label: obj.name,
        value: obj.id,
        icon: iconFromObjectType(obj.type)
    }))], [filterOutId, scene]);

    return (
        <Select
            value={value ?? ''}
            options={parentOptions}
            onChange={(value) => onChange(value.value === '' ? null : value.value ?? null)}
        />
    )
}
