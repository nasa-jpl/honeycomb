import { AnnotationOptions, ChannelizedAnnotationSchema } from "@gov.nasa.jpl.honeycomb/core";
import { AnimatedChannel, AnimatedValue, AnimatedValueMerged } from "./AnimatedChannel";

export class AnnotationValueChannelized<T extends object> extends AnimatedValueMerged<T> {
    private hasFields: boolean;
    fields: Record<string, AnimatedValue<unknown>>;

    constructor(
        options: AnnotationOptions<unknown>,
        schema: ChannelizedAnnotationSchema
    ) {
        super(options);

        this.fields = {};
        for (const field of schema.fields) {
            const valueField = options.channels?.[field.name];
            if (valueField) {
                // Create the conversion function
                // This will map the raw Grafana value to the JS value
                this.fields[field.name] = new AnimatedChannel<any>(valueField);
            }
        }

        this.hasFields = Object.keys(this.fields).length > 0;
    }

    at(time: number): T | null {
        if (this.hasFields) {
            return super.at(time);
        }

        // This annotation is not watching any data
        // This means we should always show it (don't return null)
        return {} as T;
    }
}
