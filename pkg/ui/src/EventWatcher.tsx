import { useEffect } from 'react';

import {
    type HoneycombEvent,
    type IEventDispatcher
} from '@gov.nasa.jpl.honeycomb/event-dispatcher';

interface EventWatcherProps {
    onEventFired: (e: HoneycombEvent | any) => void;
    target: IEventDispatcher;
    events: string[];
}

export const EventWatcher: React.FC<EventWatcherProps> = ({
    onEventFired,
    target,
    events,
}) => {
    useEffect(() => {
        const disp = target;
        for (const event of events) {
            disp.addEventListener(event as never, onEventFired);
        }

        return () => {
            for (const event of events) {
                disp.removeEventListener(event as never, onEventFired);
            }
        };
    }, [events, target, onEventFired]);

    return null;
}
