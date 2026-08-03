const PUBLIC_SEARCH = 'https://api-vehicle.volcengine.com/v2/search/type'
const PUBLIC_DETAIL = 'https://api-vehicle.volcengine.com/v2/custom/contents'
const PC_API = 'https://api.qishui.com'
const PUBLIC_PLAYBACK = 'https://beta-luna.douyin.com/luna/h5/seo_track'

const WEB_UA = 'LunaPC/3.3.0(359450208)'
const WEB_BASES = ['https://api5-lq.qishui.com', PC_API]

const text = (value) => String(value ?? '').trim()
const object = (...values) => values.find(value => value && typeof value === 'object' && !Array.isArray(value)) || {}
const array = (...values) => values.find(Array.isArray) || []

const normalizeCookie = (raw) => {
    const values = new Map()
    text(raw).split(';').forEach(part => {
        const index = part.indexOf('=')
        if (index <= 0) return
        const key = part.slice(0, index).trim()
        const value = part.slice(index + 1).trim()
        if (key && value) values.set(key, value)
    })
    return [...values].map(([key, value]) => `${key}=${value}`).join('; ')
}

export const qishuiCookieHasLogin = (raw) => {
    const cookie = normalizeCookie(raw).toLowerCase()
    return /(?:^|;\s*)(?:sessionid|sessionid_ss|sid_guard|uid_tt|passport_csrf_token)=/.test(cookie)
}

const pcParams = (extra = {}) => {
    const now = Date.now()
    return {
        aid: '386088', app_name: 'luna_pc', region: 'cn', geo_region: 'cn', os_region: 'cn',
        device_id: String(now), iid: String(now + 1), version_name: '3.3.0', version_code: '30030000',
        channel: 'official', build_mode: 'master', ac: 'wifi', tz_name: 'Asia/Shanghai',
        device_platform: 'windows', device_type: 'Windows', os_version: 'Windows 11', fp: String(now),
        ...extra,
    }
}

const urlWithParams = (base, params) => {
    const url = new URL(base)
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
    })
    return url.toString()
}

const requestJson = async (url, { cookie = '', method = 'GET', body, timeout = 10000, headers: extraHeaders = {} } = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
        const response = await fetch(url, {
            method,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
            headers: {
                Accept: 'application/json,text/plain,*/*',
                'Content-Type': 'application/json; charset=utf-8',
                'User-Agent': WEB_UA,
                Referer: 'https://www.qishui.com/',
                ...(cookie ? { Cookie: normalizeCookie(cookie) } : {}),
                ...(cookie ? {
                    'x-luna-background-type': 'foreground',
                    'x-luna-is-background-req': '0',
                    'x-luna-is-local-user': '1',
                } : {}),
                ...extraHeaders,
            },
        })
        if (!response.ok) throw new Error(`汽水接口返回 ${response.status}`)
        const json = await response.json()
        const status = object(json?.status_info, json?.statusInfo)
        const code = Number(status.status_code ?? status.statusCode ?? json?.status_code ?? 0)
        if (code) throw new Error(text(status.status_msg || status.statusMsg || json?.message || `汽水状态码 ${code}`))
        return json
    } finally {
        clearTimeout(timer)
    }
}

const firstUrl = (value) => {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value
    if (Array.isArray(value)) return value.map(firstUrl).find(Boolean) || ''
    if (value && typeof value === 'object') {
        return firstUrl(value.url_list || value.urlList || value.urls || value.uri || value.url)
    }
    return ''
}

const collectMedia = (payload) => {
    const root = payload?.data || payload || {}
    const direct = array(
        root.media_resources, root.media_list, root.related_media, root.medias, root.media,
        root.tracks, root.track_list, root.songs, root.items, root.list, root.result,
        root.song_list, root.recommend_media_list,
    )
    if (direct.length) return direct
    let best = []
    const visit = (node, depth = 0) => {
        if (!node || depth > 5) return
        if (Array.isArray(node)) {
            const media = node.filter(item => item && typeof item === 'object' && (
                item.media || item.track_entity || item.entity || item.base_info || item.item_id || item.id
            ))
            if (media.length > best.length) best = media
            node.slice(0, 100).forEach(item => visit(item, depth + 1))
            return
        }
        if (typeof node === 'object') Object.values(node).slice(0, 100).forEach(item => visit(item, depth + 1))
    }
    visit(root)
    return best
}

