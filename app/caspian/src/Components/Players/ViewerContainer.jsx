import React, { Component } from 'react';
import { Debouncer } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';

export class ViewerContainer extends Component {
    constructor(props) {
        super(props);

        if (typeof ResizeObserver === 'undefined') {
            throw new Error(
                'ViewContainer : ViewContainer relies on ResizeObserver which is not supported by this browser. Install polyfill.',
            );
        }

        this.lastContentRect = null;
        this.debouncer = new Debouncer();
        this.resizeObserver = new ResizeObserver(entry => {
            this.lastContentRect = entry[0].contentRect;
            this.updateSize();
        });
    }

    updateSize = () => {
        // TODO: delaying this by 1 frame causes the display lag by one frame because we render, update the observer,
        // then resize the canvas before the next render. It might be best to use CSS to center the canvas rather than
        // resizing the canvas. Or it can just be css-centered for a single frame.

        const debouncer = this.debouncer;
        const contentRect = this.lastContentRect;
        const viewer = this.props.viewer;
        const domElement = viewer.renderer.domElement;

        // resize the canvas immediately to avoid as much visual jumping as possible
        domElement.style.width = contentRect.width + 'px';
        domElement.style.height = contentRect.height + 'px';

        debouncer.run('resize', () => {
            const contentRect = this.lastContentRect;
            viewer.setPixelRatio(window.devicePixelRatio);
            viewer.setSize(contentRect.width, contentRect.height);

            if (viewer.isOptimizedViewer) {
                viewer.optimizer.restart();
            }
        });
    }

    render() {
        return <div style={this.props.style || {}} ref={el => (this._viewerContainer = el)} />;
    }

    componentDidMount() {
        const container = this._viewerContainer;
        const viewer = this.props.viewer;
        const domElement = viewer.domElement;
        const resizeObserver = this.resizeObserver;

        container.appendChild(domElement);
        resizeObserver.observe(container);

        viewer.setSize(container.offsetWidth, container.offsetHeight);
        viewer.setPixelRatio(window.devicePixelRatio);

        // pixel ratio changes trigger a window resize event
        window.addEventListener('resize', this.updateSize);
    }

    componentDidUpdate(prevProps) {
        const prevViewer = prevProps.viewer;
        const viewer = this.props.viewer;

        if (prevViewer !== viewer) {
            prevViewer.domElement.remove();

            const container = this._viewerContainer;
            const domElement = viewer.domElement;
            container.appendChild(domElement);

            const contentRect = this.lastContentRect;
            if (contentRect) {
                viewer.setSize(contentRect.width, contentRect.height);

                if (viewer.isOptimizedViewer) {
                    viewer.optimizer.restart();
                }
            }
        }
    }

    componentWillUnmount() {
        this.resizeObserver.disconnect();
        window.removeEventListener('resize', this.updateSize);
    }
}
