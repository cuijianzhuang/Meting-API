import { describe, expect, it } from 'vitest'
import { mapTencentMembership } from './cookie-validator.js'

describe('QQ 音乐会员权益映射', () => {
  it('会员结束时间已过时不应继续识别为 SVIP', () => {
    expect(mapTencentMembership({ svip: 1, svip_end_time: 1_700_000_000 }, 1_800_000_000)).toEqual({
      isVip: false,
      isSvip: false,
      vipType: 0,
    })
  })

  it('支持毫秒时间戳并保留仍有效的 SVIP', () => {
    expect(mapTencentMembership({ svip: 1, svip_end_time: 1_900_000_000_000 }, 1_800_000_000)).toEqual({
      isVip: true,
      isSvip: true,
      vipType: 2,
    })
  })

  it('读取嵌套的 SVIP 结束时间，过期后只保留普通 VIP', () => {
    expect(mapTencentMembership({ svip: 1, identity: { SVipEndTime: 1_700_000_000, vip: 1 } }, 1_800_000_000)).toEqual({
      isVip: true,
      isSvip: false,
      vipType: 1,
    })
  })

  it('解析 QQ 实际返回的日期字符串 HugeVipEnd', () => {
    expect(mapTencentMembership({ svip: 1, identity: { HugeVip: 0, HugeVipEnd: '2026-09-14 07:58:20', vip: 1 } }, Date.parse('2026-09-18T00:00:00+08:00') / 1000)).toEqual({
      isVip: true,
      isSvip: false,
      vipType: 1,
    })
  })
})
