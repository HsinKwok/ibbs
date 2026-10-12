<template>
    <footer class="footer">
        <div class="footer-content">
            <div class="copyright-item" v-if="SiteConfig.$state.Config.n_web_copyright">
                <span>{{ SiteConfig.$state.Config.n_web_copyright }}</span>
            </div>
            <div class="copyright-item">
                <span>所有内容均由网友发布提交，平台不对内容负责！</span>
            </div>
             <div class="copyright-item">
                <span>平台禁止发布违法内容！包括但不限于非法、色情、暴力、政治等违规内容。感谢您的支持与使用！</span>
            </div>
            <div class="contact-item" v-if="hasContact">
                <span class="contact-link" v-if="contact.qq">QQ：{{ contact.qq }}</span>
                <span class="contact-link" v-if="contact.wx">微信：{{ contact.wx }}</span>
                <span class="contact-link" v-if="contact.phone">手机：{{ contact.phone }}</span>
                <span class="contact-link" v-if="contact.email">邮箱：{{ contact.email }}</span>
            </div>
        </div>
    </footer>
</template>

<script setup>
import { computed } from 'vue'

const SiteConfig = useSiteConfig()

const valid = (v) => v && String(v).trim() !== '' && String(v) !== 'null'

const contact = computed(() => {
    const c = SiteConfig.$state.Config || {}
    return {
        qq: valid(c.n_contact_qqnumber) ? c.n_contact_qqnumber : '',
        wx: valid(c.n_contact_wxnumber) ? c.n_contact_wxnumber : '',
        phone: valid(c.n_contact_phone) ? c.n_contact_phone : '',
        email: valid(c.n_contact_email) ? c.n_contact_email : '',
    }
})

const hasContact = computed(() => contact.value.qq || contact.value.wx || contact.value.phone || contact.value.email)
</script>

<style lang="scss" scoped>
.footer {
    width: 100%;
    padding: 24px 20px;
    background-color: #050e2b;
    color: #fff;
    font-size: 12px;

    .footer-content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }

    .copyright-item {
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.85);
        font-size: 12px;
    }

    .contact-item {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 20px;
        line-height: 1.5;
    }

    .contact-link {
        color: rgba(255, 255, 255, 0.85);
        text-decoration: none;
        transition: all 0.3s ease;
    }

    .beian-link {
        display: flex;
        align-items: center;
        color: rgba(255, 255, 255, 0.85);
        text-decoration: none;
        transition: all 0.3s ease;
        gap: 4px;

        &:hover {
            color: #fff;
            opacity: 0.8;
        }

        img {
            width: 16px;
            height: 16px;
            object-fit: contain;
        }

        span {
            line-height: 1;
        }
    }

    .contact-link {
        color: rgba(255, 255, 255, 0.85);
        text-decoration: none;
        transition: all 0.3s ease;

        &:hover {
            color: #fff;
            opacity: 0.8;
            text-decoration: underline;
        }
    }
}

@media (min-width: 769px) {
    .footer {
        .footer-content {
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center;
            gap: 24px;
        }

        .copyright-item::after {
            content: '|';
            margin-left: 24px;
            color: rgba(255, 255, 255, 0.3);
        }

        .copyright-item:last-of-type::after {
            content: none;
        }
    }
}

@media (max-width: 768px) {
    .footer {
        padding: 20px 16px;

        .footer-content {
            gap: 8px;
        }

        .copyright-item {
            font-size: 11px;

            &::after {
                content: none;
            }
        }

        .contact-item {
            gap: 12px;
        }
    }
}

@media (max-width: 480px) {
    .footer {
        padding: 16px 12px;

        .footer-content {
            gap: 6px;
        }

        .copyright-item {
            font-size: 10px;
            text-align: center;
            padding: 0 8px;
        }
    }
}
</style>