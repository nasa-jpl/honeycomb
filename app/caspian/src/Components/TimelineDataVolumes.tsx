import React, { createRef, PureComponent } from 'react';

import * as styles from './styles/TimelineDataVolumes.css';

export class TimelineDataVolumes extends PureComponent<any, any> {
    ref: React.RefObject<any>;
    volumePixelWidth: number;

    constructor(props) {
        super(props);

        this.ref = createRef();

        // segment into 10px width bars
        this.volumePixelWidth = 10;

        this.state = {
            width: 0,
        };
    }

    handleResize = () => {
        this.setState({
            width: this.ref.current.offsetWidth,
        });
    }

    componentDidMount() {
        if (this.ref.current) {
            this.handleResize();
        }

        window.addEventListener('resize', this.handleResize);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }

    render() {
        const { start, end, timelineDataVolumes } = this.props;
        const { width } = this.state;

        // whole number of total data volume bars
        const numDataVolumeBars = Math.round(width / this.volumePixelWidth);
        const percentPerBar = 100 / numDataVolumeBars;

        const telemetryKeys = Object.keys(timelineDataVolumes);

        const timeFiltered = {};
        telemetryKeys.forEach(key => {
            timeFiltered[key] = timelineDataVolumes[key].frames.filter(elem => {
                return elem.time >= start && elem.time <= end;
            });
        });

        const regroup = {};
        const dur = end - start;

        // group timelineDataVolumes that are within 0.5% of the specified time span
        telemetryKeys.forEach(key => {
            timeFiltered[key].forEach(val => {
                const offset =
                    Math.floor(((val.time - start) / dur) * numDataVolumeBars) * percentPerBar;
                if (offset in regroup && key in regroup[offset]) {
                    regroup[offset][key] = regroup[offset][key] + 1;
                } else {
                    if (offset in regroup) {
                        regroup[offset][key] = 1;
                    } else {
                        regroup[offset] = { [key]: 1 };
                    }
                }
            });
        });

        let max = 0;
        Object.keys(regroup).forEach(offset => {
            Object.keys(regroup[offset]).forEach(key => {
                max = Math.max(regroup[offset][key], max);
            });
        });

        return (
            <div className={styles.root} ref={this.ref}>
                {Object.keys(regroup).map((offset, i) => {
                    return (
                        <div
                            key={i}
                            className={styles.highlight}
                            style={{ left: `${offset}%`, width: `calc(${percentPerBar}% - 1px)` }}
                        >
                            {Object.keys(regroup[offset]).map((key, j) => {
                                const height = (regroup[offset][key] / max) * 100;
                                return (
                                    <div
                                        key={j}
                                        style={{
                                            marginTop: '1px',
                                            height: `max(${height}%, 3px)`,
                                            backgroundColor: `${timelineDataVolumes[key].color || 'white'}`,
                                        }}
                                    />
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        );
    }
}
