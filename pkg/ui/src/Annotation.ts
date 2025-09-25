import {
    Annotation,
    AnnotationConstructor,
    AnnotationOptionsType,
    AnnotationSchema
} from "@gov.nasa.jpl.honeycomb/core";
import { RegistryItem } from "./Registry";


export interface AnnotationComponentProps<TAnnotation extends Annotation<any, any>> {
    annotation: TAnnotation;
    options: AnnotationOptionsType<TAnnotation>;
    setOptions: (options: AnnotationOptionsType<TAnnotation>) => void;
}

export interface AnnotationRegistryItemConfig<
    TAnnotation extends Annotation<any, any>
> {
    type: string;
    name: string;
    description?: string;
    schema: AnnotationSchema;

    /**
     * React component that displays over the scene viewer.
     * This will be contained in an absolute positioned component
     * and needs to be enabled by the user.
     * 
     * TODO(tumbar) Implement handler for this
     */
    // overlay?: React.FC<AnnotationComponentProps<Options>>;

    /**
     * Widget contained in a popup menu tab.
     * Every annotation will get their own tab if this definition exists
     */
    widget?: React.FC<AnnotationComponentProps<TAnnotation>>;

    classType: AnnotationConstructor<TAnnotation>;
}

export class AnnotationRegistryItem<
    TAnnotation extends Annotation<any, any>
> implements RegistryItem {
    id: string;
    name: string;
    description?: string | undefined;

    schema: AnnotationSchema;
    classType: AnnotationConstructor<TAnnotation>;
    // overlay?: React.FC<AnnotationComponentProps<Options>>;
    widget?: React.FC<AnnotationComponentProps<TAnnotation>>;

    constructor(config: AnnotationRegistryItemConfig<TAnnotation>) {
        this.id = config.type;
        this.name = config.name;
        this.description = config.description;
        this.schema = config.schema;
        this.classType = config.classType;
        this.widget = config.widget;
    }
}
