---
id: watercolor_poster_v2
label: 水彩海报 v2
applicable_to: [longform]
version: 2
---

# Watercolor poster

Wash-heavy poster style for long-form images and campaign key visuals. Visual weight comes from one continuous backdrop running under every section, not from per-section color blocks.

## Fixed system

- One continuous backdrop under EVERY section. Per-section color blocks are a different style.
- Extreme type contrast, tiered by canvas width W — W comes from the workflow size preset（尺寸预设）the user picked, never a hardcoded number. At W=750（电商详情长图）: hero title 72–110px, section titles 36–48, body 20–24, captions 16–18. At W=1080（小红书长图）: hero title 104–158, section titles 52–70, body 28–34, captions 22–26. For any other width, scale proportionally from the 750 tier (factor ≈ W/750). The hero title stacks in 2–3 SHORT STAGGERED lines of 3–5 characters — left-aligned, each line offset horizontally from the one above, tight line-height (1.0–1.15) — never one centered slab filling the width. Weights: Hero Heavy or Black, body Regular. Where the workflow's canvas-scale type rules conflict with this profile, this profile wins（与 workflow 字阶规则冲突时以 profile 为准）.
- Title shadow is a white-title privilege: only a white title on a deep/saturated band may carry one (blur 8–16, alpha ≤ 0.3, y-offset 0–4). A dark-ink title on a calm light band takes NO shadow — ink on wash reads by contrast alone.
- Deliberately uneven spacing: hero segment → large breathing space → information-dense segment → tight space → breathing space again. Constant rhythm reads as a screen.
- Hero pixels are generated at the scaffold's final size: W wide × (your hero height pick + underlap_px). The image API may 16px-align the requested size and upscale to its pixel floor, so the calm bottom band (underlap_px tall) maps approximately (≈1:1) onto the fade zone — keep it calm regardless.

## Variable system

- hero lockup: { lower-third (default), center-left, upper-float } — where the staggered stack sits inside the hero slot. Line budget per lockup: lower-third and center-left take 2–3 lines; upper-float takes AT MOST 2 (a 3-line stack there crowds the top edge). The scaffold's composite reference (Recipe step 3) shows the image API exactly where the stack is; the prompt must keep THAT region calm, low-detail, and tuned to the title color.
- hero height: { default = W (750 at W=750, 1080 at W=1080), range 0.8W–1.2W (600–900 at W=750, 860–1300 at W=1080) } — shorter for a terse single-motif design, taller when the motif needs room. The hero image is generated at W × (pick + underlap_px).
- eyebrow: { none (default), one small line above the stack } — 18–24px at W=750 (26–34 at W=1080), Regular weight, letterspaced, same ink tone as the title. An eyebrow is a caption (a date, a place, a series name), never a second headline.
- palette: auto-sampled from the hero's bottom transition band by compose_backdrop — never a fixed hex.
- section sequence and density: content-driven, but keep the uneven rhythm.
- motif: the watercolor metaphor follows the brief (a season, a place, a mood) — one motif per design, not a collage.

## Anti-identity

- No opaque (alpha=1) plates behind the title in the hero slot — no scrim rectangles, no solid bands, no blurred backing cards. Title legibility comes from the image tones, never from patches.
- No per-section color blocks or card layouts cutting the shared backdrop — visual weight belongs to the backdrop. Where dense body text fights the wash, an alpha < 0.5 helper is permitted.
- No single-line or centered hero title slabs — the staggered 2–3 line stack IS this style's headline.
- No shadow on dark-ink titles, and no heavy or blurry shadow on white ones — the shadow ranges above are the whole allowance.
- No transparent decorative PNG overlays stacked on the hero — AI-generated PNGs do not reliably produce clean alpha channels; decorative elements live INSIDE the generated hero image.
- No hard-sell phrasing ("限时秒杀", "最后一天").
- No opacity-tweaking of overlays to rescue unreadable title bands — re-derive via compose_backdrop, or regenerate the hero with a calmer title band.

## Recipe

