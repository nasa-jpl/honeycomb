import { Group } from "three";
import { PanelOptionsEditorBuilder } from "@grafana/data";

import { Annotation, AnnotationSchemaDataModel, Viewer } from "@gov.nasa.jpl.honeycomb/core";
import { AnnotationRegistryItem } from "@gov.nasa.jpl.honeycomb/ui";

import { AxesObject } from "@gov.nasa.jpl.honeycomb/telemetry-primitives";

interface CoordinateFrameOptions {
    scale: number;
    opacity: number;
}

class CoordinateFrame extends Group implements Annotation<{}, CoordinateFrameOptions> {
    helper: AxesObject;

    constructor(
        readonly viewer: Viewer,
        id: string
    ) {
        super();
        this.name = id;
        this.helper = new AxesObject();
        this.renderOrder = Infinity;

        this.add(this.helper);
    }

    options(_options: Partial<CoordinateFrameOptions>): void {
        const options = {
            scale: 1,
            opacity: 1,
            ..._options
        } satisfies CoordinateFrameOptions;

        this.helper.size = typeof options.scale === "number" ? options.scale : 1;
        this.helper.opacity = typeof options.opacity === "number" ? options.opacity : 1;;

        this.viewer.dirty = true;
    }

    update(): void { }
}

export const coordinateFrameRegistration = new AnnotationRegistryItem({
    classType: CoordinateFrame,
    type: "coordinateFrame",
    name: "Coordinate Frame",
    description: "Shows to XYZ axes of a coordinate frame",

    schema: {
        dataModel: AnnotationSchemaDataModel.channelized,
        fields: []
    }
});

export const coordinateFrameRegistrationOptions = (builder: PanelOptionsEditorBuilder<CoordinateFrameOptions>) => {
    builder.addSliderInput({
        path: "opacity",
        name: "Opacity",
        settings: {
            min: 0,
            max: 1,
            step: 0.01
        },
        defaultValue: 1
    }).addNumberInput({
        path: 'scale',
        name: 'Scale',
        description: 'Arrow scaling factor',
        defaultValue: 1,
        settings: {
            min: 0
        }
    });
};
