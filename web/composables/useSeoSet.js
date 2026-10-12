// composables/useSeoSet.ts

export const useSeoSet = ({
  title,
  keywords,
  description,
  icon,
  image
} = {}) => {

  useHead({
    title,
    titleTemplate: (t) => t ? `${t}` : '',
    meta: [
      { key: 'description', name: 'description', content: description },
      { key: 'og:title', property: 'og:title', content: title },
      { key: 'og:description', property: 'og:description', content: description },
      { key: 'og:type', property: 'og:type', content: 'website' },
      { key: 'robots1', name: 'robots', content: 'index, follow' },
      { key: 'twitter:card', name: 'twitter:card', content: 'summary_large_image' },
      { key: 'twitter:title', name: 'twitter:title', content: title },
      { key: 'twitter:description', name: 'twitter:description', content: description },
      {
        key: 'og:image',
        property: 'og:image',
        content: image
      },
      { key: 'keywords', name: 'keywords', content: keywords }
    ],
    link: [
      {
        rel: 'icon',
        type: 'image/png',
        href: icon // 你传进来的图片地址
      }
    ]
  })
}