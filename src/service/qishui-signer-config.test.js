import { describe, expect, it } from 'vitest'
import { resolveQishuiSignerUrl } from './qishui-signer-config.js'

describe('qishui signer URL resolution', () => {
  it('prefers the saved admin URL and falls back to the environment URL', () => {
    expect(resolveQishuiSignerUrl('http://qishui-signer:8080/sign', 'http://env/sign')).toBe('http://qishui-signer:8080/sign')
    expect(resolveQishuiSignerUrl('', 'http://env/sign')).toBe('http://env/sign')
    expect(resolveQishuiSignerUrl('   ', 'http://env/sign')).toBe('http://env/sign')
  })
})
