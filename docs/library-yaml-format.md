# Brand Config YAML Format

The brand config is a small, hand-readable YAML file that describes the
material types and style profiles available to the marketing agent. It
ships as `public/default-brand/config.yaml` and is loaded by the agent
backend on first boot, then persisted in the user's local SQLite
(`~/.openpencil/brand.db`).

## Schema (v1)

```yaml
schema_version: 1              # literal — bump with care
name: "默认品牌库"             # display name in the BrandConfigPanel
types:                         # material types (e.g. 朋友圈广告)
  - id: <string>               # required, [a-z0-9_]+, used as setup_material_type id
    label: <string>            # required, display label
    size: <WxH|Wx>             # required, "1080x1080" or "750x" (HUG)
    description: <string>      # optional, one-line description
profiles:                      # style profiles (Markdown guides)
  - id: <string>               # required, [a-z0-9_]+
    label: <string>            # required
    applicable_to: [<string>]  # required array, type ids; [] = universal
    markdown: |                # required, Markdown body
      # Profile Title
      - style guidance...
```

## Wire format details

### size
- `WxH` — fixed width and height (e.g. `1080x1080`, `300x250`)
- `Wx` — width with HUG height (e.g. `750x` for long-image types)
- HUG frames use `primaryAxisSizing: HUG` and grow with their content

### applicable_to
- Empty array `[]` = universal profile (applies to every material type)
- Non-empty = list of type ids; the profile is offered in the system
  prompt overlay only when the active material type is in this list

### markdown
- `|` is a YAML block-scalar marker — the body is preserved verbatim
- Indentation inside the block is **stripped by 4 spaces** (the
  emitter uses `      ` prefix; the parser trims to common indent)
- Empty markdown is rejected at validation time

## Examples

### Minimal default brand

```yaml
schema_version: 1
name: 我的品牌
types:
  - id: square
    label: Square post
    size: 1080x1080
profiles: []
```

### Long-image product type with a profile

```yaml
schema_version: 1
name: 我的品牌
types:
  - id: product_long
    label: 产品长图
    size: 750x
    description: 通用产品长图
profiles:
  - id: casual_v1
    label: 休闲活泼
    applicable_to: [product_long]
    markdown: |
      # 休闲活泼风格

      - 主色调: 暖橙 + 奶白
      - 字体: 思源黑体
      - 语气: 口语化，多用第二人称
```

## Validation

The brand config is validated by a zod schema in
`packages/agent/src/brand/schema.ts`. Common failures and their fixes:

| Failure | Fix |
|---|---|
| `schema_version` is not 1 | Bump with care — write a migration script |
| Type `id` contains spaces or punctuation | Use `[a-z0-9_]+` |
| Duplicate `id` in `types` or `profiles` | Rename one |
| `size` doesn't match `WxH` or `Wx` | Use the correct format |
| `markdown` is empty | Provide a non-empty body |
| Unknown top-level key | Remove (strict mode rejects) |

## Migration from .fig

Before P3, types and profiles lived inside a Library .fig file (binary
Figma document). Migration is a one-shot: the editor reads the .fig,
extracts the `Types` and `Profiles` pages, and emits a YAML file via
`tools/brand-config/src/generate-yaml.ts`. The legacy .fig is no
longer required after the migration — agent + SQLite store everything
else.