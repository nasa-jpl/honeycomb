import { useCallback, useEffect } from 'react';

import { EditorProps } from "../../editors/common";
import { ThresholdsEditor } from '../../editors/ThresholdsEditor';

import { ColorMapLUT } from "./colormaps";
import { IconButton, Select, Stack } from "@grafana/ui";
import { SelectableValue, ThresholdsConfig } from '@grafana/data';

export enum ColorMapType {
    gnuplot = 'gnuplot',
    lut = 'lut',
    thresholds = 'thresholds'
}

export interface LUTColorMap {
    type: ColorMapType.lut;
    lut: ColorMapLUT;
}

export interface GnuPlotColorMap {
    type: ColorMapType.gnuplot;
    red: number;
    green: number;
    blue: number;
    opacity: number;
}

export interface ThresholdsColorMap extends ThresholdsConfig {
    type: ColorMapType.thresholds;
    gradient: boolean;
}

export type ColorMap = (
    LUTColorMap
    | GnuPlotColorMap
    | ThresholdsColorMap
);

const selectOptions: Array<SelectableValue<ColorMap['type']>> = [
    {
        value: ColorMapType.lut,
        label: 'LUT',
        description: 'Linear lookup tables from MATLAB. Maps color values from 0-255.'
    },
    {
        value: ColorMapType.gnuplot,
        label: 'GNU Plot',
        description: 'TODO description'
    },
    {
        value: ColorMapType.thresholds,
        label: 'Thresholds',
        description: 'Custom thresholded colors with optional gradients'
    }
];

const lutOptions: Array<SelectableValue<ColorMapLUT>> = [
    ...Object.keys(ColorMapLUT).map((k) => ({
        label: k,
        value: k as unknown as ColorMapLUT
    }))
];

export const ColorMapEditor: React.FC<EditorProps<ColorMap>> = ({
    value,
    onChange
}) => {
    useEffect(() => {
        if (!value) {
            onChange({
                type: ColorMapType.lut,
                lut: ColorMapLUT.MATLAB_jet
            })
        }
    }, [onChange, value]);

    const onCopy = useCallback(() => {
        navigator.clipboard.writeText(JSON.stringify(value, undefined, 4))
    }, [value]);

    const onPaste = useCallback(() => {
        navigator.clipboard.readText().then((t) => {
            try {
                const j = JSON.parse(t);
                if (!Object.values(ColorMapType).includes(j?.type)) {
                    throw new Error('Invalid colormap');
                }

                onChange(j);
            } catch (e) {
                // Should we notify the user this is not a valid colormap?
            }
        })
    }, [onChange]);

    return (
        <Stack direction="column">
            <Stack direction="row">
                <Select
                    value={value?.type}
                    onChange={(sel) => onChange({ type: sel.value })}
                    options={selectOptions}
                />
                {value?.type === ColorMapType.lut ? (
                    <Select
                        options={lutOptions}
                        value={value?.lut ?? ColorMapLUT.MATLAB_jet}
                        onChange={({ value: lut }) => onChange({ ...value, lut })}
                    />
                ) : null}
                <IconButton
                    name='copy'
                    onClick={onCopy}
                    aria-label='Copy'
                    tooltip='Copy colormap'
                />
                <IconButton
                    name='clipboard-alt'
                    onClick={onPaste}
                    aria-label='Paste'
                    tooltip='Paste colormap'
                />
            </Stack>
            {value?.type === ColorMapType.thresholds ? (
                <ThresholdsEditor
                    value={value}
                    absoluteOnly={false}
                    onChange={(diff) => onChange({ ...value, ...diff })}
                />
            ) : null}

            <>{/* // TODO(tumbar) Display precomputed colormap as a canvas */}</>
        </Stack>
    )
}
