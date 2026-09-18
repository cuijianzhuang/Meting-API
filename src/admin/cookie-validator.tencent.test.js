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
})
