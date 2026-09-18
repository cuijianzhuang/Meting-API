import { describe, expect, it } from 'vitest'
import { resolveLoudnessServiceUrl } from './loudness-config.js'

describe('响度辅助服务配置', () => {
    it('后台保存的地址优先于环境变量', () => {
        expect(resolveLoudnessServiceUrl('http://saved:3100/analyze', 'http://env:3100/analyze')).toBe('http://saved:3100/analyze')
    })

    it('后台未配置时使用环境变量', () => {
        expect(resolveLoudnessServiceUrl('', 'http://env:3100/analyze')).toBe('http://env:3100/analyze')
    })
})