const seconds = (value) => {
    const number = Number(value) || 0
    return number > 10000 ? Math.round(number / 1000) : Math.round(number)
}

const artistText = (...values) => {
    const names = []
    const seen = new Set()
    const visit = (value, depth = 0) => {
        if (!value || depth > 4) return
        if (typeof value === 'string') {
            const name = text(value)
            if (name && !seen.has(name)) { seen.add(name); names.push(name) }
            return
        }
        if (Array.isArray(value)) {
            value.slice(0, 20).forEach(item => visit(item, depth + 1))
            return
        }
        if (typeof value !== 'object') return
        const direct = text(value.name || value.artist_name || value.author_name || value.nickname)
        if (direct && !seen.has(direct)) { seen.add(direct); names.push(direct) }
        ;[
            value.artist, value.artists, value.artist_info, value.artist_links,
            value.author, value.authors, value.author_info,
            value.singer, value.singers, value.singer_info,
            value.entity, value.link,
        ].forEach(item => visit(item, depth + 1))
    }
    values.forEach(value => visit(value))
    return names.join(' / ')
}

const mapMedia = (raw, index = 0) => {
    const entity = object(raw?.entity, raw?.data, raw)
    const media = object(entity.media, raw?.media, entity)
    const wrapper = object(entity.track_wrapper, media.track_wrapper, raw?.track_wrapper)
    const track = object(wrapper.track, media.track_entity, raw?.track_entity, media.track, raw?.track, media)
    const base = object(track.base_info, media.base_info, raw?.base_info, track)
    const display = object(track.display_info, media.display_info, raw?.display_info)
    const related = object(track.related_info, media.related_info, raw?.related_info)
    const album = object(raw?.album_info, raw?.album, related.album_link, base.album, track.album)
    const id = text(base.id || track.id || media.id || raw?.item_id || raw?.song_id || raw?.music_id)
    const name = text(base.name || base.title || track.name || track.title || media.name || raw?.title || raw?.name)
    if (!id || !name) return null
    const artist = artistText(
        raw?.author_info, raw?.author, raw?.authors, raw?.artist, raw?.artists, raw?.singer, raw?.singers,
        related.artist_links, related.artist, related.artists,
        base.author, base.authors, base.artist, base.artists, base.singer, base.singers,
        track.author, track.authors, track.artist, track.artists, track.singer, track.singers,
        raw?.author_name, raw?.artist_name,
    ) || '未知歌手'
    return {
        id,
        name,
        artist,
        album: text(album.name || album.title || raw?.album_name || base.album_name),
        pic: firstUrl(display.cover_url || base.cover_url || track.cover_url || raw?.cover_url || raw?.cover || album.cover_url),
        duration: seconds(base.duration_ms || base.duration || track.duration_ms || track.duration || raw?.duration_ms || raw?.duration),
        url: id,
        lrc: id,
        source: 'qishui',
        _rank: index,
    }
}

const publicSearch = async (keyword, limit = 30) => {
    const json = await requestJson(urlWithParams(PUBLIC_SEARCH, {
        keyword, search_type: 'music', limit: Math.max(30, limit), real_offset: 0, search_source: 'qishui',
    }))
    return array(json?.data?.list).map(mapMedia).filter(Boolean).slice(0, limit)
}

const pcSearch = async (keyword, cookie, limit = 30) => {
    const json = await requestJson(urlWithParams(`${PC_API}/luna/pc/search/track`, pcParams({
        q: keyword, cursor: '0', count: Math.min(50, limit), search_method: 'input',
    })), { cookie })
    return collectMedia(json).map(mapMedia).filter(Boolean).slice(0, limit)
}

const get_search_songs = async (keyword, cookie) => {
    if (qishuiCookieHasLogin(cookie)) {
        try { return await pcSearch(keyword, cookie) } catch (error) { console.warn('[Qishui] 登录搜索回退:', error.message) }
    }
    return publicSearch(keyword)
}

