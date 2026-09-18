const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : undefined

export const needsStandardLoudnessUrl = (requestedQuality) => {
    const quality = String(requestedQuality || '').trim().toLowerCase()
    return Boolean(quality && !['standard', '128'].includes(quality))
}

export const fetchAuxiliaryLoudness = async ({ serviceUrl, audioUrl, songId, fetchImpl = fetch, timeoutMs = 10_000 }) => {
    if (!serviceUrl || !audioUrl) return undefined
    try {
        const endpoint = new URL(serviceUrl)
        if (songId) endpoint.searchParams.set('id', songId)
        endpoint.searchParams.set('url', audioUrl)
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs)
        try {
            const response = await fetchImpl(endpoint, { signal: controller.signal })
            if (!response.ok) return undefined
            const body = await response.json()
            const gain = finite(body?.loudness?.gain)
            const peak = finite(body?.loudness?.peak)
            return gain === undefined && peak === undefined ? undefined : {
                ...(gain === undefined ? {} : { gain }),
                ...(peak === undefined ? {} : { peak }),
            }
        } finally {
            clearTimeout(timeout)
        }
    } catch (error) {
        console.warn('[Meting] auxiliary loudness skipped:', error?.message || error)
        return undefined
    }
}
