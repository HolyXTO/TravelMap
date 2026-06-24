import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CalendarDays,
  Camera,
  Database,
  Globe2,
  Layers3,
  ListFilter,
  MapPinned,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import {
  initialVisits,
  placeLevels,
  places,
  profiles,
  tripTypes,
} from "./data/mockData";

const profileFilters = [
  { id: "all", label: "两个人" },
  ...profiles.map((profile) => ({ id: profile.id, label: profile.name })),
];

function geometryCenter(geometry) {
  const points = [];
  const collect = (item) => {
    if (!Array.isArray(item)) return;
    if (typeof item[0] === "number") {
      points.push(item);
      return;
    }
    item.forEach(collect);
  };
  collect(geometry?.coordinates ?? geometry);
  if (points.length === 0) return [0, 0];
  const bounds = points.reduce(
    (acc, [lon, lat]) => ({
      minLon: Math.min(acc.minLon, lon),
      maxLon: Math.max(acc.maxLon, lon),
      minLat: Math.min(acc.minLat, lat),
      maxLat: Math.max(acc.maxLat, lat),
    }),
    { minLon: 180, maxLon: -180, minLat: 90, maxLat: -90 },
  );
  return [
    (bounds.minLon + bounds.maxLon) / 2,
    (bounds.minLat + bounds.maxLat) / 2,
  ];
}

function featureToPlace(feature) {
  const props = feature.properties;
  return {
    id: props.id,
    level: props.level,
    name: props.name,
    localName: props.localName || props.name,
    parentId: props.parentId,
    region: props.region || props.continent,
    geometry: feature.geometry,
    center:
      props.longitude && props.latitude
        ? [Number(props.longitude), Number(props.latitude)]
        : geometryCenter(feature.geometry),
  };
}

function placeToFeature(place) {
  return {
    type: "Feature",
    id: place.id,
    properties: {
      id: place.id,
      level: place.level,
      name: place.name,
      localName: place.localName,
    },
    geometry: Array.isArray(place.geometry)
      ? { type: "Polygon", coordinates: [place.geometry] }
      : place.geometry,
  };
}

function findPlace(placeId) {
  return places.find((place) => place.id === placeId);
}

function placeChain(placeId) {
  const chain = [];
  let current = findPlace(placeId);
  while (current) {
    chain.unshift(current);
    current = current.parentId ? findPlace(current.parentId) : null;
  }
  return chain;
}

function resolvePlaceForLevel(placeId, level) {
  const chain = placeChain(placeId);
  if (level === "country") {
    return chain.find((place) => place.level === "country");
  }
  if (level === "region") {
    return chain.find((place) => place.level === "region") ?? chain[0];
  }
  return findPlace(placeId);
}

function resolveMapIdForLevel(placeId, level) {
  const place = resolvePlaceForLevel(placeId, level);
  return place?.mapId || place?.id;
}

function formatPath(placeId, placeLookup) {
  const chain = placeChain(placeId);
  if (chain.length > 0) {
    return chain.map((place) => place.localName).join(" / ");
  }
  return placeLookup.get(placeId)?.localName ?? placeId;
}

