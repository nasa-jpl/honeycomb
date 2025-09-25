import { createContext, useContext } from "react";
import type { Viewer as BaseViewer } from "@gov.nasa.jpl.honeycomb/scene-viewers";
import type { LoadingManager, Viewer } from "@gov.nasa.jpl.honeycomb/core";
import { Registry } from "./Registry";
import { AnnotationRegistryItem } from "./Annotation";

export interface HoneycombContextState<ViewerT extends BaseViewer = Viewer> {
    viewer: ViewerT;
    manager: LoadingManager;
    annotations?: Registry<AnnotationRegistryItem<any>, any>;
}

export const HoneycombContext = createContext<HoneycombContextState<BaseViewer>>(null!);

export function useHoneycomb<ViewerT extends BaseViewer = Viewer>(): HoneycombContextState<ViewerT> {
    return useContext(HoneycombContext) as HoneycombContextState<ViewerT>;
}

export const PlayerBarHoverContext = createContext<boolean>(false);

export function usePlayerBarHover() {
    return useContext(PlayerBarHoverContext);
}

export interface AppError {
    title: string;
    message: string;
}

export interface AppContextState {
    title?: string;
    errors: AppError[];
    addError: (err: AppError) => { dispose(): void; };
    removeError: (err: AppError) => void;
    loadPercent: number;
}

export const AppContext = createContext<AppContextState>(null!);

export function useHoneycombApp() {
    return useContext(AppContext);
}
