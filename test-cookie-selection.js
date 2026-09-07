/**
 * Cookie 选择策略测试脚本
 * 测试随机选择和 SVIP 优先逻辑
 */

import store from './src/admin/store.js'

console.log('=== Cookie 选择策略测试 ===\n')

// 测试函数
async function testCookieSelection() {
    await store.init()

    const platforms = ['netease', 'tencent', 'qishui', 'kugou']

    for (const platform of platforms) {
        console.log(`\n--- 测试平台: ${platform} ---`)

        const allCookies = store.getCookies(platform).filter(c => c.isActive && c.isValid !== false)
        console.log(`可用 Cookie 数量: ${allCookies.length}`)

        if (allCookies.length === 0) {
            console.log(`  ⚠️  没有可用的 ${platform} Cookie，跳过测试`)
            continue
        }

        // 显示每个 cookie 的会员信息
        allCookies.forEach((c, idx) => {
            const isSvip = Boolean(
                c?.userInfo?.isSvip ||
                c?.userInfo?.canPlaySvip ||
                (Number(c?.userInfo?.svipType) || 0) > 0
            )
            const isVip = Boolean(c?.userInfo?.canPlayVip)
            console.log(`  Cookie ${idx + 1}: ${c.note || c.id} - VIP: ${isVip}, SVIP: ${isSvip}`)
        })

        // 测试标准音质（应该随机选择）
        console.log('\n  测试标准音质 (standard) - 应该随机选择:')
        const selections = new Map()
        for (let i = 0; i < 10; i++) {
            const selected = store.getActiveCookieForQuality(platform, 'standard')
            if (selected) {
                const key = selected.note || selected.id
                selections.set(key, (selections.get(key) || 0) + 1)
            }
        }
        selections.forEach((count, cookieId) => {
            console.log(`    ${cookieId}: 被选中 ${count} 次`)
        })

        // 测试 SVIP 音质（应该优先选择 SVIP 账号）
        const svipQualities = {
            'netease': ['sky', 'jymaster', 'dolby'],
            'tencent': ['atmos', 'master'],
            'qishui': ['flac', 'lossless', 'studio', 'atmos'],
            'kugou': ['hires', 'atmos', 'master', 'viper_atmos']
        }

        if (svipQualities[platform]) {
            console.log(`\n  测试 SVIP 音质 - 应该优先选择 SVIP 账号:`)
            for (const quality of svipQualities[platform].slice(0, 2)) {
                const selected = store.getActiveCookieForQuality(platform, quality)
                if (selected) {
                    const isSvip = Boolean(
                        selected?.userInfo?.isSvip ||
                        selected?.userInfo?.canPlaySvip ||
                        (Number(selected?.userInfo?.svipType) || 0) > 0
                    )
                    console.log(`    音质 ${quality}: 选中 ${selected.note || selected.id} (SVIP: ${isSvip})`)
                } else {
                    console.log(`    音质 ${quality}: 未选中任何 cookie`)
                }
            }
        }

        // 测试普通 VIP 音质
        const vipQualities = {
            'netease': ['320', 'exhigh', 'hires'],
            'tencent': ['320', 'exhigh'],
            'qishui': ['320', 'exhigh'],
            'kugou': ['320', 'exhigh']
        }

        if (vipQualities[platform]) {
            console.log(`\n  测试 VIP 音质 (非SVIP) - 应该随机选择:`)
            const vipSelections = new Map()
            const testQuality = vipQualities[platform][0]
            for (let i = 0; i < 5; i++) {
                const selected = store.getActiveCookieForQuality(platform, testQuality)
                if (selected) {
                    const key = selected.note || selected.id
                    vipSelections.set(key, (vipSelections.get(key) || 0) + 1)
                }
            }
            vipSelections.forEach((count, cookieId) => {
                console.log(`    音质 ${testQuality}: ${cookieId} 被选中 ${count} 次`)
            })
        }
    }

    console.log('\n=== 测试完成 ===\n')
}

// 运行测试
testCookieSelection().catch(err => {
    console.error('测试出错:', err)
    process.exit(1)
})
