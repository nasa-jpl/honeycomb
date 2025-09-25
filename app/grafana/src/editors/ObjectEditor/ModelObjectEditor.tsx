import { useCallback, useEffect, useMemo, useState } from "react";
import Validator from '@rjsf/validator-ajv8/lib/validator';
import { URDFRobot } from "urdf-loader";

import { type SelectableValue } from "@grafana/data";

import {
    Field,
    Input,
    Stack,
    Label,
    Select,
    Switch,
    Collapse,
    MultiSelect,
} from "@grafana/ui";

import { EventWatcher } from "@gov.nasa.jpl.honeycomb/ui";

import {
    ChannelSchemaType,
    ChannelType, KinematicChannel,
    LoadingManager,
    ModelSceneObject
} from "@gov.nasa.jpl.honeycomb/core";

import { ModelLoader, modelLoaderRegistry } from "@gov.nasa.jpl.honeycomb/core/src/Loaders";

import GrafanaForm from '../GrafanaForm';

import type { EditorProps } from "../common";
import { ChannelEditor } from "../ChannelEditor";


const MODEL_LOADER_EVENTS = ['registerLoader', 'unregisterLoader']

const validator = new Validator({});
const urdfPrefetchManager = new LoadingManager();

// Used through out M20FSW to denote an invalid or infinite value
export const EFFECTIVELY_INFINITE_LIMIT = 1.79769e+308;

function jointLimitFinite(limit: number) {
    return Math.abs(limit) < EFFECTIVELY_INFINITE_LIMIT;
}

const URDFJointsEditor: React.FC<
    EditorProps<ModelSceneObject> & {
        loader: ModelLoader;
    }
