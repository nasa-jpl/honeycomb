import React, { Component } from 'react';
import { Scheduler } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';
import { UPlotComponent } from './Uplot';
import { secondsToDisplayTime } from './utils/timeUtils';

const runArray = [];
function runTasks() {
    const component = runArray.shift();
    if (runArray.length) {
        Scheduler.scheduleNextFrame(runTasks);
    }
    if (component) {
        component.forceUpdate();
    }
}

export class TelemetryAnimatorGraph extends Component<any, any> {
    wasStale: boolean;
    wasLoading: boolean;
    graphData: any[];
    range: [number, number];
    series: any[];
    previousKey: string | null;
    plotOptions: any;
    scheduled = false;

    constructor(args) {
        super(args);
        this.wasStale = false;
        this.wasLoading = false;
        this.graphData = [[]];
        this.range = [0, 0];
        this.series = [{}];
        this.previousKey = null;
        this.plotOptions = {
            cursor: {
                y: false,
                drag: {
                    setScale: false,
                },
            },
            legend: {
                show: false,
            },
            scales: {
                x: {
                    auto: false,
                    range: () => {
                        const { range, graphData } = this;
                        if (range) {
                            return range;
                        } else if (graphData && graphData[0]) {
                            return [graphData[0][0], graphData[0][graphData[0].length - 1]];
                        } else {
                            return [0, 0];
                        }
                    },
                    time: false,
                    values: (u, vals, space) => {
                        if (this.props.relativeTime) {
                            return vals.map(v => secondsToDisplayTime(+v));
                        } else {
                            return vals;
                        }
                    },
                },
                linear: {
                    values: (u, vals, space) => vals.map(v => +v.toFixed(2) + (this.props.units || '')),
                },
            },
            axes: [
                {
                    scale: 'x',
                    grid: {
                        show: true,
                        stroke: 'rgba(255, 255, 255, 0.25)',
                        width: 1,
                    },
                    ticks: {
                        width: 1,
                        stroke: 'rgba(255, 255, 255, 0.25)',
                    },
                    stroke: 'white',
                    space: 100,
                    values: (u, vals, space) => {
                        if (this.props.relativeTime) {
                            return vals.map(v => secondsToDisplayTime(+v));
                        } else {
                            return vals;
                        }
                    },
                },
                {
                    scale: 'linear',
                    grid: {
                        show: true,
                        stroke: 'rgba(255, 255, 255, 0.25)',
                        width: 1,
                    },
                    ticks: {
                        width: 1,
                        stroke: 'rgba(255, 255, 255, 0.25)',
                    },
                    stroke: 'white',
                    values: (u, vals, space) => vals.map(v => +v.toFixed(2) + (this.props.units || '')),

                },
            ],
            plugins: [{
                hooks: {
                    setCursor: u => {
                        const { onHover, relativeTime = 0 } = this.props;
                        if (onHover) {
                            const { idx } = u.cursor;
                            const labels = u.series.map((s, i) => {
                                let value = u.data[i][idx];
                                const x = u.data[0][idx];

                                if (value === undefined) return null;
                                value += relativeTime;

                                const left = u.valToPos(x, 'x');
                                const top = u.valToPos(value, s.scale);
                                const name = s.label;
                                return { value, top, left, name, index: i };
                            }).filter(v => !!v);

                            onHover({ labels });
                        }
                    },
                },
            }],
            padding: [5, null, -15, null],
        };
    }

    shouldComponentUpdate(nextProps) {
        const { props, range } = this;

        if (!props.animator) {
            return props.animator !== nextProps.animator;
        }

        if (
            props.animator === nextProps.animator &&
            props.animator.time === range[1] &&
            props.duration === nextProps.duration &&
            props.fields.join('|') === nextProps.fields.join('|') &&
            props.interpolate === nextProps.interpolate &&
            this.wasStale === props.animator.stale &&
            this.wasLoading === props.animator.wasLoading
        ) {
            return false;
        }

        // check for buffer animator loading data chunks in
        this.wasLoading = props.animator.loading;
        this.wasStale = props.animator.stale;
        if (!this.scheduled) {
            if (!runArray.length) {
                Scheduler.scheduleNextFrame(runTasks);
            }
            runArray.push(this);
        }

        this.scheduled = true;
        return false;
    }

