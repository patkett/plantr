# SaParadise — Garden Planner & Supabase Database

A small client-side garden planning app: track plants, arrange them on an
interactive garden map, and optionally sync everything to a Supabase backend
(falls back to `localStorage` when not connected).

No build step required — plain HTML/CSS/JS, loaded via CDN `<script>` tags
for Tailwind CSS, Lucide icons, and the Supabase JS client.

## Project structure

```
index.html            Markup only: layout, views, modals
css/
  styles.css           Custom CSS on top of Tailwind (patterns, animations)
js/
  tailwind-config.js   Tailwind theme (brand colors, fonts)
  data.js              Seed/starter data (DEFAULT_PLANTS, DEFAULT_ZONES)
  state.js             Shared in-memory app state
  db.js                Supabase client, CRUD sync, localStorage fallback
  navigation.js         Tab switching (Directory / Map / Supabase DB)
  plants.js            Plant directory list, filters, add/edit/delete modal
  map.js               Garden canvas: beds, markers, drag & drop, drawer
  ui.js                Toasts, confirm dialog, SQL "copy" helper
  app.js               Bootstraps the app on DOMContentLoaded
sql/
  schema.sql           Supabase table/RLS setup script (also shown in-app)
```

Scripts are loaded as plain (non-module) `<script>` tags so that inline
`onclick="..."` handlers in the markup keep working — every function is a
top-level declaration, which attaches it to `window`.

## Running locally

Any static file server works, since the app needs `fetch()` to load
`sql/schema.sql` (won't work with `file://`):

```bash
python3 -m http.server 8765
# then open http://localhost:8765/index.html
```

## Supabase setup (optional)

1. Create a Supabase project.
2. Run `sql/schema.sql` in the Supabase SQL Editor.
3. In the app's "Supabase DB" tab, enter your project URL and anon key.
