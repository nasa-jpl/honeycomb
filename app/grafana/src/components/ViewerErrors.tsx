import React, { useEffect, useState } from 'react';

import {
    ToolbarButton,
    Toggletip,
    Stack,
    Label,
    IconButton
} from '@grafana/ui';

import { useHoneycombApp } from '@gov.nasa.jpl.honeycomb/ui';

interface ViewerErrorProps {
    height: number;
}

export function ViewerErrors({
    height,
}: ViewerErrorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { errors, removeError } = useHoneycombApp();

    useEffect(() => {
        if (errors.length === 0) {
            setIsOpen(false);
        }
    }, [errors]);

    if (errors.length === 0) {
        return null;
    }

    return (
        <React.Fragment>
            <Toggletip
                closeButton={false}
                placement='top-end'
                onOpen={() => setIsOpen(true)}
                onClose={() => setIsOpen(false)}
                fitContent
                content={
                    <div style={{
                        overflowY: 'auto',
                        maxHeight: `calc(${height}px - 10em`,
                        marginTop: '-16px',
                        marginBottom: '-16px',
                        marginRight: '-16px'
                    }}>
                        <Stack direction="column">
                            {errors.map((err, idx) => (
                                <Stack key={idx} direction="row">
                                    <Label style={{ flex: 1 }}>{err.message}</Label>
                                    <IconButton
                                        name="times"
                                        aria-label='Clear'
                                        onClick={() => removeError(err)}
                                    />
                                </Stack>
                            ))}
                        </Stack>
                    </div>
                }
            >
                <ToolbarButton
                    aria-controls="ViewerErrors"
                    icon='exclamation-triangle'
                    isOpen={isOpen}
                    variant='destructive'
                />
            </Toggletip>
        </React.Fragment>
    );
}