function App() {
  const [activeProfile, setActiveProfile] = useState("all");
  const [activeLevel, setActiveLevel] = useState("country");
  const [viewMode, setViewMode] = useState("map");
  const [yearFilter, setYearFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [visits, setVisits] = useState(initialVisits);
  const [selectedPlaceId, setSelectedPlaceId] = useState("CHN");
  const [mapPlaces, setMapPlaces] = useState({ country: [], region: [], city: [] });
  const [mapStatus, setMapStatus] = useState("正在加载真实边界");

  useEffect(() => {
    let cancelled = false;
    async function loadMaps() {
      try {
        const base = import.meta.env.BASE_URL;
        const [countriesResponse, statesResponse, citiesResponse] = await Promise.all([
          fetch(`${base}maps/countries.geojson`),
          fetch(`${base}maps/states.geojson`),
          fetch(`${base}maps/china-cities.geojson`),
        ]);
        if (!countriesResponse.ok || !statesResponse.ok || !citiesResponse.ok) {
          throw new Error("Map response was not ok");
        }
        const [countries, states, cities] = await Promise.all([
          countriesResponse.json(),
          statesResponse.json(),
          citiesResponse.json(),
        ]);
        if (!cancelled) {
          setMapPlaces({
            country: countries.features.map(featureToPlace),
            region: states.features.map(featureToPlace),
            city: cities.features.map(featureToPlace),
          });
          setMapStatus(
            `${countries.features.length} 个国家/地区，${states.features.length} 个二级行政区，${cities.features.length} 个中国城市`,
          );
        }
      } catch {
        if (!cancelled) setMapStatus("真实边界未加载，使用示例边界");
      }
    }
    loadMaps();
    return () => {
      cancelled = true;
    };
  }, []);

  const cityPlaces = useMemo(
    () => places.filter((place) => place.level === "city"),
    [],
  );

  const placeLookup = useMemo(() => {
    const lookup = new Map();
    for (const place of places) lookup.set(place.id, place);
    for (const level of ["country", "region", "city"]) {
      for (const place of mapPlaces[level]) lookup.set(place.id, place);
    }
    return lookup;
  }, [mapPlaces]);

  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      const place = findPlace(visit.placeId);
      const chain = placeChain(visit.placeId);
      const country = chain.find((item) => item.level === "country");
      const text = `${formatPath(visit.placeId, placeLookup)} ${visit.note}`.toLowerCase();
      const year = visit.visitedAt.slice(0, 4);
      const profileMatch =
        activeProfile === "all" || visit.profileId === activeProfile;
      const yearMatch = yearFilter === "all" || year === yearFilter;
      const regionMatch =
        regionFilter === "all" ||
        place?.region === regionFilter ||
        country?.region === regionFilter;
      const typeMatch = typeFilter === "all" || visit.type === typeFilter;
      const queryMatch = !query || text.includes(query.toLowerCase());
      return profileMatch && yearMatch && regionMatch && typeMatch && queryMatch;
    });
  }, [
    activeProfile,
    placeLookup,
    query,
    regionFilter,
    typeFilter,
    visits,
    yearFilter,
  ]);

  const visitedByLevel = useMemo(() => {
    const result = new Map();
    for (const visit of filteredVisits) {
      const mapId = resolveMapIdForLevel(visit.placeId, activeLevel);
      if (!mapId) continue;
      const current = result.get(mapId) ?? {
        count: 0,
        profileIds: new Set(),
        visits: [],
      };
      current.count += 1;
      current.profileIds.add(visit.profileId);
      current.visits.push(visit);
      result.set(mapId, current);
    }
    return result;
  }, [activeLevel, filteredVisits]);

  const displayPlaces = useMemo(() => {
    const loaded = mapPlaces[activeLevel];
    return loaded.length > 0
      ? loaded
      : places.filter((place) => place.level === activeLevel);
  }, [activeLevel, mapPlaces]);

  const selectedVisits = useMemo(() => {
    const selected = placeLookup.get(selectedPlaceId);
    if (!selected) return [];
    return filteredVisits.filter((visit) => {
      if (selected.level === "city") return resolveMapIdForLevel(visit.placeId, "city") === selected.id;
      return resolveMapIdForLevel(visit.placeId, selected.level) === selected.id;
    });
  }, [filteredVisits, placeLookup, selectedPlaceId]);

  const stats = useMemo(() => {
    const countries = new Set();
    const regions = new Set();
    const cities = new Set();
    for (const visit of filteredVisits) {
      const chain = placeChain(visit.placeId);
      for (const place of chain) {
        if (place.level === "country") countries.add(place.mapId || place.id);
        if (place.level === "region") regions.add(place.mapId || place.id);
        if (place.level === "city") cities.add(place.mapId || place.id);
      }
    }
    const recent = [...filteredVisits].sort((a, b) =>
      b.visitedAt.localeCompare(a.visitedAt),
    )[0];
    return {
      countries: countries.size,
      regions: regions.size,
      cities: cities.size,
      visits: filteredVisits.length,
      recent,
    };
  }, [filteredVisits]);

  const years = useMemo(
    () =>
      Array.from(new Set(visits.map((visit) => visit.visitedAt.slice(0, 4)))).sort(),
    [visits],
  );

  function addVisit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("photo");
    const photos =
      file && file.size
        ? [
            {
              name: file.name,
              url: URL.createObjectURL(file),
            },
          ]
        : [];
    const nextVisit = {
      id: `visit-${Date.now()}`,
      profileId: form.get("profileId"),
      placeId: form.get("placeId"),
      visitedAt: form.get("visitedAt"),
      type: form.get("type"),
      note: form.get("note") || "新添加的足迹。",
      photos,
    };
    setVisits((current) => [nextVisit, ...current]);
    setSelectedPlaceId(resolveMapIdForLevel(nextVisit.placeId, activeLevel) || nextVisit.placeId);
    event.currentTarget.reset();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">TravelMap Prototype</p>
          <h1>两个人的足迹地图</h1>
        </div>
        <div className="status-strip" aria-label="项目状态">
          <span>
            <Database size={16} /> Mock 数据
          </span>
          <span>
            <ShieldCheck size={16} /> 待接 Supabase
          </span>
        </div>
      </header>

      <section className="control-band" aria-label="地图控制">
        <div className="segmented">
          {profileFilters.map((profile) => (
            <button
              className={activeProfile === profile.id ? "active" : ""}
              key={profile.id}
              onClick={() => setActiveProfile(profile.id)}
              type="button"
            >
              <Users size={16} />
              {profile.label}
            </button>
          ))}
        </div>
        <div className="segmented">
          {placeLevels.map((level) => (
            <button
              className={activeLevel === level.id ? "active" : ""}
              key={level.id}
              onClick={() => setActiveLevel(level.id)}
              title={level.description}
              type="button"
            >
              <Layers3 size={16} />
              {level.label}
            </button>
          ))}
        </div>
        <div className="segmented">
          <button
            className={viewMode === "map" ? "active" : ""}
            onClick={() => setViewMode("map")}
            type="button"
          >
            <MapPinned size={16} />
            地图
          </button>
          <button
            className={viewMode === "list" ? "active" : ""}
            onClick={() => setViewMode("list")}
            type="button"
          >
            <ListFilter size={16} />
            列表
          </button>
          <button
            className={viewMode === "admin" ? "active" : ""}
            onClick={() => setViewMode("admin")}
            type="button"
          >
            <Plus size={16} />
            编辑
          </button>
        </div>
      </section>

      <section className="metric-grid" aria-label="统计数据">
        <Metric icon={<Globe2 />} label="去过国家" value={stats.countries} />
        <Metric icon={<Layers3 />} label="去过省州" value={stats.regions} />
        <Metric icon={<MapPinned />} label="去过城市" value={stats.cities} />
        <Metric
          icon={<CalendarDays />}
          label="最近一次"
          value={stats.recent ? findPlace(stats.recent.placeId)?.localName : "-"}
          detail={stats.recent?.visitedAt}
        />
      </section>

      <section className="filters" aria-label="筛选">
        <label>
          <Search size={16} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索地点或备注"
            value={query}
          />
        </label>
        <label>
          <SlidersHorizontal size={16} />
          <select onChange={(event) => setYearFilter(event.target.value)} value={yearFilter}>
            <option value="all">全部年份</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Globe2 size={16} />
          <select
            onChange={(event) => setRegionFilter(event.target.value)}
            value={regionFilter}
          >
            <option value="all">全部地区</option>
            <option value="Asia">亚洲</option>
            <option value="Europe">欧洲</option>
            <option value="North America">北美洲</option>
          </select>
        </label>
        <label>
          <ListFilter size={16} />
          <select onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
            <option value="all">全部类型</option>
            {tripTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </section>

      {viewMode === "map" && (
        <section className="workspace">
          <MapView
            activeLevel={activeLevel}
            cityPlaces={cityPlaces}
            displayPlaces={displayPlaces}
            mapStatus={mapStatus}
            selectedPlaceId={selectedPlaceId}
            setSelectedPlaceId={setSelectedPlaceId}
            visitedByLevel={visitedByLevel}
          />
          <DetailPanel
            placeLookup={placeLookup}
            selectedPlaceId={selectedPlaceId}
            visits={selectedVisits}
          />
        </section>
      )}

      {viewMode === "list" && <VisitList placeLookup={placeLookup} visits={filteredVisits} />}

      {viewMode === "admin" && <AdminForm addVisit={addVisit} placeLookup={placeLookup} />}
    </main>
  );
}

