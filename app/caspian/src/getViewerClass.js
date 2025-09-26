import { AnimatedViewer as Viewer } from '@gov.nasa.jpl.honeycomb/core/src/AnimatedViewer';
import { ViewCubeViewerMixin, FocusCamViewerMixin, TightShadowViewerMixin } from '@gov.nasa.jpl.honeycomb/scene-viewers';

// Separated from config.js because it imports three.js example modules which cause jest to break
// and for some reason it will not convert it... Defering to figure this out another time.
export function getViewerClass(config) {
    const rendererOptions = config.options;

    let ViewerClass = FocusCamViewerMixin(TightShadowViewerMixin(Viewer));
    if (rendererOptions.viewCube) {
        ViewerClass = ViewCubeViewerMixin(ViewerClass);
    }

    return ViewerClass;
}
