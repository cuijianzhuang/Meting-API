import { describe, expect, it } from 'vitest'
import store from './store.js'

describe('酷狗 Cookie 格式校验', () => {
    it('接受包含 token 和 userid 的酷狗 Cookie', () => {
        expect(store.validateCookieFormat('kugou', 'token=abc123; userid=10001')).toEqual({ valid: true })
    })

    it('拒绝缺少酷狗登录字段的 Cookie', () => {
        const result = store.validateCookieFormat('kugou', 'dfid=-; mid=0; clientver=11440')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('酷狗音乐')
    })

    it('不影响已有平台校验', () => {
        expect(store.validateCookieFormat('netease', 'MUSIC_U=abc1234567')).toEqual({ valid: true })
        expect(store.validateCookieFormat('tencent', 'uin=123456789')).toEqual({ valid: true })
        expect(store.validateCookieFormat('qishui', 'sessionid=abc1234567')).toEqual({ valid: true })
    })
})