function Metric({ detail, icon, label, value }) {
  return (
    <article className="metric">
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </article>
  );
}

function MapView({
  activeLevel,
  cityPlaces,
  displayPlaces,
  mapStatus,
  selectedPlaceId,
  setSelectedPlaceId,
  visitedByLevel,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const lastLevelRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [31.2, 104],
      zoom: 3,
      minZoom: 2,
      maxZoom: 10,
      scrollWheelZoom: true,
      worldCopyJump: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
      subdomains: "abcd",
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || displayPlaces.length === 0) return;

    if (layerRef.current) {
      layerRef.current.remove();
    }

    const featureCollection = {
      type: "FeatureCollection",
      features: displayPlaces.map(placeToFeature),
    };

    const layer = L.geoJSON(featureCollection, {
      style: (feature) => {
        const id = feature.properties.id;
        const visitInfo = visitedByLevel.get(id);
        const isSelected = selectedPlaceId === id;
        const hasBoth = visitInfo?.profileIds.size > 1;
        return {
          color: isSelected ? "#111c16" : visitInfo ? "#9a5a16" : "#6f7d72",
          weight: isSelected ? 2.4 : activeLevel === "country" ? 0.8 : 0.65,
          opacity: 0.95,
          fillColor: visitInfo ? (hasBoth ? "#6dbb9a" : "#f4b35e") : "#f7f3ea",
          fillOpacity: visitInfo ? 0.72 : 0.45,
        };
      },
      onEachFeature: (feature, leafletLayer) => {
        leafletLayer.bindTooltip(feature.properties.localName || feature.properties.name, {
          sticky: true,
        });
        leafletLayer.on("click", () => setSelectedPlaceId(feature.properties.id));
      },
    }).addTo(map);

    for (const city of cityPlaces) {
      const id = city.mapId || city.id;
      const visitInfo = visitedByLevel.get(id);
      const [lon, lat] = city.center;
      L.circleMarker([lat, lon], {
        radius: activeLevel === "city" ? 5 : 3.5,
        color: "#ffffff",
        weight: 1.5,
        fillColor: visitInfo || activeLevel !== "city" ? "#18241b" : "#7d8a80",
        fillOpacity: visitInfo || activeLevel !== "city" ? 0.9 : 0.45,
      })
        .bindTooltip(city.localName, { sticky: true })
        .on("click", () => setSelectedPlaceId(id))
        .addTo(layer);
    }

    layerRef.current = layer;

    const bounds = layer.getBounds();
    if (bounds.isValid() && lastLevelRef.current !== activeLevel) {
      map.fitBounds(bounds, { padding: [18, 18], animate: false });
      lastLevelRef.current = activeLevel;
    }
  }, [
    activeLevel,
    cityPlaces,
    displayPlaces,
    selectedPlaceId,
    setSelectedPlaceId,
    visitedByLevel,
  ]);

  return (
    <div className="map-surface">
      <div className="map-head">
        <div>
          <p className="eyebrow">Layer</p>
          <h2>{placeLevels.find((level) => level.id === activeLevel)?.label}层级</h2>
        </div>
        <p>{mapStatus}</p>
      </div>
      <div className="leaflet-map" ref={containerRef} />
    </div>
  );
}

