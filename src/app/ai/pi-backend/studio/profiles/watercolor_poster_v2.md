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
- Extreme type contrast: hero title 72–110px on a 750px-wide canvas, stacked in 2–3 SHORT STAGGERED lines of 3–5 characters — left-aligned, each line offset horizontally from the one above, tight line-height (1.0–1.15) — never one centered slab filling the width. Section titles 36–48. Body 20–24, captions 16–18. Weights: Hero Heavy or Black, body Regular.
- Title shadow is a white-title privilege: only a white title on a deep/saturated band may carry one (blur 8–16, alpha ≤ 0.3, y-offset 0–4). A dark-ink title on a calm light band takes NO shadow — ink on wash reads by contrast alone.
- Deliberately uneven spacing: hero segment → large breathing space → information-dense segment → tight space → breathing space again. Constant rhythm reads as a screen.
- Hero pixels are generated at the holder's final size: 750 wide × (your hero height pick + 100px bleed). The image API may 16px-align the requested size and upscale to its pixel floor, so the calm bottom ~100px maps approximately (≈1:1) onto the fade zone — keep it calm regardless.

## Variable system

- hero lockup: { lower-third (default), center-left, upper-float } — where the staggered stack sits inside the hero slot. Line budget per lockup: lower-third and center-left take 2–3 lines; upper-float takes AT MOST 2 (a 3-line stack there crowds the top edge). The composite reference (step 2) shows the API exactly where the stack is; the prompt must keep THAT region calm, low-detail, and tuned to the title color.
- hero height: { 750 (default), 600–900 } — shorter for a terse single-motif design, taller when the motif needs room. The hero image is generated at 750 × (pick + 100).
- eyebrow: { none (default), one small line above the stack } — 18–24px, Regular weight, letterspaced, same ink tone as the title. An eyebrow is a caption (a date, a place, a series name), never a second headline.
- palette: auto-sampled from the hero's bottom band by compose_backdrop — never a fixed hex.
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

One continuous backdrop under every section. The hero slot is part of the Phase 2 skeleton; this phase materializes pixels and resolves title ink:

1. (Phase 2 skeleton) Render a transparent Frame named `HeroContent` as the first flow child of the root frame, h=<your hero height pick>, w=canvas width — and design the hero title INSIDE it now, at its final text, size, position, and color (your lockup pick, plus the eyebrow line if you took one). Pixels are generated AROUND the placed title in step 2, so the title comes first — a title placed after the image is a retrofit. All content sections have transparent fills — visual weight comes from the shared backdrop, not per-section color blocks.
2. Pick your hero lockup and height (Variable system) and place the title stack (step 1). Call `generate_image` with `width: 750`, `height: <hero height + 100>`, `id: HeroContent.id`, and `references: [{"id": HeroContent.id, "composite": true}]` — the holder's final display size (the API may 16px-align it — compose for approximately what is shown). [image 1] is the composite render of your HeroContent — it covers only the TOP <hero height>px (the slot), so extend the scene calmly through the extra 100px of bleed below it. The reference fixes the placed title's position, size, and color: compose AROUND the text, keep the region under it calm, low-detail, and tuned to the title color (light band for dark ink, deep band for white), and paint NO lettering into the image (the text is a position reference only, not content). Keep the bottom ~100px calm — it maps ≈1:1 onto the fade zone. Watercolor-style prompt: soft layered washes, ONE motif, generous negative space.
3. Call `compose_backdrop({ root_id, canvas_width: 750, canvas_height: <design height>, hero_image_from: HeroContent.id })` — one call. The tool moves the image into the BackgroundLayer's HeroImg (extended 100px past the slot so the fade seam hides inside the next section), auto-samples the hero's bottom 100px for the overlay middle stop, leaves HeroContent transparent for the title, and fades the canvas to white at the foot.
4. Verify with `look`: no visible seam around the hero bottom, title area legible. If the hero is regenerated later, re-call `compose_backdrop` with the same arguments — it re-samples and recolors in place.

Do NOT pass `hero_color` in the standard recipe — auto-sampling is the point. Do not invent geometry: the 100px overlap, bleed extension, absolute positioning, and gradient transform are all handled internally.

## Tone

Restrained, atmospheric. Short sentences. Headline copy prefers noun phrases and images (a season, a place, a texture) over verb-object slogans; 6–15 characters split across the 2–3 stacked lines.
