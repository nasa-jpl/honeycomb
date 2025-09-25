import { AnimatedViewer } from "./AnimatedViewer";
import { Annotation } from "./channel";

export enum AnnotationSchemaDataModel {
    /**
     * Feed channels one-by-one into single JS record
     */
    channelized = 'channelized',

    /**
     * Extract the entire row as a nested object
     */
    structured = 'structured'
}

interface AnnotationSchemaBase {
    dataModel: AnnotationSchemaDataModel;
}

export enum ChannelSchemaType {
    number = 'number',
    boolean = 'boolean',
    string = 'string'
}

export interface ChannelSchema {
    name: string;
    description?: string;
    type: ChannelSchemaType;
}

export interface ChannelizedAnnotationSchema extends AnnotationSchemaBase {
    dataModel: AnnotationSchemaDataModel.channelized;
    fields: ChannelSchema[];
}

export interface TableSchema {
    name: string;
    description?: string;
}

export interface StructuredAnnotationSchema extends AnnotationSchemaBase {
    dataModel: AnnotationSchemaDataModel.structured;
    fields: TableSchema[];
}

export type AnnotationSchema = (
    ChannelizedAnnotationSchema
    | StructuredAnnotationSchema
);

export type AnnotationConstructor<
    TAnnotation extends Annotation<any, any>
> = new (viewer: AnimatedViewer, id: string) => TAnnotation;

export type AnnotationDataType<T> = T extends Annotation<infer D, any> ? D : never;
export type AnnotationOptionsType<T> = T extends Annotation<any, infer O> ? O : never;
