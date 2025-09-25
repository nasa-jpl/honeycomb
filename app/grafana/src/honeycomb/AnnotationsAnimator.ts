import type { DataFrame } from "@grafana/data";

import {
    SceneObjectType,
    AnnotationSchemaDataModel
} from "@gov.nasa.jpl.honeycomb/core";

import { GrafanaAnimator } from "./GrafanaAnimator";
import { AnnotationValueChannelized } from "./AnnotationChannelized";
import { AnnotationValueStructured } from "./AnnotationStructured";
import {
    HoneycombPanelOptions
} from "../types";
import { AnimatedValue } from "./AnimatedChannel";
import { AnnotationsAnimator, AnnotationState } from "@gov.nasa.jpl.honeycomb/telemetry-animator";
import { AnnotationRegistryItem } from "@gov.nasa.jpl.honeycomb/ui/src/Annotation";
import { Registry } from "@gov.nasa.jpl.honeycomb/ui";

class PlaceholderAnimatedValue implements AnimatedValue<null> {
    at(): null {
        return null;
    }

    timeOfData(): number {
        return -1;
    }

    data(): void { }
}

export class GrafanaAnnotationsAnimator extends GrafanaAnimator<AnnotationState> implements AnnotationsAnimator {
    private annotations?: Record<string, AnimatedValue<object | null>>;
    private lastData?: DataFrame[];

    constructor(readonly registry: Registry<AnnotationRegistryItem<any>, any>) {
        super();
    }

    options(options: HoneycombPanelOptions) {
        this.annotations = Object.fromEntries(options.scene.filter(v => v.type === SceneObjectType.annotation).map(({ id, annotation }) => {
            if (!annotation.type) {
                return [id, new PlaceholderAnimatedValue()];
            }

            let animatedValue: AnimatedValue<object | null>;
            const schema = this.registry.get(annotation.type).schema;

            switch (schema.dataModel) {
                case AnnotationSchemaDataModel.channelized:
                    if (!annotation.channels) {
                        return [id, new PlaceholderAnimatedValue()];
                    }

                    animatedValue = new AnnotationValueChannelized(annotation, schema);
                    break;
                case AnnotationSchemaDataModel.structured:
                    if (!annotation.tables) {
                        return [id, new PlaceholderAnimatedValue()];
                    }

                    animatedValue = new AnnotationValueStructured(annotation, schema);
                    break;
            }

            return [id, animatedValue];
        }));

        if (this.lastData) {
            Object.values(this.annotations).map(v => v.data(this.lastData!));
        }
        this._step(0);
    }

    at(time: number): AnnotationState {
        if (!this.annotations) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(
                this.annotations
            ).map(([objId, obj]) => [objId, obj.at(time)])
        );
    }

    data(data: DataFrame[]): void {
        this.lastData = data;

        if (this.annotations) {
            // Pass the data to all the robots
            Object.values(this.annotations).map((r) => r.data(data));
            this._step(0);
        }
    }
}
