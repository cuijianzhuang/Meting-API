import { describe, expect, it } from 'vitest'
import { fetchAuxiliaryLoudness, needsStandardLoudnessUrl } from './loudness.js'

describe('auxiliary loudness service', () => {
    it('uses a separate standard URL for non-standard user quality', () => {
        expect(needsStandardLoudnessUrl('flac')).toBe(true)
        expect(needsStandardLoudnessUrl('standard')).toBe(false)
        expect(needsStandardLoudnessUrl('128')).toBe(false)
    })

    it('sends the real audio URL and song id to the configured service', async () => {
        let requestedUrl = ''
        const result = await fetchAuxiliaryLoudness({
            serviceUrl: 'http://localhost:3100/analyze',
            audioUrl: 'https://cdn.example/song.mp3',
            songId: 'song-1',
            fetchImpl: async (url) => {
                requestedUrl = String(url)
                return new Response(JSON.stringify({ loudness: { gain: -12.6482, peak: 1.3296 } }), { status: 200, headers: { 'content-type': 'application/json' } })
            },
        })

        expect(new URL(requestedUrl).searchParams.get('url')).toBe('https://cdn.example/song.mp3')
        expect(new URL(requestedUrl).searchParams.get('id')).toBe('song-1')
        expect(result).toEqual({ gain: -12.6482, peak: 1.3296 })
    })

    it('returns undefined when the auxiliary service fails', async () => {
        const result = await fetchAuxiliaryLoudness({
            serviceUrl: 'http://localhost:3100/analyze',
            audioUrl: 'https://cdn.example/song.mp3',
            songId: 'song-1',
            fetchImpl: async () => new Response('{}', { status: 502 }),
        })

        expect(result).toBeUndefined()
    })
})
