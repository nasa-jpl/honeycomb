import { useMemo } from 'react';

import * as rjsf from "@rjsf/utils";
import { Label } from '@grafana/ui';
import { useCategory } from './context';

export function FormLabel({
    schema,
    uiSchema,
    formContext,
    title,
    registry
}: {
    title?: string;
    schema: rjsf.RJSFSchema,
    formContext?: any
    uiSchema?: rjsf.UiSchema<any, rjsf.RJSFSchema, any>;
    registry: rjsf.Registry<any, rjsf.RJSFSchema, any>;
}) {
    const uiOptions = rjsf.getUiOptions(uiSchema, registry.globalUiOptions);
    const categoryFromContext = useCategory();
    const category = useMemo(() => {
        return [
            ...formContext?.category,
            ...(categoryFromContext ?? [])
        ]
    }, [formContext?.category, categoryFromContext])

    const description = (uiOptions.description ?? schema.description);

    return (
        <Label
            category={category}
            description={description}
        >
            {uiOptions.title ?? title}
        </Label>
    )
}
