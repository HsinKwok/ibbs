/* 微信小程序登录相关功能 */
export const WeChatLogin = async (code) => {
    try {
        /* 获取系统配置 */
        const config = await global.Tools.getConfig()
        const appid = config[0].n_wechat_miniProgram_appid
        const secret = config[0].n_wechat_miniProgram_secret
        /* code 为前端传入的不可信参数，必须 URL 编码后再拼接，避免其中的 & = # 等字符篡改请求查询串 */
        const res = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`)
        const data = await res.json()
        if (!data.errcode) {
            return data
        } else {
            return {
                code: 201,
                msg: data.errmsg
            }
        }
    } catch (error) {
        console.log('微信登录错误:', error);
        return {
            code: 201,
            msg: '微信登录失败'
        }
    }
}
