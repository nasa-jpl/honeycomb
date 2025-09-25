import { useCallback } from 'react';

import { PanelOptionsEditorBuilder, StandardEditorProps } from "@grafana/data";
import type { FrameTrajectoriesOptions, FrameTrajectoryField, HoneycombPanelOptions } from '../types';
import { Stack, ColorPicker } from '@grafana/ui';
import { EditorContext, EditorProps } from './common';
import { SceneObjectSelect } from './SceneObjectSelect';
import { ArrayFieldWrapper, useUpdateArrayElement } from './ArrayField';

const FrameTrajectoryFieldEditor: React.FC<EditorProps<FrameTrajectoryField>> = ({
    onChange,
    value
}) => (
    <Stack direction="row" gap={1}>
        <SceneObjectSelect
            value={value?.frame ?? null}
            onChange={(frame) => onChange({ frame })}
        />
        <ColorPicker
            color={value.color}
            onChange={(color) => onChange({ color })}
        />
    </Stack>
);

const FrameTrajectoriesOptionsEditor: React.FC<StandardEditorProps<FrameTrajectoryField[], undefined, HoneycombPanelOptions>> = ({
    value,
    onChange,
    context
}) => {
    const updateFieldObject = useUpdateArrayElement(onChange, value);
    const getName = useCallback((field: FrameTrajectoryField) => {
        return context.options?.scene?.find((v) => v.id === field.frame)?.name ?? 'World';
    }, [context.options?.scene]);

    return (
        <EditorContext.Provider value={context}>
            <ArrayFieldWrapper
                onChange={onChange}
                value={value}
                getName={getName}
                createNew={() => ({ id: undefined, color: 'white' })}
            >
                {value.map((o, i: number) => (
                    <FrameTrajectoryFieldEditor
                        key={i}
                        value={o}
                        onChange={(delta) => updateFieldObject(i, delta)}
                    />
                ))}
            </ArrayFieldWrapper>
        </EditorContext.Provider>
    );
}

export function addFrameTrajectoriesOptions(builder: PanelOptionsEditorBuilder<HoneycombPanelOptions>) {
    return builder.addCustomEditor<undefined, FrameTrajectoriesOptions['frameTrajectories']>({
        path: 'frameTrajectoriesOptions.frameTrajectories',
        id: 'frameTrajectoriesOptions.frameTrajectories',
        category: ['Frame Trajectories'],
        description: 'Draw a line along the full path of a coordinate frame or object',
        name: 'Frames',
        defaultValue: [],
        editor: FrameTrajectoriesOptionsEditor,
    }).addNumberInput({
        path: 'frameTrajectoriesOptions.timeStep',
        category: ['Frame Trajectories'],
        description: 'Step size to sample frame positions (ms)',
        name: 'Step',
        settings: {
            min: 30
        },
        defaultValue: 1000
    }).addNumberInput({
        path: 'frameTrajectoriesOptions.renderOrder',
        category: ['Frame Trajectories'],
        name: 'Render Order',
        description: 'Objects with higher numbers will be rendered over lower numbers',
        defaultValue: 0
    });
}
