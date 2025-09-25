import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { css, cx } from '@emotion/css';
import _ from 'lodash';

import { DataHoverEvent, type PanelProps } from '@grafana/data';
import { usePanelContext } from '@grafana/ui';

import {
    VideoPlayer,
    useHoneycomb,
    EventWatcher,
    TimelineDataVolumeFrame,
    TimelineProps,
    Timeline
} from '@gov.nasa.jpl.honeycomb/ui';

import { SceneObject } from '@gov.nasa.jpl.honeycomb/core';

import { WorldOptions, type HoneycombPanelOptions } from '../types';
import { applyOptionsToViewer, getValueAndTimeFields } from '../honeycomb/utils';

import { SceneLoader } from '@gov.nasa.jpl.honeycomb/ui/src/SceneLoader';

import { App, GrafanaHoneycombViewer } from './App';
import { VideoSpeedPicker } from './VideoSpeedPicker';
import { GridColorListener } from './GridColor';
import { LayerTags } from './LayerTags';
import { AnnotationWidgets } from './AnnotationWidgets';
import { LightDirection } from './LightDirection';
import { useGrafanaHoneycomb } from './Context';
import { LoadWrapper } from './LoadWrapper';
import { VideoPlayerBar } from './VideoPlayerBar';
import { ViewerErrors } from './ViewerErrors';

export interface TimeRange2 {
    from: number;
    to: number;
}

interface HoneycombInnerProps extends Props {
    containerRef: Element;
}

const ANIMATOR_EVENTS = ['change'];
const HoneycombInner: React.FC<HoneycombInnerProps> = ({
    options,
    height,
    data,
    timeRange,
    containerRef,
    onOptionsChange
}) => {
    const { viewer } = useHoneycomb<GrafanaHoneycombViewer>();
    const { drivers, animators } = useGrafanaHoneycomb();
    const panelContext = usePanelContext();

    useEffect(() => {
        applyOptionsToViewer(options.worldOptions, viewer);
        viewer.updateAllDrivers(true);
        viewer.dirty = true;
    }, [viewer, options.worldOptions]);

    useEffect(() => {
        animators.kinematics.options(options);
        animators.annotations.options(options);
        viewer.updateAllDrivers(true);
    }, [options, animators, viewer]);

    useEffect(() => {
        animators.kinematics.data(data.series);
        animators.annotations.data(data.series);
        drivers.frameTrajectories.reload();
    }, [animators, data, drivers.frameTrajectories, viewer]);

    useEffect(() => {
        drivers.frameTrajectories.set(options.frameTrajectoriesOptions);
        drivers.frameTrajectories.setScene(options.scene);
        drivers.frameTrajectories.reload();
        viewer.dirty = true;
    }, [viewer, options.frameTrajectoriesOptions, options.scene, drivers]);

    useEffect(() => {
        for (const animator of Object.values(animators)) {
            animator.updateTimeRange(timeRange);
        }

        // Live data
        if (timeRange.raw.to === 'now') {
            if (viewer.isLive) {
                viewer.animator.setTime(viewer.animator.endTime);
            }
        } else if (
            viewer.animator.time < viewer.animator.startTime ||
            viewer.animator.time > viewer.animator.endTime
        ) {
            // Clamp the time to the Grafana min/max
            viewer.animator.setTime(Math.min(Math.max(
                viewer.animator.time, viewer.animator.startTime), viewer.animator.endTime
            ));
        }
    }, [animators, timeRange, viewer.animator, viewer.isLive]);

    const onPlaybackSpeedChange = useCallback((playbackSpeed: number) => {
        onOptionsChange({
            ...options,
            worldOptions: {
                ...options.worldOptions,
                playbackSpeed
            }
        })
    }, [options, onOptionsChange]);

    const onWorldOptionsChange = useCallback((diff: Partial<WorldOptions>) => {
        onOptionsChange({
            ...options,
            worldOptions: {
                ...options.worldOptions,
                ...diff
            }
        })
    }, [options, onOptionsChange]);

    const onSceneChange = useCallback((scene: SceneObject[]) => {
        onOptionsChange({
            ...options,
            scene
        })
    }, [options, onOptionsChange]);

    const onAnimatorChange = useCallback(() => {
        panelContext.eventBus.publish(
            new DataHoverEvent({
                point: {
                    time: viewer.animator.time * 1000,
                },
            })
        )
    }, [panelContext, viewer]);

    const timelineProps = useMemo<TimelineProps>(() => {
        const frames: TimelineDataVolumeFrame[] = [];
        for (const volumeField of options.dataVolumes) {
            if (volumeField.field) {
                const fields = getValueAndTimeFields(data.series, volumeField.field);
                if (fields) {
                    const { value: valueField, time: timeField } = fields;
                    frames.push({
                        name: volumeField.name,
                        color: volumeField.color,
                        // Filter out empty time slices of this field
                        // This happens when you merge tables (usually this indicates a not so great query...)
                        times: timeField.values.filter((_v, i) => (
                            valueField.values[i] !== undefined && valueField.values[i] !== null
                        )),
                    });
                }
            }
        }

        return {
            start: timeRange.from.valueOf(),
            end: timeRange.to.valueOf(),
            volumes: frames
        };
    }, [data, options.dataVolumes, timeRange]);

    return (
        <>
            <EventWatcher
                target={viewer.animator}
                onEventFired={onAnimatorChange}
                events={ANIMATOR_EVENTS}
            />
            <LightDirection
                viewer={viewer}
                onWorldOptionsChange={onWorldOptionsChange}
            />
            <LoadWrapper>
                <VideoPlayer
                    viewer={viewer}
                    container={containerRef}
                    playbarRight={
                        <React.Fragment>
                            <AnnotationWidgets
                                height={height}
                                scene={options.scene}
                                widgetGroups={options.widgetGroups}
                                onChangeScene={onSceneChange}
                            />
                            <LayerTags
                                height={height}
                                scene={options.scene}
                                tagGroups={options.tagGroups}
                            />
                            <VideoSpeedPicker
                                value={options.worldOptions.playbackSpeed}
                                onChange={onPlaybackSpeedChange}
                            />
                            <ViewerErrors height={height} />
                        </React.Fragment>
                    }
                    playbarBottom={<Timeline {...timelineProps} />}
                    PlayerBar={VideoPlayerBar}
                />
            </LoadWrapper>
        </>
    );
}

export type Props = PanelProps<HoneycombPanelOptions>;
export const HoneycombPanel: React.FC<Props> = (props) => {
    const { width, height, options: { scene } } = props;
    const [containerRef, setContainerRef] = useState<Element | null>(null);

    return (
        <div
            ref={setContainerRef}
            className={cx(
                css`
          width: ${width}px;
          height: ${height}px;
          display: flex;
        `)}
        >
            <App>
                <SceneLoader scene={scene} />
                <GridColorListener />
                {containerRef && (
                    <HoneycombInner
                        {...props}
                        containerRef={containerRef}
                    />
                )}
            </App>
        </div>
    );
};
