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
    'Generate or edit images via an OpenAI-compatible image API (gpt-image-2) and place them on the canvas as editable image nodes. Pass a JSON array for batch. Each item: {prompt, width, height, quality?, output_format?, output_compression?, replace_id?, references?, background?}. `replace_id` is ONLY the output target — never an input: provide it to fill that node with the generated image, replacing its current fill (works on leaf shapes AND on Frames, where the image becomes the frame background while children are kept — the standard way to build a text-over-image hero, and the standard way to regenerate/swap an existing canvas image); omit it to create a new image node (auto-placed right of existing page content, never overlapping). Replacing an image never loses it: when the target holds an image, the previous version is auto-preserved in the page\'s generation-history container ("生图历史", parked right of the root frame), and history entries are reusable as references. When generating a NEW image from references, omit `replace_id` — a reference\'s node id belongs in `references`, never in `replace_id`. `references` is the ONLY source of input images: an array of node ids. Each node contributes its original IMAGE bytes by default (lossless, zero-cost); nodes WITHOUT an IMAGE fill (layout Frames, groups) are rendered automatically. Pass {"id":"...","composite":true} to reference the node\'s rendered appearance instead — children, effects and rounded corners included (e.g. a hero Frame with overlay text). No references → text-to-image; with references → image-to-image. To EDIT an existing image, set `replace_id` to it AND include its node id in `references`; to REGENERATE a fresh replacement without being biased by the current one (e.g. retrying a rejected result), set `replace_id` but leave the target out of `references`. When passing multiple references, refer to them in the prompt as [image 1], [image 2], ... matching the references order. Any width/height is accepted — values are 16px-aligned and clipped to API constraints while preserving aspect ratio; adjustments are reported in note. Within one batch, references must not point at another item\'s output node — split dependent edits into separate calls. Generation is SLOW: batch ALL needed images in ONE call — never loop with repeated single calls. Returns node id metadata only (no image bytes): inspect structure with `describe`, and visually accept the content with `look` (right subject, no garbled or wrong-language text inside the image); if it misses, regenerate with an adjusted prompt (max 2 attempts). Prompts must never ask for rendered text. If the key is missing or the API returns 401, tell the user to add/check the Image Generation API key in AI chat settings (separate from the chat LLM key) — do NOT fall back to eval-drawn gradients; leave placeholder colors as-is.',
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
          id: req.replaceId ?? '',
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
