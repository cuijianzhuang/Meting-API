import { describe, expect, it } from 'vitest'
import { renderHomepage } from './homepage.js'

describe('3.3.0 homepage capability documentation', () => {
  it('shows Kugou in the platform list and capability matrix', () => {
    const html = renderHomepage({ baseUrl: 'http://localhost/', runtime: 'node', port: 3000, overseas: false })
    expect(html).toContain('v3.3.0')
    expect(html).toContain('酷狗音乐')
    expect(html).toContain('<th>酷狗</th>')
    expect(html).toContain('歌曲关键词（歌名 / 歌手 / 专辑）')
    expect(html).toContain('歌单关键词（歌单名 / 创建者）')
    expect(html).toContain('酷狗音乐 · 按歌名 / 歌手 / 专辑关键词搜索单曲')
    expect(html).toContain('酷狗音乐 · 按歌单名 / 创建者关键词搜索歌单')
    expect(html).toContain('酷狗音乐 · 获取歌单歌曲列表')
    expect(html).toContain('酷狗音乐 · 获取单曲信息')
    expect(html).toContain('酷狗音乐 · 获取播放链接（母带；需 SVIP）')
    expect(html).toContain('酷狗音乐 · 获取歌词（纯文本）')
    expect(html).toContain('酷狗音乐 · 获取封面并 302 跳转')
    expect(html).toContain('<code>duration</code>：音频时长，单位为秒')
    expect(html).toContain('<code>loudness</code>：标准化响度信息')
  })
})