Hero-first: the title is designed and the hero pixels are materialized in 阶段 2（hero 物化 / hero materialization）— BEFORE any skeleton exists; the backdrop is composed in 阶段 3（结构与填充 / structure & fill）once the content sections have rendered. 跳步 = 显式失败（skipping a step fails loudly）: `compose_backdrop` called without a scaffold from step 2 returns a structured `geometry_missing` error pointing back to `prepare_hero_scaffold` — it never guesses silent defaults.

1. （阶段 2 hero 物化）Pick your hero lockup and height (Variable system), then render the headline-first layout（标题前置版式）: a transparent Frame named `HeroContent` as the first flow child of the root frame, w=W (canvas width from the size preset), h=<your hero height pick> — and design the hero title INSIDE it now, at its final text, size, position, and color (your lockup pick, plus the eyebrow line if you took one). Pixels are generated AROUND the placed title in step 3, so the title comes first — a title placed after the image is a retrofit. All content sections have transparent fills — visual weight comes from the shared backdrop, not per-section color blocks.
2. Call `prepare_hero_scaffold({ root_id, source_node_id: HeroContent.id, underlap_px, transition_zone_px })` — underlap_px = transition_zone_px = 100 at W=750 (both default to 100; scale with W, ≈140 at W=1080; transition_zone_px is clamped to underlap_px when larger, and the result then carries `clamped: true`). The tool clones your headline layout verbatim into a page-level scaffold frame sized W × (hero height + underlap_px), placed beside the canvas, and writes the geometry record that step 4 reads. Returns `{ scaffold_id, width, height, underlap_px, transition_zone_px, clamped, cloned_children, note }` — pass the returned `width`/`height` as the generation size in step 3.
3. Call `generate_image` with a single request: `{ requests: [{ prompt: <watercolor prompt>, width: <scaffold width>, height: <scaffold height>, replace_id: <scaffold_id>, references: [{ id: <scaffold_id>, composite: true }] }] }` — the image is generated INTO the scaffold at its final display size (the API may 16px-align it — compose for approximately what is shown). [image 1] is the composite render of your scaffold: it covers the title stack at the top (the slot) plus the underlap_px bleed below it, so extend the scene calmly through the bleed. The reference fixes the placed title's position, size, and color: compose AROUND the text, keep the region under it calm, low-detail, and tuned to the title color (light band for dark ink, deep band for white), and paint NO lettering into the image (the text is a position reference only, not content). Keep the bottom underlap band calm — it maps ≈1:1 onto the fade zone. Watercolor-style prompt: soft layered washes, ONE motif, generous negative space. To retry a rejected result, re-call with the same `replace_id` and omit the reference for an unbiased regeneration — the previous version is auto-preserved in the page's generation history.
4. （阶段 3 结构与填充）After the content sections have rendered and the root frame's height has settled, call `compose_backdrop({ root_id, scaffold_id })` — one call. ALL geometry (canvas width, hero slot height, underlap, transition band) is read from the scaffold's geometry record — there is no width parameter to pass. Omit `canvas_height` on this wrap-up call: it then follows the root frame's current height. The tool copies the scaffold's image into the BackgroundLayer's HeroImg (extended underlap_px past the slot so the fade seam hides inside the next section), auto-samples the hero's bottom transition band for the overlay middle stop, resizes your HeroContent slot to the slot height (title untouched, fills forced transparent), and fades the canvas to white at the foot. External hero source instead (user-uploaded image, no scaffold): call `compose_backdrop({ root_id, hero_image_from })` — the source node's height becomes the hero display height and the canvas width follows the root frame.
5. Verify with `look`: no visible seam around the hero bottom, title area legible. If the hero is regenerated later, re-call `compose_backdrop` with the same arguments — it re-samples and recolors in place.

Do NOT pass `hero_color` in the standard recipe — auto-sampling is the point. Do not invent geometry: the underlap extension, bleed, absolute positioning, and gradient transform are all handled internally by the tools.

## Tone

Restrained, atmospheric. Short sentences. Headline copy prefers noun phrases and images (a season, a place, a texture) over verb-object slogans; 6–15 characters split across the 2–3 stacked lines.
