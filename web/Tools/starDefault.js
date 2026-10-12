/* 求Star/推广卡片默认内容
 * 前台未配置 n_star_content 时展示、后台编辑器预填时共用，保证两处一致。
 * 刻意写成单行：wangEditor 解析含换行的 HTML 时会插入多余空段落，前台也会出现空行。 */
export const DEFAULT_STAR_CONTENT = '<p style="text-align: center; font-size: 36px; margin: 0 0 12px;">⭐</p><h3 style="text-align: center; margin: 0 0 8px; font-size: 18px; color: #1a1a1a;">求个 Star</h3><p style="text-align: center; color: #666; font-size: 14px; margin: 0 0 16px;">本项目全开源，若您需要，请在 GitHub 上给个 Star 支持一下，谢谢！</p><p style="text-align: center;"><a href="https://github.com/example/forum" target="_blank" rel="noopener noreferrer">GitHub 仓库</a>&nbsp;&nbsp;<a href="https://gitee.com/example/forum" target="_blank" rel="noopener noreferrer">Gitee 仓库</a></p>'

/* 判断富文本是否为空（空段落/换行等编辑器归一化产物） */
export const isBlankStarContent = (html) => {
    if (!html) return true
    // 含图片/视频/表格等媒体时不算空
    if (/<(img|video|iframe|table)\b/i.test(html)) return false
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() === ''
}
