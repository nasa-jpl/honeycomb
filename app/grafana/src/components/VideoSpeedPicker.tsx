import { useMemo, useState } from 'react';
import { ToolbarButton, Toggletip, Slider } from '@grafana/ui';

export interface VideoSpeedPickerProps {
    value: number;
    onChange: (value: number) => void;
}

export function VideoSpeedPicker({ value, onChange }: VideoSpeedPickerProps) {
    const [isOpen, setIsOpen] = useState(false);

    const marks = useMemo(() => ({
        1: "1",
        2: "2",
        5: "5",
        10: "10",
        20: "20"
    }), []);

    return (
        <Toggletip
            closeButton={false}
            placement='top-end'
            onOpen={() => setIsOpen(true)}
            onClose={() => setIsOpen(false)}
            content={
                <div style={{ width: '350px', marginTop: '-16px', marginBottom: '-16px' }}>
                    <Slider value={value} onChange={onChange} min={0} max={20} marks={marks} />
                </div>
            }
        >
            <ToolbarButton
                tooltip='Playback speed'
                aria-controls="TimePickerContent"
                icon='angle-double-right'
                isOpen={isOpen}
                variant='canvas'
            >
                {value.toFixed(0)}x
            </ToolbarButton>
        </Toggletip>
    );
}

VideoSpeedPicker.displayName = 'VideoSpeedPicker';
