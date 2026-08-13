import { request } from '../providers/netease/util.js'
import { changeUrlQuery } from '../providers/tencent/util.js'
import { getVipLoginInfo } from '../providers/tencent/qr_login.js'

const detectSvip = (...sources) => sources.some((source) => {
    if (!source || typeof source !== 'object') return false
    return source.isSvip === true
        || source.is_svip === true
        || source.isSuperVip === true
        || source.is_super_vip === true
        || source.svip === true
        || source.superVip === true
        || source.super_vip === true
        || Number(source.svipType || source.svip_type || source.superVipType || source.super_vip_type) > 0
        || ['svip', 'supervip'].includes(String(source.vipStage || source.vip_stage || source.vipLevelName || source.vip_level_name || '').toLowerCase().replace(/[ _-]/g, ''))
})
import { getQishuiProfile } from '../providers/qishui/index.js'

const parseCookieString = (cookieString) => {
    if (!cookieString) return {}
    const cookies = {}
    cookieString.split(';').forEach(item => {
        const [key, value] = item.trim().split('=')
        if (key && value) {
            cookies[key] = value
        }
    })
    return cookies
}

const checkNeteaseVipAbility = async (cookieString) => {
    try {
        const testSongId = '254059'
        const data = {
            ids: '[' + testSongId + ']',
            level: 'standard',
            encodeType: 'flac',
        }
        
        const res = await request(
            'POST',
            'https://interface.music.163.com/eapi/song/enhance/player/url/v1',
            data,
            {
                crypto: 'eapi',
                url: '/api/song/enhance/player/url/v1',
                cookie: cookieString
            }
        )
        
        if (res.data && res.data[0]) {
            const songData = res.data[0]
            const url = songData.url
            
            if (!url) {
                return false
            }
            
            if (url.includes('try') || url.includes('trial')) {
                return false
            }
            
            if (songData.freeTrialInfo) {
                return false
            }
            
            if (songData.freePartInfo) {
                return false
            }
            
            if (songData.level === 'trial' || songData.level === 'try') {
                return false
            }
            
            return true
        }
        return false
    } catch (e) {
        return false
    }
}

const getTencentMembership = async (cookie) => {
    try {
        const { code, data } = await getVipLoginInfo({
            uin: cookie.uin || '',
            musickey: cookie.qqmusic_key || cookie.qm_keyst || '',
            loginType: cookie.tmeLoginType || cookie.login_type || 2,
            deviceCookie: cookie.psrf_qqdevice || '',
        })
        if (code !== 0) return null
        const identity = data.identity || data.Identity || {}
        const isSvip = Number(data.svip || data.SVip) > 0 || Number(identity.HugeVip || identity.hugeVip || identity.huge_vip) > 0
        const isVip = isSvip || Number(identity.vip || identity.Vip) > 0
        return { isVip, isSvip, vipType: isSvip ? 2 : isVip ? 1 : 0 }
    } catch {
        return null
    }
}

export const validateNeteaseCookie = async (cookieString) => {
    try {
        const cookie = parseCookieString(cookieString)
        
        if (!cookie.MUSIC_U && !cookie.MUSIC_A) {
            return {
                valid: false,
                error: 'Cookie缺少必要的认证信息 (MUSIC_U 或 MUSIC_A)',
                userInfo: null
            }
        }

        const data = {}
        const res = await request(
            'POST',
            'https://music.163.com/weapi/w/nuser/account/get',
            data,
            {
                crypto: 'weapi',
                cookie: cookieString
            }
        )

        if (res.code === 200 && res.account) {
            const isVip = (res.profile?.vipType || 0) > 0
            const isSvip = detectSvip(res.profile, res.account)
            let canPlayVip = isVip
            
            if (!isVip) {
                canPlayVip = await checkNeteaseVipAbility(cookieString)
            }
            
            return {
                valid: true,
                error: null,
                userInfo: {
                    userId: res.account?.id || res.profile?.userId,
                    nickname: res.profile?.nickname || '未知用户',
                    avatarUrl: res.profile?.avatarUrl || '',
                    vipType: res.profile?.vipType || 0,
                    isVip: isVip,
                    isSvip,
                    canPlaySvip: isSvip,
                    canPlayVip: canPlayVip
                }
            }
        } else if (res.code === 301) {
            return {
                valid: false,
                error: 'Cookie已过期，请重新获取',
                userInfo: null
            }
        } else if (res.code === 200 && !res.account) {
            const canPlayVip = await checkNeteaseVipAbility(cookieString)
            
            return {
                valid: true,
                error: null,
                userInfo: {
                    userId: null,
                    nickname: '游客用户',
                    avatarUrl: '',
                    vipType: 0,
                    isVip: false,
                    canPlayVip: canPlayVip
                }
            }
        } else {
            return {
                valid: false,
                error: `验证失败: ${res.message || res.msg || '未知错误'}`,
                userInfo: null
            }
        }
    } catch (e) {
        return {
            valid: false,
            error: `验证出错: ${e.message}`,
            userInfo: null
        }
    }
}

