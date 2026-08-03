import { describe, expect, test } from 'vitest'
import { buildUrlPayload, normalizeDuration, normalizeLoudness } from '../src/quality.js'
import { mergeTencentTrackAudioMeta } from '../src/providers/tencent/song.js'

describe('loudness metadata', () => {
    test('normalizes supported numeric fields', () => {
        expect(normalizeLoudness({
            gain: '-8.427',
            peak: 0.946,
            lra: 5.3,
            ignored: 1,
        })).toEqual({
            gain: -8.427,
            peak: 0.946,
            lra: 5.3,
        })
    })

    test('drops invalid values', () => {
        expect(normalizeLoudness({ gain: 'invalid', peak: null })).toBeUndefined()
    })

    test('adds loudness without changing the existing url payload', () => {
        expect(buildUrlPayload(
            'https://example.com/song.mp3',
            'standard',
            'standard',
            'netease',
            { gain: -7.5363, peak: 1, closedGain: 0, closedPeak: 0 },
            281755.6,
        )).toEqual({
            url: 'https://example.com/song.mp3',
            quality: '标准',
            duration: 281756,
            loudness: {
                gain: -7.5363,
                peak: 1,
                closedGain: 0,
                closedPeak: 0,
            },
        })
    })

    test('normalizes positive millisecond duration', () => {
        expect(normalizeDuration('260000')).toBe(260000)
        expect(normalizeDuration(0)).toBeUndefined()
    })
})

describe('tencent track loudness', () => {
    test('keeps volume metadata with the audio file data', () => {
        expect(mergeTencentTrackAudioMeta({
            file: { media_mid: 'abc', size_128mp3: 123 },
            volume: { gain: -9.331, peak: 1, lra: 4.2 },
            interval: 260,
        })).toEqual({
            media_mid: 'abc',
            size_128mp3: 123,
            volume: { gain: -9.331, peak: 1, lra: 4.2 },
            duration: 260000,
        })
    })
})
