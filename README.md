# TravelMap

Personal travel footprint map for two people. The current version uses React, Vite, Leaflet, CARTO basemap tiles, local GeoJSON boundary files, mock visit data, and a Supabase schema prepared for one editor account.

## What Is Included

- React + Vite app
- GitHub Pages workflow
- Leaflet map with Web Mercator interaction
- CARTO basemap with OSM/CARTO attribution
- Profile switch for two people
- Layer switch: country / state-province / city
- Country boundaries generated from `世界地图/WorldBoundaries.shp`
- Admin-1 boundaries generated from `世界地图/WorldStates.shp`
- China city boundaries generated from `世界地图/ChinaCityBoundaries.shp`
- Dashboard metrics, filters, map view, list view, edit prototype
- Supabase schema in `supabase/schema.sql`

## Local Run

```bash
pnpm install
pnpm run dev
```

The GitHub Pages build path is `/TravelMap/`, so the local URL is usually:

```text
http://127.0.0.1:5173/TravelMap/
```

## Build

```bash
pnpm run build
```

The production output goes to `dist/`.

## Map Data

Input SHP files:

```text
世界地图/WorldBoundaries.shp
世界地图/WorldStates.shp
世界地图/ChinaCityBoundaries.shp
```

Generated web files:

```text
public/maps/countries.geojson
public/maps/states.geojson
public/maps/china-cities.geojson
```

Regenerate them with:

```bash
python scripts/convert_maps.py
```

The converter currently:

- Reads SHP files with `pyshp`
- Converts `WGS_1984_World_Mercator` country/state coordinates back to lon/lat
- Keeps China city data in WGS84 lon/lat
- Simplifies polygon rings
- Filters country boundaries to UN member states plus observer states when present in the source
- Merges Northern Cyprus and the Cyprus buffer zone into Cyprus
- Merges Kosovo into Serbia for this 195-state framing
- Outputs China city boundaries only, not global city boundaries

Current generated counts:

```text
countries.geojson: 194 features
states.geojson: 4596 features
china-cities.geojson: 361 features
```

The country count is 194 because the current `WorldBoundaries.shp` source does not include a separate Palestine boundary feature. Palestine is still in the target whitelist, so it can be added later from a vetted compatible boundary source.

## OSM / CARTO

The map uses CARTO's light basemap tiles:

```text
https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png
```

The visible attribution is:

```text
© OpenStreetMap contributors © CARTO
```

Do not bulk-download OSM tiles. Use a proper tile provider or self-host a tile stack if offline/full-control basemaps become necessary.

## GitHub Pages

After pushing this project to `HolyXTO/TravelMap`, open the repository on GitHub:

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

The workflow is:

```text
.github/workflows/deploy.yml
```

After Pages is enabled, pushes to `main` should publish the site.

## Supabase Preparation

In Supabase:

1. Create a project.
2. Create one Auth user for yourself.
3. Open SQL Editor.
4. Run `supabase/schema.sql`.
5. Find your Auth user UUID.
6. Add yourself as the only editor:

```sql
insert into public.app_editors (user_id)
values ('YOUR_AUTH_USER_UUID');
```

7. Create a Storage bucket named `travel-photos`.
8. Copy the Project URL and anon public key.

Create a local `.env`:

```text
VITE_SUPABASE_URL=your project URL
VITE_SUPABASE_ANON_KEY=your anon public key
```

Never put database passwords, service role keys, or GitHub tokens into frontend code.
