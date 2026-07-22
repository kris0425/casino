# Discord Casino Bot

Discord casino/economy bot with games, assets, pets, teams, heists, racing and
vehicle modification previews.

## Project layout

- `src/index.js` — bot commands, interactions, economy rules and SQLite access.
- `scripts/render_car.py` — renders `1280 × 720` garage/modification cards.
- `assets/` — production media and vehicle modification assets.
- `data/` — runtime SQLite database and generated renders; never commit or copy
  over production data during a code deployment.
- `tmp/` — local references, QA previews and one-off development output.

## Local setup

1. Copy `.env.example` to `.env` and fill in Discord credentials.
2. Run `npm ci`.
3. Run `npm run check` before deployment.
4. Run `npm start`, or use `docker compose up -d --build`.

Python 3, Pillow and Noto CJK fonts are installed by the Docker image for card
rendering.

## Deployment scope

Normal code/media deployment updates `src/`, `scripts/` and `assets/`. Preserve
the server-side `.env` and `data/` volume. After rebuilding, verify:

- `node --check src/index.js`
- `python3 -m py_compile scripts/render_car.py`
- bot login appears in the container log
- one real garage card is rendered for every changed vehicle

## Vehicle modification assets

See [`assets/mod_layers/README.md`](assets/mod_layers/README.md). The UI only
offers exterior combinations that the renderer can actually produce; an
unsupported combination is rejected before any coins are deducted.

## Maintenance notes

- `src/index.js` is currently a large single module. New feature families should
  be extracted gradually into catalog, database, command and interaction
  modules instead of making the file larger.
- Development screenshots belong under `tmp/`, not the project root.
- Keep `.env.example` synchronized with every `process.env` key used by code.
