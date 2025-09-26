function lerp(a, b, t) {
    return a * (1 - t) + b * t;
}

// map t between the range [a, b] to [0, 1]
function normalize(a, b, t) {
    return (t - a) / (b - a);
}


/**
 * @typedef {Array} ChartTuple
 * A tuple where the first element is an array of times and the second element is the array
 * of values with the same length as the times array.
 */

/**
 * Resamples all the provided chart data such that they all use a common time array. The
 * return value is an array of all resampled data with the first element being the sorted,
 * concatenated list of all times.
 * @param {Array<ChartTuple>} data
 * @param {Boolean} [interpolate=true]
 * @returns Array<Array<Number>>
 */
// TODO: add tests for this function
export function resampleData(data, interpolate = true) {
    const resampledTimes = data.flatMap(d => d[0] || []).sort((a, b) => a - b);

    // create a list of resampled data
    const resampledValuesList = new Array(data.length).fill().map(() => []);
    for (let d = 0, dl = data.length; d < dl; d ++) {
        const [times = [], values = []] = data[d];
        const resampledValues = resampledValuesList[d];

        let currentIndex = 0;
        let foundCorrespondingTime = false;
        for (let i = 0, l = resampledTimes.length; i < l; i ++) {
            const value = values[currentIndex];

            if (interpolate) {
                const nextIndex = Math.min(currentIndex + 1, times.length - 1);
                const t1 = times[currentIndex];
                const t2 = times[nextIndex];

                const t = t1 === t2 ? 0 : normalize(t1, t2, resampledTimes[i]);
                const v = lerp(values[currentIndex], values[nextIndex], t);
                resampledValues.push(v);
            } else {
                resampledValues.push(value);
            }

            if (times[currentIndex] === resampledTimes[i]) {
                foundCorrespondingTime = true;
            }

            // if the next times are equal we can step forward
            if (foundCorrespondingTime && times[currentIndex + 1] === resampledTimes[i + 1]) {
                currentIndex ++;
                foundCorrespondingTime = false;
            }
        }
    }

    return [resampledTimes, ...resampledValuesList];
}
