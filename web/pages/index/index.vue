<template>
    <div class="PageBox">
        <div class="PageContent">
          
            <div class="Content">
                <NuxtPage />
                <Tabbar></Tabbar>
            </div>
        </div>



    </div>
</template>

<script setup>
const SiteConfig = useSiteConfig()

useSeoSet({
    title: SiteConfig.$state.Config.n_web_title,
    description: SiteConfig.$state.Config.n_web_desc,
    keywords: SiteConfig.$state.Config.n_web_keys,

})


</script>
<style lang="scss" scoped>
/* 视口小于768px时的样式 */
@media (min-width: 768px) {

    .PageBox {
        width: calc(100%);
        position: relative;



    }

}

/* 视口小于768px时的样式 */
@media (max-width: 768px) {

    .PageBox {
        width: calc(100%);
        position: relative;

       


    }

}
</style>
