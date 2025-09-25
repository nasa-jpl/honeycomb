import { type ChangeEvent, type FocusEvent, useCallback } from 'react';
import {
    ariaDescribedByIds,
    type BaseInputTemplateProps,
    examplesId,
    getInputProps,
    type FormContextType,
    type RJSFSchema,
    type StrictRJSFSchema,
} from '@rjsf/utils';

import { Input } from '@grafana/ui';

/** The `BaseInputTemplate` is the template to use to render the basic `<input>` component for the `core` theme.
 * It is used as the template for rendering many of the <input> based widgets that differ by `type` and callbacks only.
 * It can be customized/overridden for other themes or individual implementations as needed.
 *
 * @param props - The `WidgetProps` for this template
 */
export default function BaseInputTemplate<
    T = any,
    S extends StrictRJSFSchema = RJSFSchema,
    F extends FormContextType = any
>(props: BaseInputTemplateProps<T, S, F>) {
    const {
        id,
        name, // remove this from ...rest
        value,
        readonly,
        disabled,
        autofocus,
        onBlur,
        onFocus,
        onChange,
        onChangeOverride,
        options,
        schema,
        uiSchema,
        formContext,
        registry,
        rawErrors,
        type,
        defaultValue,
        hideLabel, // remove this from ...rest
        hideError, // remove this from ...rest
        ...rest
    } = props;

    // Note: since React 15.2.0 we can't forward unknown element attributes, so we
    // exclude the "options" and "schema" ones here.
    if (!id) {
        console.warn('No id for', props);
        throw new Error(`no id for props ${JSON.stringify(props)}`);
    }
    const inputProps = {
        ...rest,
        ...getInputProps<T, S, F>(schema, type, options),
    };

    const _onChange = useCallback(
        ({ target: { value } }: ChangeEvent<HTMLInputElement>) => onChange(value === '' ? options.emptyValue : value),
        [onChange, options]
    );
    const _onBlur = useCallback(({ target: { value } }: FocusEvent<HTMLInputElement>) => onBlur(id, value), [onBlur, id]);
    const _onFocus = useCallback(
        ({ target: { value } }: FocusEvent<HTMLInputElement>) => onFocus(id, value),
        [onFocus, id]
    );

    return (
        <Input
            id={id}
            name={id}
            className='form-control'
            readOnly={readonly}
            type={inputProps.type}
            disabled={disabled}
            autoFocus={autofocus}
            value={value ?? defaultValue}
            {...inputProps as any}
            list={schema.examples ? examplesId<T>(id) : undefined}
            onChange={(onChangeOverride || _onChange) as any}
            onBlur={_onBlur}
            onFocus={_onFocus}
            aria-describedby={ariaDescribedByIds<T>(id, !!schema.examples)}
        />
    );
}
