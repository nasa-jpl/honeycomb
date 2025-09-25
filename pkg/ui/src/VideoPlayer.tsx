import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import { Viewer } from '@gov.nasa.jpl.honeycomb/core';
import type { IEventDispatcher } from '@gov.nasa.jpl.honeycomb/event-dispatcher';
import { Debouncer } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';

import { ViewerContainer } from './ViewerContainer';
import { EventWatcher } from './EventWatcher';

export interface VideoPlayerBarProps {
    startTime: number;
    currTime: number;
    endTime: number;

    left?: React.ReactNode | undefined;
    right?: React.ReactNode | undefined;
    top?: React.ReactNode | undefined;
    bottom?: React.ReactNode | undefined;

    setTime: (time: number) => void;

    isPlaying: boolean;
    isFullscreen: boolean;
    isLive: boolean;
    displayLive: boolean;

    onClickPlay: () => void;
    onClickStop: () => void;
    onClickFullScreen: () => void;
    onClickLive: () => void;
    disabled: boolean;
}

export interface VideoPlayerProps {
    viewer: Viewer;
    container: Element;

    /**
     * Elements to place on top of the viewer itself
     */
    children?: React.ReactNode | undefined;

    /**
     * Elements to place on the left side of the player bar
     */
    playbarLeft?: React.ReactNode | undefined;

    /**
     * Elements to place above the aboveplay/seekbar
     */
    playbarTop?: React.ReactNode | undefined;

    /**
     * Elements to place below the play/seekbar
     */
    playbarBottom?: React.ReactNode | undefined;

    /**
     * Elements to place on the right side of the player bar
     */
    playbarRight?: React.ReactNode | undefined;

    significantAnimators?: string[];

    PlayerBar: React.ComponentType<VideoPlayerBarProps>;
}

