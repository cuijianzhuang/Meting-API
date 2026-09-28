import { afterEach, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './api.js'
import store from './store.js'
import { get_song_url } from '../providers/tencent/song.js'
import { startTencentVerification, getTencentVerificationFrame, sendTencentVerificationPointer } from '../providers/tencent/verification.js'

vi.mock('../providers/tencent/verification.js', () => ({
    startTencentVerification: vi.fn(),
    getTencentVerificationFrame: vi.fn(async () => new Uint8Array([1, 2, 3])),
    sendTencentVerificationPointer: vi.fn(),
    closeTencentVerification: vi.fn(),
}))

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

it('opens a Cookie-bound verification browser only for an authenticated admin', async () => {
    const cookie = 'uin=789;qqmusic_key=PRIVATE_COOKIE'
    const mockFetch = vi.fn()
        .mockResolvedValueOnce({ json: async () => ({ songinfo: { data: { track_info: { file: { media_mid: 'media', size_128mp3: 1 } } } } }) })
        .mockResolvedValueOnce({ json: async () => ({ req_0: { code: 104009, data: { validUrl: 'https://c.y.qq.com/r/fy6U?tokenValid=PRIVATE_TOKEN', midurlinfo: [{ purl: '' }] } } }) })
    vi.stubGlobal('fetch', mockFetch)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await get_song_url('0010BrWk2SucQr', cookie, { quality: 'standard' })
    vi.spyOn(store, 'getCookies').mockReturnValue([{ id: 'account-1', platform: 'tencent', cookie }, { id: 'account-2', platform: 'tencent', cookie: 'other' }])
    vi.spyOn(store, 'validateToken').mockReturnValue(true)
    vi.spyOn(store.users, 'get').mockReturnValue({ role: 'admin' })
    const app = new Hono()
    adminRoutes(app)

    expect((await app.request('/admin/cookies/tencent-verifications')).status).toBe(401)
    const response = await app.request('/admin/cookies/tencent-verifications', { headers: { 'X-Auth-Username': 'admin', 'X-Auth-Token': 'test' } })
    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual([{ id: 'account-1', songmid: '0010BrWk2SucQr' }])

    vi.spyOn(store, 'getCookie').mockReturnValue({ id: 'account-1', platform: 'tencent', cookie })
    const headers = { 'X-Auth-Username': 'admin', 'X-Auth-Token': 'test' }
    expect((await app.request('/admin/cookies/account-1/verification/frame')).status).toBe(401)
    expect((await app.request('/admin/cookies/account-1/verification/start', { method: 'POST', headers })).status).toBe(200)
    expect(startTencentVerification).toHaveBeenCalledWith('account-1', cookie, 'https://c.y.qq.com/r/fy6U?tokenValid=PRIVATE_TOKEN')
    expect((await app.request('/admin/cookies/account-1/verification/frame', { headers })).headers.get('content-type')).toBe('image/webp')
    expect(getTencentVerificationFrame).toHaveBeenCalledWith('account-1')
    expect((await app.request('/admin/cookies/account-1/verification/pointer', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'down', x: 20, y: 30 }) })).status).toBe(200)
    expect(sendTencentVerificationPointer).toHaveBeenCalledWith('account-1', { type: 'down', x: 20, y: 30 })
    mockFetch
        .mockResolvedValueOnce({ json: async () => ({ songinfo: { data: { track_info: { file: { media_mid: 'media', size_128mp3: 1 } } } } }) })
        .mockResolvedValueOnce({ json: async () => ({ req_0: { data: { sip: ['https://stream.qq.com/'], midurlinfo: [{ purl: 'song.mp3', result: 0 }] } } }) })
        .mockResolvedValueOnce({ status: 206 })
    expect(await (await app.request('/admin/cookies/account-1/retry-play', { method: 'POST', headers })).json()).toEqual({ success: true })
    expect((await (await app.request('/admin/cookies/tencent-verifications', { headers })).json()).data).toEqual([])
})
