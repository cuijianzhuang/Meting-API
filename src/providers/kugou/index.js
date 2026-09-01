import { createHash } from 'node:crypto'

const LITE_APPID = 3116
const LITE_CLIENTVER = 11440
const SIGN_SALT = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA'
const TRACK_KEY_SALT = '185672dd44712f60bb1736df5a377e82'
const API_BASE = 'https://gateway.kugou.com'
const LYRIC_BASE = 'https://lyrics.kugou.com'
const MID = '0'

const text = (value) => String(value ?? '').trim()
const md5 = (value) => createHash('md5').update(String(value)).digest('hex')

export const buildKugouSignature = (params, body = '') => {
  const serialized = Object.keys(params).sort().map((key) => {
    const value = params[key]
    return `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`
  }).join('')
  return md5(`${SIGN_SALT}${serialized}${body || ''}${SIGN_SALT}`)
}

export const parseKugouCookie = (raw = '') => Object.fromEntries(text(raw).split(';').map((part) => {
  const index = part.indexOf('=')
  return index > 0 ? [part.slice(0, index).trim(), part.slice(index + 1).trim()] : null
}).filter(Boolean))

export const isKugouMembershipRequestParamError = (error) => Number(error?.code || error?.error_code) === 20010
export const buildKugouTrackKey = (hash, cookie = {}) => md5(`${text(hash).toLowerCase()}${TRACK_KEY_SALT}${LITE_APPID}${buildKugouDevice(cookie).mid}${Number(cookie.userid) || 0}`)
export const normalizeKugouId = (id) => {
  const [hash = '', albumAudioId = '0'] = text(id).split(',')
  return { hash: hash.toLowerCase(), albumAudioId: Number(albumAudioId) || 0 }
}

const imageUrl = (value) => text(value).replace('{size}', '400').replace('{hash}', '').replace('http://', 'https://')

export const mapKugouSong = (song = {}) => {
  const hash = text(song.hash || song.Hash || song.fileHash || song.FileHash).toLowerCase()
  const fileName = text(song.FileName || song.filename || song.file_name)
  const fileTitle = fileName.includes(' - ') ? fileName.slice(fileName.indexOf(' - ') + 3).trim() : fileName
  const duration = Number(song.duration ?? song.Duration ?? song.timelength ?? 0)
  return {
    id: hash,
    title: text(song.songname || song.songName || song.SongName || song.name || fileTitle),
    author: text(song.singername || song.singerName || song.SingerName || song.author_name || song.author),
    album: text(song.album_name || song.albumName || song.AlbumName || song.album),
    pic: imageUrl(song.img || song.image || song.Image || song.album_img || song.albumImage),
    duration: duration > 10000 ? Math.round(duration / 1000) : duration,
    url: hash,
    lrc: hash,
    source: 'kugou',
  }
}

export const buildKugouDevice = (cookie = {}) => ({
  dfid: text(cookie.dfid || cookie.kg_dfid || '-'),
  mid: text(cookie.KUGOU_API_MID || cookie.mid || cookie.kg_mid || MID),
  uuid: '-',
  appid: LITE_APPID,
  clientver: LITE_CLIENTVER,
})

export const requestKugou = async (path, { params = {}, method = 'GET', body, cookie = {}, base = API_BASE, headers = {}, signed = true } = {}) => {
  const device = buildKugouDevice(cookie)
  const clienttime = Math.floor(Date.now() / 1000)
  const allParams = signed ? { ...device, clienttime, ...params } : { ...params }
  if (signed && cookie.token) allParams.token = cookie.token
  if (signed && cookie.userid) allParams.userid = cookie.userid
  const bodyText = body === undefined ? '' : JSON.stringify(body)
  if (signed) allParams.signature = buildKugouSignature(allParams, bodyText)
  const url = new URL(path, base)
  Object.entries(allParams).forEach(([key, value]) => url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value)))
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
      ...(signed ? { dfid: device.dfid, mid: device.mid, clienttime: String(clienttime) } : {}),
      'x-router': headers['x-router'] || '',
      ...headers,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(text(cookie.__raw) ? { Cookie: cookie.__raw } : {}),
    },
    ...(body !== undefined ? { body: bodyText } : {}),
  })
  if (!response.ok) throw new Error(`酷狗接口返回 ${response.status}`)
  const data = await response.json()
  if (data?.error_code !== undefined && Number(data.error_code) !== 0) {
    const error = new Error(data?.error || data?.msg || data?.data?.errmsg || '酷狗接口请求失败')
    error.code = Number(data.error_code)
    error.payload = data
    throw error
  }
  return data
}

