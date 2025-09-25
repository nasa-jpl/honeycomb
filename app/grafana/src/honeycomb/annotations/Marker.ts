import {
    Annotation,
    AnnotationSchemaDataModel,
    ChannelSchemaType,
    Viewer
} from "@gov.nasa.jpl.honeycomb/core";

import {
    BoxGeometry,
    BufferGeometry,
    Color,
    CylinderGeometry,
    DoubleSide,
    FrontSide,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PlaneGeometry,
    RingGeometry,
    SphereGeometry
} from "three";

import { widgetFromBuilder } from "./util";
import { PanelOptionsEditorBuilder } from "@grafana/data";
import { AnnotationRegistryItem } from "@gov.nasa.jpl.honeycomb/ui";

interface MarkerData {
    scaleX: number;
    scaleY: number;
    scaleZ: number;
}

export enum MarkerGeometry {
    cube = 'cube',
    sphere = 'sphere',
    cylinder = 'cylinder',
    plane = 'plane',
    circle = 'circle',
    rectangle = 'rectangle'
}

interface MarkerOptions {
    geometry: MarkerGeometry;

    /**
     * Coloring on this geometry
     */
    color: string;

    opacity: number;

    /**
     * Enables shadows on this annotation
     * true: MeshStandardMaterial
     * false: MeshBasicMaterial
     */
    shaded: boolean;

    renderOrder: number;
    depthTest: boolean;

    /**
     * For circle geometry
     */
    unscaledThickness: number;
}

const sphereGeometry = new SphereGeometry(1, 32, 32);
const boxGeometry = new BoxGeometry(1, 1, 1);
const cylinderGeometry = new CylinderGeometry(1, 1, 1);
const planeGeometry = new PlaneGeometry(1, 1);

function getCircleGeometry(thickness: number) {
    return new RingGeometry(1 - thickness, 1);
}

let circleGeometry = getCircleGeometry(0.1);

function getRectangleGeometry(thickness: number) {
    const thetaForRectangle = 4;
    const phiForRectangle = 1;
    const thetaStart = MathUtils.DEG2RAD * 45;
    // need to divide by sqrt(2) since the diagonal is the radius
    // and we want to be able to easily scale a rectangle to adjust
    // its width and length
    const innerRadius = (1 - thickness) / Math.sqrt(2);
    const outerRadius = 1 / Math.sqrt(2);
    return new RingGeometry(innerRadius, outerRadius, thetaForRectangle, phiForRectangle, thetaStart);
}
let rectangleGeometry = getRectangleGeometry(0.1);

function getGeometry(geom: MarkerGeometry): BufferGeometry {
    switch (geom) {
        case MarkerGeometry.cube:
            return boxGeometry;
        case MarkerGeometry.sphere:
            return sphereGeometry;
        case MarkerGeometry.cylinder:
            return cylinderGeometry;
        case MarkerGeometry.plane:
            return planeGeometry;
        case MarkerGeometry.circle:
            return circleGeometry;
        case MarkerGeometry.rectangle:
            return rectangleGeometry;
    }
    return boxGeometry;
}


const widgetBuilder = (new PanelOptionsEditorBuilder<MarkerOptions>())
    .addColorPicker({
        path: 'color',
        name: 'Color',
        settings: {
            enableNamedColors: false
        },
    }).addSliderInput({
        path: 'opacity',
        name: 'Opacity',
        settings: {
            min: 0,
            max: 1,
            step: 0.05
        }
    });

export class Marker extends Mesh<
    BufferGeometry,
    MeshStandardMaterial | MeshBasicMaterial
