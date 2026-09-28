import { afterEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import store, { selectCookieForQuality } from '../admin/store.js'
import Providers from '../providers/index.js'

describe('FM account selection', () => {
    afterEach(() => vi.restoreAllMocks())

    it('uses the FM account for IDs and SVIP account for URLs even after a URL failure', async () => {
        const fmCookie = { id: 'fm', cookie: 'FM_COOKIE', isValid: true, fmPriority: true, userInfo: { canPlayVip: true } }
        const svipCookie = { id: 'svip', cookie: 'SVIP_COOKIE', isValid: true, userInfo: { canPlaySvip: true } }
        vi.spyOn(store, 'getActiveCookieForFm').mockImplementation(() => fmCookie.isValid ? fmCookie : svipCookie)
        vi.spyOn(store, 'getActiveCookieForQuality').mockImplementation((platform, quality, preferFm) =>
            selectCookieForQuality([fmCookie, svipCookie], quality, platform, preferFm))
        vi.spyOn(store, 'getFallbackCookieForQuality').mockReturnValue(null)
        const recordFailure = vi.spyOn(store, 'recordCookieUrlFailure').mockResolvedValue()
        vi.spyOn(store, 'isQualityRequiresSvip').mockReturnValue(true)
        const handle = vi.fn(async (type) => type === 'url' ? null : [{ url: 'song-id', pic: '', lrc: '' }])
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['url', 'fm'], handle })
        const context = (type, id) => ({
            req: { url: 'http://localhost/api', query: () => ({ server: 'netease', type, id, quality: type === 'url' ? 'sky' : undefined, fm: type === 'url' ? '1' : undefined }), header: () => '' },
            status: vi.fn(),
            json: vi.fn(value => value),
        })

        const [song] = await api(context('fm'))
        expect(song.url).toContain('id=song-id')
        expect(song.url).toContain('fm=1')
        expect(handle).toHaveBeenCalledWith('fm', '6907557348', 'FM_COOKIE', expect.any(Object))
        expect(await api(context('url', 'song-id'))).toEqual({ error: 'no url' })
        await api(context('fm'))

        expect(fmCookie.isValid).toBe(true)
        expect(svipCookie.isValid).toBe(true)
        expect(recordFailure).toHaveBeenCalledWith('svip')
        expect(handle).toHaveBeenCalledWith('url', 'song-id', 'SVIP_COOKIE', expect.any(Object))
        expect(handle).toHaveBeenLastCalledWith('fm', '6907557348', 'FM_COOKIE', expect.any(Object))
    })

    it('tries the FM account first, then another eligible account after no URL', async () => {
        const fmCookie = { id: 'fm', cookie: 'FM_COOKIE', isActive: true, isValid: true, fmPriority: true, userInfo: { canPlaySvip: true } }
        const backup = { id: 'backup', cookie: 'BACKUP_COOKIE', isActive: true, isValid: true, userInfo: { canPlaySvip: true } }
        vi.spyOn(store, 'getActiveCookieForQuality').mockReturnValue(fmCookie)
        vi.spyOn(store, 'getFallbackCookieForQuality').mockReturnValue(backup)
        const recordFailure = vi.spyOn(store, 'recordCookieUrlFailure').mockResolvedValue()
        const handle = vi.fn(async (type, id, cookie) => cookie === 'FM_COOKIE' ? null : { url: 'https://example.com/song.mp3' })
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['url'], handle })
        const ctx = {
            req: { query: () => ({ server: 'netease', type: 'url', id: 'song-id', quality: 'sky', fm: '1', redirect: '1' }), header: () => '' },
            json: vi.fn(value => value), status: vi.fn(), redirect: vi.fn(url => ({ url })),
        }

        expect((await api(ctx)).url).toBe('https://example.com/song.mp3')
        expect(handle.mock.calls.map(call => call[2])).toEqual(['FM_COOKIE', 'BACKUP_COOKIE'])
        expect(recordFailure).toHaveBeenCalledTimes(1)
        expect(recordFailure).toHaveBeenCalledWith('fm')
        expect(fmCookie.isValid).toBe(true)
    })

    it('returns the FM account URL without trying another account when it succeeds', async () => {
        const fmCookie = { id: 'fm', cookie: 'FM_COOKIE', isActive: true, isValid: true, userInfo: { canPlaySvip: true } }
        vi.spyOn(store, 'getActiveCookieForQuality').mockReturnValue(fmCookie)
        const fallback = vi.spyOn(store, 'getFallbackCookieForQuality').mockReturnValue(null)
        const recordFailure = vi.spyOn(store, 'recordCookieUrlFailure').mockResolvedValue()
        const handle = vi.fn().mockResolvedValue({ url: 'https://example.com/song.mp3' })
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['url'], handle })
        const ctx = {
            req: { query: () => ({ server: 'netease', type: 'url', quality: 'sky', fm: '1', redirect: '1' }), header: () => '' },
            json: vi.fn(value => value), status: vi.fn(), redirect: vi.fn(url => ({ url })),
        }

        expect((await api(ctx)).url).toBe('https://example.com/song.mp3')
        expect(handle).toHaveBeenCalledTimes(1)
        expect(fallback).not.toHaveBeenCalled()
        expect(recordFailure).not.toHaveBeenCalled()
    })
})
