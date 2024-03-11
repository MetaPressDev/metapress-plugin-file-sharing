
/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes) {
    if (bytes < 1024)                       return bytes + ' B'
    else if (bytes < 1024 * 1024)           return (bytes / 1024).toFixed(2) + ' KB'
    else if (bytes < 1024 * 1024 * 1024)    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
    else                                    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}