> = ({ value, onChange, loader }) => {

    const [isOpen, setIsOpen] = useState(false);
    const [obj3d, setObj3d] = useState<URDFRobot>();
    const [options, setOptions] = useState<Array<SelectableValue<string>>>();
    const [optionsLoading, setOptionsLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string>();

    const onCollapseToggle = useCallback(() => {
        setIsOpen((v) => !v);
    }, []);

    const loadJointOptions = useCallback(async () => {
        try {
            const obj3d = await loader.load(value.model.path, value.model.options, urdfPrefetchManager);
            setFetchError(undefined);
            setObj3d(obj3d as URDFRobot);

            return Object.entries((obj3d as URDFRobot).joints).map(([jointName, joint]) => {
                const shouldIgnoreLimits = joint.ignoreLimits || joint.limit.lower >= joint.limit.upper;

                const hasLimit = !shouldIgnoreLimits && (
                    jointLimitFinite(joint.limit.lower as number) ||
                    jointLimitFinite(joint.limit.upper as number)
                );

                return {
                    value: jointName,
                    label: jointName,
                    description: hasLimit ? `min: ${joint.limit.lower}, max: ${joint.limit.upper}` : undefined
                } satisfies SelectableValue<string>;
            });
        } catch (err) {
            setFetchError(`${err}`);
            setObj3d(undefined);
            throw err;
        }
    }, [loader, value.model.options, value.model.path]);

    useEffect(() => {
        setOptionsLoading(true);
        loadJointOptions()
            .then((v) => setOptions(v))
            .finally(() => {
                setOptionsLoading(false);
            });
    }, [setFetchError, loader, value.model.path, value.model.options, loadJointOptions]);

    const onJointChange = useCallback((jointName: string, channelDiff: Partial<KinematicChannel>) => {
        onChange({
            ...value,
            joints: {
                ...value.joints,
                [jointName]: {
                    constant: 0,
                    type: ChannelType.constant,
                    ...value.joints?.[jointName],
                    ...channelDiff
                } as KinematicChannel
            }
        })
    }, [onChange, value]);

    const selectedJoints = useMemo(() => (
        Object.keys(value.joints ?? {}).map(v => ({ value: v }))
    ), [value.joints]);

    const onSelectedJointChanged = useCallback((selectedJoints: Array<SelectableValue<string>>) => {
        const newJoints: Record<string, KinematicChannel> = {};
        for (const selectedJoint of selectedJoints) {
            newJoints[selectedJoint.value!] = {
                type: ChannelType.constant,
                constant: 0,
                ...value.joints?.[selectedJoint.value!]
            } as KinematicChannel
        }

        onChange({ joints: newJoints });
    }, [value.joints, onChange]);

    const joints = useMemo(() => Object.entries(value.joints ?? {}).map(([jointName, jointChannel]) => {
        const joint = obj3d?.joints[jointName];
        if (joint) {
            const shouldIgnoreLimits = joint.ignoreLimits || joint.limit.lower >= joint.limit.upper;

            const hasLimit = !shouldIgnoreLimits && (
                jointLimitFinite(joint.limit.lower as number) ||
                jointLimitFinite(joint.limit.upper as number)
            );

            return (
                <ChannelEditor
                    key={jointName}
                    type={ChannelSchemaType.number}
                    name={jointName}
                    description={hasLimit ? `min: ${joint.limit.lower}, max: ${joint.limit.upper}` : undefined}
                    onChange={(diff) => onJointChange(jointName, diff)}
                    value={jointChannel}
                />
            );
        } else {
            return null;
        }
    }), [obj3d?.joints, onJointChange, value.joints]);

    return (
        <Collapse
            collapsible
            isOpen={isOpen}
            onToggle={onCollapseToggle}
            label="Joints"
        >
            <Field
                label="Mapped joints"
                description="Joints to map to constant or articulated (channelized) value"
                invalid={Boolean(fetchError)}
                error={fetchError}
            >
                <MultiSelect
                    placeholder="Joints"
                    loadingMessage="Loading joints"
                    options={options}
                    isLoading={optionsLoading}
                    onChange={onSelectedJointChanged}
                    cacheOptions={false}
                    value={selectedJoints}
                />
            </Field>


            {joints}
        </Collapse>
    );
}

export const ModelEditor: React.FC<EditorProps<ModelSceneObject>> = ({
    value,
    onChange
}) => {
    const [modelLoaders, setModelLoaders] = useState<Array<SelectableValue<string>>>([]);
    const [autoTypeDetection, setAutoTypeDetection] = useState(true);
    const [pathCache, setPathCache] = useState(value.model?.path);

    useEffect(() => {
        setPathCache(value.model?.path);
    }, [value.model?.path]);

    const onChangeModel = useCallback((diff: Partial<ModelSceneObject['model']>) => {
        onChange({
            model: {
                ...value.model,
                ...diff
            }
        });
    }, [value.model, onChange]);

    const refreshModelLoaders = useCallback(() => {
        setModelLoaders((modelLoaderRegistry.all().map((v) => ({
            label: v.name,
            description: `${v.description ?? ''} (extensions: ${JSON.stringify(v.ext)})`,
            icon: v.icon,
            value: v.name
        }))));
    }, []);

    const onFormDataChange = useCallback((event: any) => {
        onChangeModel({ options: event.formData })
    }, [onChangeModel]);

    const detectedType = useMemo(() => {
        if (value.model?.path) {
            return modelLoaderRegistry.getFromPath(value.model.path)?.name;
        }

        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value.model?.path, modelLoaders]);

    const type = useMemo(() => {
        if (autoTypeDetection) {
            return detectedType;
        } else {
            // Fallback to detected type if not selected
            return value.model?.type ?? detectedType;
        }
    }, [autoTypeDetection, detectedType, value.model?.type])

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const loader = useMemo(() => type ? modelLoaderRegistry.get(type) : undefined, [modelLoaders, type])

    const formContext = useMemo(() => ({
        category: [type]
    }), [type]);

    useEffect(() => {
        refreshModelLoaders();
    });

    return (
        <>
            <EventWatcher
                target={modelLoaderRegistry}
                events={MODEL_LOADER_EVENTS}
                onEventFired={refreshModelLoaders}
            />
            <Field
                label={
                    <Stack direction="row" gap={1}>
                        <Label category={['Model']}>
                            Loader
                        </Label>
                        <div style={{ flex: 1 }} />
                        <Label>Auto</Label>
                        <Switch
                            value={autoTypeDetection}
                            onChange={event => setAutoTypeDetection(event.currentTarget.checked)}
                        />
                    </Stack>
                }
                invalid={!type}
                error="No model loader found"
            >
                <Select
                    value={type}
                    options={modelLoaders}
                    placeholder="Model loader"
                    disabled={autoTypeDetection}
                    onChange={(event) => onChangeModel({ type: event.value })}
                />
            </Field>
            <Field
                label={<Label description="URL of the asset to fetch" category={['Model']}>
                    Asset URL
                </Label>}
            >
                <Input
                    value={pathCache}
                    placeholder="Asset URL"
                    onBlur={(event) => onChangeModel({ path: event.currentTarget.value })}
                    onChange={(event) => setPathCache(event.currentTarget.value)}
                />
            </Field>
            {loader?.optionSchema && <GrafanaForm
                formData={value.model?.options}
                onChange={onFormDataChange}
                schema={loader.optionSchema}
                uiSchema={loader.optionUiSchema}
                formContext={formContext}
                validator={validator}
            />}
            {loader?.name === 'URDF' && <URDFJointsEditor value={value} onChange={onChange} loader={loader} />}
        </>
    )
}
