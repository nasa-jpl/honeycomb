import { Loaders, LoadingManager } from '@gov.nasa.jpl.honeycomb/core';
import { LoaderUtils, Object3D } from 'three';
import type { URDFOptions } from './urdfModelLoader';

function loadXacro(path: string, options: Partial<URDFOptions>, manager: LoadingManager): Promise<Object3D> {
    return new Promise((resolve, reject) => {
        import('xacro-parser/src/XacroLoader.js').then(({ XacroLoader }) => {
            const loader = new XacroLoader();
            manager.itemStart(path);

            const packages = options.packages || {};
            Object.assign(
                loader,
                {
                    rospackCommands: {
                        find: function (pkg: string) {
                            if (typeof packages === "function") {
                                return packages(pkg);
                            } else if (pkg in packages) {
                                return packages[pkg] as any;
                            } else {
                                return null;
                            }
                        },
                    }
                },
                options,
            );

            const resolvedPath = manager.resolveURL(path);
            loader.load(
                resolvedPath,
                xml => {
                    const serializer = new XMLSerializer();
                    const xmlContent = serializer.serializeToString(xml);

                    const workingPath = LoaderUtils.extractUrlBase(path);
                    const urdfOptions = Object.assign(
                        {
                            workingPath,
                            packages,
                        },
                        options,
                    );

                    Loaders.parseModel('urdf', xmlContent, urdfOptions, manager).then(model => {
                        resolve(model as Object3D);
                        manager.itemEnd(path);
                    });
                },
                err => {
                    reject(err);
                },
            );
        });
    });
}

export { loadXacro };
