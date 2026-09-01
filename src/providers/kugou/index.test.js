import { describe, expect, it } from 'vitest'
import kugou, { buildKugouDevice, mapKugouSong, normalizeKugouId, buildKugouSignature } from './index.js'

describe('kugou provider contract', () => {
  it('registers the unified Meting capabilities', () => {
    const registry = { register: (name, value) => { registry.name = name; registry.value = value } }
    kugou.register(registry)
    expect(registry.name).toBe('kugou')
    expect(registry.value.support_type).toEqual(expect.arrayContaining([
      'url', 'pic', 'lrc', 'song', 'playlist', 'search', 'search_playlist', 'fm',
    ]))
  })

  it('normalizes a Kugou song hash or composite id', () => {
    expect(normalizeKugouId('ABCDEF,123')).toEqual({ hash: 'abcdef', albumAudioId: 123 })
    expect(normalizeKugouId('ABCDEF')).toEqual({ hash: 'abcdef', albumAudioId: 0 })
  })

  it('maps Kugou search records to the shared song shape', () => {
    expect(mapKugouSong({
      hash: 'ABC', songname: '测试', singername: '歌手', album_name: '专辑',
      img: 'http://s1.example/{size}', duration: 215,
    })).toMatchObject({
      id: 'abc', title: '测试', author: '歌手', album: '专辑',
      pic: 'https://s1.example/400', duration: 215, url: 'abc', lrc: 'abc',
    })
  })

  it('maps the public Web search record shape', () => {
    expect(mapKugouSong({
      FileHash: 'ABCDEF', FileName: '歌手 - 测试歌曲', SingerName: '歌手', AlbumName: '专辑',
      Image: 'http://s1.example/{size}', Duration: 215,
    })).toMatchObject({
      id: 'abcdef', title: '测试歌曲', author: '歌手', album: '专辑',
      pic: 'https://s1.example/400', duration: 215, url: 'abcdef', lrc: 'abcdef',
    })
  })

  it('builds the tracker key required by the play-url endpoint', async () => {
    const { buildKugouTrackKey } = await import('./index.js')
    expect(buildKugouTrackKey('abcdef', { KUGOU_API_MID: 'device-mid', userid: '42' })).toBe('1caced7d174e717d08ddd25bc1990975')
  })

  it('reports the actual standard quality when an SVIP request returns a 128kbps MP3', async () => {
    const { getKugouActualQuality } = await import('./index.js')
    expect(getKugouActualQuality({ bitRate: 128000, extName: 'mp3', fileSize: 4_162_655 })).toMatchObject({ name: '标准' })
  })

  it('uses media metadata instead of a requested master flag on a downgraded response', async () => {
    const { getKugouActualQuality } = await import('./index.js')
    expect(getKugouActualQuality({ quality: 'super', bitRate: 128000, extName: 'mp3', fileSize: 4_162_655 })).toMatchObject({ name: '标准' })
  })

  it('maps Kugou volume metadata to the shared loudness shape', async () => {
    const { mapKugouLoudness } = await import('./index.js')
    expect(mapKugouLoudness({ volume: -10.1, volume_peak: 1.6, volume_gain: 0 })).toEqual({ gain: -10.1, peak: 1.6 })
  })

  it('uses the API cookie device identity in Android request parameters', () => {
    expect(buildKugouDevice({ dfid: 'dfid-1', KUGOU_API_MID: '123456789', KUGOU_API_DEV: 'DEV1234567' })).toMatchObject({
      dfid: 'dfid-1',
      mid: '123456789',
      uuid: '-',
      appid: 3116,
      clientver: 11440,
    })
  })
  it('creates the Android request signature deterministically', () => {
    expect(buildKugouSignature({ appid: 3116, clientver: 11440, hash: 'abc' }, '')).toBe('c61e6852e071acf8e5435eff08874afe')
  })
})