> implements Annotation<MarkerData, MarkerOptions> {
    private isShaded?: boolean;
    unscaledThickness = 0.1;

    constructor(
        readonly viewer: Viewer
    ) {
        super();
    }

    options(_options: Partial<MarkerOptions>): void {
        const options = {
            geometry: MarkerGeometry.cube,
            color: '#ffffff',
            opacity: 1,
            shaded: false,
            renderOrder: 0,
            depthTest: true,
            unscaledThickness: 0.1,
            ..._options
        } satisfies MarkerOptions;

        if (options.unscaledThickness !== this.unscaledThickness) {
            this.unscaledThickness = options.unscaledThickness;
            circleGeometry = getCircleGeometry(this.unscaledThickness);
            rectangleGeometry = getRectangleGeometry(this.unscaledThickness);
        }

        this.geometry = getGeometry(options.geometry);

        if (this.isShaded !== options.shaded || !this.material || this.isShaded === undefined) {
            // We need to re contruct the material
            this.isShaded = options.shaded;

            this.material = (
                options.shaded ? new MeshStandardMaterial() : new MeshBasicMaterial()
            );
        }

        this.renderOrder = options.renderOrder;

        this.material.color = new Color(options.color);

        if (!options.shaded) {
            // Transparency only works for MeshBasicMaterial
            this.material.opacity = options.opacity;
            this.material.transparent = true;
        } else {
            this.material.opacity = 1;
            this.material.transparent = false;
        }

        const side = (
            options.geometry === MarkerGeometry.plane ||
                options.geometry === MarkerGeometry.circle ||
                options.geometry === MarkerGeometry.rectangle ? DoubleSide : FrontSide
        );

        this.material.depthTest = options.depthTest;
        this.material.side = side;
        this.material.shadowSide = side;

        this.viewer.dirty = true;
    }

    update(data: MarkerData): void {
        this.scale.set(
            data.scaleX,
            data.scaleY,
            data.scaleZ
        );

        this.updateMatrixWorld();
        this.viewer.dirty = true;
    }
}

export const markerRegistration = new AnnotationRegistryItem({
    classType: Marker,
    type: "marker",
    name: "Marker",
    description: "Basic scalable geometry",
    widget: widgetFromBuilder(widgetBuilder),

    schema: {
        dataModel: AnnotationSchemaDataModel.channelized,
        fields: [
            'X', 'Y', 'Z'
        ].map(v => ({
            name: `scale${v}`,
            description: `Scale multiplier in ${v} direction`,
            type: ChannelSchemaType.number
        }))
    }
});

export const markerRegistrationOptions = (builder: PanelOptionsEditorBuilder<MarkerOptions>) => {
    builder.addSelect({
        path: 'geometry',
        name: 'Geometry',
        description: 'Static geometry to render',
        settings: {
            options: [
                {
                    value: MarkerGeometry.cube,
                    label: 'Cube',
                    icon: 'cube'
                },
                {
                    value: MarkerGeometry.cylinder,
                    label: 'Cylinder',
                    icon: 'database'
                },
                {
                    value: MarkerGeometry.plane,
                    label: 'Plane',
                    icon: 'gf-grid'
                },
                {
                    value: MarkerGeometry.sphere,
                    label: 'Sphere',
                    icon: 'globe'
                },
                {
                    value: MarkerGeometry.circle,
                    label: 'Circle',
                    icon: 'circle'
                },
                {
                    value: MarkerGeometry.rectangle,
                    label: 'Rectangle',
                    icon: 'square-shape'
                }
            ]
        },
        defaultValue: MarkerGeometry.cube
    }).addColorPicker({
        path: "color",
        name: "Color",
        settings: {
            enableNamedColors: false
        },
        defaultValue: '#fff'
    }).addBooleanSwitch({
        path: "shaded",
        name: "Shaded",
        description: "Use shaded material instead of the basic mesh material which doesn't simulate shadows",
        defaultValue: false
    }).addSliderInput({
        path: "opacity",
        name: "Opacity",
        settings: {
            min: 0,
            max: 1,
            step: 0.01
        },
        defaultValue: 1,
        showIf(currentOptions) {
            return !currentOptions.shaded;
        },
    }).addNumberInput({
        path: 'renderOrder',
        name: 'Render Order',
        description: 'Objects with higher numbers will be rendered over lower numbers',
        defaultValue: 0
    }).addBooleanSwitch({
        path: "depthTest",
        name: "Depth Test",
        description: "If disabled, will always render the object even if it is occluded",
        defaultValue: true
    }).addNumberInput({
        path: 'unscaledThickness',
        name: 'Unscaled Thickness',
        description: 'Thickness of the shape\'s border before scaling is applied. Note the border is inside the shape.',
        defaultValue: 0.1,
        settings: {
            min: 0
        },
        showIf(currentOptions) {
            return currentOptions.geometry === MarkerGeometry.circle ||
                currentOptions.geometry === MarkerGeometry.rectangle;
        }
    });
};
