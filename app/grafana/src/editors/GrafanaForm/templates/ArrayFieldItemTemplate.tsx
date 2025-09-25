import { createContext, useCallback } from 'react';
import * as rjsf from "@rjsf/utils";
import { Field, Stack } from '@grafana/ui';

export type ArrayGridRowActionsContextProps = Partial<Pick<rjsf.ArrayFieldTemplateItemType, (
    'hasCopy' |
    'hasMoveDown' |
    'hasMoveUp' |
    'hasRemove' |
    'index'
)> & {
    onCopy: () => void;
    onDrop: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}>;

const nop = () => { throw new Error("No context"); };

export const ArrayGridRowActionsContext = createContext<ArrayGridRowActionsContextProps>({
    hasCopy: false,
    hasMoveDown: false,
    hasMoveUp: false,
    hasRemove: false,
    index: -1,
    onCopy: nop,
    onDrop: nop,
    onMoveUp: nop,
    onMoveDown: nop
});

export default function ArrayFieldItemTemplate({
    children,
    hasCopy,
    hasMoveDown,
    hasMoveUp,
    hasRemove,
    index,
    registry,
    uiSchema,
    onCopyIndexClick,
    onDropIndexClick,
    onReorderClick
}: rjsf.ArrayFieldTemplateItemType) {
    // const onCopy = useCallback(() => {
    //     onCopyIndexClick(index)();
    // }, [onCopyIndexClick, index]);

    const onMoveDown = useCallback(() => {
        onReorderClick(index, index + 1)();
    }, [onReorderClick, index]);

    const onMoveUp = useCallback(() => {
        onReorderClick(index, index - 1)();
    }, [onReorderClick, index]);

    const onDrop = useCallback(() => {
        onDropIndexClick(index)();
    }, [onDropIndexClick, index]);

    const {
        ButtonTemplates: {
            MoveUpButton,
            MoveDownButton,
            RemoveButton,
        }
    } = registry.templates;

    return (
        <Field label={<Stack direction="row" gap={1}>
            <div style={{ flex: 1 }} />
            {hasMoveUp && <MoveUpButton onClick={onMoveUp} registry={registry} uiSchema={uiSchema} />}
            {hasMoveDown && <MoveDownButton onClick={onMoveDown} registry={registry} uiSchema={uiSchema} />}
            {hasRemove && <RemoveButton onClick={onDrop} registry={registry} uiSchema={uiSchema} />}
        </Stack>}>
            {children}
        </Field>
    );
}
