import { describe, expect, it } from 'vitest'
import { getQualityName, getQualityRequirement } from '../../quality.js'

describe('kugou quality membership tiers', () => {
  it('marks 320 and lossless as VIP', () => {
    expect(getQualityRequirement('320', 'kugou')).toBe('VIP')
    expect(getQualityRequirement('flac', 'kugou')).toBe('VIP')
    expect(getQualityRequirement('lossless', 'kugou')).toBe('VIP')
  })

  it('marks Hi-Res as VIP and Viper formats as SVIP', () => {
    expect(getQualityRequirement('hires', 'kugou')).toBe('VIP')
    expect(getQualityRequirement('atmos', 'kugou')).toBe('SVIP')
    expect(getQualityRequirement('master', 'kugou')).toBe('SVIP')
    expect(getQualityRequirement('viper_tape', 'kugou')).toBe('SVIP')
    expect(getQualityRequirement('viper_clear', 'kugou')).toBe('SVIP')
    expect(getQualityRequirement('viper_hifi', 'kugou')).toBe('SVIP')
  })

  it('keeps standard quality free and names Kugou formats', () => {
    expect(getQualityRequirement('standard', 'kugou')).toBe('免费')
    expect(getQualityName('hires', 'kugou')).toBe('Hi-Res音质')
    expect(getQualityName('atmos', 'kugou')).toBe('蝰蛇全景声2.0')
    expect(getQualityName('master', 'kugou')).toBe('母带')
    expect(getQualityName('viper_tape', 'kugou')).toBe('蝰蛇母带音质')
    expect(getQualityName('viper_clear', 'kugou')).toBe('蝰蛇超清音质')
    expect(getQualityName('viper_hifi', 'kugou')).toBe('蝰蛇HiFi音质')
  })
})