export const validateTencentCookie = async (cookieString) => {
    try {
        const cookie = parseCookieString(cookieString)
        
        if (!cookie.uin && !cookie.qqmusic_key) {
            return {
                valid: false,
                error: 'Cookie缺少必要的认证信息 (uin 或 qqmusic_key)',
                userInfo: null
            }
        }

        const uin = cookie.uin || ''
        const qqmusic_key = cookie.qqmusic_key || ''

        const membership = await getTencentMembership(cookie)
        const data = {
            data: JSON.stringify({
                comm: {
                    ct: 19,
                    cv: 0,
                    uin: uin,
                    format: 'json',
                    authst: qqmusic_key
                },
                req_0: {
                    module: 'music.UserInfoSvr',
                    method: 'GetUserInfo',
                    param: {}
                }
            })
        }

        const url = changeUrlQuery(data, 'https://u.y.qq.com/cgi-bin/musicu.fcg')
        const res = await fetch(url, {
            headers: {
                Referer: 'https://y.qq.com/',
                'User-Agent': 'Mozilla/5.0',
                Cookie: cookieString,
            },
        })
        const result = await res.json()

        if (result.req_0 && result.req_0.code === 0) {
            const userInfo = result.req_0.data
            const detectedSvip = detectSvip(userInfo, userInfo?.vipInfo, userInfo?.vip_info, userInfo?.memberInfo, userInfo?.member_info)
            const isSvip = membership?.isSvip || detectedSvip
            const isVip = membership?.isVip || (userInfo?.vip || 0) > 0 || isSvip
            
            return {
                valid: true,
                error: null,
                userInfo: {
                    userId: userInfo?.uin || uin,
                    nickname: userInfo?.nick || 'QQ用户',
                    avatarUrl: userInfo?.headpic || '',
                    vipType: membership?.vipType || userInfo?.vip || 0,
                    isVip: isVip,
                    isSvip,
                    canPlaySvip: isSvip,
                    canPlayVip: isVip
                }
            }
        } else if (membership) {
            return {
                valid: true,
                error: null,
                userInfo: {
                    userId: uin,
                    nickname: 'QQ用户',
                    avatarUrl: '',
                    vipType: membership.vipType,
                    isVip: membership.isVip,
                    isSvip: membership.isSvip,
                    canPlaySvip: membership.isSvip,
                    canPlayVip: membership.isVip,
                },
            }
        } else if (result.req_0 && result.req_0.code === 1000) {
            return {
                valid: false,
                error: 'Cookie已过期，请重新获取',
                userInfo: null
            }
        } else {
            return {
                valid: true,
                error: null,
                userInfo: {
                    userId: uin,
                    nickname: 'QQ用户',
                    avatarUrl: '',
                    vipType: 0,
                    isVip: false,
                    isSvip: false,
                    canPlaySvip: false,
                    canPlayVip: false
                }
            }
        }
    } catch (e) {
        return {
            valid: false,
            error: `验证出错: ${e.message}`,
            userInfo: null
        }
    }
}

export const validateQishuiCookie = async (cookieString) => getQishuiProfile(cookieString)

export const validateCookie = async (platform, cookieString) => {
    if (platform === 'netease') {
        return await validateNeteaseCookie(cookieString)
    } else if (platform === 'tencent') {
        return await validateTencentCookie(cookieString)
    } else if (platform === 'qishui') {
        return await validateQishuiCookie(cookieString)
    } else {
        return {
            valid: false,
            error: '不支持的平台类型',
            userInfo: null
        }
    }
}

export default {
    validateCookie,
    validateNeteaseCookie,
    validateTencentCookie,
    validateQishuiCookie,
}
