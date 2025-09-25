import React, { useState, useEffect } from 'react';
import { Paper, Popper } from '@material-ui/core';

import { DisplayTime, PureTypography } from './Common.jsx';
import * as styles from './styles/TimelineEvents.css';

export function EventMarker(props) {
    const [activeEventTime, setActiveEventTime, clearHook] = useEventMarkerStore();

    const handleClick = e => {
        const { event, onClick } = props;
        onClick(e, event.time);
    };

    const handleMouseOver = e => {
        const { event } = props;
        setActiveEventTime(event.time);
    };

    const handleMouseOut = e => {
        setActiveEventTime(null);
    };

    useEffect(() => () => clearHook(), []);

    const { start, end, event, container } = props;
    const dur = end - start;
    const relTime = event.time - start;
    const offset = (relTime / dur) * 100;
    const refId = `id_evt_marker_${event.time}`;
    const active =
        event.time === activeEventTime ||
        event.state.events.find(el => el.startTime === activeEventTime);

    const popperContainer = container;
    const markerClasses = active ? `${styles.marker} ${styles.markerActive}` : `${styles.marker}`;

    const popper = active ? (
        <Popper
            open={true}
            position="top"
            anchorEl={() => document.getElementById(refId)}
            container={popperContainer}
            modifiers={{
                offset: { offset: '0,10' },
                preventOverflow: {
                    enabled: true,
                    boundariesElement: popperContainer,
                },
            }}
        >
            <Paper elevation={2} className={styles.evtTooltip}>
                <PureTypography
                    variant="body2"
                    className={styles.evtDur}
                    label={<DisplayTime seconds={relTime} />}
                />
                {event.state.events.map((evt, i) => {
                    return (
                        <div key={`evt_tooltip_${i}`} className={styles.evt}>
                            <PureTypography
                                variant="body2"
                                className={styles.evtLabel}
                                label={evt.name}
                            />
                            <PureTypography
                                variant="body2"
                                className={styles.evtDur}
                                label={
                                    <DisplayTime
                                        seconds={evt.endTime - evt.startTime}
                                        humanReadable={true}
                                    />
                                }
                            />
                        </div>
                    );
                })}
            </Paper>
        </Popper>
    ) : null;

    return (
        <React.Fragment>
            <div
                id={refId}
                className={markerClasses}
                style={{ left: `${offset}%` }}
                onClick={handleClick}
                onMouseOver={handleMouseOver}
                onMouseOut={handleMouseOut}
            />
            {popper}
        </React.Fragment>
    );
}

// create a store object for sharing state
const storeEventMarkerStatus = {
    state: null,
    setState(value) {
        this.state = value;
        this.setters.forEach(setter => setter(this.state));
    },
    setters: [],
};

// Bind the setState function to the store object so
// we don't lose context when calling it elsewhere
storeEventMarkerStatus.setState = storeEventMarkerStatus.setState.bind(storeEventMarkerStatus);

// this is the custom hook we'll call on components.
export function useEventMarkerStore() {
    const [stateEventMarkerStatus, set] = useState(storeEventMarkerStatus.state);
    if (!storeEventMarkerStatus.setters.includes(set)) {
        storeEventMarkerStatus.setters.push(set);
    }

    // define a function to clear a set function from the store for when a component unmounts
    const clearEventMarkerStateSetter = function() {
        storeEventMarkerStatus.setters = storeEventMarkerStatus.setters.filter(s => s !== set);
    };

    return [stateEventMarkerStatus, storeEventMarkerStatus.setState, clearEventMarkerStateSetter];
}

export const useEventMarkerSet = storeEventMarkerStatus.setState;