const extractSongs = (data) => {
  const list = data?.data?.info || data?.data?.lists || data?.data?.songs || data?.data?.songlist || data?.info || []
  return Array.isArray(list) ? list.map(mapKugouSong).filter((song) => song.id) : []
}

const search = async (keyword, cookie) => {
  const data = await requestKugou('/song_search_v2', {
    base: 'https://songsearch.kugou.com',
    params: { keyword, page: 1, pagesize: 30, platform: 'WebFilter', filter: 2 },
    cookie,
    signed: false,
  })
  return extractSongs(data)
}

const searchPlaylist = async (keyword, cookie) => {
  const data = await requestKugou('/v1/search/special', {
    params: { keyword, page: 1, pagesize: 30, platform: 'AndroidFilter' }, cookie,
    headers: { 'x-router': 'complexsearch.kugou.com' },
  })
  const list = data?.data?.lists || data?.data?.info || data?.lists || []
  return Array.isArray(list) ? list.map((item) => ({
    id: text(item.global_collection_id || item.specialid || item.id),
    title: text(item.specialname || item.name || item.title),
    author: text(item.nickname || item.username || item.author_name),
    pic: imageUrl(item.img || item.image || item.imgurl),
    url: text(item.global_collection_id || item.specialid || item.id),
    trackCount: Number(item.song_count || item.trackCount || 0),
    source: 'kugou',
  })).filter((item) => item.id) : []
}

const personalFm = async (cookie) => {
  const data = await requestKugou('/v2/personal_recommend', {
    method: 'POST',
    body: { action: 'play', recommend_source_locked: 0, song_pool_id: 0, callerid: 0, m_type: 1, platform: 'ios', area_code: 1, remain_songcnt: 0, mode: 'normal', fakem: 'ca981cfc583a4c37f28d2d49000013c16a0a' },
    cookie, headers: { 'x-router': 'persnfm.service.kugou.com' },
  })
  return extractSongs(data)
}

const song = async (id, cookie) => {
  const { hash } = normalizeKugouId(id)
  return extractSongs(await requestKugou('/v1/audio/audio', {
    method: 'POST', body: { data: [{ hash, audio_id: 0 }] }, cookie,
    base: 'http://kmr.service.kugou.com', headers: { 'x-router': 'kmr.service.kugou.com' },
  }))
}

const playlist = async (id, cookie) => extractSongs(await requestKugou('/pubsongs/v2/get_other_list_file_nofilt', {
  params: { global_collection_id: id, area_code: 1, begin_idx: 0, pagesize: 1000, plat: 1, type: 1, mode: 1, personal_switch: 1 }, cookie,
}))

const KUGOU_QUALITY_MAP = {
  standard: { request: 128, name: '标准' },
  '128': { request: 128, name: '标准' },
  '320': { request: 320, name: '极高' },
  exhigh: { request: 320, name: '极高' },
  flac: { request: 'flac', name: '无损' },
  lossless: { request: 'flac', name: '无损' },
  hires: { request: 'high', name: '高解析度无损' },
  atmos: { request: 'viper_atmos', name: '全景声' },
  master: { request: 'super', name: '母带' },
}

export const getKugouQuality = (quality = 'standard') => KUGOU_QUALITY_MAP[String(quality).toLowerCase()] || KUGOU_QUALITY_MAP.standard

export const mapKugouLoudness = (info = {}) => {
  const gain = Number(info.volume)
  const peak = Number(info.volume_peak)
  const loudness = {}
  if (Number.isFinite(gain)) loudness.gain = gain
  if (Number.isFinite(peak)) loudness.peak = peak
  return Object.keys(loudness).length ? loudness : undefined
}

export const getKugouActualQuality = (info = {}) => {
  const bitrate = Number(info.bitRate ?? info.bitrate ?? info.bit_rate ?? 0)
  const kbps = bitrate > 10_000 ? bitrate / 1000 : bitrate
  const extension = text(info.extName || info.extname || info.ext || '').toLowerCase()
  if (extension || bitrate > 0) {
    if (extension === 'flac' || kbps >= 700) return KUGOU_QUALITY_MAP.flac
    if (kbps >= 280) return KUGOU_QUALITY_MAP['320']
    return KUGOU_QUALITY_MAP.standard
  }

  const responseQuality = text(info.quality || info.quality_name).toLowerCase()
  const explicit = Object.values(KUGOU_QUALITY_MAP).find((item) => String(item.request).toLowerCase() === responseQuality)
  if (explicit) return explicit
  return KUGOU_QUALITY_MAP.standard
}

