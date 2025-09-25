import { useEffect } from "react";

import { FrameObject } from "@gov.nasa.jpl.honeycomb/core/src/Loaders";
import { FrameSceneObject } from "@gov.nasa.jpl.honeycomb/core";
import { SceneEntityLoaderProps } from "./SceneLoaderCommon";

export const SceneFrameLoader: React.FC<SceneEntityLoaderProps<FrameSceneObject>> = ({
    obj,
    manager,
    setObject,
    setError
}) => {

    // Load actual object
    useEffect(() => {
        const load = async () => {
            try {
                const newObj3d = new FrameObject();
                setObject(newObj3d);
                setError(null);
            } catch (err) {
                setObject(null);
                setError(`${err}`);
            }
        }

        load();
    }, [obj.id, obj.type, manager, setObject, setError]);

    return null;
}
