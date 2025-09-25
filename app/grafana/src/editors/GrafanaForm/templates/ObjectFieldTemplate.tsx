import { useMemo } from 'react';
import {
    type ObjectFieldTemplatePropertyType,
    type ObjectFieldTemplateProps,
    canExpand,
    getUiOptions,
} from '@rjsf/utils';
import { Box, Field, Stack } from '@grafana/ui';
import { FormLabel } from '../common/utils';
import { CategoryContext } from '../common/context';

/** The `ObjectFieldTemplate` is the template to use to render all the inner properties of an object along with the
 * title and description if available. If the object is expandable, then an `AddButton` is also rendered after all
 * the properties.
 *
 * @param props - The `ObjectFieldTemplateProps` for this component
 */
export default function ObjectFieldTemplate(
    props: ObjectFieldTemplateProps
) {
    const {
        disabled,
        formData,
        idSchema,
        onAddClick,
        properties,
        readonly,
        registry,
        schema,
        title,
        uiSchema,
        formContext
    } = props;

    // Button templates are not overridden in the uiSchema
    const {
        ButtonTemplates: { AddButton },
    } = registry.templates;

    const uiOptions = getUiOptions(uiSchema, registry.globalUiOptions);
    const description = (uiOptions.description ?? props.schema.description ?? schema.description);

    const category = useMemo(() => [title], [title]);

    // Don't dump an empty title bar
    if (!title && !description && !canExpand(schema, uiSchema, formData)) {
        return properties.map((prop: ObjectFieldTemplatePropertyType) => prop.content);
    }

    return (
        <Field id={idSchema.$id}
            label={
                <Stack direction="row" justifyContent="space-between" gap={1}>
                    <FormLabel
                        schema={schema}
                        uiSchema={uiSchema}
                        registry={registry}
                        title={title}
                        formContext={formContext}
                    />
                    {canExpand(schema, uiSchema, formData) && <AddButton
                        key={0}
                        onClick={onAddClick(schema)}
                        disabled={disabled || readonly}
                        uiSchema={uiSchema}
                        registry={registry}
                    />}
                </Stack>
            }
        >
            <CategoryContext.Provider value={category}>
                <Box paddingTop={properties.length > 0 ? 2 : 0}>
                    {properties.map((prop: ObjectFieldTemplatePropertyType) => prop.content)}
                </Box>
            </CategoryContext.Provider>
        </Field>
    )
}
