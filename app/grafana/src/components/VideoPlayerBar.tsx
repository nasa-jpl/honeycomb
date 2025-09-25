import { useCallback, useMemo, useState } from 'react';

import { IconButton, Stack, ToolbarButton } from '@grafana/ui';
import { dateTime } from '@grafana/data';

import { PlayerBarHoverContext, VideoPlayerBarProps } from '@gov.nasa.jpl.honeycomb/ui';

import { VideoPlayerSlider } from './VideoPlayerSlider';

function sameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

export const DisplayTime: React.FC<{
    startTime: number;
    currentTime: number;
    endTime: number;
}> = ({ startTime, currentTime, endTime }) => {
    const s = useMemo(() => dateTime(startTime * 1000), [startTime]);
    const c = useMemo(() => dateTime(currentTime * 1000), [currentTime]);
    const e = useMemo(() => dateTime(endTime * 1000), [endTime]);

    const startToEndMultiple = useMemo(() => !sameDay(s.toDate(), e.toDate()), [s, e]);
    const currentToEndMultiple = useMemo(() => !sameDay(c.toDate(), e.toDate()), [c, e]);
    const cs = useMemo(() => {
        if (startToEndMultiple) {
            return c.format('YYYY-MM-DD HH:mm:ss')
        } else {
            return c.format('HH:mm:ss')
        }
    }, [c, startToEndMultiple]);

    const es = useMemo(() => {
        if (currentToEndMultiple) {
            return e.format('HH:mm:ss YYYY-MM-DD')
        } else {
            return e.format('HH:mm:ss')
        }
    }, [e, currentToEndMultiple]);

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>{cs}</span>
            <span style={{ margin: '0 4px' }}>:</span>
            {es}
        </span >
    )
}

// Passible video playback bar with slots for button extensions
export const VideoPlayerBar: React.FC<VideoPlayerBarProps> = ({
    startTime,
    currTime,
    endTime,
    setTime,

    isPlaying,
    isFullscreen,
    isLive,
    displayLive,

    left,
    right,
    top,
    bottom,

    onClickPlay,
    onClickStop,
    onClickFullScreen,
    onClickLive,

    disabled,
}) => {
    const [hovering, setHovering] = useState(false);

    const onMouseEnter = useCallback(() => {
        setHovering(true);
    }, []);

    const onMouseLeave = useCallback(() => {
        setHovering(false);
    }, []);

    return (
        <Stack
            direction="column"
            gap={0}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <PlayerBarHoverContext.Provider value={hovering}>
                {top}

                <VideoPlayerSlider
                    min={startTime}
                    max={endTime}
                    value={currTime}
                    onChange={setTime}
                    disabled={disabled}
                />

                {bottom}
            </PlayerBarHoverContext.Provider>

            <Stack direction="row" justifyContent="space-between" gap={1}>
                <Stack direction="row" gap={3}>
                    <Stack direction="row" gap={1}>
                        <IconButton
                            onClick={onClickPlay}
                            aria-label='Play'
                            tooltip="Play"
                            name={isPlaying ? "pause" : "play"}
                            size="lg"
                            disabled={disabled}
                        />
                        <IconButton
                            onClick={onClickStop}
                            aria-label='Stop'
                            tooltip="Stop"
                            name="square-shape"
                            size="lg"
                            disabled={disabled}
                        />
                        <DisplayTime
                            startTime={startTime}
                            currentTime={currTime}
                            endTime={endTime}
                        />
                    </Stack>
                    {displayLive && (
                        <ToolbarButton
                            variant='canvas'
                            disabled={isLive}
                            tooltip={isLive ? 'Displaying latest data' : 'Pin to latest data'}
                            icon='circle-mono'
                            iconSize='xs'
                            onClick={onClickLive}
                        >
                            Live
                        </ToolbarButton>
                    )}
                    <Stack direction="row" gap={1}>
                        {left}
                    </Stack>
                </Stack>
                <Stack direction="row" gap={3}>
                    <Stack direction="row" gap={1}>
                        {right}
                    </Stack>
                    <IconButton
                        tooltip="Fullscreen"
                        onClick={onClickFullScreen}
                        aria-label='Fullscreen'
                        name={isFullscreen ? "compress-arrows" : "expand-arrows-alt"}
                        size="lg"
                    />
                </Stack>
            </Stack>
        </Stack>
    )
}

