import { useEffect, useState } from 'react';

import { BusEvent, PanelOptionsEditorBuilder, StandardEditorProps } from "@grafana/data";
import type { HoneycombPanelOptions, Vec3 } from '../types';
import { Button, Field, Stack } from "@grafana/ui";

export class LightingEditEvent implements BusEvent {
    static type = 'honeycomb.lighting';
    type = LightingEditEvent.type;
    payload: boolean;

    constructor(v: boolean) {
        this.payload = v;
    }
}

const LightDirectionEditor: React.FC<StandardEditorProps<Vec3 | undefined>> = ({
    context
}) => {
    const [editingState, setEditingState] = useState(false);

    useEffect(() => {
        context?.eventBus?.publish(new LightingEditEvent(editingState));

        return () => {
            context?.eventBus?.publish(new LightingEditEvent(false));
        }
    }, [context?.eventBus, editingState]);

    return (
        <Field label="Sun" description="Orientation of the sun">
            <Stack direction="row">
                {!editingState && (
                    <Button onClick={() => setEditingState(true)} icon="edit">
                        Edit
                    </Button>
                )}
                {editingState && (
                    <Button
                        variant='primary'
                        onClick={() => setEditingState(false)}
                        icon="check-circle"
                    >
                        Finish
                    </Button>
                )}
            </Stack>
        </Field>
    );
}

export function addWorldOptions(builder: PanelOptionsEditorBuilder<HoneycombPanelOptions>) {
    return builder.addNestedOptions({
        path: 'worldOptions',
        build(worldOptionsBuilder) {
            return worldOptionsBuilder.addNumberInput({
                path: 'playbackSpeed',
                name: 'Playback Speed',
                description: 'Time multiplier to use when playing panel animation',
                defaultValue: 1
            }).addBooleanSwitch({
                path: 'gridVisibility',
                name: 'Grid',
                description: 'Show the base plane grid',
                defaultValue: false
            }).addSelect({
                path: 'up',
                name: 'Up Vector',
                description: 'Changes the world\'s up vector',
                settings: {
                    options: [
                        "+X",
                        "+Y",
                        "+Z",
                        "-X",
                        "-Y",
                        "-Z"
                    ].map((v) => ({ value: v, label: v }))
                },
                defaultValue: '-Z'
            }).addBooleanSwitch({
                path: 'viewCube',
                name: 'View Cube',
                description: 'Display to view cube to show camera orientation',
                defaultValue: false
            }).addNumberInput({
                path: 'sunIntensity',
                name: 'Sun Intensity',
                description: 'Intensity factor of sunlight',
                defaultValue: 1,
                settings: {
                    min: 0
                }
            }).addCustomEditor<{}, Vec3>({
                path: 'sunDirection',
                id: 'sunDirection',
                name: 'Sun Direction',
                description: 'Sun light direction vector',
                editor: LightDirectionEditor
            })
        }
    });
}
