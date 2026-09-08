---
id: watercolor_poster_v2
label: 水彩海报 v2
modes: [longform-hero-kv-first, longform-structure-first]
version: 2
---

# Watercolor poster

Wash-heavy poster style for long-form images and campaign key visuals. Visual weight comes from one continuous backdrop running under every section, not from per-section color blocks. Profile is organized by design elements (typography / color / layout / hero treatment / forbidden / tone); the procedural recipe lives with the workflow.

## Typography

- Extreme type contrast, tiered by canvas width W — W comes from the workflow size preset（尺寸预设）the user picked, never a hardcoded number. At W=750（电商详情长图）: hero title 72–110px, section titles 36–48, body 20–24, captions 16–18. At W=1080（小红书长图）: hero title 104–158, section titles 52–70, body 28–34, captions 22–26. For any other width, scale proportionally from the 750 tier (factor ≈ W/750). Where the workflow's canvas-scale type rules conflict with this profile, this profile wins（与 workflow 字阶规则冲突时以 profile 为准）.
- Hero title stacks in 2–3 SHORT STAGGERED lines of 3–5 characters — left-aligned, each line offset horizontally from the one above, tight line-height (1.0–1.15) — never one centered slab filling the width. Weights: Hero Heavy or Black, body Regular.
- Title shadow is a white-title privilege: only a white title on a deep/saturated band may carry one. Dark-ink titles on calm light bands take NO shadow — ink on wash reads by contrast alone.
- eyebrow: { none (default), one small line above the stack } — 18–24px at W=750 (26–34 at W=1080), Regular weight, letterspaced, same ink tone as the title. An eyebrow is a caption (a date, a place, a series name), never a second headline.

## Color

- palette: auto-sampled from the hero's bottom transition band by compose_backdrop — never a fixed hex.
- Harmony governs how the sampled hero color extends into the rest of the design (analogous / complementary / split-complementary / triadic / monochromatic — picked per design). The profile does not lock a specific harmony; it constrains the watercolor wash feel: soft layered tints, no harsh neon, no near-black accents, no commercial gradients. The backdrop carries the color — section bodies stay transparent so the wash reads through.

## Layout

- One continuous backdrop under EVERY section. Per-section color blocks are a different style.
- Deliberately uneven spacing: hero segment → large breathing space → information-dense segment → tight space → breathing space again. Constant rhythm reads as a screen. Section sequence and density are content-driven, but keep the uneven rhythm.
- Where dense body text fights the wash, an alpha < 0.5 helper is permitted to keep the shared backdrop visible underneath — title legibility still comes from the image tones, never from patches.

## Hero treatment

- hero lockup: { lower-third (default), center-left, upper-float } — where the staggered stack sits inside the hero slot. Line budget per lockup: lower-third and center-left take 2–3 lines; upper-float takes AT MOST 2 (a 3-line stack there crowds the top edge).
- hero height: { default = W (750 at W=750, 1080 at W=1080), range 0.8W–1.2W (600–900 at W=750, 860–1300 at W=1080) } — shorter for a terse single-motif design, taller when the motif needs room.
- scaffold parameters: underlap_px and transition_zone_px default to 100 at W=750 (both default to 100; scale with W, ≈140 at W=1080; transition_zone_px is clamped to underlap_px when larger, and the result then carries `clamped: true`). The scaffold's composite reference shows the image API exactly where the title stack sits — the prompt must keep THAT region calm, low-detail, and tuned to the title color.
- Title band must land on a calm, low-detail region of the hero image, with the tone clearly on the light or dark side (light band for dark ink, deep band for white) — no muddy mid-tones.
- Watercolor-style prompt: soft layered washes, ONE motif, generous negative space. The image is generated into the scaffold at its final display size (the API may 16px-align it — compose for approximately what is shown). Keep the bottom underlap band calm — it maps ≈1:1 onto the fade zone.
- motif: the watercolor metaphor follows the brief (a season, a place, a mood) — one motif per design, not a collage.

## Forbidden

- No opaque (alpha=1) plates behind the title in the hero slot — no scrim rectangles, no solid bands, no blurred backing cards. Title legibility comes from the image tones, never from patches.
- No per-section color blocks or card layouts cutting the shared backdrop — visual weight belongs to the backdrop.
- No single-line or centered hero title slabs — the staggered 2–3 line stack IS this style's headline.
- No shadow on dark-ink titles. White-title shadows stay inside the allowance (blur 8–16, alpha ≤ 0.3, y-offset 0–4) — heavy or blurry shadows are out.
- No transparent decorative PNG overlays stacked on the hero — AI-generated PNGs do not reliably produce clean alpha channels; decorative elements live INSIDE the generated hero image.
- No hard-sell phrasing ("限时秒杀", "最后一天").
- No opacity-tweaking of overlays to rescue unreadable title bands — re-derive via compose_backdrop, or regenerate the hero with a calmer title band.

## Tone

Restrained, atmospheric. Short sentences. Headline copy prefers noun phrases and images (a season, a place, a texture) over verb-object slogans; 6–15 characters split across the 2–3 stacked lines.
