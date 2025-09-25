import React, { Component } from 'react';
import uPlot from 'uplot';
import { embedUPlotStyles } from './embedUPlotStyles.js';

export class UPlotComponent extends Component {
    constructor(...args) {
        super(...args);

        this.uPlot = null;
        this.container = null;
        embedUPlotStyles();
    }

    _recreatePlot() {
        const { container, props } = this;
        if (! container) {
            return;
        }

        const {
            options,
            data,
            series,
        } = props;

        if (this.uPlot) {
            this.uPlot.destroy();
        }

        this.uPlot = new uPlot({
            ...options,
            series,
        }, data, container);

        this.uPlot.setData(data);
    }


    shouldComponentUpdate(nextProps) {
        const { uPlot, props } = this;
        const {
            data,
            series,
            options,

            dataRevision,
            optionsRevision,
            seriesRevision,
        } = props;

        if (
            optionsRevision !== nextProps.optionsRevision ||
            options !== nextProps.options
        ) {
            this._recreatePlot();
        } else if (uPlot) {
            if (
                seriesRevision !== nextProps.seriesRevision ||
                series !== nextProps.series
            ) {
                const seriesCount = uPlot.series.length;
                for (let i = seriesCount - 1; i >= 0; i --) {
                    uPlot.delSeries(i);
                }

                const nextSeries = nextProps.series;
                const newSeriesCount = nextSeries.length;
                for (let i = 0; i < newSeriesCount; i ++) {
                    uPlot.addSeries(nextSeries[i]);
                }
            }

            if (
                dataRevision !== nextProps.dataRevision ||
                data !== nextProps.data
            ) {
                uPlot.setData(nextProps.data);
            }
        }
        return true;
    }

    render() {
        const { style, className } = this.props;

        return <div
            ref={el => this.container = el}
            style={style}
            className={className}
        ></div>;
    }

    componentDidMount() {
        const { container } = this;
        this._recreatePlot();

        const resizer = new ResizeObserver(entry => {
            const contentRect = entry[0].contentRect;

            this.uPlot.setSize({
                width: contentRect.width,
                height: contentRect.height,
            });

            this.uPlot.__contentRect = entry[0].contentRect;
        });
        resizer.observe(container);
        this.resizer = resizer;
    }

    componentWillUnmount() {
        if (this.resizer) {
            this.resizer.disconnect();
            this.resizer = null;
        }

        this.uPlot.destroy();
        this.uPlot = null;
    }
}