const getPublicDetail = async (id) => {
    const json = await requestJson(urlWithParams(PUBLIC_DETAIL, {
        sources: 'qishui', need_author: true, need_album: true, need_ugc: true, need_stat: true, item_ids: id,
    }))
    return array(json?.data?.list)[0] || null
}

const get_song_info = async (id, cookie) => {
    if (qishuiCookieHasLogin(cookie)) {
        try {
            const json = await requestJson(urlWithParams(`${PC_API}/luna/pc/track_v2`, pcParams({ track_id: id, media_type: 'track' })), { cookie })
            const item = mapMedia(object(json?.data?.track, json?.track, json?.data, json))
            if (item) return [item]
        } catch (error) { console.warn('[Qishui] 登录详情回退:', error.message) }
    }
    const item = mapMedia(await getPublicDetail(id))
    return item ? [item] : []
}

const normalizeLyric = (input) => text(input).replace(/\\n/g, '\n').split('\n').map(line => {
    const match = /^\[(\d+),(\d+)\](.*)$/.exec(line.trim())
    if (!match) return line
    const time = Number(match[1]) || 0
    const minutes = Math.floor(time / 60000)
    const secondsValue = ((time % 60000) / 1000).toFixed(3).padStart(6, '0')
    const body = match[3].replace(/<\d+,\d+,\d+>/g, '')
    return `[${String(minutes).padStart(2, '0')}:${secondsValue}]${body}`
}).join('\n')

const lyricText = (node) => {
    if (typeof node === 'string' && node.includes('[')) return normalizeLyric(node)
    if (!node || typeof node !== 'object') return ''
    return lyricText(node.content || node.lyric_text || node.lyric || node.text || node.entity)
}

const findLyrics = (payload) => {
    let lyric = ''
    let tlyric = ''
    const seen = new Set()
    const visit = (node, path = '', depth = 0) => {
        if (!node || depth > 7 || seen.has(node) || (lyric && tlyric)) return
        if (typeof node !== 'object') return
        seen.add(node)
        Object.entries(node).slice(0, 120).forEach(([key, value]) => {
            const next = `${path}.${key}`
            if (/lyric|translation|tlyric/i.test(key)) {
                const valueText = lyricText(value)
                if (/translation|tlyric|translated/i.test(next)) tlyric ||= valueText
                else lyric ||= valueText
            }
            visit(value, next, depth + 1)
        })
    }
    visit(payload)
    return { lyric, tlyric }
}

const get_lyric = async (id, cookie) => {
    try {
        const seo = await requestJson(urlWithParams('https://beta-luna.douyin.com/luna/h5/seo_track', {
            track_id: id, device_platform: 'web',
        }))
        const found = findLyrics(seo)
        if (found.lyric) return found
    } catch {}
    if (qishuiCookieHasLogin(cookie)) {
        try {
            const json = await requestJson(urlWithParams(`${PC_API}/luna/pc/track_v2`, pcParams({ track_id: id, media_type: 'track' })), { cookie })
            const found = findLyrics(json)
            if (found.lyric) return found
        } catch {}
    }
    const detail = await getPublicDetail(id)
    return findLyrics(detail || {})
}

const streamUrl = (value) => firstUrl(
    value?.main_play_url || value?.MainPlayUrl || value?.main_url || value?.url || value?.URL ||
    value?.play_url || value?.PlayURL || value?.backup_play_url || value?.backup_urls,
)

const streamFrom = (value, inherited = {}) => {
    if (!value || typeof value !== 'object') return null
    const url = streamUrl(value)
    if (!url) return null
    const meta = object(value.video_meta, value.VideoMeta, value.meta)
    const bitrate = Number(value.bitrate || value.Bitrate || value.real_bitrate || value.br || meta.bitrate || 0)
    const quality = text(value.quality || value.Quality || value.definition || value.gear_des_key || inherited.quality)
    const format = text(value.format || value.Format || value.vtype || meta.format)
    const authInfo = object(value.encrypt_info, value.EncryptInfo, value.encryptInfo)
    const auth = text(value.play_auth || value.PlayAuth || value.spade_a || authInfo.spade_a || inherited.auth)
    return { url, auth, bitrate, quality, format, duration: seconds(value.duration || inherited.duration) }
}

