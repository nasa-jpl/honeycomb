import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GrafanaTheme2 } from "@grafana/data";

import { DndProvider } from "react-dnd";
import {
    Tree,
    DropOptions,
    getBackendOptions,
    MultiBackend,
    TreeMethods
} from "@minoru/react-dnd-treeview";

import {
    Box,
    useStyles2,
    WithContextMenu
} from "@grafana/ui";

import { css } from "@emotion/css";

import { Scene, SceneObject, SceneObjectType } from "@gov.nasa.jpl.honeycomb/core";

import { SceneItem, WorldSceneItem } from "./SceneItem";
import { SceneObjectNode } from "./types";

function getHelpText(obj: SceneObject) {
    switch (obj.type) {
        case SceneObjectType.model:
            switch (obj.model.type) {
                case 'urdf':
                    return 'Robot';
                default:
                    return 'External asset';
            }
        case SceneObjectType.frame:
            return 'Coodinate frame';
        case SceneObjectType.annotation:
            return `Annotation (${obj.annotation.type ?? 'unset'})`;
    }
}

function createHierarchy(scene: Scene): SceneObjectNode[] {
    const objects = new Set(scene.map(v => v.id));
    const hasChildren = Object.fromEntries(scene.map(v => [v.id, false]));

    for (const obj of scene) {
        if (obj.parent) {
            hasChildren[obj.parent] = true;
        }
    }

    return [
        {
            parent: 0,
            id: 1,
            text: 'World',
            droppable: true,
            data: {
                id: '',
                helpText: '',
                type: 'any' as any,
                hasChildren: true
            }
        },
        ...scene.map(v => ({
            parent: objects.has(v.parent ?? '') ? v.parent! : 1,
            id: v.id,
            text: v.name,
            droppable: true,
            data: {
                id: v.id,
                type: v.type,
                hasChildren: hasChildren[v.id] ?? false,
                tags: v.tags,
                helpText: getHelpText(v)
            }
        } satisfies SceneObjectNode))
    ];
}

const SceneItemContextMenu: React.FC<{}> = () => {
    return null;
}

interface SceneHierarchyProps {
    selected: string | null;
    onSelect: (obj: string | null) => void;

    scene: Scene;
    onChange: (id: string, updateElement: Partial<SceneObject>) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
}

export function SceneHierarchy({
    scene,
    selected,
    onSelect,
    onChange,
    onDelete,
    onDuplicate
}: React.PropsWithChildren<SceneHierarchyProps>) {
    const [sceneNodes, setSceneNodes] = useState<SceneObjectNode[]>([]);

    useEffect(() => {
        setSceneNodes(createHierarchy(scene));
    }, [scene]);

    const selectedParent = useMemo(() => selected ?
        scene.find(v => v.id === selected)?.parent ?? null
        : null, [selected, scene])

    const styles = useStyles2(getStyles);
    const ref = useRef<TreeMethods>(null);

    const onDrop = useCallback((scene: SceneObjectNode[], options: DropOptions<{ id: string; }>) => {
        const target = options.dropTarget;
        const source = options.dragSource;

        if (source && target) {
            if (typeof source.id !== 'string') {
                console.warn('Invalid dragSource in treeview', source);
                return;
            } else if (target.id === source.id) {
                // Can't put us under ourselves
                return;
            }

            if (typeof target.id === 'number') {
                // This is world
                onChange(source.id as string, {
                    parent: null
                });
            } else {
                onChange(source.id as string, {
                    parent: target.id
                });
            }
        }
    }, [onChange]);

    const canDrag = useCallback((node?: SceneObjectNode) => {
        return node !== undefined && node.id !== 1;
    }, []);

    const canDrop = useCallback(() => {
        return true;
    }, []);

    const deselectObject = useCallback(() => {
        onSelect(null);
    }, [onSelect]);

    useEffect(() => {
        // Expand the parent when a nested object is selected
        if (selectedParent) {
            ref.current?.open(selectedParent);
        }
    }, [selectedParent]);

    const onDragStart = useCallback((node: SceneObjectNode) => {
        ref.current?.close(node.id);
    }, []);

    return (
        <Box>
            <div className={styles.wrapper} onClick={deselectObject}>
                <DndProvider backend={MultiBackend} options={getBackendOptions()}>
                    <Tree
                        ref={ref}
                        tree={sceneNodes}
                        rootId={0}
                        onDrop={onDrop}
                        canDrop={canDrop}
                        canDrag={canDrag}
                        onDragStart={onDragStart}
                        insertDroppableFirst={false}
                        classes={{
                            draggingSource: 'draggingSource',
                            dropTarget: 'dropTarget',
                            container: styles.list,
                            listItem: styles.listItem
                        }}
                        render={(node, { depth, isOpen, onToggle }) => (
                            node.id === 1 ? <WorldSceneItem
                                isOpen={isOpen}
                                onToggleOpen={onToggle}
                            /> : <WithContextMenu renderMenuItems={() => <SceneItemContextMenu />}>
                                {({ openMenu }) => <SceneItem
                                    openMenu={openMenu}
                                    depth={depth}
                                    node={node as SceneObjectNode}
                                    isOpen={isOpen}
                                    onToggleOpen={onToggle}
                                    onDelete={() => onDelete(node.id as string)}
                                    onDuplicate={() => onDuplicate(node.id as string)}
                                    className={
                                        selected === node.id ? 'selected'
                                            : selectedParent === node.id ? 'parentSelected'
                                                : undefined}
                                    onSelect={() => onSelect(node.id as string)}
                                />}
                            </WithContextMenu>
                        )}
                        dragPreviewRender={(monitor) => (
                            <SceneItem depth={0} node={monitor.item as unknown as SceneObjectNode} />
                        )}
                    />
                </DndProvider>
            </div>
        </Box>
    );
}

function stripe(theme: GrafanaTheme2, i: number) {
    if (theme.isDark) {
        return `rgba(255, 255, 255, ${(i) * 0.03})`;
    } else {
        return `rgba(0, 0, 0, ${(i) * 0.02})`;
    }
}

function stripHeight(
    theme: GrafanaTheme2,
    multiplier = 1
) {
    const typography = theme.typography.h6;
    return `calc(${typography.fontSize} * ${typography.lineHeight * multiplier} + ${theme.spacing(0.5 * multiplier)})`
}

const getStyles = (theme: GrafanaTheme2) => ({
    wrapper: css(`
        display: flex;
        flex: 1;

        background: repeating-linear-gradient(
            ${stripe(theme, 1)},
            ${stripe(theme, 1)} ${stripHeight(theme)},
            ${stripe(theme, 0)} ${stripHeight(theme)},
            ${stripe(theme, 0)} ${stripHeight(theme, 2)}
        );

        &.dropTarget {
            background-color: ${stripe(theme, 4)};
        }`),
    listItem: css(`
        &.dropTarget {
            background-color: ${stripe(theme, 4)};
        }

        &.draggingSource {
            opacity: 0.3;
        }`),
    list: css(`
        list-style: none;
        box-sizing: border-box;
        width: 100%;
        padding: 0;
        margin: 0;

        &.dropTarget {
            background-color: ${stripe(theme, 4)};
        }`)
});

