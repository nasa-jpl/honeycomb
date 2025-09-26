import React, { Component } from 'react';

const EMPTY_ARRAY = [];
class EventWatcher extends Component<any, any> {
    _triggerCallback: (e) => void;

    constructor(props) {
        super(props);

        this._triggerCallback = e => this.props.onEventFired(e);
    }

    addViewerEvents(target, events) {
        events.forEach(e => target.addEventListener(e, this._triggerCallback));
    }

    removeViewerEvents(target, events) {
        events.forEach(e => target.addEventListener(e, this._triggerCallback));
    }

    updateEventRegistration(prevProps = null) {
        const nextProps = this.props;
        const nextTarget = nextProps.target;
        const prevTarget = prevProps && prevProps.target;

        const nextEvents = nextProps.events || EMPTY_ARRAY;
        const prevEvents = (prevProps && prevProps.events) || EMPTY_ARRAY;

        if (nextTarget !== prevTarget) {
            if (prevTarget) {
                this.removeViewerEvents(prevTarget, prevEvents);
            }

            if (nextTarget) {
                this.addViewerEvents(nextTarget, nextEvents);
            }
        } else if (nextTarget && nextEvents !== prevEvents && nextEvents.join() !== prevEvents.join()) {
            this.removeViewerEvents(nextTarget, prevEvents);
            this.addViewerEvents(nextTarget, nextEvents);
        }

        return true;
    }

    render() {
        return null;
    }

    componentDidMount() {
        this.updateEventRegistration();
    }

    componentDidUpdate(prevProps) {
        this.updateEventRegistration(prevProps);
    }
}

export { EventWatcher };
