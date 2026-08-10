/**
 * QQ 音乐私人漫游（猜你喜欢）
 *
 * 对齐 QQMusicApi RecommendApi.get_guess_recommend：
 * module=music.radioProxy.MbTrackRadioSvr method=get_radio_track
 *
 * 官方接口固定 radio id=99，不支持熟悉/探索等模式；id 参数忽略。
 * 需有效登录 Cookie（uin + qm_keyst / qqmusic_key）。
 */
import { changeUrlQuery } from './util.js'
import { map_song_list } from './search.js'

const parseCookieString = (cookieString) => {
    if (!cookieString) return {}
    const cookies = {}
    cookieString.split(';').forEach((item) => {
        const idx = item.indexOf('=')
        if (idx <= 0) return
        const key = item.slice(0, idx).trim()
        const value = item.slice(idx + 1).trim()
        if (key && value) cookies[key] = value
    })
    return cookies
}

const hasLogin = (cookieObj) => {
    const uin = cookieObj.uin || cookieObj.wxuin || ''
    const authst = cookieObj.qqmusic_key || cookieObj.qm_keyst || ''
    return Boolean(uin && authst && uin !== '0')
}

export const get_personal_fm = async (id = '', cookie = '') => {
    const cookieObj = parseCookieString(cookie)
    if (!hasLogin(cookieObj)) return []

    const uin = cookieObj.uin || cookieObj.wxuin || '0'
    const authst = cookieObj.qqmusic_key || cookieObj.qm_keyst || ''
    // QQ 官方无模式参数，忽略 id
    void id

    const data = {
        radio: {
            module: 'music.radioProxy.MbTrackRadioSvr',
            method: 'get_radio_track',
            param: {
                id: 99,
                num: 5,
                from: 0,
                scene: 0,
                song_ids: [],
            },
        },
        comm: {
            uin,
            format: 'json',
            // Android 客户端参数（对齐 QQMusicApi DEFAULT_VERSION_POLICY.android）
            ct: 11,
            cv: 14090008,
            authst,
        },
    }

    const url = changeUrlQuery(
        { data: JSON.stringify(data) },
        'https://u.y.qq.com/cgi-bin/musicu.fcg',
    )
    const result = await (await fetch(url, {
        headers: {
            Referer: 'https://y.qq.com/',
            'User-Agent': 'Mozilla/5.0',
            Cookie: cookie,
        },
    })).json()

    const code = result?.radio?.code
    if (code === 1000 || code === 104401 || code === 104400) {
        throw new Error('QQ 音乐登录态无效或已过期，无法获取漫游')
    }
    if (code !== 0 && code !== undefined) {
        throw new Error(`QQ 音乐漫游接口错误: ${code}`)
    }

    const tracks = result?.radio?.data?.tracks
    if (!Array.isArray(tracks) || !tracks.length) return []

    return map_song_list(tracks)
}
