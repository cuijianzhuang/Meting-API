import { describe, expect, it } from 'vitest'
import { buildQishuiSignerPayload, isQishuiRemoteSignerConfigured } from './signature.js'

describe('qishui docker signer payload', () => {
  it('keeps the complete URL and ordered header pairs for a remote signer', () => {
    expect(buildQishuiSignerPayload({
      url: 'https://api.qishui.com/luna/pc/track_v2?aid=386088',
      deviceId: 'DEVICE',
      headers: { Accept: '*/*', 'User-Agent': 'LunaPC/test' },
    })).toEqual({
      deviceId: 'DEVICE',
      url: 'https://api.qishui.com/luna/pc/track_v2?aid=386088',
      headers: ['accept', '*/*', 'user-agent', 'LunaPC/test'],
    })
  })

  it('requires a configured remote signer requires a configured remote signer', () => {
    expect(isQishuiRemoteSignerConfigured('')).toBe(false)
    expect(isQishuiRemoteSignerConfigured('http://qishui-signer:8080/sign')).toBe(true)
  })
})
