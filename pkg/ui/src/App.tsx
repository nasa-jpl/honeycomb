import React, {
    useCallback,
    useEffect,
    useReducer,
    useRef,
    useState
} from 'react';

import { Debouncer } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';

import { EventWatcher } from './EventWatcher';

import {
    AppContext,
    AppError,
    HoneycombContext,
    HoneycombContextState
} from './Context';

import { HoneycombEvent } from '@gov.nasa.jpl.honeycomb/event-dispatcher';

interface HoneycombAppProps extends HoneycombContextState {
    title?: string;
}

const MANAGER_EVENTS = ['start', 'progress', 'complete', 'error'];
const ERROR_EVENTS = ['error'];

export function App({
    title,
    children,
    ...honeycombContext
}: React.PropsWithChildren<HoneycombAppProps>) {
    const [, forceUpdate] = useReducer(x => x + 1, 0);
    const [errors, setErrors] = useState<AppError[]>([]);
    const debouncer = useRef(new Debouncer());

    const forceUpdateDebounced = useCallback(() => {
        debouncer.current.run('rerender', () => forceUpdate(), Infinity);
    }, []);

    useEffect(() => {
        return () => {
            // ensure we don't call force update after the component has been unmounted
            debouncer.current.cancelAll();
        }
    }, []);

    const { manager, viewer } = honeycombContext;
    const loadPercent = manager.total === 0 ? 1.0 : Math.min(
        manager.loaded / manager.total, 1.0
    );

    const onRemoveError = useCallback((e: AppError) => {
        setErrors(errors.filter(v => e !== v));
    }, [errors]);

    const onAddErrorFromContext = useCallback((e: AppError) => {
        errors.push(e);
        setErrors([...errors]);

        return {
            dispose: () => onRemoveError(e),
        };
    }, [errors]);

    const onAddErrorEvent = useCallback((title: string, e: HoneycombEvent) => {
        let err = e.error;
        if (!(err instanceof Error)) {
            err = new Error(err as any);
        }

        console.error(err);
        onAddErrorFromContext({ title, message: (err as Error).message })
    }, [onAddErrorFromContext]);

    return (
        <HoneycombContext.Provider value={honeycombContext}>
            <AppContext.Provider value={{
                title,
                loadPercent,
                errors,
                addError: onAddErrorFromContext,
                removeError: onRemoveError,
            }}>
                <EventWatcher
                    target={manager}
                    events={MANAGER_EVENTS}
                    onEventFired={forceUpdateDebounced}
                />
                <EventWatcher
                    target={manager}
                    events={ERROR_EVENTS}
                    onEventFired={(e) => onAddErrorEvent("Loading manager error", e)}
                />
                <EventWatcher
                    target={viewer}
                    events={ERROR_EVENTS}
                    onEventFired={(e) => onAddErrorEvent("Viewer error", e)}
                />
                {children}
            </AppContext.Provider>
        </HoneycombContext.Provider>
    );
}