const positive = (value) => value === true || Number(value) > 0 || ['true', 'yes', 'vip'].includes(String(value || '').toLowerCase())
const svip = (value) => value === true || Number(value) > 0 || ['true', 'yes', 'svip', 'super_vip', 'supervip'].includes(String(value || '').toLowerCase())

export const mapKugouMembership = (payload = {}, cookie = {}) => {
  const data = payload?.data?.data || payload?.data || payload || {}
  const vipType = Number(data.vip_type ?? data.vipType ?? data.type ?? cookie.vip_type ?? 0) || 0
  const isSvip = [
    data.is_svip, data.isSvip, data.svip, data.super_vip, data.superVip,
    data.is_super_vip, data.isSuperVip,
  ].some(svip) || ['svip', 'super_vip', 'supervip'].includes(String(data.product_type ?? data.productType ?? data.vip_name ?? data.vipName ?? '').toLowerCase())
  const isVip = isSvip || [data.is_vip, data.isVip, data.vip, data.vip_status, data.vipStatus].some(positive) || vipType > 0
  return { vipType, isVip, isSvip, canPlayVip: isVip, canPlaySvip: isSvip }
}
const audioUrl = async (id, quality, cookie) => {
  const { hash, albumAudioId } = normalizeKugouId(id)
  const requested = getKugouQuality(quality)
  const data = await requestKugou('/v5/url', {
    params: {
      album_id: 0, area_code: 1, hash, ssa_flag: 'is_fromtrack', version: 11430,
      page_id: 967177915, quality: requested.request, album_audio_id: albumAudioId,
      behavior: 'play', pid: 411, cmd: 26, pidversion: 3001, cdnBackup: 1,
      IsFreePart: 1, ppage_id: '356753938,823673182,967485191', module: '',
      key: buildKugouTrackKey(hash, cookie),
    },
    cookie, headers: { 'x-router': 'trackercdn.kugou.com' },
  })
  const info = data?.data || data
  const url = [info?.play_url, info?.url, info?.ori_url, info?.backupUrl, info?.backup_url].flat().find(Boolean) || ''
  const actual = getKugouActualQuality(info)
  return {
    url, quality: actual.name,
    duration: Number(info?.timeLength || info?.duration || 0) || undefined,
    loudness: mapKugouLoudness(info),
    pic: imageUrl(info?.trans_param?.union_cover || info?.img || info?.image),
    ...(url ? {} : { reason: text(info?.fail_process?.join(' / ') || info?.error_msg || '该曲目当前无可播放地址') }),
  }
}
const lyric = async (id, cookie) => {
  const { hash } = normalizeKugouId(id)
  const searchData = await requestKugou('/search', {
    base: LYRIC_BASE, params: { ver: 1, man: 'yes', client: 'pc', hash }, cookie, signed: false,
  })
  const item = searchData?.candidates?.[0]
  if (!item?.id || !item?.accesskey) return { lyric: '' }
  const result = await requestKugou('/download', {
    base: LYRIC_BASE, params: { ver: 1, client: 'pc', id: item.id, accesskey: item.accesskey, fmt: 'lrc', charset: 'utf8' }, cookie, signed: false,
  })
  const content = result?.content || ''
  return { lyric: content ? Buffer.from(content, 'base64').toString('utf8') : '' }
}

const handle = async (type, id, rawCookie = '', options = {}) => {
  const cookie = { ...parseKugouCookie(rawCookie), __raw: rawCookie }
  if (type === 'search') return search(id, cookie)
  if (type === 'song') return song(id, cookie)
  if (type === 'playlist') return playlist(id, cookie)
  if (type === 'search_playlist') return searchPlaylist(id, cookie)
  if (type === 'url') return audioUrl(id, options.quality || 'standard', cookie)
  if (type === 'lrc') return lyric(id, cookie)
  if (type === 'pic') return (await audioUrl(id, 'standard', cookie)).pic || ''
  if (type === 'fm') return personalFm(cookie)
  return []
}

const support_type = ['url', 'pic', 'lrc', 'song', 'playlist', 'search', 'search_playlist', 'fm']

export default { register: (ctx) => ctx.register('kugou', { handle, support_type }) }
