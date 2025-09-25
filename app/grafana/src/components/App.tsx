import { useEffect, useState } from 'react';

import { Mesh, BufferGeometry } from 'three';
import {
    computeBoundsTree,
    disposeBoundsTree,
    acceleratedRaycast
} from 'three-mesh-bvh';

import { LoadingManager, Viewer } from '@gov.nasa.jpl.honeycomb/core';

import {
    AnnotationDriver,
    KinematicsDriver,
    registerCommonLoaders
} from '@gov.nasa.jpl.honeycomb/extensions';

import {
    FocusCamViewerMixin,
    LightingViewerMixin,
    TransformControlsViewerMixin,
    ViewCubeViewerMixin
} from '@gov.nasa.jpl.honeycomb/scene-viewers';


import {
    type HoneycombContextState,
    App as HoneycombApp,
} from '@gov.nasa.jpl.honeycomb/ui';

import { GrafanaKinematicsAnimator } from '../honeycomb/KinematicsAnimator';
import { GrafanaAnnotationsAnimator } from '../honeycomb/AnnotationsAnimator';
import { FrameTrajectoriesDriver } from '../honeycomb/FrameTrajectoriesDriver';
import { GrafanaHoneycombContext, GrafanaHoneycombContextState } from './Context';
import { annotationRegistry } from '../module';

export class GrafanaHoneycombViewer extends
    ViewCubeViewerMixin(
        FocusCamViewerMixin(
            TransformControlsViewerMixin(
                LightingViewerMixin(Viewer))))
{
}

export const App: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
    const [honeycombContext, setHoneycombContext] = useState<HoneycombContextState>();
    const [grafanaHoneycombContext, setGrafanaHoneycombContext] = useState<GrafanaHoneycombContextState>();

    useEffect(() => {
        const manager = new LoadingManager();
        const viewer = new GrafanaHoneycombViewer();

        const kinematicsDriver = new KinematicsDriver();
        const annotationsDriver = new AnnotationDriver(manager);
        const kinematicsAnimator = new GrafanaKinematicsAnimator();
        const annotationsAnimator = new GrafanaAnnotationsAnimator(annotationRegistry);
        const frameTrajectoriesDriver = new FrameTrajectoriesDriver(viewer, kinematicsAnimator);

        // Using three-mesh-bvh can help speed up terrain raycasts immensely for
        // large terrains. For example, on a terrain with 7.5M vertices and 15M faces,
        // normal raycasts took over 1100ms but the sped-up version took under 1ms.
        // Note that computeBoundsTree() must be called one time on the geometry prior
        // to any raycasts (not for each raycast), otherwise the normal three raycast 
        // function will be used. We are now calling computeBoundsTree() on loaded 
        // objects by default. Here are some typical timings on computeBoundsTree():
        // - .stl terrain with 7.5M vertices, 15M faces -- 6.8 seconds
        // - .obj terrain with 500K vertices, 996K faces -- 340ms
        // - small .stl mesh files for a rover -- all under 22ms
        // See also:
        // - honeycomb/modules/honeycomb/src/Loaders.ts
        // - useOptimizedRaycast option in ModelObject in 
        //   honeycomb/modules/honeycomb/src/scene.ts
        (BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
        (BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
        Mesh.prototype.raycast = acceleratedRaycast;

        registerCommonLoaders();

        viewer.addDriver(kinematicsDriver, 'kinematics');
        viewer.addDriver(annotationsDriver, 'annotations');

        viewer.addAnimator(kinematicsAnimator, 'kinematics');
        viewer.addAnimator(annotationsAnimator, 'annotations');
        viewer.animator.setTime(viewer.animator.startTime);

        // Load all settings and files from the lineage of configs
        viewer.renderer.setClearColor("#000", 0);
        viewer.getCamera().position.set(2, 2, 2);
        viewer.controls.enableKeys = false;

        // TODO(tumbar) Remove. This is just for debugging purposes
        (window as any).viewer = viewer;

        setHoneycombContext({ viewer, manager, annotations: annotationRegistry });
        setGrafanaHoneycombContext({
            drivers: {
                kinematics: kinematicsDriver,
                frameTrajectories: frameTrajectoriesDriver,
                annotations: annotationsDriver
            },
            animators: {
                kinematics: kinematicsAnimator,
                annotations: annotationsAnimator
            }
        });
    }, []);

    if (!honeycombContext || !grafanaHoneycombContext) {
        return null;
    }

    return (
        <HoneycombApp {...honeycombContext}>
            <GrafanaHoneycombContext.Provider value={grafanaHoneycombContext}>
                {children}
            </GrafanaHoneycombContext.Provider>
        </HoneycombApp>
    )
}
