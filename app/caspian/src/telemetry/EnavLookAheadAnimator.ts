import { TelemetryAnimator, LookAheadAnimatorMixin } from '@gov.nasa.jpl.honeycomb/telemetry-animator';
import { JobRunner } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';

export class EnavLookAheadAnimator extends LookAheadAnimatorMixin(TelemetryAnimator<any>) {
    isEnavLookAheadAnimator = true;

    directory: string;
    _preloadedFiles: any;
    _jobRunner: JobRunner;
    fetchOptions: any;
    costmapTimes: any;
    heightmapTimes: any;

    constructor(frames, path) {
        super(frames);

        // get directory that the arksml file was in
        let index = path.lastIndexOf('/');
        if (index === -1) {
            index = path.lastIndexOf('\\');
            if (index === -1) {
                throw new Error('badly formatted arksml file path');
            }
        }
        this.directory = path.substring(0, index + 1);

        this._preloadedFiles = {};

        this._jobRunner = new JobRunner();

        this.fetchOptions = { credentials: 'same-origin' };

        this.costmapTimes = [];
        this.heightmapTimes = [];
        this.searchForCostAndHeightMaps();
    }

    searchForCostAndHeightMaps() {
        const costmapTimes = this.costmapTimes;
        const heightmapTimes = this.heightmapTimes;
        let lastCostmapFile = '';
        let lastHeightmapFile = '';
        for (let i = 0; i < this.frames.length; i++) {
            if (this.frames[i].state?.annotations?.length) {
                for (let j = 0; j < this.frames[i].state.annotations.length; j++) {

                    if (this.frames[i].state.annotations[j].type === 'EnavCostmap' &&
                        this.frames[i].state.annotations[j].file !== lastCostmapFile
                    ) {
                        costmapTimes.push(this.frames[i].time);
                        lastCostmapFile = this.frames[i].state.annotations[j].file;
                    }

                    if (this.frames[i].state.annotations[j].type === 'EnavHeightmap' &&
                        this.frames[i].state.annotations[j].file !== lastHeightmapFile
                    ) {
                        heightmapTimes.push(this.frames[i].time);
                        lastHeightmapFile = this.frames[i].state.annotations[j].file;
                    }
                }
            }
        }
    }

    /* Overrides */
    preloadData(state: { annotations: any; }) {
        if (state.annotations) {
            const allAnnotations = state.annotations;
            const promises = [];
            for (let i = 0, l = allAnnotations.length; i < l; i++) {
                switch (allAnnotations[i].type) {
                    case 'EnavCostmap': {
                        let pr = this._preloadBinaryFile(allAnnotations[i]);
                        if (pr) { promises.push(pr); }
                        break;
                    }
                    case 'EnavHeightmap': {
                        let pr = this._preloadBinaryFile(allAnnotations[i]);
                        if (pr) {
                            promises.push(pr);
                        }

                        break;
                    }
                }
            }

            if (promises.length > 0) {
                return promises;
            } else {
                return null;
            }
        }
    }

    processState(state) {
        if (state.annotations) {
            const allAnnotations = state.annotations;
            let modified = false;
            for (let i = 0, l = allAnnotations.length; i < l; i++) {
                // make sure || modified is on the RIGHT side
                // or else it might not call function as an optimization
                switch (allAnnotations[i].type) {
                    case 'EnavCostmap':
                        modified = this._processCostmap(allAnnotations[i]) || modified;
                        break;
                    case 'EnavHeightmap':
                        modified = this._processHeightmap(allAnnotations[i]) || modified;
                        break;
                }
            }

            if (modified) {
                // We copy the array because we've modified it and the diff process does not iterate over arrays
                state.annotations = state.annotations.slice();
                return true;
            }
        }
        return false;
    }

    unloadData(state) {
        if (state.annotations) {
            const allAnnotations = state.annotations;
            for (let i = 0, l = allAnnotations.length; i < l; i++) {
                switch (allAnnotations[i].type) {
                    case 'EnavCostmap':
                        this._unloadCostmap(allAnnotations[i]);
                        break;
                    case 'EnavHeightmap':
                        this._unloadHeightmap(allAnnotations[i]);
                        break;
                }
            }
        }
    }

    /* Private */
    /* Preload functions */
    _preloadFile(annotation): Promise<any> {
        const path = this.directory + annotation.file;
        const controller = new AbortController();

        const obj: any = { references: 1 };
        const signal = controller.signal;
        // checking res.ok here because fetch will only throw if there's a network error
        // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Checking_that_the_fetch_was_successful
        const pr = this._jobRunner.run(
            async () => {
                const fetchOptions = { ...this.fetchOptions, signal };
                const response = await fetch(path, fetchOptions);
                if (!response.ok) {
                    throw new Error(`EnavLookAheadAnimator: Failed to load file "${path}" with status ${response.status} : ${response.statusText}`);
                }
                return response;
            },
            () => {
                controller.abort();
            },
        );

        obj.promise = pr;
        this._preloadedFiles[annotation.file] = obj;
        return pr;
    }

    _preloadBinaryFile(annotation) {
        if (!this._preloadedFiles) {
            return;
        }

        if (annotation.file in this._preloadedFiles) {
            const obj = this._preloadedFiles[annotation.file];
            obj.references++;
            return obj.promise;
        } else {
            const pr = this._preloadFile(annotation)
                .then(res => res.arrayBuffer())
                .then(buffer => {
                    this._preloadedFiles[annotation.file].buffer = buffer;
                });
            pr.catch(error => {
                // delete entry in _preloadFiles if we didn't abort the fetch
                // since aborted will be handled in unload
                if (error.name !== 'AbortError') {
                    delete this._preloadedFiles[annotation.file];
                }
            });

            return pr;
        }
    }

