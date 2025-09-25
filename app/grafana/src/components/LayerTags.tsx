import { Object3D } from 'three';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
    ToolbarButton,
    Toggletip,
    Stack,
    Tag,
    VerticalTab,
    Checkbox
} from '@grafana/ui';

import { SceneObject, Viewer } from '@gov.nasa.jpl.honeycomb/core';

import { UiGroup } from '../types';
import { useHoneycomb } from '@gov.nasa.jpl.honeycomb/ui';

interface LayerItemProps {
    tag: string;
    state: boolean;
    disabled?: boolean;
    onChange: (value: boolean) => void;
}

function LayerItem({
    tag,
    disabled,
    state,
    onChange
}: LayerItemProps) {
    return (
        <Stack direction="row">
            <Tag name={tag} />
            <div style={{ flex: 1 }} />
            <Checkbox
                disabled={disabled}
                value={state}
                onChange={(e) => onChange(e.currentTarget.checked)}
            />
        </Stack>
    )
}

interface ObjectTagManagerProps {
    enabled: boolean;
    objectId: string;
    viewer: Viewer;
}

function ObjectTagManager({
    enabled,
    objectId,
    viewer
}: ObjectTagManagerProps) {
    const object = useMemo<Object3D | undefined>(() => (
        viewer.objects[objectId]
    ), [viewer, objectId]);

    useEffect(() => {
        if (object) {
            object.visible = enabled;
            object.userData.enabled = enabled;

            viewer.dirty = true;
        }

        return () => {
            if (object) {
                object.visible = true;
            }
        };
    }, [enabled, object, viewer]);

    return null;
}

export interface LayerTagsProps {
    scene: SceneObject[];
    tagGroups?: UiGroup[];
    height: number;
}

export function LayerTags({
    scene,
    tagGroups,
    height
}: LayerTagsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTags, setActiveTags] = useState<Record<string, boolean>>({});

    const { viewer } = useHoneycomb();

    const tags = useMemo<string[]>(() => {
        const out = new Set<string>();
        for (const obj of scene) {
            for (const tag of obj.tags ?? []) {
                out.add(tag);
            }
        }

        return Array.from(out).sort();
    }, [scene]);

    // Refresh activeTags when there is a new set tags/scene updates
    useEffect(() => {
        const seenTags = new Set<string>();
        const toAdd = new Set<string>();
        for (const tag of tags) {
            // Track this tag if we are not already
            if (activeTags[tag] === undefined) {
                toAdd.add(tag);
            }

            seenTags.add(tag);
        }

        // Remove any stale tags
        const toRemove = new Set<string>();
        for (const tag of Object.keys(activeTags)) {
            if (!seenTags.has(tag)) {
                toRemove.add(tag);
            }
        }

        if (toRemove.size > 0 || toAdd.size > 0) {
            const newTags: Record<string, boolean> = {
                ...activeTags,
            }

            for (const tag of toRemove.values()) {
                delete newTags[tag];
            }

            for (const tag of toAdd.values()) {
                // By default new tags are shown in the scene
                newTags[tag] = true;
            }

            setActiveTags(newTags);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tags]);

    const onChangeTagEnabled = useCallback((tag: string, enabled: boolean) => {
        setActiveTags({
            ...activeTags,
            [tag]: enabled
        })
    }, [activeTags]);

    const objects = useMemo<Record<string, boolean>>(() => {
        const out: Record<string, boolean> = {};
        for (const obj of scene) {
            let enabled = true;
            for (const tag of obj.tags ?? []) {
                enabled = enabled && activeTags[tag];
            }

            out[obj.id] = enabled;
        }

        return out;
    }, [activeTags, scene]);

    const [tabIndex, setTabIndex] = useState(0);

    const activeGroup = useMemo(() => tagGroups?.[tabIndex], [tagGroups, tabIndex]);
    const allSwitch = useMemo<boolean | null>(() => {
        if (!activeGroup || !activeGroup.items) {
            return null;
        }

        const states = activeGroup.items.map((v) => activeTags[v]);
        let allOn = states.every(v => v);
        let allOff = states.every(v => !v);

        if (allOn) {
            return true;
        } else if (allOff) {
            return false;
        } else {
            return null;
        }
    }, [activeGroup, activeTags]);

    const onChangeAllSwitch = useCallback((e: React.FormEvent<HTMLInputElement>) => {
        const on = e.currentTarget.checked;
        if (!activeGroup || !activeGroup.items) {
            return;
        }

        const newStates: Record<string, boolean> = (
            Object.fromEntries(activeGroup.items.map((v) => ([
                v,
                on
            ])))
        );

        setActiveTags({
            ...activeTags,
            ...newStates
        })
    }, [activeGroup, activeTags]);

    if (tagGroups === undefined || tagGroups.length === 0) {
        return null;
    }

    return (
        <React.Fragment>
            <Toggletip
                closeButton={false}
                placement='top-end'
                onOpen={() => setIsOpen(true)}
                onClose={() => setIsOpen(false)}
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
                                {tagGroups?.map((group, index) => (
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

                            {activeGroup && (
                                <div style={{ paddingRight: '16px' }}>
                                    <Stack direction="column" flex={1}>
                                        <Checkbox
                                            label={activeGroup.name}
                                            description={activeGroup.description}
                                            value={allSwitch === null ? false : allSwitch}
                                            indeterminate={allSwitch === null}
                                            onChange={onChangeAllSwitch}
                                        />
                                        {activeGroup.items?.map((tag) => (
                                            <LayerItem
                                                key={tag}
                                                tag={tag}
                                                disabled={activeTags[tag] === undefined}
                                                state={activeTags[tag]}
                                                onChange={(enabled) => onChangeTagEnabled(tag, enabled)}
                                            />
                                        ))}
                                        <div style={{ flex: 1 }} />
                                    </Stack>
                                </div>
                            )}
                        </Stack>
                    </div>
                }
            >
                <ToolbarButton
                    aria-controls="LayerTagsContent"
                    icon='layer-group'
                    isOpen={isOpen}
                    variant='canvas'
                >
                </ToolbarButton>
            </Toggletip>

            {Object.entries(objects).map(([objectId, enabled]) => (
                <ObjectTagManager
                    key={objectId}
                    enabled={enabled}
                    objectId={objectId}
                    viewer={viewer}
                />
            ))}
        </React.Fragment>
    );
}
