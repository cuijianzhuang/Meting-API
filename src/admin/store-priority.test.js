import { describe, expect, it } from 'vitest'
import { selectActiveCookie, selectFmCookie, selectCookieForQuality, selectRequestCookie } from './store.js'

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

    it('FM 优先账号覆盖普通账号选择', () => {
        const fmCookie = cookie('FM账号', {}, 1)
        const newerCookie = cookie('普通账号', {}, 2)
        fmCookie.fmPriority = true

        expect(selectFmCookie([newerCookie, fmCookie])).toBe(fmCookie)
    })

    it('FM 优先账号能播放目标音质时继续使用该账号', () => {
        const fmCookie = cookie('FM账号', { canPlayVip: true }, 1)
        fmCookie.fmPriority = true
        const otherCookie = cookie('普通账号', { canPlayVip: true }, 2)

        expect(selectCookieForQuality([otherCookie, fmCookie], '320', 'netease', true)).toBe(fmCookie)
    })

    it('FM 优先账号会员不足时使用其他可播放账号，但保留 FM 歌曲 ID 由调用方传递', () => {
        const fmCookie = cookie('FM账号', { canPlayVip: false }, 2)
        fmCookie.fmPriority = true
        const vipCookie = cookie('高音质账号', { canPlayVip: true }, 1)

        expect(selectCookieForQuality([fmCookie, vipCookie], '320', 'netease', true)).toBe(vipCookie)
    })

    it('显式指定 Cookie 时不使用 FM 优先账号', () => {
        const explicitCookie = 'MUSIC_U=explicit'
        const fmCookie = cookie('FM账号')
        fmCookie.fmPriority = true

        expect(selectRequestCookie(explicitCookie, fmCookie)).toBe(explicitCookie)
    })
})
