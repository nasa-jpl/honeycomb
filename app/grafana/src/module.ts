import { PanelOptionsEditorBuilder, PanelPlugin } from '@grafana/data';

import { type HoneycombPanelOptions } from './types';

import {
    AnnotationRegistryItem,
    Registry
} from '@gov.nasa.jpl.honeycomb/ui';

import { HoneycombPanel } from './components/HoneycombPanel';

import { addWorldOptions } from './editors/WorldOptions';
import { addSceneEditor } from './editors/SceneEditor';
import { addDataVolumeOptions } from './editors/DataVolumeOptions';
import { addFrameTrajectoriesOptions } from './editors/FrameTrajectoriesOptions';
import { addTagGroupsOptions } from './editors/TagGroupsEditor';
import { addWidgetGroupsOptions } from './editors/WidgetGroupsEditor';

import { markerRegistration, markerRegistrationOptions } from './honeycomb/annotations/Marker';
import { costMapRegistration, costMapRegistrationOptions } from './honeycomb/annotations/CostMap';
import { debugRegistration, debugRegistrationOptions } from './honeycomb/annotations/Debug';
import { heightMapRegistration, heightMapRegistrationOptions } from './honeycomb/annotations/HeightMap';
import { enavRegistration, enavRegistrationOptions } from './honeycomb/annotations/Enav';
import { coordinateFrameRegistration, coordinateFrameRegistrationOptions } from './honeycomb/annotations/CoordinateFrame';

export const annotationRegistry = new Registry<
    AnnotationRegistryItem<any>,
    PanelOptionsEditorBuilder<any>
>(PanelOptionsEditorBuilder, () => {
    return [
        [markerRegistration, markerRegistrationOptions],
        [costMapRegistration, costMapRegistrationOptions],
        [heightMapRegistration, heightMapRegistrationOptions],
        [debugRegistration, debugRegistrationOptions],
        [enavRegistration, enavRegistrationOptions],
        [coordinateFrameRegistration, coordinateFrameRegistrationOptions]
    ];
});

export const plugin = new PanelPlugin<HoneycombPanelOptions>(HoneycombPanel).setPanelOptions((builder) => {
    addWorldOptions(builder);
    addSceneEditor(builder);
    addDataVolumeOptions(builder);
    addFrameTrajectoriesOptions(builder);
    addTagGroupsOptions(builder);
    addWidgetGroupsOptions(builder);
}).setDataSupport({
    annotations: true
});
