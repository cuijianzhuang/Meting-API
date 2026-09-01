import { describe, expect, it } from 'vitest'
import { buildKugouQrCookie, checkKugouQrSession, createKugouQrSession, getKugouQrSession } from './qr_login.js'

describe('酷狗扫码会话', () => {
  it('在授权成功后生成后台可直接保存的 API Cookie', async () => {
    const session = await createKugouQrSession({
      request: async () => ({ status: 1, data: { qrcode: 'qr-key-confirm' } }),
    })
    const result = await checkKugouQrSession(session.key, {
      request: async () => ({ data: { status: 4, token: 'api-token', userid: 12345, vip_type: 1, vip_token: 'vip-token' } }),
    })

    expect(result).toMatchObject({ status: 'confirmed', userId: '12345' })
    expect(result.cookie).toContain('token=api-token')
    expect(result.cookie).toContain('userid=12345')
    expect(result.cookie).toContain('KUGOU_API_DEV=')
    expect(result.validation).toEqual({ valid: true, source: 'qr' })
  })
  it('为扫码会话保留设备 Cookie，并返回可扫描地址', async () => {
    const session = await createKugouQrSession({
      request: async () => ({ status: 1, data: { qrcode: 'qr-key-123' } }),
    })

    expect(session).toMatchObject({
      platform: 'kugou',
      key: 'qr-key-123',
      qrurl: expect.stringContaining('qrcode=qr-key-123'),
    })
    const deviceCookie = buildKugouQrCookie(session.key)
    expect(deviceCookie).toMatch(/KUGOU_API_GUID=[a-f0-9]{32}/)
    expect(deviceCookie).toMatch(/KUGOU_API_MID=\d+/)
    expect(deviceCookie).toMatch(/KUGOU_API_DEV=[A-Z0-9]{10}/)
    expect(getKugouQrSession(session.key)?.cookie).toContain('KUGOU_API_DEV=')
  })
})