import { Object3D } from "three";

import { Annotation, AnnotationSchemaDataModel, Viewer } from "@gov.nasa.jpl.honeycomb/core";
import { AnnotationRegistryItem } from "@gov.nasa.jpl.honeycomb/ui";
import { PanelOptionsEditorBuilder } from "@grafana/data";

interface DebugOptions {
    log: boolean;
}

class Debug extends Object3D implements Annotation<any, DebugOptions> {
    private _options?: DebugOptions;

    constructor(
        readonly viewer: Viewer,
        id: string
    ) {
        super();
        this.name = id;
    }

    options(options: DebugOptions): void {
        this._options = options;
    }

    update(data: any): void {
        if (this._options?.log) {
            console.log(data);
        }
    }
}

export const debugRegistration = new AnnotationRegistryItem({
    classType: Debug,
    type: "debug",
    name: "Debugging",
    description: "A debug annotation that prints the raw value into the browser console",

    schema: {
        dataModel: AnnotationSchemaDataModel.structured,
        fields: [
            {
                name: 'table',
                description: 'Table to print out extracted value of'
            }
        ]
    }
});

export const debugRegistrationOptions = (builder: PanelOptionsEditorBuilder<DebugOptions>) => {
    builder.addBooleanSwitch({
        name: 'Log',
        description: 'Print out values into `console.log`',
        path: 'log'
    });
};
