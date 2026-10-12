import { Message } from '@arco-design/web-vue';
import Config from '../app-config.js'

/* 读取 Cookie 中的 token（上传走原生 XHR，无法复用 useApiFetch 的注入逻辑）。
   后台优先用 AToken，前台用 UToken；后端据此识别管理员以豁免上传频控/开关限制。 */
function getAuthHeader() {
  if (typeof document === 'undefined') return {}
  const read = (name) => {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
    return match ? decodeURIComponent(match[1]) : ''
  }
  const atoken = read('AToken')
  if (atoken) return { admintoken: atoken }
  const utoken = read('UToken')
  if (utoken) return { usertoken: utoken }
  return {}
}

/* 通用上传函数 */
const updatefun = (file, url, onProgress) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true)

    const authHeader = getAuthHeader()
    for (const key of Object.keys(authHeader)) {
      xhr.setRequestHeader(key, authHeader[key])
    }

    xhr.upload.onprogress = function (event) {
      if (event.lengthComputable && onProgress) {
        let percent = Math.round((event.loaded * 100) / event.total)
        if (percent >= 100) percent = 99
        onProgress(percent)
      }
    }

    xhr.onload = function () {
      if (xhr.status === 200) {
        let res
        try {
          res = JSON.parse(xhr.responseText)
        } catch (e) {
          Message.error('上传失败：响应解析错误')
          reject(e)
          return
        }
        if (res.code !== 200) {
          Message.error('上传失败：' + res.msg)
        }
        onProgress?.(100)
        resolve(res)
      } else {
        Message.error('上传失败（HTTP ' + xhr.status + '）')
        reject(xhr)
      }
    }

    xhr.onerror = function () {
      Message.error('网络错误，上传失败')
      reject(xhr)
    }

    xhr.send(formData)
  })
}

export const upimg = async (file, onProgress) => {
    const res = await updatefun(file, Config.apiBase + '/api/upload/image', (percent) => {
        onProgress?.(percent)
    })
    return res;

}
export const upfile = async (file, onProgress) => {

    const res = await updatefun(file, Config.apiBase + '/api/upload/file', (percent) => {
        onProgress?.(percent)
    })

    return res;
}