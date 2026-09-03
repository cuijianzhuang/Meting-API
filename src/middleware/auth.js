import store from '../admin/store.js'

const extractBearerToken = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return ''
    return authHeader.substring(7).trim()
}

const applyApiTokenContext = (c, tokenData) => {
    c.set('username', tokenData.createdBy || 'api')
    c.set('isApiToken', true)
    c.set('tokenData', tokenData)
}

/** 程序化接口专用：仅接受 Authorization: Bearer <API Token> */
export const apiTokenMiddleware = async (c, next) => {
    const apiToken = extractBearerToken(c.req.header('Authorization'))
    if (!apiToken) {
        return c.json({ success: false, error: '需要 API Token，请使用 Authorization: Bearer <token>' }, 401)
    }

    const result = store.validateApiToken(apiToken)
    if (!result.valid) {
        return c.json({ success: false, error: 'API Token 无效' }, 401)
    }

    applyApiTokenContext(c, result.tokenData)
    return await next()
}

export const authMiddleware = async (c, next) => {
    const username = c.req.header('X-Auth-Username')
    const token = c.req.header('X-Auth-Token')
    const apiToken = extractBearerToken(c.req.header('Authorization'))

    if (apiToken) {
        const result = store.validateApiToken(apiToken)
        
        if (result.valid) {
            applyApiTokenContext(c, result.tokenData)
            return await next()
        }
    }

    if (!username || !token) {
        return c.json({ success: false, error: '未提供认证信息' }, 401)
    }

    if (!store.validateToken(username, token)) {
        return c.json({ success: false, error: '认证信息无效或已过期' }, 401)
    }

    c.set('username', username)
    await next()
}

export const adminMiddleware = async (c, next) => {
    const isApiToken = c.get('isApiToken')
    
    if (isApiToken) {
        return await next()
    }
    
    const username = c.get('username')
    const user = store.users.get(username)
    
    if (!user || user.role !== 'admin') {
        return c.json({ success: false, error: '权限不足' }, 403)
    }
    
    await next()
}
