import { useCallback, useEffect, useState } from "react";
import { Group } from "three";

import { loadModel, modelLoaderRegistry, type ModelLoader } from "@gov.nasa.jpl.honeycomb/core/src/Loaders";
import { ModelSceneObject } from "@gov.nasa.jpl.honeycomb/core";

import { SceneEntityLoaderProps } from "./SceneLoaderCommon";
import { EventWatcher } from "./EventWatcher";

const MODEL_LOADER_EVENTS = ['registerLoader', 'unregisterLoader']
export const SceneModelLoader: React.FC<SceneEntityLoaderProps<ModelSceneObject>> = ({
    obj,
    manager,
    setObject,
    setError
}) => {
    const [loader, setLoader] = useState<ModelLoader>();

    // We really don't want to reload the model if the object has not changed
    // Cache the options here to force react to do a deep compare of the options
    const [cachedOptions, setCachedOptions] = useState<string>(JSON.stringify(obj.model.options));

    const refreshLoader = useCallback(() => {
        setLoader(modelLoaderRegistry.getFromPath(obj.model.path, obj.model.type));
    }, [obj.model.path, obj.model.type]);

    useEffect(() => {
        refreshLoader();
    }, [obj.model.path, refreshLoader]);

    useEffect(() => {
        setCachedOptions(JSON.stringify(obj.model.options));
    }, [obj.model.options])

    // Load actual object
    useEffect(() => {
        const load = async () => {
            try {
                const loaderResult = await loadModel(
                    obj.model.type,
                    obj.model.path,
                    cachedOptions ? JSON.parse(cachedOptions) : undefined,
                    manager
                );


                let newObj3d;
                if (Array.isArray(loaderResult)) {
                    const group = new Group();
                    for (const obji of loaderResult) {
                        group.add(obji);
                    }
                    newObj3d = group;
                } else {
                    newObj3d = loaderResult;
                }

                setObject(newObj3d);
                setError(null);
            } catch (err) {
                setObject(null);
                setError(`${err}`);
            }
        }

        load();
    }, [loader,
        obj.id,
        obj.model.type,
        obj.model.path,
        cachedOptions,
        manager,
        setObject,
        setError
    ]);

    return (
        <EventWatcher
            target={modelLoaderRegistry}
            events={MODEL_LOADER_EVENTS}
            onEventFired={refreshLoader}
        />
    );
}