const VIEWER_EVENTS = ['change', 'vrdisplayconnectionchange', 'toggle-tag'];
const VIEWER_OBJECT_EVENTS = ['add-object', 'remove-object'];
const ANIMATOR_EVENTS = ['change', 'added-frames', 'keyframe-progress', 'connected', 'disconnected'];

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    viewer,
    container,
    significantAnimators,
    playbarLeft,
    playbarRight,
    playbarTop,
    playbarBottom,
    PlayerBar,
    children
}) => {
    const debouncer = useMemo(() => new Debouncer(), []);
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const [fullscreen, setFullscreen] = useState(false);

    const updateIsFullscreen = useCallback(() => {
        const isFullscreen = !!(
            document.fullscreenElement ||
            (document as any).mozFullScreen ||
            (document as any).webkitIsFullScreen ||
            (document as any).msIsFullscreen
        );

        setFullscreen(isFullscreen);
    }, []);

    const onDocClick = useCallback(() => {
        if (document.activeElement instanceof HTMLButtonElement) {
            document.activeElement.blur();
        }
    }, []);

    useEffect(() => {
        debouncer.run('rerender', () => forceUpdate(), Infinity);

        document.addEventListener('fullscreenchange', updateIsFullscreen);
        document.addEventListener('mozfullscreenchange', updateIsFullscreen);
        document.addEventListener('webkitfullscreenchange', updateIsFullscreen);
        document.addEventListener('msfullscreenchange', updateIsFullscreen);
        document.addEventListener('click', onDocClick);

        return () => {
            document.removeEventListener('fullscreenchange', updateIsFullscreen);
            document.removeEventListener('mozfullscreenchange', updateIsFullscreen);
            document.removeEventListener('webkitfullscreenchange', updateIsFullscreen);
            document.removeEventListener('msfullscreenchange', updateIsFullscreen);
            document.removeEventListener('click', onDocClick);
        }
    }, [debouncer, onDocClick, updateIsFullscreen]);

    const enterFullscreen = useCallback(() => {
        const docElm = container || document.documentElement;

        if (docElm.requestFullscreen) {
            docElm.requestFullscreen();
        } else if ((docElm as any).mozRequestFullScreen) {
            (docElm as any).mozRequestFullScreen();
        } else if ((docElm as any).webkitRequestFullScreen) {
            (docElm as any).webkitRequestFullScreen();
        } else if ((docElm as any).msRequestFullscreen) {
            (docElm as any).msRequestFullscreen();
        }
    }, [container]);

    const exitFullscreen = useCallback(() => {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
            (document as any).mozCancelFullScreen();
        } else if ((document as any).webkitCancelFullScreen) {
            (document as any).webkitCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
            (document as any).msExitFullscreen();
        }
    }, []);

    const onClickFullscreen = useCallback(() => {
        if (fullscreen) {
            exitFullscreen();
        } else {
            enterFullscreen();
        }
    }, [fullscreen, exitFullscreen, enterFullscreen]);

    const onClickStop = useCallback(() => {
        viewer.stop();
        forceUpdate();
    }, [viewer]);

    const onClickPlay = useCallback(() => {
        if (viewer.isPlaying) {
            viewer.pause();
        } else {
            viewer.play();
        }

        forceUpdate();
    }, [viewer]);

    const onClickLive = useCallback(() => {
        if (!viewer.isLive) {
            viewer.isLive = true;
            viewer.play();
        }

        forceUpdate();
    }, [viewer]);

    const onViewerObjectEvent = useCallback(() => {
        viewer.updateAllDrivers(true);
    }, [viewer]);

    const onKeyDown = useCallback((e: Event) => {
        if (e instanceof KeyboardEvent) {
            const animator = viewer.animator;

            switch (e.key) {
                case ' ':
                    onClickPlay();
                    break;
                case 'ArrowLeft': {
                    const prevTime = animator.getPrevSignificantTime(significantAnimators);
                    if (prevTime !== null) {
                        animator.setTime(prevTime);
                        forceUpdate();
                    }
                }
                    break;
                case 'ArrowRight': {
                    const nextTime = animator.getNextSignificantTime(significantAnimators);
                    if (nextTime !== null) {
                        animator.setTime(nextTime);
                        forceUpdate();
                    }
                }
                    break;
            }
        }
    }, [onClickPlay, significantAnimators, viewer.animator]);

    const setTime = useCallback((val: number) => {
        viewer.animator.setTime(val).then(() => {
            forceUpdate();
        });
        viewer.isLive = false;
    }, [viewer]);

    return (
        <React.Fragment>
            <EventWatcher
                target={viewer}
                events={VIEWER_EVENTS}
                onEventFired={forceUpdate}
            />
            <EventWatcher
                target={viewer.animator}
                events={ANIMATOR_EVENTS}
                onEventFired={forceUpdate}
            />
            <EventWatcher
                target={viewer}
                onEventFired={onViewerObjectEvent}
                events={VIEWER_OBJECT_EVENTS}
            />
            <EventWatcher
                target={container as unknown as IEventDispatcher}
                events={['keydown']}
                onEventFired={onKeyDown}
            />
            <div style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                width: "100%",
                height: "100%",
            }}>
                <div style={{
                    flex: 1,
                    position: 'relative'
                }}>
                    <ViewerContainer viewer={viewer} style={{
                        height: '100%',
                        width: '100%',
                        flexShrink: 1,
                        overflow: 'hidden',
                        // Absolute so that it doesn't affect the box parent sizing
                        // This container will resize the actual viewer
                        position: 'absolute'
                    }}>
                        {children}
                    </ViewerContainer>
                </div>
                <PlayerBar
                    startTime={viewer.animator.startTime}
                    currTime={viewer.animator.time}
                    endTime={viewer.animator.endTime}
                    setTime={setTime}
                    onClickPlay={onClickPlay}
                    onClickStop={onClickStop}
                    onClickFullScreen={onClickFullscreen}
                    onClickLive={onClickLive}
                    isFullscreen={fullscreen}
                    isPlaying={viewer.isPlaying}
                    isLive={viewer.isLive}
                    displayLive={viewer.animator.liveData}
                    disabled={viewer.animator.seekable === false}
                    left={playbarLeft}
                    right={playbarRight}
                    top={playbarTop}
                    bottom={playbarBottom}
                />
            </div>
        </React.Fragment >
    );
}
