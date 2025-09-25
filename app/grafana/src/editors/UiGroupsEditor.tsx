import React from 'react';
import type { UiGroup } from '../types';

import {
    Field,
    Stack,
    Input,
    MultiSelect
} from '@grafana/ui';

import { EditorProps } from './common';
import { ArrayFieldWrapper, useUpdateArrayElement } from './ArrayField';
import { SelectableValue } from '@grafana/data';

interface UiGroupOptions {
    items: Array<SelectableValue<string>>;
}

const UiGroupEditor: React.FC<EditorProps<UiGroup> & UiGroupOptions> = ({
    onChange,
    value,
    items
}) => {
    return (
        <React.Fragment>
            <Field label="Name">
                <Stack direction="column">
                    <Stack direction="row" gap={1}>
                        <Input
                            value={value?.name}
                            placeholder="Name"
                            onChange={(e) => onChange({ name: e.currentTarget.value })}
                        />
                        <Input
                            value={value?.description}
                            placeholder="Description"
                            onChange={(e) => onChange({ description: e.currentTarget.value })}
                        />
                    </Stack>

                    <MultiSelect
                        options={items}
                        value={value.items}
                        onChange={(e) => onChange({ items: e.map(v => v.value).filter(v => v !== undefined) })}
                    />
                </Stack>
            </Field>
        </React.Fragment>
    )
}

interface UiGroupsEditorProps extends UiGroupOptions {
    addLabel: string;
    value: UiGroup[];
    onChange: (value?: UiGroup[] | undefined) => void;
}

export const UiGroupsEditor: React.FC<UiGroupsEditorProps> = ({
    addLabel,
    value,
    onChange,
    items
}) => {
    const updateFieldObject = useUpdateArrayElement(onChange, value);

    return (
        <ArrayFieldWrapper
            onChange={onChange}
            value={value}
            createNew={() => ({ items: [] } as UiGroup)}
            move
            addName={addLabel}
        >
            {value.map((o: UiGroup, i: number) => (
                <UiGroupEditor
                    key={i}
                    value={o}
                    items={items}
                    onChange={(delta) => updateFieldObject(i, delta)}
                />
            ))}
        </ArrayFieldWrapper>
    );
}
