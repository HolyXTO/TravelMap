# TravelMap

Personal travel footprint map for two people. The current version is a working prototype with real country and admin-1 boundary data from local SHP files, mock visit records, and a future Supabase integration path.

## What Is Included

- React + Vite app
- GitHub Pages workflow
- Profile switch for two people
- Layer switch: country / state-province / city
- Real country boundaries from `世界地图/WorldBoundaries.shp`
- Real admin-1 boundaries from `世界地图/WorldStates.shp`
- City layer prototype with sample city polygons and dots
- Dashboard metrics, filters, map view, list view, edit prototype
- Supabase schema draft in `supabase/schema.sql`

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
```

Generated web files:

```text
public/maps/countries.geojson
public/maps/states.geojson
```

Regenerate them with:

```bash
python scripts/convert_maps.py
```

The converter currently:

- Reads the SHP files with `pyshp`
- Converts `WGS_1984_World_Mercator` coordinates back to lon/lat
- Simplifies polygon rings
- Preserves all country and admin-1 features
- Uses stable country ids such as `CHN`, `USA`, `DEU`, `JPN`, `FRA`

Current generated counts:

```text
countries.geojson: 209 features
states.geojson: 4596 features
```

When city-level SHP data is available, add it to `世界地图/`, then extend `scripts/convert_maps.py` with a third output such as:

```text
public/maps/cities.geojson
```

## OSM / CARTO Note

The current prototype does not use OSM or CARTO map tiles. It renders local boundary GeoJSON directly as SVG.

If a future version adds an OSM/CARTO/MapTiler basemap, keep the attribution visible on the map, for example:

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
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Create a Storage bucket named `travel-photos`.
5. Create two editor users in Authentication.
6. Copy the Project URL and anon public key.

Create a local `.env`:

```text
VITE_SUPABASE_URL=your project URL
VITE_SUPABASE_ANON_KEY=your anon public key
```

Never put database passwords, service role keys, or GitHub tokens into frontend code.
