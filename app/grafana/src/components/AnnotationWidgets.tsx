import { useCallback, useMemo, useState } from 'react';

import {
    ToolbarButton,
    Toggletip,
    Stack,
    VerticalTab,
    Label,
    Divider
} from '@grafana/ui';

import {
    Annotation,
    AnnotationSceneObject,
    SceneObject
} from '@gov.nasa.jpl.honeycomb/core';

import { useUpdateArrayElement } from '../editors/ArrayField';
import { useHoneycomb } from '@gov.nasa.jpl.honeycomb/ui';
import { annotationRegistry } from '../module';
import { UiGroup } from '../types';
import React from 'react';

interface AnnotationWidgetProps {
    obj: AnnotationSceneObject;
    onChangeObj: (delta: Partial<AnnotationSceneObject>) => void;
}

function AnnotationWidget({
    obj,
    onChangeObj
}: AnnotationWidgetProps) {
    const { viewer } = useHoneycomb();
    const obj3d = useMemo(() => viewer.objects[obj.id], [viewer, obj]) as Annotation<any, any>;
    const reg = useMemo(() => annotationRegistry.getIfExists(obj.annotation.type), [obj]);

    const onChangeOptions = useCallback((options: any) => {
        onChangeObj({
            annotation: {
                ...obj.annotation,
                options
            }
        })
    }, [obj.annotation, onChangeObj]);

    if (!reg?.widget || !obj3d) {
        return null;
    }

    return (
        <reg.widget
            annotation={obj3d}
            options={obj.annotation.options}
            setOptions={onChangeOptions}
        />
    )
}

interface AnnotationWidgetWrapperProps {
    scene: SceneObject[];
    onChangeScene: (scene: SceneObject[]) => void;
    objId: string;
}

function AnnotationWidgetWrapper({
    scene,
    onChangeScene,
    objId
}: AnnotationWidgetWrapperProps) {
    const objDef = useMemo(() => (
        scene.find(v => v.id === objId) as AnnotationSceneObject | undefined
    ), [objId, scene]);

    const updateSceneObjectIdx = useUpdateArrayElement(onChangeScene, scene);

    const onChangeObj = useCallback((updateElement: Partial<SceneObject>) => {
        let idx = scene.findIndex(v => v.id === objId);
        if (idx >= 0) {
            updateSceneObjectIdx(idx, updateElement);
        }

    }, [objId, scene, updateSceneObjectIdx]);

    if (!objDef) {
        return null;
    }

    return (
        <React.Fragment>
            <Label description={objDef.description}>
                {objDef.name}
            </Label>
            <AnnotationWidget
                obj={objDef}
                onChangeObj={onChangeObj}
            />
        </React.Fragment>
    );
}

interface WidgetGroupProps {
    scene: SceneObject[];
    onChangeScene: (scene: SceneObject[]) => void;
    group: UiGroup;
}

function WidgetGroup({
    scene,
    onChangeScene,
    group
}: WidgetGroupProps) {
    // Deduplication just in case the group list has duplicate items
    // We are using React key={id} so duplicate IDs will have undefined behavior in the UI
    const itemsDeduped = useMemo(() => Array.from(new Set(group.items)), [group.items]);

    return (
        <React.Fragment>
            <Label description={group.description}>
                {group.name}
            </Label>
            {itemsDeduped.map((id, idx) => (
                <React.Fragment key={id}>
                    <Divider spacing={0} />
                    <AnnotationWidgetWrapper
                        scene={scene}
                        onChangeScene={onChangeScene}
                        objId={id}
                    />
                </React.Fragment>
            ))}
        </React.Fragment>
    );
}

export interface AnnotationWidgetsProps {
    scene: SceneObject[];
    widgetGroups: UiGroup[];
    onChangeScene: (scene: SceneObject[]) => void,
    height: number;
}

export function AnnotationWidgets({
    scene,
    widgetGroups,
    onChangeScene,
    height
}: AnnotationWidgetsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [tabIndex, setTabIndex] = useState(0);

    const activeGroup = useMemo(() => widgetGroups?.[tabIndex] as UiGroup | undefined, [widgetGroups, tabIndex]);

    // Don't show the button if there are no configured groups
    if (!widgetGroups || widgetGroups.length === 0) {
        return null;
    }

    return (
        <React.Fragment>
            <Toggletip
                closeButton={false}
                placement='top-end'
                onOpen={() => setIsOpen(true)}
                onClose={() => setIsOpen(false)}
                fitContent
                content={
                    <div style={{
                        overflowY: 'auto',
                        maxHeight: `calc(${height}px - 10em`,
                        marginTop: '-16px',
                        marginBottom: '-16px',
                        marginRight: '-16px'
                    }}>
                        <Stack direction="row">
                            <Stack direction="column" gap={0}>
                                {widgetGroups?.map((group, index) => (
                                    <VerticalTab
                                        key={index}
                                        style={{
                                            height: 'auto'
                                        }}
                                        label={group.name ?? ''}
                                        counter={group.items?.length}
                                        active={tabIndex === index}
                                        onChangeTab={() => setTabIndex(index)}
                                    />
                                ))}
                                <div style={{ flex: 1 }} />
                            </Stack>

                            {activeGroup && <div style={{ paddingRight: '16px' }}>
                                <Stack direction="column" flex={1}>
                                    <WidgetGroup
                                        scene={scene}
                                        onChangeScene={onChangeScene}
                                        group={activeGroup}
                                    />
                                    <div style={{ flex: 1 }} />
                                </Stack>
                            </div>}

                        </Stack>
                    </div>
                }
            >
                <ToolbarButton
                    aria-controls="ObjectWidgetsContent"
                    icon='capture'
                    isOpen={isOpen}
                    variant='canvas'
                >
                </ToolbarButton>
            </Toggletip>
        </React.Fragment>
    );
}
