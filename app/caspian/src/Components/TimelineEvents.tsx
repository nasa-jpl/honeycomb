import React, { PureComponent } from 'react';
import { EventMarker } from './EventMarker';
import * as styles from './styles/TimelineEvents.css';

export class TimelineEvents extends PureComponent<any, any> {
    /* Life Cycle Functions */
    render() {
        const { start, end, events, onClick } = this.props;

        // group events that are within 1% of the specified time span
        const dur = end - start;
        const timeFiltered = events.filter(elem => {
            return elem.time >= start && elem.time <= end;
        });
        const regroup = timeFiltered.reduce((acc, el) => {
            if (acc.length > 0) {
                const prevI = acc.length - 1;
                const prev = acc[prevI];
                const prevOffset = (prev.time - start) / dur;
                const offset = (el.time - start) / dur;

                if (offset - prevOffset < 0.01) {
                    prev.state.events = prev.state.events.concat(el.state.events);
                } else {
                    acc.push(el);
                }
            } else {
                acc.push(el);
            }
            return acc;
        }, []);

        return (
            <div className={styles.root}>
                {regroup.map((evt, i) => (
                    <EventMarker
                        key={`evt_marker_${i}`}
                        start={start}
                        end={end}
                        event={evt}
                        onClick={onClick}
                    />
                ))}
            </div>
        );
    }
}
