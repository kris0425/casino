# Vehicle modification assets

Each supported vehicle has a folder named after its `assetCatalog` ID. Photo
presets and transparent part layers must use the renderer photo size of
`1280 × 545` and the same camera position.

```text
assets/mod_layers/<asset_id>/
  body_mask.png                         # optional paint mask
  presets/
    <paint>_<widebody>_<wheels>_<spoiler>.png
  wheels/
    <wheel>.png                         # generic fallback
    <widebody>_<wheel>.png              # preferred kit-specific alignment
  widebody/
    <widebody>.png                      # optional transparent fallback
  spoiler/
    <spoiler>.png                       # optional transparent fallback
```

Renderer order:

1. Use an exact four-part preset when it exists.
2. Otherwise use `<paint>_<widebody>_stock_stock.png` and composite a
   kit-specific wheel/spoiler layer.
3. Otherwise use the painted stock base and transparent fallback layers.

Rules:

- `body_mask.png` is grayscale: white is recolored and black is preserved.
- Transparent part layers must contain only the replacement part and required
  local shadow/reflection. Do not include body panels, tyres, or background.
- Wheel centre caps must be concentric with the tyre ellipse. Different
  widebody/camera layouts require `<widebody>_<wheel>.png` variants.
- A missing visual combination must not be sold. `src/index.js` validates the
  prospective configuration before charging the player.

Current complete visual matrix:

- `rocket_bunny_rx7`: 8 paints × 4 body kits × 4 wheel choices = 128.
- `silver_r34`: partial legacy matrix; unsupported combinations are hidden and
  rejected without charging until their assets are completed.
