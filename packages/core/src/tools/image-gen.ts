import { generateOne } from './image-gen/apply'
import { getActiveImageGenProvider } from './image-gen/providers'
import { parseImageGenRequests } from './image-gen/requests'
import { defineTool } from './schema'

export {
  setImageGenCredentials,
  setActiveImageGenProvider,
  getImageGenProviders
} from './image-gen/providers'

export const generateImage = defineTool({
  name: 'generate_image',
  mutates: true,
  description:
    'Generate or edit an image via an OpenAI-compatible image API (gpt-image-2) and place it on the canvas as an editable image node. Pass a JSON array for batch. Each item: {prompt, width, height, quality?, output_format?, output_compression?, id?, background?}. Omit id to create a new image frame. Pass the id of an existing node to target it: a node with an IMAGE fill is edited image-to-image (its pixels are uploaded); a leaf shape WITHOUT an image fill (e.g. a gray Rectangle/Ellipse placeholder) is filled directly with the generated image — the preferred way to fill named placeholder nodes. For local edits, describe the target region inside the prompt (e.g. "add the logo in the top-right corner"). gpt-image-2 only accepts a fixed set of sizes (1024x1024, 1536x1024, 1024x1536, 2048x2048, 2048x1152, 3840x2160, 2160x3840) — requested width/height are auto-mapped to the nearest allowed size and reported in `note`.',
  params: {
    requests: {
      type: 'string',
      description:
        'JSON array: [{"prompt":"product hero shot","width":1080,"height":1080},{"prompt":"banner bg","width":1080,"height":500}]',
      required: true
    }
  },
  execute: async (figma, { requests }) => {
    const provider = getActiveImageGenProvider()
    if (!provider) {
      return {
        error: `No image-gen provider configured. Add an image-gen API key in settings (separate from the chat LLM key).`
      }
    }

    const reqs = parseImageGenRequests(requests)
    if ('error' in reqs) return reqs

    const results = await Promise.all(
      reqs.requests.map((req) =>
        generateOne(figma, provider, req).catch((err) => ({
          id: req.id ?? '',
          error: err instanceof Error ? err.message : String(err)
        }))
      )
    )
    const ok = results.filter((result) => result.id && !result.error).length

    return {
      generated: ok,
      failed: results.length - ok,
      provider: provider.name,
      ...(reqs.sizeNote ? { note: reqs.sizeNote } : {}),
      ...(reqs.warning ? { warning: reqs.warning } : {}),
      results
    }
  }
})
