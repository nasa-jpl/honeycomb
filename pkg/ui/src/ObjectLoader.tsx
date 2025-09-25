import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState
} from "react";

import { Object3D } from "three";

import { useHoneycomb, useHoneycombApp } from "./Context";

interface ObjectLoaderContextValue<TObject3D extends Object3D> {
    /**
     * Push or clear an error from the parent object loader
     * @param error string for error, falsey to clear errors
     */
    setError: (error: string | null) => void;

    /**
     * Push a loaded object up to the object loader
     * @param obj3d object that was loaded
     */
    setObject: (obj3d: TObject3D | null) => void;

    obj3d: TObject3D | null;
}

const ObjectLoaderContext = createContext<ObjectLoaderContextValue<any>>(null!);

export function useObjectLoader<TObject3D extends Object3D>(): ObjectLoaderContextValue<TObject3D> {
    return useContext(ObjectLoaderContext);
}

interface ObjectLoaderProps extends React.PropsWithChildren {
    id: string;
    name: string;
}

export const ObjectLoader: React.FC<ObjectLoaderProps> = ({
    id,
    name,
    children
}) => {
    const [obj3d, setObject] = useState<Object3D | null>(null);
    const [err, setError] = useState<string | null>(null);
    const { viewer } = useHoneycomb();
    const { addError } = useHoneycombApp();

    const objectLoaderContext = useMemo<ObjectLoaderContextValue<any>>(() => ({
        obj3d,
        setObject,
        setError
    }), [obj3d]);

    // Add the obj3d to the scene
    useEffect(() => {
        if (obj3d) {
            viewer.objects[id] = obj3d;
            viewer.dispatchEvent({ type: 'add-object', object: obj3d });
        }

        return () => {
            if (obj3d) {
                obj3d.removeFromParent();
                delete viewer.objects[id];
                viewer.dispatchEvent({ type: 'remove-object', object: obj3d });
            }
        }
    }, [viewer, id, obj3d]);

    useEffect(() => {
        if (err) {
            const disp = addError({
                title: `Failed to load ${name}`,
                message: err
            });

            return () => {
                disp.dispose();
            }
        } else {
            return undefined;
        }
    }, [err]);

    return (
        <ObjectLoaderContext.Provider value={objectLoaderContext}>
            {children}
        </ObjectLoaderContext.Provider>
    );
}