function DetailPanel({ placeLookup, selectedPlaceId, visits }) {
  const place = placeLookup.get(selectedPlaceId);
  if (!place) return null;

  return (
    <aside className="detail-panel">
      <p className="eyebrow">Selected</p>
      <h2>{place.localName}</h2>
      <p className="place-path">{formatPath(place.id, placeLookup)}</p>
      <div className="detail-stats">
        <span>{visits.length} 次记录</span>
        <span>{place.level}</span>
      </div>
      <div className="visit-stack">
        {visits.length === 0 && <p className="empty">还没有符合当前筛选的足迹。</p>}
        {visits.map((visit) => (
          <article className="visit-item" key={visit.id}>
            <div>
              <strong>{profiles.find((profile) => profile.id === visit.profileId)?.name}</strong>
              <span>{visit.visitedAt}</span>
            </div>
            <p>{visit.note}</p>
            <small>{visit.type}</small>
            {visit.photos.length > 0 && (
              <img alt={visit.photos[0].name} src={visit.photos[0].url} />
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}

function VisitList({ placeLookup, visits }) {
  return (
    <section className="list-view">
      <div className="section-title">
        <p className="eyebrow">Records</p>
        <h2>足迹列表</h2>
      </div>
      <div className="table">
        <div className="table-row table-head">
          <span>人物</span>
          <span>地点</span>
          <span>日期</span>
          <span>类型</span>
          <span>备注</span>
        </div>
        {visits.map((visit) => (
          <div className="table-row" key={visit.id}>
            <span>{profiles.find((profile) => profile.id === visit.profileId)?.name}</span>
            <span>{formatPath(visit.placeId, placeLookup)}</span>
            <span>{visit.visitedAt}</span>
            <span>{visit.type}</span>
            <span>{visit.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminForm({ addVisit, placeLookup }) {
  return (
    <section className="admin-view">
      <div className="section-title">
        <p className="eyebrow">Editor Prototype</p>
        <h2>添加足迹</h2>
      </div>
      <form className="editor-form" onSubmit={addVisit}>
        <label>
          人物
          <select name="profileId" required>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          地点
          <select name="placeId" required>
            {places
              .filter((place) => place.level === "city")
              .map((place) => (
                <option key={place.id} value={place.id}>
                  {formatPath(place.id, placeLookup)}
                </option>
              ))}
          </select>
        </label>
        <label>
          日期
          <input name="visitedAt" required type="date" />
        </label>
        <label>
          类型
          <select name="type" required>
            {tripTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          备注
          <textarea name="note" placeholder="记录这次旅行的简短说明" rows="4" />
        </label>
        <label className="upload wide">
          <Camera size={18} />
          <span>上传一张照片预览</span>
          <input accept="image/*" name="photo" type="file" />
        </label>
        <button className="primary-action" type="submit">
          <Plus size={18} />
          添加到当前原型
        </button>
      </form>
    </section>
  );
}

export default App;
