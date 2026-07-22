/**
 * 网易云电台 / 播客
 *
 * | type        | id           | 说明                         |
 * |-------------|--------------|------------------------------|
 * | dj          | 电台 ID      | 电台下节目列表（可播放）     |
 * | dj_detail   | 电台 ID      | 电台详情                     |
 * | djprogram   | 节目 ID      | 单集详情（可播放）           |
 * | dj_hot      | hot/recommend| 热门电台 / 推荐电台          |
 * | search_dj   | 关键词       | 电台搜索                     |
 */
import { request } from './util.js'

export const map_program_list = (programs = []) => {
    return programs.map((program) => {
        const song = program.mainSong || {}
        const artists = song.artists || song.ar || []
        const songId = song.id || program.id
        const author =
            artists.reduce((i, v) => (i ? `${i} / ${v.name}` : v.name), '') ||
            program.dj?.nickname ||
            ''

        return {
            title: program.name || song.name || '',
            author,
            pic: program.coverUrl || song.album?.picUrl || songId,
            url: songId,
            lrc: songId,
            id: String(program.id),
        }
    })
}

export const map_radio_list = (radios = []) => {
    return radios.map((radio) => ({
        title: radio.name || '',
        author: radio.dj?.nickname || '',
        pic: radio.picUrl || radio.intervenePicUrl || '',
        id: String(radio.id),
        url: String(radio.id),
        trackCount: radio.programCount || 0,
    }))
}

/** 电台节目列表 */
export const get_dj_programs = async (id, cookie = '') => {
    const data = {
        radioId: id,
        limit: 100,
        offset: 0,
        asc: false,
    }

    const res = await request(
        'POST',
        'https://music.163.com/weapi/dj/program/byradio',
        data,
        { crypto: 'weapi', cookie: cookie || {} },
    )

    return map_program_list(res.programs || [])
}

/** 电台详情 */
export const get_dj_detail = async (id, cookie = '') => {
    const data = { id }

    const res = await request(
        'POST',
        'https://music.163.com/weapi/djradio/v2/get',
        data,
        { crypto: 'weapi', cookie: cookie || {} },
    )

    const radio = res.data || res.djRadio
    if (!radio) {
        throw res
    }

    return map_radio_list([radio])
}

/** 单集（节目）详情 */
export const get_dj_program_detail = async (id, cookie = '') => {
    const data = { id }

    const res = await request(
        'POST',
        'https://music.163.com/weapi/dj/program/detail',
        data,
        { crypto: 'weapi', cookie: cookie || {} },
    )

    if (!res.program) {
        throw res
    }

    return map_program_list([res.program])
}

/**
 * 热门 / 推荐电台
 * id=recommend → 推荐；其余（含 hot / 留空）→ 热门
 */
export const get_dj_hot = async (id = '', cookie = '') => {
    if (String(id).toLowerCase() === 'recommend') {
        const res = await request(
            'POST',
            'https://music.163.com/weapi/djradio/recommend/v1',
            {},
            { crypto: 'weapi', cookie: cookie || {} },
        )
        return map_radio_list(res.djRadios || [])
    }

    const data = {
        limit: 30,
        offset: 0,
    }

    const res = await request(
        'POST',
        'https://music.163.com/weapi/djradio/hot/v1',
        data,
        { crypto: 'weapi', cookie: cookie || {} },
    )

    return map_radio_list(res.djRadios || [])
}

/** 电台搜索（id 填关键词） */
export const get_search_djs = async (id, cookie = '') => {
    const data = {
        s: id,
        type: 1009,
        limit: 30,
        offset: 0,
        total: true,
    }

    const res = await request('POST', `https://interface.music.163.com/eapi/cloudsearch`, data, {
        crypto: 'eapi',
        cookie: cookie || {},
        url: '/api/cloudsearch/pc',
    })

    return map_radio_list(res.result?.djRadios || [])
}