const collectStreams = (payload) => {
    const streams = []
    const seen = new Set()
    const visit = (node, inherited = {}, depth = 0) => {
        if (!node || depth > 8) return
        if (typeof node === 'string') {
            const value = node.trim()
            if ((value.startsWith('{') || value.startsWith('[')) && value.length < 2_000_000) {
                try { visit(JSON.parse(value), inherited, depth + 1) } catch {}
            }
            return
        }
        if (typeof node !== 'object' || seen.has(node)) return
        seen.add(node)
        if (Array.isArray(node)) {
            node.slice(0, 250).forEach(item => visit(item, inherited, depth + 1))
            return
        }
        const authInfo = object(node.encrypt_info, node.EncryptInfo, node.encryptInfo)
        const next = {
            auth: text(node.play_auth || node.PlayAuth || node.spade_a || authInfo.spade_a || inherited.auth),
            duration: seconds(node.duration || node.video_duration || inherited.duration),
            quality: text(node.quality || node.definition || node.gear_des_key || inherited.quality),
        }
        const stream = streamFrom(node, next)
        if (stream) streams.push(stream)
        Object.values(node).slice(0, 250).forEach(item => visit(item, next, depth + 1))
    }
    visit(payload)
    return streams.filter((item, index, list) => list.findIndex(other => other.url === item.url) === index)
}

const qualityRank = (stream) => {
    const label = `${stream.quality} ${stream.format}`.toLowerCase()
    const bitrate = stream.bitrate > 10000 ? stream.bitrate / 1000 : stream.bitrate
    if (/hires|master/.test(label)) return 110
    if (/lossless|flac|sq/.test(label) || bitrate >= 900) return 100
    if (/highest|excellent|superhigh|hq/.test(label)) return 80
    if (/higher|high|320/.test(label) || bitrate >= 320) return 70
    return 50
}

const requestedRank = (quality) => {
    if (/hires|master/.test(quality)) return 110
    if (/flac|lossless/.test(quality)) return 100
    if (/320|exhigh|higher/.test(quality)) return 70
    return 50
}

// Public share playback fallback, adapted from jiuhunwl/music_jx (MIT).
// It only exposes the free AAC/M4A stream and never grants member-only quality.
const get_public_song_url = async (id) => {
    const json = await requestJson(urlWithParams(PUBLIC_PLAYBACK, { track_id: id, device_platform: 'web' }))
    const player = object(json?.track_player)
    try {
        const model = typeof player.video_model === 'string' ? JSON.parse(player.video_model) : player.video_model
        const stream = array(model?.video_list)[0]
        const url = text(stream?.main_url || stream?.backup_url)
        if (url) {
            return {
                url,
                quality: 'standard',
                duration: Number(stream?.video_meta?.duration || 0) || undefined,
            }
        }
    } catch {}
    const playInfoUrl = text(player.url_player_info)
    if (playInfoUrl) {
        const info = await requestJson(playInfoUrl)
        const stream = array(info?.Result?.Data?.PlayInfoList)[0]
        const url = text(stream?.MainPlayUrl || stream?.BackupPlayUrl)
        if (url) return { url, quality: 'standard' }
    }
    return null
}

const get_song_url = async (id, cookie, options = {}) => {
    if (!qishuiCookieHasLogin(cookie)) return get_public_song_url(id)
    const body = { track_id: id, media_type: 'track', queue_type: 'favorite_track_playlist', scene_name: 'library' }
    let json
    try {
        json = await requestJson(urlWithParams(`${PC_API}/luna/pc/track_v2`, pcParams()), { cookie, method: 'POST', body })
    } catch {
        json = await requestJson(urlWithParams(`${PC_API}/luna/pc/track_v2`, pcParams({ track_id: id, media_type: 'track' })), { cookie })
    }
    const streams = collectStreams(json).sort((a, b) => qualityRank(b) - qualityRank(a))
    if (!streams.length) return null
    const target = requestedRank(text(options.quality).toLowerCase())
    const selected = streams.find(stream => qualityRank(stream) <= target) || streams[streams.length - 1]
    const level = qualityRank(selected) >= 100 ? 'lossless' : qualityRank(selected) >= 70 ? 'exhigh' : 'standard'
    return {
        url: selected.url,
        auth: selected.auth,
        quality: level,
        duration: selected.duration ? selected.duration * 1000 : undefined,
    }
}

