import { Object3D } from 'three';

import { Annotation, Driver, StateDiff } from '@gov.nasa.jpl.honeycomb/core';
import { FullState } from '@gov.nasa.jpl.honeycomb/telemetry-animator';

export interface AnnotationObject<T> extends Object3D {
    /**
     * Called on every refresh frame.
     * 
     * Note: For rendering efficiency, you should check if the annotation
     *       needs to refresh and only update the parts that need it
     * @param state Data passed to your annotation
     */
    update(state: T): void;
}

export type AnnotationConstructor<T> = new (data: T) => AnnotationObject<T>;

export interface AnnotationRegistration<T> {
    type: string;

    /**
     * Optional user-facing label to use instead of {@link type}
     */
    label?: string;

    /**
     * Optional user-facing description
     */
    description?: string;

    constructor: AnnotationConstructor<T>
}

export class AnnotationDriver extends Driver<FullState> {
    update(
        fullState: FullState,
        diff: StateDiff<FullState>
    ): void {
        if (!diff.didChange("annotations")) {
            return;
        }

        if (!this.viewer || !fullState?.annotations) {
            return;
        }

        for (const [id, state] of Object.entries(fullState.annotations)) {
            const annotation = this.viewer.objects[id] as Annotation<any, any>;
            if (annotation) {
                if (state) {
                    annotation.update(state);
                    annotation.visible = annotation.userData.enabled ?? true;
                } else {
                    annotation.visible = false;
                }

                this.viewer.dirty = true;
            }
        }
    }
}
