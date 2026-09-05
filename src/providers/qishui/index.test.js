import { describe, expect, it } from 'vitest'
import { mapQishuiLoudness } from './index.js'

describe('qishui loudness metadata', () => {
  it('maps the native VolumeInfo shape to the shared gain/peak shape', () => {
    expect(mapQishuiLoudness({ track: { volume_info: { loudness: -8.4, peak: 0.97 } } }))
      .toEqual({ gain: -8.4, peak: 0.97 })
  })

  it('does not treat effect-chain gain_db as song loudness', () => {
    expect(mapQishuiLoudness({ chains: [{ nodes: [{ type: 'gain', gain_db: -3.5 }] }] }))
      .toBeUndefined()
  })
})
