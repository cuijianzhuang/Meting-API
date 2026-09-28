import { afterEach, expect, it, vi } from 'vitest'

const mouse = { move: vi.fn(), down: vi.fn(), up: vi.fn() }
const page = { setViewport: vi.fn(), goto: vi.fn(), screenshot: vi.fn(async () => new Uint8Array([1, 2, 3])), mouse }
const context = { setCookie: vi.fn(), newPage: vi.fn(async () => page), close: vi.fn() }
const browser = { createBrowserContext: vi.fn(async () => context), close: vi.fn() }
vi.mock('puppeteer-core', () => ({ default: { launch: vi.fn(async () => browser) } }))

import { startTencentVerification, getTencentVerificationFrame, sendTencentVerificationPointer, closeTencentVerification } from './verification.js'

afterEach(async () => {
    await closeTencentVerification('account-1')
    vi.clearAllMocks()
})

it('opens the official challenge with the stored Cookie and relays a manual drag', async () => {
    await startTencentVerification('account-1', 'uin=123; qqmusic_key=abc=def', 'https://c.y.qq.com/r/fy6U?tokenValid=TOKEN')
    expect(context.setCookie).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'uin', value: '123', domain: '.qq.com' }),
        expect.objectContaining({ name: 'qqmusic_key', value: 'abc=def', domain: '.qq.com' }),
    )
    expect(page.goto).toHaveBeenCalledWith('https://c.y.qq.com/r/fy6U?tokenValid=TOKEN', expect.any(Object))
    expect(await getTencentVerificationFrame('account-1')).toEqual(new Uint8Array([1, 2, 3]))
    await sendTencentVerificationPointer('account-1', { type: 'down', x: 20, y: 30 })
    await sendTencentVerificationPointer('account-1', { type: 'move', x: 140, y: 30 })
    await sendTencentVerificationPointer('account-1', { type: 'up', x: 140, y: 30 })
    expect(mouse.move).toHaveBeenCalledWith(140, 30)
    expect(mouse.down).toHaveBeenCalledOnce()
    expect(mouse.up).toHaveBeenCalledOnce()
})
