import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import styled from '@emotion/styled';

export const TimelineDataVolumesRoot = styled.div`
    position: relative;
    width: 100%;
    height: 20px;
    margin-bottom: 5px;
`;

export const TimelineDataVolumesHighlight = styled.div`
    position: absolute;
    pointer-events: none;
    bottom: 0;
    height: inherit;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
`;


export interface TimelineDataVolumeFrame {
    name: string;
    times: number[],
    color?: string
}


export interface TimelineProps {
    start: number;
    end: number;
    volumes: TimelineDataVolumeFrame[];
}

export const Timeline: React.FC<TimelineProps> = ({
    start,
    end,
    volumes
}) => {
    if (volumes.length > 0) {
        return (
            <TimelineVolumes
                start={start}
                end={end}
                volumes={volumes}
            />
        );
    } else {
        return null;
    }
}


function transpose(matrix: number[][]): number[][] {
    return matrix[0].map((_col, i) => matrix.map(row => row[i]));
}

const volumePixelWidth = 5;

const TimelineVolumes: React.FC<TimelineProps> = ({
    start,
    end,
    volumes
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const target = ref.current!;
        const updateWidth = () => {
            setWidth(ref.current?.offsetWidth ?? 0);
        };

        updateWidth();

        target.addEventListener('resize', updateWidth);
        window.addEventListener('resize', updateWidth);
        return () => {
            target.removeEventListener('resize', updateWidth);
            window.removeEventListener('resize', updateWidth);
        }
    }, []);

    // whole number of total data volume bars
    const numDataVolumeBars = useMemo(() => Math.round(width / volumePixelWidth), [width]);
    const percentPerBar = useMemo(() => 100 / numDataVolumeBars, [numDataVolumeBars]);

    const volumesBucketFrame = useMemo(() => {
        const delta = end - start;

        if (delta === 0) {
            return null;
        }

        if (numDataVolumeBars === 0) {
            return null;
        }

        const volumesFrameBucket: number[][] = [];
        for (const frame of volumes) {
            const currentFrame = new Array(numDataVolumeBars).fill(0);
            volumesFrameBucket.push(currentFrame);

            for (const time of frame.times) {
                // Compute the bucket this time falls into
                let bucket: number;
                if (time >= end) {
                    bucket = numDataVolumeBars - 1;
                } else if (time < start) {
                    bucket = 0;
                } else {
                    bucket = Math.floor(((time - start) / (delta)) * numDataVolumeBars);
                }

                currentFrame[bucket] += 1;
            }
        }

        if (volumesFrameBucket.length === 0) {
            return null;
        }

        return transpose(volumesFrameBucket);
    }, [end, numDataVolumeBars, start, volumes]);

    const max = useMemo(() => {
        // Compute the max to scale the bars vertically
        let max = 0;
        for (const iter of volumesBucketFrame ?? []) {
            for (const value of iter) {
                max = Math.max(value, max);
            }
        }

        return max;
    }, [volumesBucketFrame]);

    return (
        <TimelineDataVolumesRoot ref={ref}>
            {(volumesBucketFrame ?? []).map((frames, bucketIndex) => (
                <TimelineDataVolumesHighlight
                    key={bucketIndex}
                    style={{
                        left: `${percentPerBar * bucketIndex}%`,
                        width: `calc(${percentPerBar}% - 1px)`
                    }}
                >
                    {frames.map((value, frameIndex) => {
                        const height = (value / max) * 100;
                        if (value === 0) {
                            return null;
                        }

                        return (
                            <div
                                key={frameIndex}
                                style={{
                                    marginTop: '1px',
                                    height: `max(${height}%, 3px)`,
                                    backgroundColor: `${volumes[frameIndex].color ?? 'white'}`,
                                }}
                            />
                        );
                    })}
                </TimelineDataVolumesHighlight>
            ))}
        </TimelineDataVolumesRoot>
    )
}
