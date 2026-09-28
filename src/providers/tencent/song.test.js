import { afterEach, expect, it, vi } from 'vitest'
import { get_song_url, getTencentVerification } from './song.js'

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

it('keeps an official verification link for the affected Cookie when Tencent requires a slider', async () => {
    const cookie = 'uin=456;qqmusic_key=PRIVATE_COOKIE'
    const validUrl = String.raw`https\://c.y.qq.com/r/fy6U?\_wv=8192&tokenValid=PRIVATE_TOKEN`
    vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ json: async () => ({ songinfo: { data: { track_info: { file: { media_mid: 'media', size_128mp3: 1 } } } } }) })
        .mockResolvedValueOnce({ json: async () => ({ req_0: { code: 104009, data: { retcode: 104009, validUrl, midurlinfo: [{ result: 0, purl: '' }] } } }) }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await get_song_url('0010BrWk2SucQr', cookie, { quality: 'standard' })).toBeNull()
    expect(getTencentVerification(cookie)).toEqual({ songmid: '0010BrWk2SucQr', validUrl: 'https://c.y.qq.com/r/fy6U?_wv=8192&tokenValid=PRIVATE_TOKEN' })
    expect(getTencentVerification('uin=other')).toBeNull()
})

it('does not treat a vkey payload as playable when Tencent requires verification', async () => {
    const cookie = 'uin=111;qqmusic_key=COOKIE'
    vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ json: async () => ({ songinfo: { data: { track_info: { file: { media_mid: 'media', size_128mp3: 1 } } } } }) })
        .mockResolvedValueOnce({ json: async () => ({ req_0: { code: 104009, data: { validUrl: 'https://c.y.qq.com/r/fy6U', sip: ['https://stream.qq.com/'], midurlinfo: [{ purl: 'song.mp3', result: 0 }] } } }) })
        .mockResolvedValueOnce({ status: 206 }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await get_song_url('0010BrWk2SucQr', cookie, { quality: 'standard' })).toBeNull()
    expect(getTencentVerification(cookie)?.songmid).toBe('0010BrWk2SucQr')
})

it('does not print the Tencent vkey response when no URL is returned', async () => {
    const response = {
        code: 0,
        req_0: { code: 0, data: { validUrl: 'https://c.y.qq.com/r/fy6U?tokenValid=PRIVATE_TOKEN', midurlinfo: [{ result: 104003, purl: '', vkey: 'SECRET', errmsg: 'no permission' }] } },
    }
    vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ json: async () => ({ songinfo: { data: { track_info: { file: { media_mid: 'media', size_128mp3: 1 } } } } }) })
        .mockResolvedValueOnce({ json: async () => response }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await get_song_url('003ujA7V2k3oPC', 'uin=123;qqmusic_key=COOKIE_SECRET', { quality: 'standard' })).toBeNull()
    expect(warn).not.toHaveBeenCalled()
})
