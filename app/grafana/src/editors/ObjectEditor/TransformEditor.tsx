import React from "react";
import { Collapse, Field, RadioButtonGroup } from "@grafana/ui";
import type { SelectableValue } from "@grafana/data";

import { ChannelSchemaType, KinematicChannel, Orientation, OrientationConvention, Position } from "@gov.nasa.jpl.honeycomb/core";

import type { EditorProps } from "../common";
import { ChannelEditor } from "../ChannelEditor";

function mergeChannelDiff(current: Partial<KinematicChannel | undefined>, diff: Partial<KinematicChannel>): KinematicChannel {
    return {
        ...current,
        ...diff
    } as KinematicChannel;
}

export const PositionFieldEditor: React.FC<EditorProps<Position>> = ({
    value,
    onChange
}) => (
    <Collapse label="Position" isOpen>
        <ChannelEditor type={ChannelSchemaType.number} name="X" value={value.x} onChange={(diff) => onChange({ x: mergeChannelDiff(value.x, diff) })} />
        <ChannelEditor type={ChannelSchemaType.number} name="Y" value={value.y} onChange={(diff) => onChange({ y: mergeChannelDiff(value.y, diff) })} />
        <ChannelEditor type={ChannelSchemaType.number} name="Z" value={value.z} onChange={(diff) => onChange({ z: mergeChannelDiff(value.z, diff) })} />
    </Collapse>
);

const orientationConventionOptions: Array<SelectableValue<OrientationConvention>> = [
    {
        label: 'JPL',
        value: OrientationConvention.jpl,
        description: 'Quaternion JPL Convention (ij = k)'
    },
    {
        label: 'Hamilton',
        value: OrientationConvention.hamilton,
        description: 'Quaternion Hamilton Convention (ij = -k)'
    },
    {
        label: 'RPY',
        value: OrientationConvention.rpy,
        description: 'Roll pitch yaw (euler angles)'
    }
];

export const OrientationFieldEditor: React.FC<EditorProps<Orientation>> = ({
    value,
    onChange
}) => (
    <Collapse label="Orientation" isOpen>
        <Field label="Convention">
            <RadioButtonGroup
                options={orientationConventionOptions}
                value={value.type}
                onChange={(value) => onChange({ type: value })}
            />
        </Field>
        <ChannelEditor type={ChannelSchemaType.number} name="X" value={value.x} onChange={(diff) => onChange({ x: mergeChannelDiff(value.x, diff) })} />
        <ChannelEditor type={ChannelSchemaType.number} name="Y" value={value.y} onChange={(diff) => onChange({ y: mergeChannelDiff(value.y, diff) })} />
        <ChannelEditor type={ChannelSchemaType.number} name="Z" value={value.z} onChange={(diff) => onChange({ z: mergeChannelDiff(value.z, diff) })} />
        {
            value.type !== OrientationConvention.rpy ? (
                <ChannelEditor type={ChannelSchemaType.number} name="W" value={value.w} onChange={(diff) => onChange({ w: mergeChannelDiff(value.w, diff) })} />
            ) : null
        }
    </Collapse>
);
