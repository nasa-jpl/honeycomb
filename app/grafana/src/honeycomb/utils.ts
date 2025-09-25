import {
    Field,
    FieldMatcherID,
    FieldMatcherInfo,
    fieldMatchers,
    type DataFrame
} from "@grafana/data";

import { WorldOptions } from "../types";
import { Vector3 } from "three";
import { GrafanaHoneycombViewer } from "../components/App";

export function binarySearch(times: number[], time: number) {
    if (time < times[0]) {
        return -1;
    } else if (time > times[times.length - 1]) {
        return times.length - 1;
    }

    let m = 0;
    let n = times.length - 1;
    while (m <= n) {
        const k = (n + m) >> 1;
        const cmp = time - times[k];
        if (cmp > 0) {
            m = k + 1;
        } else if (cmp < 0) {
            n = k - 1;
        } else {
            return k;
        }
    }

    return m - 1;
}

const tempVec3a = new Vector3();
export function applyOptionsToViewer(options: Partial<WorldOptions>, viewer: GrafanaHoneycombViewer) {
    viewer.playbackSpeed = options.playbackSpeed ?? 1;
    viewer.gridVisibility = !!options.gridVisibility;
    viewer.world.setUpDirection(options.up ?? "+Z");
    viewer.viewCubeEnabled = options.viewCube ?? false;

    viewer.directionalLight.intensity = options.sunIntensity ?? 1;

    if (options.sunDirection) {
        tempVec3a.set(
            options.sunDirection[0],
            options.sunDirection[1],
            options.sunDirection[2]
        );

        viewer.setSunDirection(tempVec3a);
    }

    viewer.dirty = true;
}

const fieldNameMatcher = fieldMatchers.get(FieldMatcherID.byName) as FieldMatcherInfo<string>;
const firstTimeMatcher = fieldMatchers.get(FieldMatcherID.firstTimeField).get({});

export function getFirstTimeField(table: DataFrame, data: DataFrame[]): Field<number> | undefined {
    for (const timeField of table.fields) {
        if (firstTimeMatcher(timeField, table, data)) {
            return timeField;
        }
    }

    return;
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);

    const length = binaryString.length;
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
}

export function getValueAndTimeFields<T>(
    data: DataFrame[],
    fieldName: string
): { time: Field<number>, value: Field<T> } | undefined {
    const valueMatcher = fieldNameMatcher.get(fieldName);

    // Find the corresponding value field
    for (const frame of data) {
        for (const valueField of frame.fields) {
            if (valueMatcher(valueField, frame, data)) {
                // We found value field, now found the time field in this frame
                const timeField = getFirstTimeField(frame, data);
                if (timeField) {
                    return {
                        value: valueField,
                        time: timeField
                    };
                }

                // No time field found in this table, this valueField is not valid
                // TODO(tumbar) Should we keep searching?
                return;
            }
        }
    }

    return;
}
