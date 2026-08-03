import { describe, expect, it } from 'vitest'
import { selectActiveCookie } from './store.js'

const cookie = (note, userInfo = {}, updatedAt = 1) => ({ note, userInfo, updatedAt })

describe('Meting 全局 Cookie 优先级', () => {
    it('共享 SVIP 优先于基础 VIP 和基础非会员', () => {
        const baseVip = cookie('基础 QQ', { isVip: true }, 3)
        const sharedSvip = cookie('contribution:tencent:1', { isVip: true, isSvip: true }, 1)
        expect(selectActiveCookie([baseVip, sharedSvip])).toBe(sharedSvip)
    })

    it('没有共享 SVIP 时基础账号优先于共享 VIP', () => {
        const baseFree = cookie('基础网易', { isVip: false }, 1)
        const sharedVip = cookie('contribution:netease:1', { isVip: true }, 3)
        expect(selectActiveCookie([sharedVip, baseFree])).toBe(baseFree)
    })

    it('同档位按更新时间选择', () => {
        const oldBase = cookie('基础一', {}, 1)
        const newBase = cookie('基础二', {}, 2)
        expect(selectActiveCookie([oldBase, newBase])).toBe(newBase)
    })
})
