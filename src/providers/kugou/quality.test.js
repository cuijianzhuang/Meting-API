import { describe, expect, it } from 'vitest'
import { getQualityName, getQualityRequirement } from '../../quality.js'

describe('kugou quality membership tiers', () => {
  it('marks 320 and lossless as VIP', () => {
    expect(getQualityRequirement('320', 'kugou')).toBe('VIP')
    expect(getQualityRequirement('flac', 'kugou')).toBe('VIP')
    expect(getQualityRequirement('lossless', 'kugou')).toBe('VIP')
  })

  it('marks immersive and master qualities as SVIP', () => {
    expect(getQualityRequirement('hires', 'kugou')).toBe('SVIP')
    expect(getQualityRequirement('atmos', 'kugou')).toBe('SVIP')
    expect(getQualityRequirement('master', 'kugou')).toBe('SVIP')
  })

  it('keeps standard quality free and names Kugou formats', () => {
    expect(getQualityRequirement('standard', 'kugou')).toBe('免费')
    expect(getQualityName('hires', 'kugou')).toBe('高解析度无损')
    expect(getQualityName('atmos', 'kugou')).toBe('全景声')
    expect(getQualityName('master', 'kugou')).toBe('母带')
  })
})
