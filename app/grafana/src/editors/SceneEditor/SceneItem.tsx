import {
    useCallback,
    useState,
    MouseEvent,
    useMemo,
    useEffect,
    MouseEventHandler
} from 'react';

import { GrafanaTheme2 } from "@grafana/data";
import {
    Box,
    Button,
    Icon,
    IconButton,
    Modal,
    Stack,
    Text,
    useStyles2,
    useTheme2,
    Tooltip,
    TagList
} from "@grafana/ui";

import { css } from "@emotion/css";
import { iconFromObjectType } from '../common';
import { SceneObjectNode } from './types';

interface SceneItemProps {
    depth: number;
    node: SceneObjectNode;
    className?: string;

    isOpen?: boolean;
    onToggleOpen?: () => void;

    openMenu?: MouseEventHandler<HTMLElement>;

    onDelete?: () => void;
    onDuplicate?: () => void;
    onSelect?: () => void;
}

export const SceneItem: React.FC<SceneItemProps> = ({
    depth,
    node,
    isOpen,
    className,

    openMenu,
    onDelete,
    onDuplicate,
    onSelect,
    onToggleOpen
}) => {
    const styles = useStyles2(getStyles);
    const theme = useTheme2();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const onSelectClick = useCallback((event: MouseEvent) => {
        event.stopPropagation();

        onSelect?.();
    }, [onSelect]);

    const onShowDelete = useCallback(() => {
        setShowDeleteDialog(true);
    }, []);

    const onCancelDelete = useCallback(() => {
        setShowDeleteDialog(false);
    }, []);

    const onConfirmDelete = useCallback(() => {
        onDelete?.();
        setShowDeleteDialog(false);
    }, [onDelete]);

    const icon = useMemo(() => (
        node.data?.type ? iconFromObjectType(node.data.type) ?? 'globe' : 'globe'
    ), [node.data?.type]);

    return (
        <div
            className={`${styles.wrapper} ${className}`}
            onClick={onSelectClick}
            onDoubleClick={node.data?.hasChildren ? onToggleOpen : undefined}
            onAuxClickCapture={openMenu}
            style={{
                paddingLeft: `${theme.spacing(depth * 2)}`
            }}
        >
            <Modal title={
                <span>Delete {node.text !== "" ? <code>{node.text}</code> : <span>Unnamed Object</span>}?</span>
            } isOpen={showDeleteDialog}>
                <Stack direction="column">
                    <Text>
                        This action cannot be undone, are you sure you want to delete this item?
                    </Text>
                    <Stack alignItems="end" direction="row">
                        <Button variant='secondary' onClick={onCancelDelete}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={onConfirmDelete}>
                            Delete
                        </Button>
                    </Stack>
                </Stack>
            </Modal>

            <Box
                paddingY={0.25}
                paddingX={1}
                flex={1}
                minWidth={0}
            >
                <Stack
                    direction="row"
                    flex="1"
                    minWidth={0}
                >
                    {(node.data?.hasChildren) && <IconButton
                        size="sm"
                        onClick={onToggleOpen}
                        name={isOpen ? 'angle-down' : 'angle-right'}
                        aria-label="Expand"
                    />}

                    <Tooltip content={node.data?.helpText ?? ''}>
                        <Box>
                            <Icon
                                size="sm"
                                color={theme.colors.text.secondary}
                                name={icon}
                            />
                        </Box>
                    </Tooltip>

                    <Text variant='h6' truncate>
                        {node.text}
                    </Text>

                    <div style={{ flex: 1 }} />

                    {node.data?.tags && <TagList tags={node.data?.tags} />}

                    {onDuplicate && <IconButton
                        onClick={onDuplicate}
                        size="sm"
                        variant='secondary'
                        name="copy"
                        tooltip="Duplicate"
                        aria-label="Duplicate"
                    />}

                    {onDelete && <IconButton
                        onClick={onShowDelete}
                        size="sm"
                        variant='destructive'
                        name="trash-alt"
                        tooltip="Delete"
                        aria-label="Delete"
                    />}
                </Stack>
            </Box>
        </div>
    );
}

interface WorldSceneItemProps {
    isOpen: boolean;
    onToggleOpen: () => void;
}

export const WorldSceneItem: React.FC<WorldSceneItemProps> = ({
    isOpen,
    onToggleOpen
}) => {
    const styles = useStyles2(getStyles);
    const theme = useTheme2();

    useEffect(() => {
        if (!isOpen) {
            onToggleOpen();
        }
    }, [isOpen, onToggleOpen]);

    return (
        <div className={`${styles.wrapper}`}>
            <Box
                paddingY={0.25}
                paddingX={1}
                flex={1}
            >
                <Stack
                    direction="row"
                    flex="1"
                >
                    <Box>
                        <Icon
                            size="sm"
                            color={theme.colors.text.secondary}
                            name='globe'
                        />
                    </Box>

                    <Text variant='h6'>
                        World
                    </Text>
                </Stack>
            </Box>
        </div>
    );
}

const getStyles = (theme: GrafanaTheme2) => ({
    wrapper: css(`
        position: relative;
        display: flex;

        &:hover {
            background-color: ${theme.colors.action.hover};
        }

        & .buttons {
            display: none;
        }

        &:hover .buttons {
            display: flex;
        }

        &.selected {
            background-color: ${theme.colors.primary.main};
            color: ${theme.colors.primary.contrastText};
        }

        &.selected:hover {
            background-color: ${theme.colors.emphasize(theme.colors.primary.main, 0.1)};
        }

        &.parentSelected {
            background-color: ${theme.colors.secondary.main};
            color: ${theme.colors.secondary.contrastText};
        }

        &.parentSelected:hover {
            background-color: ${theme.colors.emphasize(theme.colors.secondary.main, 0.1)} !important;
        }`
    ),
});
