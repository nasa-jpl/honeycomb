import React, { useContext } from "react";
import type { AnnotationDriver, KinematicsDriver } from "@gov.nasa.jpl.honeycomb/extensions";

import { FrameTrajectoriesDriver } from "../honeycomb/FrameTrajectoriesDriver";
import { GrafanaKinematicsAnimator } from "../honeycomb/KinematicsAnimator";
import { GrafanaAnnotationsAnimator } from "../honeycomb/AnnotationsAnimator";

export interface GrafanaHoneycombContextState {
    drivers: {
        kinematics: KinematicsDriver;
        annotations: AnnotationDriver;
        frameTrajectories: FrameTrajectoriesDriver;
    };

    animators: {
        kinematics: GrafanaKinematicsAnimator;
        annotations: GrafanaAnnotationsAnimator;
    }
}

export const GrafanaHoneycombContext = React.createContext<GrafanaHoneycombContextState>(null!);

export function useGrafanaHoneycomb() {
    return useContext(GrafanaHoneycombContext);
}