    _preloadJsonFile(annotation) {
        if (!this._preloadedFiles) {
            return;
        }

        if (annotation.file in this._preloadedFiles) {
            const obj = this._preloadedFiles[annotation.file];
            obj.references++;
            return obj.promise;
        } else {
            const pr = this._preloadFile(annotation)
                .then(res => res.json())
                .then(json => (this._preloadedFiles[annotation.file].json = json));
            pr.catch(error => {
                // delete entry in _preloadFiles if we didn't abort the fetch
                // since aborted will be handled in unload
                if (error.name !== 'AbortError') {
                    delete this._preloadedFiles[annotation.file];
                }
            });

            return pr;
        }
    }

    /* Process functions */

    // heightmap binary file contents in order (from navlib_ai_dp.xml):
    // cellZ: Float32Array Average height value over the cell in Map frame (positive z is down)
    // cellGlobalPosError: Float32Array roughly maps to how old the cells are and how close to expiring they are.
    // cellIsDilated: Uint8Array Whether the cell is dilated (within half a wheel radius of a cell with finite height)
    _processHeightmap(annotation) {
        if (this._preloadedFiles[annotation.file] && this._preloadedFiles[annotation.file].buffer) {
            const buffer = this._preloadedFiles[annotation.file].buffer;
            const totalNumCells = Math.pow(annotation.enavDpGrid.numCells, 2);
            const cellGlobalPosErrorByteOffset = totalNumCells * Float32Array.BYTES_PER_ELEMENT;
            const isDilatedByteOffset =
                cellGlobalPosErrorByteOffset + totalNumCells * Float32Array.BYTES_PER_ELEMENT;

            annotation.cellZ = new Float32Array(buffer, 0, totalNumCells);
            annotation.cellGlobalPosError =
                new Float32Array(buffer, cellGlobalPosErrorByteOffset, totalNumCells);
            annotation.cellIsDilated = new Uint8Array(buffer, isDilatedByteOffset, totalNumCells);
            return true;
        }
        return false;
    }

    // costmap binary file contents in order (from navlib_ai_dp.xml):
    // cellType: Uint8Array Type of cell
    // cellTilt: Float32Array Tilt of the plane fit centered on the cell
    // cellRoughness: Float32Array Roughness of the plane fit centered on the cell
    // cellCostType: Uint8Array Type of cost for the cell
    _processCostmap(annotation) {
        if (this._preloadedFiles[annotation.file] && this._preloadedFiles[annotation.file].buffer) {
            const buffer = this._preloadedFiles[annotation.file].buffer;
            const totalNumCells = Math.pow(annotation.enavDpGrid.numCells, 2);
            const cellTypeByteOffset = 0;
            const cellTiltByteOffset = totalNumCells * Uint32Array.BYTES_PER_ELEMENT;
            const cellRoughnessByteOffset =
                cellTiltByteOffset + totalNumCells * Float32Array.BYTES_PER_ELEMENT;
            const cellCostTypeByteOffset =
                cellRoughnessByteOffset + totalNumCells * Float32Array.BYTES_PER_ELEMENT;

            annotation.cellType = new Uint32Array(buffer, cellTypeByteOffset, totalNumCells);
            annotation.cellTilt = new Float32Array(totalNumCells);
            annotation.cellRoughness = new Float32Array(totalNumCells);
            annotation.cellCostType = new Uint32Array(
                buffer,
                cellCostTypeByteOffset,
                totalNumCells,
            );

            // since the file is a mix between types, might not be aligned
            const cellTiltDataView = new DataView(
                buffer,
                cellTiltByteOffset,
                totalNumCells * Float32Array.BYTES_PER_ELEMENT,
            );
            const cellRoughnessDataView = new DataView(
                buffer,
                cellRoughnessByteOffset,
                totalNumCells * Float32Array.BYTES_PER_ELEMENT,
            );
            for (let i = 0; i < totalNumCells; i++) {
                // read as little endian
                annotation.cellTilt[i] = cellTiltDataView.getFloat32(
                    i * Float32Array.BYTES_PER_ELEMENT,
                    true,
                );
                annotation.cellRoughness[i] = cellRoughnessDataView.getFloat32(
                    i * Float32Array.BYTES_PER_ELEMENT,
                    true,
                );
            }
            return true;
        }
        return false;
    }

    /* Unload functions */
    _unloadHeightmap(annotation) {
        if (this._decrementReferences(annotation)) {
            delete annotation.cellZ;
            delete annotation.cellIsDilated;
            delete annotation.cellAge;
            delete this._preloadedFiles[annotation.file];
        }
    }

    _unloadCostmap(annotation) {
        if (this._decrementReferences(annotation)) {
            delete annotation.cellType;
            delete annotation.cellTilt;
            delete annotation.cellRoughness;
            delete annotation.cellCostType;
            delete this._preloadedFiles[annotation.file];
        }
    }

    _decrementReferences(annotation) {
        if (annotation.file in this._preloadedFiles) {
            this._preloadedFiles[annotation.file].references--;

            if (this._preloadedFiles[annotation.file].references === 0) {
                this._preloadedFiles[annotation.file].promise.cancel();
                return true;
            } else if (this._preloadedFiles[annotation.file].references < 0) {
                throw new Error('References somehow became less than 0');
            }
        }
        return false;
    }
}
