// Loads CameraModels.xml and processes it into a dictionary of camera objects
import { FetchTextLoader } from '@gov.nasa.jpl.honeycomb/common';
import { Vector3 } from 'three';

type Vec3 = [number, number, number];

export enum CameraModelType {
    CAHV = "CAHV",
    CAHVOR = "CAHVOR",
    CAHVORE = "CAHVORE"
}

interface CameraAbstract<VT> {
    /**
     * The type of camera model.
     */
    type: CameraModelType;

    /**
     * The name of the camera model.
     */
    name: string;

    /**
     * The frame name that the camera model is defined relative to.
     */
    frameName: string;

    /**
     * The frame name for which we should reparent the visualization
     * for usability reasons in the UI.
     */
    reparentFrameName: string;

    /**
     * The width in pixels.
     */
    width: number;

    /**
     * The height in pixels
     */
    height: number;

    minRange: number;

    /**
     * x, y, z point representing the center of the camera in the original frame the model was generated in.
     */
    C: VT;

    /**
     * Same as the {@link #CameraDefinition#C C} vector but relative to the frame named {@link #CameraDefinition#frame_name frame_name}.
     */
    C_LOCAL?: VT;

    /**
     * x, y, z direction representing the camera axis.
     */
    A: VT;

    /**
     * Camera horizontal component.
     */
    H: VT;

    /**
     * Camera vertical component
     */
    V: VT;

    /**
     * Optical axis component.
     */
    O?: VT;

    /**
     * Radial distortion component.
     */
    R?: VT;

    /**
     * Camera entrance pupil
     */
    E?: VT;

    pupilType?: number;
    linearity: number;
}

interface CameraCahv<VT> extends CameraAbstract<VT> {
    C: VT;
    C_LOCAL?: VT;
    A: VT;
    H: VT;
    V: VT;
}

interface CameraCahvor<VT> extends CameraCahv<VT> {
    O: VT;
    R: VT;
}

interface CameraCahvore<VT> extends CameraCahvor<VT> {
    E: VT;
}

type CameraDefinitionGeneric<VT> = (
    CameraCahv<VT> & { type: CameraModelType.CAHV } |
    CameraCahvor<VT> & { type: CameraModelType.CAHVOR } |
    CameraCahvore<VT> & { type: CameraModelType.CAHVORE }
);

export type CameraDefinition = CameraDefinitionGeneric<Vector3>;

export interface CameraDefinitions {
    [camName: string]: CameraDefinition;
}

/**
 * Class for loading and parsing RSVP XML Camera model files
 * Sets the C, C_LOCAL, A, H, V, O, and R fields to
 * use THREE.Vector3 instances rather than arrays.
 */
export class CameraLoader extends FetchTextLoader<CameraDefinitions> {
    /* Private Functions */
    // parse a string to a number, or return the string.
    _parseValue(value: any) {
        return isNaN(value) ? value : parseFloat(value);
    }

    // Parse the inner html from a node within a camera definition, either returning an array of floats, a float, an int, or the string.
    private _parseInnerHTML(node: Element) {
        const innerHTML = node.innerHTML;
        const splits = innerHTML.split(',');
        if (splits.length > 1) {
            return splits.map(v => parseFloat(v));
        }
        return parseFloat(innerHTML);
    }

    /**
     * Parses the contents of the given Camera XML and returns an object describing
     * the models.
     */
    protected parseXml(str: string): { [name: string]: CameraDefinitionGeneric<Vec3> } {
        console.time('CameraLoader: Parse');
        const doc = new DOMParser().parseFromString(str, 'application/xml');
        const topNode = doc.querySelector('CAMERA_MODELS');

        if (!topNode) {
            throw new Error(`No node 'CAMERA_MODELS' found in ${str}`);
        }

        const childNodes = topNode.children;
        const cameras: { [name: string]: CameraDefinitionGeneric<Vec3> } = {};

        for (let i = 0; i < childNodes.length; i++) {
            const cameraObject: { [name: string]: any } = {
                type: null,
                name: null,
                width: null,
                height: null,
                minRange: null,
                frameName: null,
                C: null,
                C_LOCAL: null,
                A: null,
                H: null,
                V: null,
                O: null,
                R: null,
                E: null,
                pupilType: null,
                linearity: null,
            };
            let cameraName;
            const cameraNode = childNodes[i];

            const attributes = cameraNode.attributes;
            for (let a = 0; a < attributes.length; a++) {
                const attribute = attributes[a];
                cameraObject[attribute.name] = this._parseValue(attribute.value);
                // each camera MUST have a name
                if (attribute.name.toLowerCase() === 'name') {
                    cameraName = attribute.value;
                }
            }

            if (cameraName === undefined) {
                // TODO this should never happen
                console.log(`No camera name found when parsing ${cameraNode.tagName}`);
                continue;
            }

            const children = cameraNode.children;
            for (let j = 0; j < children.length; j++) {
                const child = children[j];
                const value = this._parseInnerHTML(child);
                cameraObject[child.nodeName] = value;
            }

            if ('PUPILTYPE' in cameraObject) cameraObject.pupilType = cameraObject.PUPILTYPE;
            if ('LINEARITY' in cameraObject) cameraObject.linearity = cameraObject.LINEARITY;
            if ('min_range' in cameraObject) cameraObject.minRange = cameraObject.min_range;
            if ('frame_name' in cameraObject) cameraObject.frameName = cameraObject.frame_name;
            if ('reparent_frame' in cameraObject) cameraObject.reparentFrameName = cameraObject.reparent_frame;

            cameras[cameraName] = cameraObject as CameraDefinitionGeneric<Vec3>;
        }
        console.timeEnd('CameraLoader: Parse');

        return cameras;
    }

    parse(str: string): CameraDefinitions {
        const inParsed = this.parseXml(str);
        const result: CameraDefinitions = {};
        for (const name in inParsed) {
            const cameraModelIn = inParsed[name];
            result[name] = {
                ...cameraModelIn,
                C: new Vector3(...cameraModelIn.C),
                C_LOCAL: cameraModelIn.C_LOCAL ? new Vector3(...cameraModelIn.C_LOCAL) : undefined,
                A: new Vector3(...cameraModelIn.A),
                H: new Vector3(...cameraModelIn.H),
                V: new Vector3(...cameraModelIn.V),
                O: cameraModelIn.O ? new Vector3(...cameraModelIn.O) : undefined,
                R: cameraModelIn.R ? new Vector3(...cameraModelIn.R) : undefined,
                E: cameraModelIn.E ? new Vector3(...cameraModelIn.E) : undefined,
            } as CameraDefinition;
        }

        return result;
    }
}

