import { useCallback, useMemo, useState } from "react";
import { uid } from 'uid';

import {
    PanelOptionsEditorBuilder,
    type StandardEditorProps
} from "@grafana/data";

import {
    Dropdown,
    Menu,
    Button,
    Stack
} from "@grafana/ui";

import { AnnotationStaleBehavior, ChannelType, OrientationConvention, Scene, SceneObject, SceneObjectType } from "@gov.nasa.jpl.honeycomb/core";

import { useUpdateArrayElement } from "../../editors/ArrayField";
import { EditorContext, iconFromObjectType } from "../../editors/common";
import { SceneHierarchy } from "./SceneHierarchy";
import { ObjectEditor } from "../ObjectEditor";
import { HoneycombPanelOptions } from "../../types";

const defaultTransform = {
    position: {
        x: {
            type: ChannelType.constant,
            interpolate: true,
            value: 0
        },
        y: {
            type: ChannelType.constant,
            interpolate: true,
            value: 0
        },
        z: {
            type: ChannelType.constant,
            interpolate: true,
            value: 0
        }
    },
    orientation: {
        type: OrientationConvention.hamilton,
        x: {
            type: ChannelType.constant,
            interpolate: true,
            value: 0
        },
        y: {
            type: ChannelType.constant,
            interpolate: true,
            value: 0
        },
        z: {
            type: ChannelType.constant,
            interpolate: true,
            value: 0
        },
        w: {
            type: ChannelType.constant,
            interpolate: true,
            value: 1
        }
    }
}

const SceneEditor: React.FC<StandardEditorProps<Scene, undefined, HoneycombPanelOptions>> = ({
    value,
    onChange,
    context
}) => {
    const [selected, setSelect] = useState<string | null>(null);
    const selectedObject = useMemo(() => value.find(v => v.id === selected), [value, selected]);

    const updateSceneObject = useUpdateArrayElement(onChange, value);
    const onDelete = useCallback((id: string) => {
        let idx = value.findIndex(v => v.id === id);
        if (idx >= 0) {
            onChange([...value.slice(0, idx), ...value.slice(idx + 1)])
        }
    }, [onChange, value]);

    const onDuplicate = useCallback((id: string) => {
        const item = value.find(v => v.id === id);
        if (item) {
            const newUid = uid();
            onChange([...value, {
                ...structuredClone(item),
                id: newUid,
                name: item.name + ' (Duplicate)'
            }]);

            requestAnimationFrame(() => {
                setSelect(newUid);
            })
        }
    }, [onChange, value]);

    // const [addMenuOpen, setAddMenuOpen] = useState(false);
    // const onToggleAddMenu = useCallback(() => {
    //     setAddMenuOpen(!addMenuOpen)
    // }, [addMenuOpen]);

    const updateSceneObjectId = useCallback((id: string, updateElement: Partial<SceneObject>) => {
        let idx = value.findIndex(v => v.id === id);
        if (idx >= 0) {
            updateSceneObject(idx, updateElement);
        }

    }, [updateSceneObject, value]);

    const addSceneObject = useCallback((item: SceneObject) => {
        onChange([
            ...value,
            item
        ]);
        setSelect(item.id);
    }, [onChange, value])

    const addMenu = useMemo(() => (
        <Menu>
            <Menu.Item
                icon={iconFromObjectType(SceneObjectType.model)}
                label="Model"
                description="Loads an external asset like a mesh or robot."
                onClick={() => addSceneObject({
                    type: SceneObjectType.model,
                    id: uid(),
                    name: 'New Model',
                    model: {
                        path: ''
                    },
                    ...defaultTransform
                })}
            />
            <Menu.Item
                icon={iconFromObjectType(SceneObjectType.frame)}
                label="Coordinate Frame"
                description="A coordinate frame that can hold other objects underneath. No geometry is loaded."
                onClick={() => addSceneObject({
                    type: SceneObjectType.frame,
                    id: uid(),
                    name: 'New Coodinate Frame',
                    ...defaultTransform
                })}
            />
            <Menu.Item
                icon={iconFromObjectType(SceneObjectType.annotation)}
                label="Annotation"
                description="A custom visualization that can be connected to data from your query for animations."
                onClick={() => addSceneObject({
                    type: SceneObjectType.annotation,
                    id: uid(),
                    name: 'New Annotation',
                    annotation: {
                        staleBehavior: AnnotationStaleBehavior.invisible,
                        staleThreshold: false,
                        options: {}
                    },
                    ...defaultTransform
                })}
            />
        </Menu>
    ), [addSceneObject]);

    return (
        <EditorContext.Provider value={context}>
            <Stack direction="column">
                <SceneHierarchy
                    scene={value}
                    selected={selected}
                    onSelect={setSelect}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onChange={updateSceneObjectId}
                />
                <Stack direction="row" flex="1" alignItems="end">
                    <div style={{ flex: 1 }} />
                    <Dropdown overlay={addMenu}>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon="plus"
                        >
                            Add
                        </Button>
                    </Dropdown>
                </Stack>
                {selectedObject && <ObjectEditor
                    value={selectedObject}
                    onChange={(delta) => selected ? updateSceneObjectId(selected, delta) : null}
                />}
            </Stack>
        </EditorContext.Provider>
    );
}

export function addSceneEditor(builder: PanelOptionsEditorBuilder<HoneycombPanelOptions>) {
    return builder.addCustomEditor<undefined, Scene>({
        path: 'scene',
        id: 'scene',
        category: ['Scene'],
        name: 'Objects',
        defaultValue: [],
        editor: SceneEditor,
    });
}
