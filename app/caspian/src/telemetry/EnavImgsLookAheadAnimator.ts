import { TelemetryAnimator, LookAheadAnimatorMixin } from '@gov.nasa.jpl.honeycomb/telemetry-animator';
import { JobRunner } from '@gov.nasa.jpl.honeycomb/scheduling-utilities';

export class EnavImgsLookAheadAnimator extends LookAheadAnimatorMixin(TelemetryAnimator) {
    constructor(frames) {
        super(frames);

        this.isEnavImgsLookAheadAnimator = true;

        this._preloadedFiles = {};

        this._jobRunner = new JobRunner();

        this.fetchOptions = { credentials: 'same-origin' };
    }

    /* Overrides */
    preloadData(state) {
        const { annotations } = state;
        if (annotations) {
            const promises = [];
            annotations.forEach(val => {
                let pr = this._preloadImage(val);
                if (pr) promises.push(pr);
            });

            if (promises.length > 0) {
                return promises;
            } else {
                return null;
            }
        }
    }

    processState(state) {
        const { annotations } = state;
        if (annotations) {
            let modified = false;
            annotations.forEach(val => {
                if (this._preloadedFiles[val.ocs_name] && this._preloadedFiles[val.ocs_name].cacheImgURL) {
                    val.cacheImgURL = this._preloadedFiles[val.ocs_name].cacheImgURL;
                    modified = true;
                }
            });

            if (modified) {
                // We copy the array because we've modified it and the diff process does not iterate over arrays
                state.annotations = state.annotations.slice();
                return true;
            }
        }

        return false;
    }

    unloadData(state) {
        const { annotations } = state;
        if (annotations) {
            annotations.forEach(val => {
                this._unloadImage(val);
            });
        }
    }

    /* Private */
    _preloadImage(annotation) {
        if (!this._preloadedFiles) return;

        if (annotation.ocs_name in this._preloadedFiles) {
            const obj = this._preloadedFiles[annotation.ocs_name];
            obj.references++;
            return obj.promise;
        } else {
            const pr = this._preloadFile(annotation)
                .then(res => res.blob())
                .then(blob => {
                    this._preloadedFiles[annotation.ocs_name].cacheImgURL =
                        URL.createObjectURL(blob);
                });
            pr.catch(error => {
                // delete entry in _preloadFiles if we didn't abort the fetch
                // since aborted will be handled in unload
                if (error.name !== 'AbortError') {
                    delete this._preloadedFiles[annotation.ocs_name];
                }
            });

            return pr;
        }
    }

    _preloadFile(annotation) {
        const path = annotation.permalink;
        const controller = new AbortController();

        const obj = { references: 1 };
        const signal = controller.signal;
        // checking res.ok here because fetch will only throw if there's a network error
        // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Checking_that_the_fetch_was_successful
        const pr = this._jobRunner.run(
            async () => {
                const fetchOptions = { ...this.fetchOptions, signal };
                const response = await fetch(path, fetchOptions);
                if (!response.ok) {
                    throw new Error(`EnavImgsLookAheadAnimator: Failed to load file "${path}" with status ${response.status} : ${response.statusText}`);
                }
                return response;
            },
            () => {
                controller.abort();
            },
        );

        obj.promise = pr;
        this._preloadedFiles[annotation.ocs_name] = obj;
        return pr;
    }

    _unloadImage(annotation) {
        if (this._decrementReferences(annotation)) {
            URL.revokeObjectURL(annotation.cacheImgURL);
            delete annotation.cacheImgURL;
            delete this._preloadedFiles[annotation.ocs_name];
        }
    }

    _decrementReferences(annotation) {
        if (annotation.ocs_name in this._preloadedFiles) {
            this._preloadedFiles[annotation.ocs_name].references--;

            if (this._preloadedFiles[annotation.ocs_name].references === 0) {
                this._preloadedFiles[annotation.ocs_name].promise.cancel();
                return true;
            } else if (this._preloadedFiles[annotation.ocs_name].references < 0) {
                throw new Error('EnavImgsLookAheadAnimator: References somehow became less than 0');
            }
        }
        return false;
    }
}
