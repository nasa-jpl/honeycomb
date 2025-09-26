// Ensures a number is two whole digits
function padWithZero(n) {
    if (n < 0) {
        return n < 10 ? `-0${-n}` : `${n}`;
    } else {
        return n < 10 ? `0${n}` : `${n}`;
    }
}

// Covert the given seconds into an "HH:MM:SS.SS" notation
export function secondsToDisplayTime(s, humanReadable = false) {
    const h = Math.floor(s / (60 * 60));
    s -= h * 60 * 60;

    const m = Math.floor(s / 60);
    s -= m * 60;

    if (humanReadable) {
        const strArr = [];
        if (h > 0) {
            strArr.push(`${h}hr`);
        }
        if (m > 0) {
            strArr.push(`${m}min`);
        }
        if (s > 0) {
            strArr.push(`${Math.round(s)}sec`);
        }
        return strArr.join(' ');
    }
    return `${padWithZero(h)}:${padWithZero(m)}:${padWithZero(s.toFixed(2))}`;
}