    render() {
        const {
            graphData,
            series,
            plotOptions,
            props,
        } = this;
        const {
            duration,
            fields,
            animator,
            colors = ['#000'],
            interpolate = true,
            relativeTime = 0,
        } = props;

        this.scheduled = false;

        while (graphData.length < fields.length + 1) {
            graphData.push([]);

            series.push({
                scale: 'linear',
                stroke: '#000',
                width: 1 / window.devicePixelRatio,
                points: {
                    show: false,
                    fill: '#000',
                    size: 3,
                },
            });
        }
        graphData.length = fields.length + 1;
        series.length = fields.length + 1;

        let index = 0;
        let maxTime = null;
        if (animator) {
            const earliestTime = animator.time - duration;
            const endTime = animator.time;

            // TODO: only seek back to the last time read instead of iterating over
            // the full time span. Splice the data outside the range off. Seekback
            // can take awhile when iterating over a large list.
            const currState = animator.state;
            graphData[0][index] = animator.time;
            for (let i = 0, l = fields.length; i < l; i++) {
                const field = fields[i];
                const value = currState[field];
                const list = graphData[i + 1];
                list[index] = value;
            }
            index++;

            // seekback only gives sparse frames so a value COULD be undefined here
            // We need to iterate over all frames afterward and forward propagate the
            // undefined frames.
            let stop = false;
            animator.seekBack((state, time) => {
                if (stop) {
                    return true;
                }

                stop = time < earliestTime;

                if (interpolate) {
                    graphData[0][index] = graphData[0][index - 1];
                    graphData[0][index + 1] = time - relativeTime;
                } else {
                    graphData[0][index] = time - relativeTime;
                }
                for (let i = 0, l = fields.length; i < l; i++) {
                    const field = fields[i];
                    let value;
                    if (Array.isArray(field)) {
                        value = state;

                        for (let j = 0, lj = field.length; value && j < lj; j++) {
                            value = value[field[j]];
                        }
                        if (typeof value === 'object') {
                            value = undefined;
                        }
                    } else {
                        value = state[field];
                    }

                    const list = graphData[i + 1];
                    if (interpolate) {
                        list[index] = value;
                        list[index + 1] = value;
                    } else {
                        list[index] = value;
                    }
                }

                if (maxTime === null) {
                    maxTime = time;
                }

                if (interpolate) {
                    index += 2;
                } else {
                    index += 1;
                }
            });

            this.range = [earliestTime - relativeTime, endTime - relativeTime];
        } else {
            this.range = [0, 0];
        }

        graphData.forEach((list, i) => {
            list.length = index;
            list.reverse();

            // fill any empty fields with back filled data
            for (let i = 1; i < index; i++) {
                const vPrev = list[i - 1];
                const vCurr = list[i];
                if (vCurr === undefined) {
                    list[i] = vPrev;
                }
            }

            for (let i = index - 2; i >= 0; i--) {
                const vPrev = list[i + 1];
                const vCurr = list[i];
                if (vCurr === undefined) {
                    list[i] = vPrev;
                }
            }
        });

        series.forEach((s, i) => {
            s.label = fields[i - 1] || 'time';

            if (i !== 0) {
                const color = colors[(i - 1) % colors.length];
                s.stroke = color;
                s.points.fill = color;
            }
        });

        return <UPlotComponent
            data={graphData}
            options={plotOptions}
            series={series}
            dataRevision={this.range.join('|') + animator?.loading + '|' + animator?.stale}
            seriesRevision={fields.join('|') + colors.join('|')}

            style={{
                width: '100%',
                height: '150px',
            }}
        />;
    }

    componentWillUnmount() {
        const index = runArray.indexOf(this);
        if (index !== -1) {
            runArray.splice(index, 1);
        }
    }
}

export class LabeledTelemetryAnimatorGraph extends React.Component<any, any> {
    constructor(props) {
        super(props);
        this.state = { labelData: [] };
    }

    render() {
        const { props, state } = this;
        const { labelData } = state;
        const { fields = [], colors = ['#000'], labels = [], animator } = props;

        const elements = ['time', ...fields].map((field, i) => {
            const info = labelData[i];
            const isTime = field === 'time';

            let value;
            if (info) {
                value = info.value;
            } else if (animator) {
                if (isTime) {
                    value = animator.time;
                } else if (Array.isArray(field)) {
                    value = animator.state;
                    for (let j = 0, lj = field.length; value && j < lj; j++) {
                        value = value[field[j]];
                    }
                    if (typeof value === 'object') {
                        value = undefined;
                    }
                } else {
                    value = animator.state[field];
                }
            }

            if (value === undefined) {
                value = '--';
            } else {
                value = value.toFixed(3);
            }

            let name;
            if (labels[i - 1]) {
                name = labels[i - 1];
            } else {
                name = Array.isArray(field) ? field.join('.') : field;
            }
            return <div key={name} title={name} style={{
                width: '50%',
                display: 'inline-flex',
                fontFamily: 'monospace',
            }}>
                <div style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '10px',
                    background: isTime ? 'transparent' : colors[(i - 1) % colors.length],
                    display: 'inline-block',
                    marginRight: '5px',
                    marginTop: '4px',
                }}></div>

                <div style={{
                    display: 'inline-block',
                    width: '40%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}>
                    {name}
                </div>
                <div style={{
                    display: 'inline-block',
                    overflow: 'hidden',
                    width: '60%',
                    whiteSpace: 'pre',
                }}>: {value}</div>
            </div>;
        });

        return <div style={{ position: 'relative', background: 'rgba(255, 255, 255, 0.05)', marginBottom: '5px', padding: '5px' }}>
            <TelemetryAnimatorGraph
                {...props}
                colors={colors}
                onHover={({ labels }) => {
                    this.setState({ labelData: labels });
                }}
            />
            {elements}
        </div>;
    }
}
