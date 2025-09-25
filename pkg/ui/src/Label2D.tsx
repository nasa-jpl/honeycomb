import { useEffect, useMemo } from 'react';
import { Object3D } from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import { useHoneycomb } from './Context';

interface Label2DProps {
    parent: Object3D;
    label: string;
    x?: number;
    y?: number;
    z?: number;
}

export const Label2D: React.FC<Label2DProps> = ({
    parent,
    label,
    x, y, z
}) => {
    const { viewer } = useHoneycomb();
    const text = useMemo(() => {
        const text = document.createElement('div');
        text.style.color = '#fff';
        text.style.textShadow = '-1px 1px 1px rgb(0,0,0)';
        return text;
    }, [])

    const css2dObject = useMemo(() => new CSS2DObject(text), [text]);

    useEffect(() => {
        text.textContent = label;
    }, [text, label]);

    useEffect(() => {
        css2dObject?.position.set(x ?? 0, y ?? 0, z ?? 0);
        viewer.dirty = true;
    }, [x, y, z, css2dObject, viewer]);

    useEffect(() => {
        parent.add(css2dObject);
        return () => {
            css2dObject.removeFromParent();
        }
    }, [parent, css2dObject]);

    return null;
}
