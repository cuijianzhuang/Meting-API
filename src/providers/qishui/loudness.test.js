import { describe, expect, it } from 'vitest'
import { analyzePcmLoudness, analyzeQishuiAudioBuffer } from './loudness.js'

const makePcm = (values) => Float32Array.from(values)

const makeWav16Mono = (samples, sampleRate = 8000) => {
  const data = Buffer.alloc(44 + samples.length * 2)
  data.write('RIFF', 0)
  data.writeUInt32LE(36 + samples.length * 2, 4)
  data.write('WAVE', 8)
  data.write('fmt ', 12)
  data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20)
  data.writeUInt16LE(1, 22)
  data.writeUInt32LE(sampleRate, 24)
  data.writeUInt32LE(sampleRate * 2, 28)
  data.writeUInt16LE(2, 32)
  data.writeUInt16LE(16, 34)
  data.write('data', 36)
  data.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((sample, index) => data.writeInt16LE(Math.round(sample * 32767), 44 + index * 2))
  return data
}

describe('qishui audio loudness analysis', () => {
  it('calculates RMS gain in dBFS and linear peak from PCM', () => {
    expect(analyzePcmLoudness([makePcm([0.5, -0.5, 0.5, -0.5])])).toEqual({
      gain: -6.0206,
      peak: 0.5,
    })
  })

  it('decodes a WAV buffer without invoking an external executable', async () => {
    const result = await analyzeQishuiAudioBuffer(makeWav16Mono([0.25, -0.25, 0.25, -0.25]), 'audio/wav')
    expect(result).toEqual({ gain: -12.0412, peak: 0.25 })
  })

  it('returns undefined for an unsupported compressed container', async () => {
    await expect(analyzeQishuiAudioBuffer(Buffer.from('not audio'), 'audio/mp4')).resolves.toBeUndefined()
  })
})
