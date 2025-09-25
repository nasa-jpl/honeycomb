import { useCallback } from 'react';
import * as rjsf from "@rjsf/utils";

import { Select, MultiSelect } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

export function SelectWidget({
    id,
    options,
    required,
    disabled,
    readonly,
    value,
    multiple,
    onChange,
    rawErrors = [],
}: rjsf.WidgetProps) {
    const { enumOptions } = options;

    const onSingleChangeCb = useCallback((
        selected: SelectableValue<any>
    ) => {
        return onChange(selected.value);
    }, [onChange]);

    const onMultipleChangeCb = useCallback((selected: Array<SelectableValue<any>>) => {
        onChange(selected.map(v => v.value))
    }, [onChange])

    const Component = multiple ? MultiSelect : Select;

    return (
        <Component
            id={id}
            name={id}
            value={value}
            required={required}
            multiple={multiple}
            disabled={disabled || readonly}
            className={rawErrors.length > 0 ? "is-invalid" : ""}
            onChange={(multiple ? onMultipleChangeCb : onSingleChangeCb) as any}
            options={enumOptions}
        />
    );
};
