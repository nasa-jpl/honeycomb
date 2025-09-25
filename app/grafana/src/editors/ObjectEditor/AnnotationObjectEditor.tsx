import {
    useCallback,
    useMemo
} from 'react';

import {
    Annotation,
    AnnotationOptions,
    AnnotationSceneObject,
    AnnotationStaleBehavior,
    AnnotationSchemaDataModel,
    AnnotationOptionsType
} from '@gov.nasa.jpl.honeycomb/core';

import {
    PanelOptionsEditorBuilder,
    SelectableValue,
    StandardEditorProps,
} from "@grafana/data";

import { InsertNullsEditor } from '../../editors/InsertNullsEditor';
import { OptionsBuilderEditor } from '../../editors/OptionsBuilderEditor';
import { ChannelizedAnnotationOptionsEditor } from './ChannelizedAnnotationOptionsEditor';
import { StructuredAnnotationOptionsEditor } from './StructuredAnnotationOptionsEditor';
import { annotationRegistry } from '../../module';

const staleBehaviorOptions: Array<SelectableValue<AnnotationStaleBehavior>> = [
    {
        label: 'Invisible',
        value: AnnotationStaleBehavior.invisible,
        icon: 'eye-slash',
        description: 'Make the annotation invisible'
    },
    {
        label: 'Last',
        value: AnnotationStaleBehavior.defaults,
        icon: 'step-backward',
        description: 'Use the last values when there is data, use the channel defaults when there is no data'
    }
];

function AnnotationOptionsEditor<TAnnotation extends Annotation<any, any>>({
    context,
    value,
    onChange
}: StandardEditorProps<AnnotationOptionsType<TAnnotation>>) {
    const options: AnnotationSceneObject = context.options;

    // Look up the annotation registration
    const item = useMemo(() => annotationRegistry.getIfExists(
        options?.annotation.type
    ), [options?.annotation.type]);

    const onBuilderChange = useCallback((update: any) => {
        onChange({
            ...value,
            ...update
        });
    }, [onChange, value]);

    // Render the options
    return (
        item && <OptionsBuilderEditor
            builder={item.builder}
            value={value}
            onChange={onBuilderChange}
            parentOptions={context}
        />
    )
}

export const annotationEditor = new PanelOptionsEditorBuilder<AnnotationOptions<any>>()
    .addSelect({
        name: 'Type',
        path: 'type',
        settings: {
            getOptions: async () => annotationRegistry.list().map((annot) => ({
                value: annot.id,
                label: annot.name,
                description: annot.description
            })),
            options: [],
            noOptionsMessage: 'No annotations registered',
            placeholder: 'Annotation type'
        }
    }).addCustomEditor<undefined, number | boolean>({
        name: 'Stale Threshold',
        id: 'InsertNullsEditor',
        path: 'staleThreshold',
        defaultValue: false,
        description: "The oldest a channel in this annotation can be before the state is marked stale.",
        editor: InsertNullsEditor,
    }).addRadio({
        path: 'staleBehavior',
        name: 'Stale behavior',
        description: "Tell the animator what to do with this annotation the oldest channel is past the stale threshold.",
        settings: {
            options: staleBehaviorOptions
        },
        showIf: (options) => {
            // Only show stale behavior if it can be marked stale
            return options.staleThreshold !== false;
        },
        defaultValue: AnnotationStaleBehavior.invisible
    }).addCustomEditor<undefined, any>({
        name: '',
        id: 'AnnotionOptions',
        path: 'options',
        defaultValue: {},
        showIf: (currentOptions) => {
            // Check if there is a schema
            return annotationRegistry.getIfExists(
                currentOptions.type
            ) !== undefined;
        },
        editor: AnnotationOptionsEditor,
    }).addCustomEditor({ // Channelized data model
        name: 'Channels',
        path: 'channels',
        id: 'AnnotationChannels',
        defaultValue: {},
        editor: ChannelizedAnnotationOptionsEditor,
        showIf: (currentOptions) => {
            // Check if there is a schema
            const item = annotationRegistry.getIfExists(
                currentOptions.type
            );

            return item?.schema.dataModel === AnnotationSchemaDataModel.channelized;
        }
    }).addCustomEditor({
        name: 'Series',
        path: 'tables',
        id: 'AnnotationTable',
        editor: StructuredAnnotationOptionsEditor,
        showIf: (currentOptions) => {
            // Check if there is a schema
            const item = annotationRegistry.getIfExists(
                currentOptions.type
            );

            return item?.schema.dataModel === AnnotationSchemaDataModel.structured;
        }
    })

