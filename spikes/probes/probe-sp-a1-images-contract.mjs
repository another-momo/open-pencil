/**
 * Phase 3 SP-a1 探针：pi-ai generateImages（openrouter-images）接口形状钉扎。
 *
 * 背景（S4 §2 SP-a，17 册 W1-D2）：生图接入 S-a 路线 = pi-ai 的 generateImages。
 * SP-a 拆两半：a1 = 接口形状（本探针，fake fetch 注入即可钉死）；a2 = 真图出图质量
 * （需 OpenRouter key，本机无凭证 → 阻塞登记，待 owner 提供）。
 *
 * 钉扎点（2026-08-30 走查 dist/api/openrouter-images.js 得）：
 * - 传输 = OpenAI 兼容 **chat.completions**（非 /images/generations）；
 * - 请求体 {model, messages:[{role:'user',content:[text|image_url]}], stream:false,
 *   modalities:['image'] 或 ['image','text']（随 model.output）}；
 * - 响应取 choices[0].message.images[].image_url，**仅 data: URL 被解析**（http URL 跳过）；
 * - options.timeoutMs → OpenAI client timeout（provider 层超时可控，SP-b 结论配套）；
 * - 无 apiKey → stopReason:'error'。
 *
 * 运行：bun spikes/probes/probe-sp-a1-images-contract.mjs
 */

import { generateImages } from '@earendil-works/pi-ai/api/openrouter-images'

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const MODEL = {
  id: 'google/gemini-2.5-flash-image',
  name: 'Gemini 2.5 Flash Image',
  api: 'openrouter-images',
  provider: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  output: ['image'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
}

let failures = 0
function check(label, cond, detail = '') {
  console.log(`  ${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}

async function main() {
  console.log('== SP-a1 探针：generateImages 接口形状钉扎 ==\n')

  // ── 1. 请求形状 + 响应解析（fake fetch 捕获）──
  console.log('[1] 请求形状 + 响应解析')
  let captured = null
  const fakeFetch = async (url, init) => {
    captured = { url: String(url), method: init?.method, headers: init?.headers, body: init?.body }
    const payload = {
      id: 'gen-sp-a1',
      usage: { prompt_tokens: 1290, completion_tokens: 42 },
      choices: [
        {
          message: {
            content: '这是生成的配图',
            images: [
              { image_url: { url: `data:image/png;base64,${PNG_1PX}` } },
              { image_url: { url: 'https://example.com/not-inlined.png' } } // 非 data: 应被跳过
            ]
          }
        }
      ]
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }

  const result = await generateImages(
    MODEL,
    {
      input: [
        { type: 'text', text: '为「夏日冷萃咖啡」生成 hero 主视觉' },
        { type: 'image', mimeType: 'image/png', data: PNG_1PX }
      ]
    },
    { apiKey: 'sk-or-test-key', fetch: fakeFetch }
  )

  const body = JSON.parse(captured.body)
  const headerRecord =
    captured.headers instanceof Headers
      ? Object.fromEntries(captured.headers.entries())
      : captured.headers
  check('POST 到 {baseUrl}/chat/completions', captured.url === 'https://openrouter.ai/api/v1/chat/completions', captured.url)
  check('authorization Bearer 透传', /Bearer sk-or-test-key/.test(headerRecord?.authorization ?? ''))
  check('body.model = model.id', body.model === MODEL.id)
  check("modalities = ['image']（output 无 text）", JSON.stringify(body.modalities) === '["image"]')
  check('文本输入 → content[0].type=text', body.messages[0].content[0].type === 'text')
  check(
    '图像输入 → content[1] data: URL 回环',
    body.messages[0].content[1].image_url?.url === `data:image/png;base64,${PNG_1PX}`
  )
  check('stopReason = stop', result.stopReason === 'stop')
  check('responseId 透传', result.responseId === 'gen-sp-a1')
  const texts = result.output.filter((o) => o.type === 'text')
  const images = result.output.filter((o) => o.type === 'image')
  check('文本内容解析', texts[0]?.text === '这是生成的配图')
  check('图像内容解析（data: 唯一入列）', images.length === 1 && images[0].mimeType === 'image/png' && images[0].data === PNG_1PX)
  check('usage 映射（input=1290 output=42）', result.usage?.input === 1290 && result.usage?.output === 42)

  // ── 2. modalities 随 model.output 含 text 扩展 ──
  console.log('\n[2] modalities 随 output 扩展')
  let captured2 = null
  await generateImages(
    { ...MODEL, output: ['image', 'text'] },
    { input: [{ type: 'text', text: 'hi' }] },
    {
      apiKey: 'k',
      fetch: async (url, init) => {
        captured2 = JSON.parse(init.body)
        return new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
    }
  )
  check("output 含 text → modalities ['image','text']", JSON.stringify(captured2.modalities) === '["image","text"]')

  // ── 3. 无 apiKey 错误路径 ──
  console.log('\n[3] 无 apiKey 错误路径')
  const noKey = await generateImages(MODEL, { input: [{ type: 'text', text: 'x' }] }, {})
  check("stopReason = 'error'", noKey.stopReason === 'error')
  check('errorMessage 指明缺 key', /No API key/.test(noKey.errorMessage ?? ''), noKey.errorMessage)

  console.log(`\n== SP-a1 判定: ${failures === 0 ? '✅ 接口形状全部钉死' : `❌ ${failures} 项不符`} ==`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('探针失败:', e)
  process.exit(1)
})
