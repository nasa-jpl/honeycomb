import { useCallback } from 'react';
import * as rjsf from "@rjsf/utils";
import { Switch } from '@grafana/ui';

export function CheckboxWidget({
    id,
    value,
    disabled,
    label,
    onBlur,
    onFocus,
    onChange,
}: rjsf.WidgetProps) {
    const handleChange = useCallback((e: any) => {
        onChange(e.target.checked);
    }, [onChange]);

    const handleBlur = useCallback(
        (event: any) => onBlur(id, event.target.checked),
        [onBlur, id]
    );

    const handleFocus = useCallback(
        (event: any) => onFocus(id, event.target.checked),
        [onFocus, id]
    );

    return (
        <Switch
            disabled={disabled}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            value={value}
            label={label}
        >
        </Switch>
    )
}
