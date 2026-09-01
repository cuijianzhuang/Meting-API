import { describe, expect, it } from 'vitest'
import { isKugouMembershipRequestParamError, mapKugouMembership, parseKugouCookie } from '../providers/kugou/index.js'


describe('酷狗 Cookie 解析', () => {
  it('接受浏览器复制后带末尾分号的 Cookie', () => {
    expect(parseKugouCookie('token=abc; userid=10001;')).toEqual({ token: 'abc', userid: '10001' })
  })
})

describe('酷狗会员接口错误识别', () => {
  it('将 20010 识别为设备参数拒绝，而不是 Cookie 失效', () => {
    expect(isKugouMembershipRequestParamError({ code: 20010 })).toBe(true)
    expect(isKugouMembershipRequestParamError({ code: 401 })).toBe(false)
  })
})
describe('酷狗会员权益映射', () => {
  it('将普通豪华 VIP 映射为 VIP，不能播放 SVIP 音质', () => {
    expect(mapKugouMembership({ vip_type: 1 })).toMatchObject({
      vipType: 1,
      isVip: true,
      isSvip: false,
      canPlayVip: true,
      canPlaySvip: false,
    })
  })

  it('不会只因 vip_type 数值把普通 VIP 误判为 SVIP', () => {
    expect(mapKugouMembership({ vip_type: 3 })).toMatchObject({
      isVip: true,
      isSvip: false,
      canPlayVip: true,
      canPlaySvip: false,
    })
  })
  it('将豪华 VIP 或超级会员字段映射为 SVIP 权益', () => {
    expect(mapKugouMembership({ vip_type: 3, super_vip: 1 })).toMatchObject({
      isVip: true,
      isSvip: true,
      canPlayVip: true,
      canPlaySvip: true,
    })
  })
})

