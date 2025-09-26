import React, { Component, Fragment } from 'react';
import { MuiThemeProvider, createTheme } from '@material-ui/core';
import { StylesProvider } from '@material-ui/styles';
import { Debouncer } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';
import HoneycombLoadWrapper from './HoneycombLoadWrapper';
import { EventWatcher } from '../EventWatcher';

const defaultTheme = createTheme({
    root: {
        color: '#fff',
    },
    palette: {
        primary: { main: '#fff' },
        secondary: { main: '#52c7b8' },
        type: 'dark',
        background: {
            // color the popover and menu backgrounds
            paper: '#2b373e',
        },
    },
    color: '#fff',
});

const VIEWER_EVENTS = ['change', 'vrdisplayconnectionchange', 'toggle-tag'];
const ANIMATOR_EVENTS = ['change', 'added-frames', 'keyframe-progress', 'connected', 'disconnected'];
const MANAGER_EVENTS = ['start', 'progress', 'complete', 'error'];
const ERROR_EVENTS = ['error'];
export default class extends Component<any, any> {
    _forceUpdate: () => void;
    debouncer: Debouncer;

    constructor(props) {
        super(props);

        this.state = { errors: [] };

        const debouncer = new Debouncer();
        const callback = () => this.forceUpdate();
        this._forceUpdate = () => debouncer.run('rerender', callback, Infinity);
        this.debouncer = debouncer;
    }

    onAddError = e => {
        const errors = this.state.errors;
        let err = e.error;
        if (!(err instanceof Error)) {
            err = new Error(err);
        }

        errors.push(err);
        console.error(err);
        this.setState({ errors });
    };

    onClearErrors = () => {
        this.setState({ errors: [] });
    };

    render() {
        const state = this.state;
        const { errors } = state;

        const props = this.props;
        const { viewer, manager, componentType, title, theme, ...rest } = props;

        const ComponentType = componentType;

        let loadPercent = 1;
        let managerEventWatchers = null;
        let viewerEventWatchers = null;
        if (manager) {
            loadPercent = manager.total === 0 ? 1.0 : Math.min(manager.loaded / manager.total, 1.0);
            managerEventWatchers = (
                <Fragment>
                    <EventWatcher
                        target={manager}
                        events={MANAGER_EVENTS}
                        onEventFired={this._forceUpdate}
                    />
                    <EventWatcher
                        target={manager}
                        events={ERROR_EVENTS}
                        onEventFired={this.onAddError}
                    />
                </Fragment>
            );
        }

        if (viewer) {
            viewerEventWatchers = (
                <Fragment>
                    <EventWatcher
                        target={viewer}
                        events={VIEWER_EVENTS}
                        onEventFired={this._forceUpdate}
                    />
                    <EventWatcher
                        target={viewer.animator}
                        events={ANIMATOR_EVENTS}
                        onEventFired={this._forceUpdate}
                    />
                    <EventWatcher
                        target={viewer}
                        events={ERROR_EVENTS}
                        onEventFired={this.onAddError}
                    />
                </Fragment>
            );
        }

        return (
            <StylesProvider injectFirst>
                <MuiThemeProvider theme={theme || defaultTheme}>
                    {managerEventWatchers}
                    {viewerEventWatchers}
                    <HoneycombLoadWrapper
                        title={title}
                        errors={errors}
                        loadPercent={loadPercent}
                        onClearErrors={this.onClearErrors}
                    >
                        <ComponentType {...rest} viewer={viewer} />
                    </HoneycombLoadWrapper>
                </MuiThemeProvider>
            </StylesProvider>
        );
    }

    componentWillUnmount() {
        // ensure we don't call force update after the component has been unmounted
        this.debouncer.cancelAll();
    }
}
