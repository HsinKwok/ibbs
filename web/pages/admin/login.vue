<template>
    <div>
        <div class="LoginTop">
        </div>
        <div class="LoginBox">
            <div class="LoginTopInfo">
                <p class="LoginTopInfocs">Admin!</p>
                <p class="LoginTopInfoTitle">欢迎回来，尊敬的管理员</p>
            </div>

            <a-form :model="form" layout="vertical" @submit="login">
                <a-input placeholder="请输入账号" type="text" allow-clear v-model="form.username" class="input">
                    <template #prefix>
                        <icon-user />
                    </template>
                </a-input>
                <a-input placeholder="请输入密码" allow-clear type="password" v-model="form.password" class="input">
                    <template #prefix>
                        <icon-lock />
                    </template>
                </a-input>

                <a-form-item :hideLabel="true">
                    <a-button class="loginbut" type="primary" html-type="submit" :loading="submitting">立即登录</a-button>
                </a-form-item>
            </a-form>

            <!-- 项目信息 -->
            <div class="project-info">
                <div class="project-title">
                    <span>{{ SiteConfig.$state.Config.n_web_title }}</span>
                </div>
                <div class="project-desc">
                    {{ SiteConfig.$state.Config.n_web_desc }}
                </div>
                <div class="project-links">
                    <a-button type="text" size="small" @click="openGitee">Gitee</a-button>
                    <span class="divider">|</span>
                    <a-button type="text" size="small" @click="openGithub">GitHub</a-button>
                    <span class="divider">|</span>
                    <span class="star-text">⭐ 欢迎 Star</span>
                </div>
            </div>

        </div>
    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue';
import { getAdminBase } from '@/utils/adminPath';
/* 会话 cookie：前端需读取后以自定义请求头携带，故不能 httpOnly；显式声明 path/sameSite，并在 HTTPS 下启用 Secure */
const AToken = useCookie('AToken', {
    path: '/',
    sameSite: 'lax',
    secure: useRequestURL().protocol === 'https:',
})
const SiteConfig = useSiteConfig()

/* 后台路由未在 app.vue 预加载站点配置，这里统一拉取，供下方项目信息卡片使用 */
await SiteConfig.init()

const form = ref({

})
const submitting = ref(false)
const login = async () => {
    if (submitting.value) return
    submitting.value = true
    try {
        const res = await useApiFetch().post('/api/adminlogin', form.value)
        if (res.code == 200) {
            Message.success('登录成功')
            AToken.value = res.data
            navigateTo(getAdminBase())
        } else {
            Message.error(res.msg || '登录失败')
        }
    } catch (e) {
        Message.error('登录失败，请稍后重试')
    } finally {
        submitting.value = false
    }
}

/* 打开 Gitee */
const openGitee = () => {
    window.open(SiteConfig.$state.Config.n_gitee_url, '_blank')
}

/* 打开 GitHub */
const openGithub = () => {
    window.open(SiteConfig.$state.Config.n_github_url, '_blank')
}






</script>

<style lang="scss" scoped>
.LoginTop {
    width: 100%;
    position: relative;
    background-color: #f7f7f7;
    height: 100vh;
    background-size: cover;
    background: url(../../assets/bj.jpg);

  
}

.LoginBox {
    background-color: #fff;
    overflow: hidden;
    width: calc(100% - 100px);
    padding: 40px;
    position: fixed;
    top: 50%;
    max-width: 400px;
    // right: ;
    left: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 10px rgba(243, 243, 243, 0.1);
    border-radius: 20px;

    .LoginTopInfo {
        margin-bottom: 30px;

        .LoginTopInfocs {
            font-size: 34px;
            font-weight: 800;
        }

        .LoginTopInfoTitle {
            font-size: 14px;
            font-weight: 800;
            margin-top: 10px;
        }
    }

    .loginbut {
        border-radius: 30px;
        height: 45px;
        width: 100%;
        margin-top: 20px;
    }

    .input {
        width: 100%;
        height: 45px;
        border-radius: 30px;
        margin-bottom: 20px;
        padding: 0 10px;
        font-size: 14px;
        color: #000;
    }

    .project-info {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #f0f0f0;
        text-align: center;

        .project-title {
            font-size: 18px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 6px;
        }

        .project-desc {
            font-size: 13px;
            color: #6b7280;
            margin-bottom: 12px;
        }

        .project-links {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;

            :deep(.arco-btn) {
                color: #667eea;
                padding: 0 4px;
                height: auto;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.3s ease;

                &:hover {
                    color: #764ba2;
                    background: rgba(102, 126, 234, 0.1);
                }
            }

            .divider {
                color: #d0d7de;
                font-size: 14px;
            }

            .star-text {
                font-size: 13px;
                color: #6b7280;
                font-weight: 500;
            }
        }
    }


}
</style>
