/**
 * Generates a timestamp in WIB (UTC+7) format: YYYY-MM-DDTHH:mm:ss+07:00
 * 
 * @param {number} offsetMinutes - Optional offset in minutes (for expiredDate).
 * @returns {string} Formatted timestamp.
 */
export function generateTimestamp(offsetMinutes = 0) {
    const now = new Date();
    if (offsetMinutes) {
        now.setMinutes(now.getMinutes() + offsetMinutes);
    }

    // Adjust to WIB (UTC+7)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibDate = new Date(utc + (3600000 * 7));

    const pad = (n) => String(n).padStart(2, '0');

    const year = wibDate.getFullYear();
    const month = pad(wibDate.getMonth() + 1);
    const day = pad(wibDate.getDate());
    const hours = pad(wibDate.getHours());
    const minutes = pad(wibDate.getMinutes());
    const seconds = pad(wibDate.getSeconds());

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
}

/**
 * Recursively sorts object keys for canonical JSON representation.
 * 
 * @param {any} obj - The object or value to sort.
 * @returns {any} Sorted object or value.
 */
export function sortObject(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => sortObject(item));
    }

    const sortedKeys = Object.keys(obj).sort();
    const result = {};

    for (const key of sortedKeys) {
        result[key] = sortObject(obj[key]);
    }

    return result;
}