const get_personal_fm = async (_mode, cookie) => {
    if (!qishuiCookieHasLogin(cookie)) return []
    const params = pcParams({ cursor: 0, cnt: 12, count: 12 })
    for (const base of WEB_BASES) {
      for (const path of ['/luna/feed/song-tab', '/luna/pc/feed/song-tab']) {
        try {
            const json = await requestJson(urlWithParams(`${base}${path}`, params), {
              cookie,
              headers: { Referer: 'https://www.qishui.com/' },
            })
            const songs = collectMedia(json).map(mapMedia).filter(Boolean)
            if (songs.length) return songs
        } catch (error) { console.warn(`[Qishui] 漫游 ${path} 失败:`, error.message) }
      }
    }
    // 推荐接口受限时，使用已登录账号的最近播放和收藏作为房间漫游候选。
    for (const path of ['/luna/pc/me/recently-played-media', '/luna/pc/me/collection/mixed']) {
      try {
        const json = await requestJson(urlWithParams(`${PC_API}${path}`, pcParams({ cursor: '', count: 30 })), { cookie })
        const songs = collectMedia(json).map(mapMedia).filter(Boolean)
        if (songs.length) return songs
      } catch (error) { console.warn(`[Qishui] 漫游回退 ${path} 失败:`, error.message) }
    }
    return []
}

const support_type = ['url', 'lrc', 'song', 'pic', 'search', 'fm']

const handle = async (type, id, cookie = '', options = {}) => {
    if (type === 'search') return get_search_songs(id, cookie)
    if (type === 'song') return get_song_info(id, cookie)
    if (type === 'pic') return (await get_song_info(id, cookie))[0]?.pic || ''
    if (type === 'lrc') return get_lyric(id, cookie)
    if (type === 'url') return get_song_url(id, cookie, options)
    if (type === 'fm') return get_personal_fm(id, cookie)
    return -1
}

export const getQishuiProfile = async (cookie) => {
    if (!qishuiCookieHasLogin(cookie)) return { valid: false, error: 'Cookie 缺少汽水登录态', userInfo: null }
    try {
        const json = await requestJson(urlWithParams(`${PC_API}/luna/pc/me`, pcParams()), { cookie, timeout: 8000 })
        const root = json?.data || json || {}
        const user = object(root.my_info, root.myInfo, root.user, root.user_info, root.account, root.me, root)
        let isVip = false
        let isSvip = false
        let membershipKnown = false
        const visit = (node, depth = 0) => {
            if (!node || typeof node !== 'object' || depth > 6) return
            Object.entries(node).slice(0, 180).forEach(([key, value]) => {
                const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '')
                const positive = value === true || (Number.isFinite(Number(value)) && Number(value) > 0) || /^(vip|svip|active|valid|会员)$/i.test(text(value))
                if (/svip|supervip/.test(normalized)) { membershipKnown = true; if (positive) isSvip = true }
                else if (/vip|member/.test(normalized)) { membershipKnown = true; if (positive) isVip = true }
                if (value && typeof value === 'object') visit(value, depth + 1)
            })
        }
        visit(root)
        if (isSvip) isVip = true
        return {
            valid: true,
            error: null,
            userInfo: {
                userId: text(user.id || user.user_id || user.uid),
                nickname: text(user.nickname || user.nick_name || user.name || user.douyin_id || '汽水用户'),
                avatarUrl: firstUrl(user.avatar_url || user.avatar || user.larger_avatar_url),
                isVip,
                isSvip,
                vipType: isSvip ? 2 : isVip ? 1 : 0,
                canPlayVip: isVip,
                canPlaySvip: isSvip,
                membershipKnown,
            },
        }
    } catch (error) {
        return { valid: false, error: `汽水 Cookie 验证失败: ${error.message}`, userInfo: null }
    }
}

export default {
    register: (ctx) => ctx.register('qishui', { handle, support_type }),
}
