import { describe, expect, it } from 'vitest'
import kugou, { buildKugouDevice, buildKugouLegacyMid, mapKugouSong, normalizeKugouId, buildKugouSignature, isKugouNonFatalError, buildKugouPlaylistRequest, isKugouShareCode, extractKugouShareCollectionId, buildKugouShareRequest, buildKugouShareKey } from './index.js'

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

  it('only accepts collection ids for playlist requests', async () => {
    const { isKugouCollectionId } = await import('./index.js')
    expect(isKugouCollectionId('collection_3_975665376_1162_0')).toBe(true)
    expect(isKugouCollectionId('gcid_3zik61ilzx7z09d')).toBe(false)
    expect(isKugouCollectionId('1852429')).toBe(false)
    expect(isKugouCollectionId('https://m.kugou.com/songlist/gcid_3zik61ilzx7z09d/')).toBe(false)
  })

  it('maps legacy Android playlist records with audio_name and authors', () => {
    expect(mapKugouSong({
      hash: 'ABCDEF', audio_name: 'Rosy赵露思 - 有你在 (Whatever官方中文版)',
      authors: [{ author_name: 'Rosy赵露思' }], albuminfo: { name: '有你在' }, timelen: 152607,
    })).toMatchObject({
      id: 'abcdef', title: '有你在 (Whatever官方中文版)', author: 'Rosy赵露思', album: '有你在', duration: 153,
    })
  })

  it('generates a deterministic decimal legacy Android MID from a seed', () => {
    expect(buildKugouLegacyMid('device-seed')).toMatch(/^\d+$/)
    expect(buildKugouLegacyMid('device-seed')).toBe(buildKugouLegacyMid('device-seed'))
  })

  it('normalizes desktop and mobile gcid sharing URLs to the mobile parser URL', async () => {
    const { buildKugouMobilePlaylistUrl } = await import('./index.js')
    expect(buildKugouMobilePlaylistUrl('https://www.kugou.com/songlist/gcid_3zik61ilzx7z09d/?chl=wechat')).toBe('https://m.kugou.com/songlist/gcid_3zik61ilzx7z09d/')
    expect(buildKugouMobilePlaylistUrl('https://m.kugou.com/songlist/gcid_3zik61ilzx7z09d/')).toBe('https://m.kugou.com/songlist/gcid_3zik61ilzx7z09d/')
  })

  it('recognizes numeric Kugou share codes without confusing playlist ids', () => {
    expect(isKugouShareCode('39499569')).toBe(true)
    expect(isKugouShareCode(' collection_3_975665376_1162_0 ')).toBe(false)
    expect(isKugouShareCode('1852429')).toBe(false)
  })

  it('builds the legacy share-code command request from dynamic device values', () => {
    const request = buildKugouShareRequest('39499569', {
      mid: 'mid-1', clienttime: 841742523, clienttimems: 1788398523665, deviceId: 'device-1',
    })
    expect(request).toMatchObject({
      url: 'http://t.kugou.com/command/', method: 'POST',
      headers: expect.objectContaining({ 'KG-CLIENTTIMEMS': '1788398523665', 'KG-DEVID': 'device-1' }),
      body: { appid: 1001, clientver: 20141, mid: 'mid-1', clienttime: 841742523, data: '39499569', key: expect.any(String) },
    })
    expect(buildKugouShareKey('39499569')).toBe(request.body.key)
  })

  it('extracts a collection id from either command response field', () => {
    expect(extractKugouShareCollectionId({ status: 1, err_code: 0, data: { info: { global_collection_id: 'collection_3_975665376_1162_0' } } })).toBe('collection_3_975665376_1162_0')
    expect(extractKugouShareCollectionId({ status: 1, err_code: 0, data: { info: { copy_gcid: 'collection_3_975665376_1162_0' } } })).toBe('collection_3_975665376_1162_0')
    expect(extractKugouShareCollectionId({ status: 0, err_code: 20006, data: { info: {} } })).toBe('')
  })

  it('maps Kugou search playlist results to the global collection id', async () => {
    const { mapKugouPlaylist } = await import('./index.js')
    expect(mapKugouPlaylist({ specialid: 1852429, gid: 'collection_3_975665376_920_0', specialname: '测试歌单' })).toMatchObject({
      id: 'collection_3_975665376_920_0',
      url: 'collection_3_975665376_920_0',
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

  it('uses the reference personal FM endpoint request shape', async () => {
    const { buildKugouFmRequest } = await import('./index.js')
    const request = buildKugouFmRequest({ userid: '42', token: 'token-1', vip_type: '1', KUGOU_API_MID: 'mid-1' }, 1700000000000)
    expect(request).toMatchObject({
      path: '/v2/personal_recommend',
      method: 'POST',
      router: 'persnfm.service.kugou.com',
      body: expect.objectContaining({ appid: 3116, clientver: 11440, clienttime: 1700000000000, userid: '42', kguid: '42', token: 'token-1', vip_type: '1' }),
    })
    expect(request.body.key).toHaveLength(32)
  })

  it('uses media metadata instead of a requested master flag on a downgraded response', async () => {
    const { getKugouActualQuality } = await import('./index.js')
    expect(getKugouActualQuality({ quality: 'super', bitRate: 128000, extName: 'mp3', fileSize: 4_162_655 })).toMatchObject({ name: '标准' })
  })

  it('prefers explicit Viper quality metadata returned by Kugou', async () => {
    const { getKugouActualQuality } = await import('./index.js')
    expect(getKugouActualQuality({ quality: 'viper_tape', bitRate: 128000, extName: 'mp3' })).toMatchObject({ name: '蝰蛇母带音质' })
    expect(getKugouActualQuality({ quality_name: 'viper_hifi', bitRate: 128000, extName: 'mp3' })).toMatchObject({ name: '蝰蛇HiFi音质' })
    expect(getKugouActualQuality({ quality: 'multitrack' })).toMatchObject({ name: '多轨音质' })
  })

  it('maps all supported Viper quality aliases to tracker request values', async () => {
    const { getKugouQuality } = await import('./index.js')
    expect(getKugouQuality('hires')).toMatchObject({ request: 'high', name: 'Hi-Res音质' })
    expect(getKugouQuality('atmos')).toMatchObject({ request: 'viper_atmos', name: '蝰蛇全景声2.0' })
    expect(getKugouQuality('viper_tape')).toMatchObject({ request: 'viper_tape', name: '蝰蛇母带音质' })
    expect(getKugouQuality('viper_clear')).toMatchObject({ request: 'viper_clear', name: '蝰蛇超清音质' })
    expect(getKugouQuality('viper_hifi')).toMatchObject({ request: 'viper_hifi', name: '蝰蛇HiFi音质' })
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
  it('builds playlist requests like the reference Kugou API module', () => {
    expect(buildKugouPlaylistRequest('12345678', { page: 2, pagesize: 30 })).toEqual({
      path: '/pubsongs/v2/get_other_list_file_nofilt',
      params: {
        area_code: 1,
        begin_idx: 30,
        plat: 1,
        type: 1,
        mode: 1,
        personal_switch: 1,
        extend_fields: 'abtags,hot_cmt,popularization',
        pagesize: 30,
        global_collection_id: '12345678',
      },
    })
  })



  it('treats expired or rejected Kugou upstream requests as non-fatal provider misses', () => {
    expect(isKugouNonFatalError({ code: 20010 })).toBe(true)
    expect(isKugouNonFatalError({ code: 200101 })).toBe(true)
    expect(isKugouNonFatalError({ status: 500 })).toBe(true)
    expect(isKugouNonFatalError({ code: 401 })).toBe(false)
  })

  it('creates the Android request signature deterministically', () => {
    expect(buildKugouSignature({ appid: 3116, clientver: 11440, hash: 'abc' }, '')).toBe('c61e6852e071acf8e5435eff08874afe')
  })
  it('extracts playlist metadata and tracks from a mobile Kugou share page', async () => {
    const { extractKugouMobilePlaylist } = await import('./index.js')
    const html = '<script>window.$output = {"info":{"listinfo":{"name":"甜度100%","list_create_username":"芋圆啵啵","pic":"http://c1.kgimg.com/custom/{size}/cover.jpg","count":52},"songs":[{"hash":"9156BDEEA2A465F95EED8EDDF595DB03","name":"Rosy赵露思 - 有你在","timelen":152607,"albuminfo":{"name":"有你在"},"cover":"http://imge.kugou.com/stdmusic/{size}/cover.jpg"}]}};</script>'
    expect(extractKugouMobilePlaylist(html)).toMatchObject({
      trackCount: 52,
      songs: [{ id: '9156bdeea2a465f95eed8eddf595db03', title: '有你在', author: 'Rosy赵露思', album: '有你在', duration: 153 }],
    })
  })

  it('builds the legacy Android special playlist request for full-track pagination', async () => {
    const { buildKugouSpecialPlaylistRequest } = await import('./index.js')
    expect(buildKugouSpecialPlaylistRequest(5294381, 2, 300, { mid: 'device-mid', dfid: 'dfid-1' })).toEqual({
      base: 'https://gatewayretry.kugou.com',
      path: '/v2/get_other_list_file',
      headers: expect.objectContaining({
        'x-router': 'pubsongscdn.kugou.com',
        'User-Agent': 'Android9-AndroidPhone-11239-18-0-playlist-wifi',
        mid: 'device-mid', dfid: 'dfid-1',
      }),
      params: expect.objectContaining({
        specialid: 5294381,
        specalidpgc: 5294381,
        page: 2,
        pagesize: 300,
        appid: 1005,
        clientver: 11239,
      }),
    })
  })
})
