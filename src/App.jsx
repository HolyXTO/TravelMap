import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CalendarDays,
  Database,
  Globe2,
  Layers3,
  ListFilter,
  MapPinned,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  Users,
} from "lucide-react";
import {
  initialVisits,
  placeLevels,
  places,
  profiles,
  tripTypes,
} from "./data/mockData";
import { supabase } from "./lib/supabase";

const PHOTO_BUCKET = "travel-photos";
const CHINA_BOUNDS = [
  [18, 73],
  [54, 135],
];
const WORLD_BOUNDS = [
  [-85, -180],
  [84, 180],
];
const CONTINENT_LABELS = {
  Asia: "亚洲",
  Europe: "欧洲",
  Africa: "非洲",
  Oceania: "大洋洲",
  Americas: "美洲",
  "North America": "北美洲",
  "South America": "南美洲",
  Antarctica: "南极洲",
};

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

function flagEmoji(isoA2) {
  if (!isoA2 || isoA2.length !== 2) return "◇";
  return isoA2
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join("");
}

function featureToPlace(feature) {
  const props = feature.properties;
  return {
    ...props,
    id: props.id,
    level: props.level,
    name: props.name,
    localName: props.localName || props.name,
    parentId: props.parentId,
    countryCode: props.countryCode || props.code || props.id,
    countryName: props.country || props.localName || props.name,
    flag: flagEmoji(props.isoA2),
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

function findPlace(placeId, placeLookup) {
  return placeLookup?.get(placeId) || places.find((place) => place.id === placeId);
}

function placeChain(placeId, placeLookup) {
  const chain = [];
  let current = findPlace(placeId, placeLookup);
  const seen = new Set();
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? findPlace(current.parentId, placeLookup) : null;
  }
  return chain;
}

function resolvePlaceForLevel(placeId, level, placeLookup) {
  const chain = placeChain(placeId, placeLookup);
  if (level === "country") {
    return chain.find((place) => place.level === "country");
  }
  if (level === "region") {
    return chain.find((place) => place.level === "region") ?? chain[0];
  }
  return findPlace(placeId, placeLookup);
}

function resolveMapIdForLevel(placeId, level, placeLookup) {
  const place = resolvePlaceForLevel(placeId, level, placeLookup);
  return place?.mapId || place?.id;
}

function formatPath(placeId, placeLookup) {
  const chain = placeChain(placeId, placeLookup);
  if (chain.length > 0) {
    return chain.map((place) => place.localName).join(" / ");
  }
  return placeLookup.get(placeId)?.localName ?? placeId;
}

function regionLabel(region) {
  return CONTINENT_LABELS[region] || region || "其他";
}

function placeSearchText(place) {
  return [
    place.flag,
    place.localName,
    place.name,
    place.countryName,
    place.province,
    place.region,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildContinentSummary(visits, placeLookup) {
  const buckets = new Map();
  for (const visit of visits) {
    const chain = placeChain(visit.placeId, placeLookup);
    const country = chain.find((place) => place.level === "country");
    const region = chain.find((place) => place.level === "region");
    const city = chain.find((place) => place.level === "city");
    const continent = regionLabel(country?.region || country?.continent || "Other");
    if (!buckets.has(continent)) {
      buckets.set(continent, {
        label: continent,
        count: 0,
        countries: new Map(),
      });
    }
    const bucket = buckets.get(continent);
    bucket.count += 1;
    const countryId = country?.id || "unknown";
    if (!bucket.countries.has(countryId)) {
      bucket.countries.set(countryId, {
        id: countryId,
        name: country?.localName || country?.name || "未知地区",
        regions: new Set(),
        cities: new Set(),
        visits: 0,
      });
    }
    const item = bucket.countries.get(countryId);
    item.visits += 1;
    if (region) item.regions.add(region.id);
    if (city) item.cities.add(city.id);
  }

  const order = ["亚洲", "北美洲", "欧洲", "非洲", "大洋洲", "南美洲", "南极洲", "美洲"];
  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      countries: Array.from(bucket.countries.values()).sort((a, b) =>
        b.visits - a.visits || a.name.localeCompare(b.name),
      ),
    }))
    .sort((a, b) => {
      const ai = order.indexOf(a.label);
      const bi = order.indexOf(b.label);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

function photoFromPath(path) {
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return {
    name: path.split("/").pop() || "旅行照片",
    url: data.publicUrl,
  };
}

function mapProfile(row) {
  return {
    id: row.id,
    name: row.display_name,
    color: row.color,
  };
}

function mapVisit(row) {
  return {
    id: row.id,
    profileId: row.profile_id,
    placeId: row.place_id,
    visitedAt: row.visited_at,
    type: row.trip_type,
    note: row.note || "",
    photos: (row.visit_photos || []).map((photo) =>
      photoFromPath(photo.storage_path),
    ),
  };
}

function safeStorageName(name) {
  return name.replace(/[^\w.-]+/g, "_").slice(-100) || "photo";
}

function App() {
  const [activeProfile, setActiveProfile] = useState("all");
  const [activeLevel, setActiveLevel] = useState("country");
  const [viewMode, setViewMode] = useState("map");
  const [yearFilter, setYearFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [appProfiles, setAppProfiles] = useState(profiles);
  const [visits, setVisits] = useState([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState("CHN");
  const [countryModalId, setCountryModalId] = useState(null);
  const [mapPlaces, setMapPlaces] = useState({ country: [], region: [], city: [] });
  const [searchPlaces, setSearchPlaces] = useState([]);
  const [mapStatus, setMapStatus] = useState("正在加载真实边界");
  const [dataStatus, setDataStatus] = useState("正在连接 Supabase");
  const [session, setSession] = useState(null);
  const [isEditor, setIsEditor] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const profileFilters = useMemo(
    () => [
      { id: "all", label: "两个人" },
      ...appProfiles.map((profile) => ({ id: profile.id, label: profile.name })),
    ],
    [appProfiles],
  );

  useEffect(() => {
    if (
      activeProfile !== "all" &&
      !appProfiles.some((profile) => profile.id === activeProfile)
    ) {
      setActiveProfile("all");
    }
  }, [activeProfile, appProfiles]);

  const loadTravelData = async () => {
    try {
      setDataStatus("正在同步 Supabase 数据");
      const [profilesResult, visitsResult] = await Promise.all([
        supabase
          .from("travel_profiles")
          .select("id, display_name, color, created_at")
          .order("created_at", { ascending: true }),
        supabase
          .from("visits")
          .select(
            "id, profile_id, place_id, visited_at, trip_type, note, visit_photos(id, storage_path, caption)",
          )
          .order("visited_at", { ascending: false }),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (visitsResult.error) throw visitsResult.error;

      const nextProfiles = profilesResult.data.map(mapProfile);
      setAppProfiles(nextProfiles.length > 0 ? nextProfiles : profiles);
      setVisits(visitsResult.data.map(mapVisit));
      setDataStatus("Supabase 已连接");
    } catch (error) {
      console.error(error);
      setAppProfiles(profiles);
      setVisits(initialVisits);
      setDataStatus("Supabase 暂不可用，正在显示本地示例数据");
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadMaps() {
      try {
        const base = import.meta.env.BASE_URL;
        const [
          countriesResponse,
          statesResponse,
          citiesResponse,
          indexResponse,
        ] = await Promise.all([
          fetch(`${base}maps/countries.geojson`),
          fetch(`${base}maps/states.geojson`),
          fetch(`${base}maps/china-cities.geojson`),
          fetch(`${base}maps/place-index.json`),
        ]);
        if (
          !countriesResponse.ok ||
          !statesResponse.ok ||
          !citiesResponse.ok ||
          !indexResponse.ok
        ) {
          throw new Error("Map response was not ok");
        }
        const [countries, states, cities, placeIndex] = await Promise.all([
          countriesResponse.json(),
          statesResponse.json(),
          citiesResponse.json(),
          indexResponse.json(),
        ]);
        if (!cancelled) {
          setMapPlaces({
            country: countries.features.map(featureToPlace),
            region: states.features.map(featureToPlace),
            city: cities.features.map(featureToPlace),
          });
          setSearchPlaces(placeIndex);
          setMapStatus(
            `${countries.metadata?.countryCount || countries.features.length} 个国家，${states.features.length} 个中国省级单位，${cities.features.length} 个中国城市`,
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

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      await loadTravelData();
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setSession(data.session);
    }

    boot();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthMessage("");
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkEditor() {
      if (!session) {
        setIsEditor(false);
        return;
      }
      const { data, error } = await supabase.rpc("is_travelmap_editor");
      if (!cancelled) {
        setIsEditor(Boolean(data) && !error);
        if (error) setAuthMessage("登录成功，但暂时无法确认编辑权限。");
      }
    }

    checkEditor();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const cityPlaces = useMemo(
    () => searchPlaces.filter((place) => place.level === "city" && place.countryCode === "CHN"),
    [searchPlaces],
  );

  const placeLookup = useMemo(() => {
    const lookup = new Map();
    for (const place of places) lookup.set(place.id, place);
    for (const level of ["country", "region", "city"]) {
      for (const place of mapPlaces[level]) lookup.set(place.id, place);
    }
    for (const place of searchPlaces) {
      const existing = lookup.get(place.id);
      lookup.set(place.id, {
        ...existing,
        ...place,
        geometry: existing?.geometry || place.geometry,
      });
    }
    return lookup;
  }, [mapPlaces, searchPlaces]);

  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      const place = findPlace(visit.placeId, placeLookup);
      const chain = placeChain(visit.placeId, placeLookup);
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
      const mapId = resolveMapIdForLevel(visit.placeId, activeLevel, placeLookup);
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
  }, [activeLevel, filteredVisits, placeLookup]);

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
      if (selected.level === "city") {
        return resolveMapIdForLevel(visit.placeId, "city", placeLookup) === selected.id;
      }
      return resolveMapIdForLevel(visit.placeId, selected.level, placeLookup) === selected.id;
    });
  }, [filteredVisits, placeLookup, selectedPlaceId]);

  const stats = useMemo(() => {
    const countries = new Set();
    const regions = new Set();
    const cities = new Set();
    for (const visit of filteredVisits) {
      const chain = placeChain(visit.placeId, placeLookup);
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
  }, [filteredVisits, placeLookup]);

  const years = useMemo(
    () =>
      Array.from(new Set(visits.map((visit) => visit.visitedAt.slice(0, 4)))).sort(),
    [visits],
  );

  const visitedPlaceIds = useMemo(
    () => new Set(visits.map((visit) => visit.placeId)),
    [visits],
  );

  const selectedCountryId = useMemo(
    () => resolveMapIdForLevel(selectedPlaceId, "country", placeLookup) || "CHN",
    [placeLookup, selectedPlaceId],
  );

  const selectedCountry = placeLookup.get(selectedCountryId);
  const modalCountry = countryModalId ? placeLookup.get(countryModalId) : null;

  const selectedCountryPlaces = useMemo(
    () =>
      searchPlaces.filter(
        (place) =>
          place.countryCode === selectedCountryId &&
          place.level !== "country",
      ),
    [searchPlaces, selectedCountryId],
  );

  const selectedCountryVisits = useMemo(
    () =>
      filteredVisits.filter(
        (visit) =>
          resolveMapIdForLevel(visit.placeId, "country", placeLookup) === selectedCountryId,
      ),
    [filteredVisits, placeLookup, selectedCountryId],
  );

  const continentSummary = useMemo(
    () => buildContinentSummary(filteredVisits, placeLookup),
    [filteredVisits, placeLookup],
  );

  function changeLevel(levelId) {
    setActiveLevel(levelId);
    if (levelId === "region" || levelId === "city") {
      setSelectedPlaceId("CHN");
    }
  }

  async function saveVisit({ file, placeId, profileId, resetTarget, type, visitedAt }) {
    if (!session || !isEditor) {
      setAuthMessage("请先用已授权账号登录。");
      return false;
    }
    try {
      setIsSaving(true);
      setAuthMessage("");
      const { data: createdVisit, error: visitError } = await supabase
        .from("visits")
        .insert({
          profile_id: profileId,
          place_id: placeId,
          visited_at: visitedAt || new Date().toISOString().slice(0, 10),
          trip_type: type || "旅行",
          note: "",
          created_by: session.user.id,
        })
        .select("id")
        .single();

      if (visitError) throw visitError;

      if (file && file.size) {
        const storagePath = `${session.user.id}/${createdVisit.id}/${Date.now()}-${safeStorageName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(storagePath, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { error: photoError } = await supabase.from("visit_photos").insert({
          visit_id: createdVisit.id,
          storage_path: storagePath,
          created_by: session.user.id,
        });
        if (photoError) throw photoError;
      }

      await loadTravelData();
      setSelectedPlaceId(resolveMapIdForLevel(placeId, activeLevel, placeLookup) || placeId);
      setAuthMessage("已保存到 Supabase。");
      resetTarget?.reset?.();
      return true;
    } catch (error) {
      console.error(error);
      setAuthMessage(`保存失败：${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function addVisit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await saveVisit({
      file: form.get("photo"),
      placeId: form.get("placeId"),
      profileId: form.get("profileId"),
      resetTarget: formElement,
      type: form.get("type"),
      visitedAt: form.get("visitedAt"),
    });
  }

  async function addPlace(place, options = {}) {
    const targetProfile =
      options.profileId ||
      (activeProfile !== "all" ? activeProfile : appProfiles[0]?.id);
    if (!targetProfile) {
      setAuthMessage("还没有可用的人物档案。");
      return false;
    }
    return saveVisit({
      placeId: place.id,
      profileId: targetProfile,
      type: options.type || "旅行",
      visitedAt: options.visitedAt || "",
    });
  }

  async function deleteVisit(visitId) {
    if (!session || !isEditor) {
      setAuthMessage("请先用已授权账号登录。");
      return false;
    }
    const ok = window.confirm("确认删除这条足迹记录吗？");
    if (!ok) return false;
    try {
      setIsSaving(true);
      const { error } = await supabase.from("visits").delete().eq("id", visitId);
      if (error) throw error;
      await loadTravelData();
      setAuthMessage("已删除。");
      return true;
    } catch (error) {
      console.error(error);
      setAuthMessage(`删除失败：${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setAuthMessage("正在登录");
    const { error } = await supabase.auth.signInWithPassword({
      email: form.get("email"),
      password: form.get("password"),
    });
    setAuthMessage(error ? `登录失败：${error.message}` : "登录成功。");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setAuthMessage("已退出登录。");
  }

  return (
    <main className="app-shell">
      <QuickAddDock
        activeProfile={activeProfile}
        addPlace={addPlace}
        authMessage={authMessage}
        isEditor={isEditor}
        isSaving={isSaving}
        profiles={appProfiles}
        searchPlaces={searchPlaces}
        session={session}
        visitedPlaceIds={visitedPlaceIds}
        visits={visits}
        onDeleteVisit={deleteVisit}
      />
      <header className="topbar">
        <div>
          <p className="eyebrow">TravelMap Prototype</p>
          <h1>两个人的足迹地图</h1>
        </div>
        <div className="status-strip" aria-label="项目状态">
          <span>
            <Database size={16} /> {dataStatus}
          </span>
          <span>
            <ShieldCheck size={16} /> {session ? "已登录编辑账号" : "公开只读"}
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
              onClick={() => changeLevel(level.id)}
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
          value={stats.recent ? findPlace(stats.recent.placeId, placeLookup)?.localName : "-"}
          detail={stats.recent?.visitedAt}
        />
      </section>

      <section className="filters" aria-label="筛选">
        <label>
          <Search size={16} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索地点"
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
            placeLookup={placeLookup}
            selectedPlaceId={selectedPlaceId}
            setSelectedPlaceId={setSelectedPlaceId}
            onCountryOpen={setCountryModalId}
            visitedByLevel={visitedByLevel}
            visitedPlaces={searchPlaces.filter((place) => visitedPlaceIds.has(place.id))}
          />
          {selectedCountry && (
            <CountryPanel
              addPlace={addPlace}
              authMessage={authMessage}
              country={selectedCountry}
              countryPlaces={selectedCountryPlaces}
              isEditor={isEditor}
              isSaving={isSaving}
              profiles={appProfiles}
              selectedPlaceId={selectedPlaceId}
              selectedVisits={selectedVisits}
              session={session}
              visits={selectedCountryVisits}
              visitedPlaceIds={visitedPlaceIds}
            />
          )}
        </section>
      )}

      {modalCountry && (
        <CountryModal
          addPlace={addPlace}
          authMessage={authMessage}
          cityPlaces={mapPlaces.city}
          country={modalCountry}
          countryPlaces={searchPlaces.filter(
            (place) => place.countryCode === modalCountry.id && place.level !== "country",
          )}
          isEditor={isEditor}
          isSaving={isSaving}
          onClose={() => setCountryModalId(null)}
          onDeleteVisit={deleteVisit}
          profiles={appProfiles}
          regionPlaces={mapPlaces.region}
          placeLookup={placeLookup}
          session={session}
          visits={filteredVisits.filter(
            (visit) =>
              resolveMapIdForLevel(visit.placeId, "country", placeLookup) === modalCountry.id,
          )}
          visitedPlaceIds={visitedPlaceIds}
          visitedByLevel={visitedByLevel}
        />
      )}

      {viewMode === "list" && (
        <VisitList
          placeLookup={placeLookup}
          profiles={appProfiles}
          visits={filteredVisits}
        />
      )}

      {viewMode === "admin" && (
        <AdminForm
          addVisit={addVisit}
          authMessage={authMessage}
          isEditor={isEditor}
          isSaving={isSaving}
          onSignIn={signIn}
          onSignOut={signOut}
          placeLookup={placeLookup}
          profiles={appProfiles}
          session={session}
        />
      )}

      <TravelOverview
        continentSummary={continentSummary}
        placeLookup={placeLookup}
      />
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
  placeLookup,
  selectedPlaceId,
  setSelectedPlaceId,
  onCountryOpen,
  visitedByLevel,
  visitedPlaces,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const lastLevelRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [15, 18],
      zoom: 2,
      minZoom: 1,
      maxZoom: 12,
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
          color: isSelected ? "#245a38" : visitInfo ? "#9a5a16" : "#6f7d72",
          weight: isSelected ? 1.4 : activeLevel === "country" ? 0.7 : 0.6,
          opacity: 0.95,
          fillColor: visitInfo ? (hasBoth ? "#6dbb9a" : "#f4b35e") : "#f7f3ea",
          fillOpacity: visitInfo ? 0.72 : 0.45,
        };
      },
      onEachFeature: (feature, leafletLayer) => {
        leafletLayer.bindTooltip(feature.properties.localName || feature.properties.name, {
          sticky: true,
        });
        leafletLayer.on("click", () => {
          setSelectedPlaceId(feature.properties.id);
          if (activeLevel === "country") onCountryOpen(feature.properties.id);
        });
        leafletLayer.on("mouseover", () => {
          if (activeLevel === "country") setSelectedPlaceId(feature.properties.id);
        });
      },
    }).addTo(map);

    const markerPlaces =
      activeLevel === "city"
        ? visitedPlaces.filter((place) => place.level === "city")
        : visitedPlaces.filter((place) => place.level === "city");
    for (const city of markerPlaces) {
      const id = city.mapId || city.id;
      const visitInfo =
        visitedByLevel.get(id) ||
        visitedByLevel.get(resolveMapIdForLevel(id, activeLevel, placeLookup));
      const [lon, lat] = city.center;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
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

    const bounds =
      activeLevel === "country"
        ? L.latLngBounds(WORLD_BOUNDS)
        : L.latLngBounds(CHINA_BOUNDS);
    if (bounds.isValid() && lastLevelRef.current !== activeLevel) {
      map.fitBounds(bounds, { padding: [10, 10], animate: false });
      lastLevelRef.current = activeLevel;
    }
  }, [
    activeLevel,
    cityPlaces,
    displayPlaces,
    placeLookup,
    selectedPlaceId,
    setSelectedPlaceId,
    onCountryOpen,
    visitedByLevel,
    visitedPlaces,
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

function QuickAddDock({
  activeProfile,
  addPlace,
  authMessage,
  isEditor,
  isSaving,
  profiles,
  searchPlaces,
  session,
  visitedPlaceIds,
  visits,
  onDeleteVisit,
}) {
  return (
    <aside className="quick-add-dock" aria-label="快速添加足迹">
      <div className="dock-handle">
        <Plus size={18} />
      </div>
      <PlaceSearchPanel
        activeProfile={activeProfile}
        addPlace={addPlace}
        authMessage={authMessage}
        isEditor={isEditor}
        isSaving={isSaving}
        places={searchPlaces}
        profiles={profiles}
        session={session}
        title="添加足迹"
        visitedPlaceIds={visitedPlaceIds}
        visits={visits}
        onDeleteVisit={onDeleteVisit}
      />
    </aside>
  );
}

function FlagIcon({ place }) {
  const iso = place?.isoA2?.toLowerCase();
  if (!iso || iso.length !== 2) {
    return <span className="flag fallback-flag">{place?.flag || "◇"}</span>;
  }
  return (
    <span className="flag">
      <img
        alt=""
        loading="lazy"
        src={`https://flagcdn.com/w40/${iso}.png`}
      />
    </span>
  );
}

function CountryModal({
  addPlace,
  authMessage,
  cityPlaces,
  country,
  countryPlaces,
  isEditor,
  isSaving,
  onClose,
  onDeleteVisit,
  placeLookup,
  profiles,
  regionPlaces,
  session,
  visits,
  visitedByLevel,
  visitedPlaceIds,
}) {
  const visitedRegions = new Set();
  const visitedCities = new Set();
  for (const visit of visits) {
    const regionId = resolveMapIdForLevel(visit.placeId, "region", placeLookup);
    const cityId = resolveMapIdForLevel(visit.placeId, "city", placeLookup);
    if (regionId && regionId !== country.id) visitedRegions.add(regionId);
    if (cityId) visitedCities.add(cityId);
  }
  const regionTotal = country.id === "CHN"
    ? countryPlaces.filter((place) => place.level === "region").length
    : 0;
  const grouped = buildCountryGroups(visits, placeLookup);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="country-modal" role="dialog" aria-modal="true">
        <header className="modal-head">
          <div>
            <p className="eyebrow">Country</p>
            <h2>
              <FlagIcon place={country} />
              {country.name}
            </h2>
            <span>{country.localName || country.countryName}</span>
          </div>
          <button aria-label="关闭" className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="modal-grid">
          <PlaceSearchPanel
            addPlace={addPlace}
            authMessage={authMessage}
            compact
            isEditor={isEditor}
            isSaving={isSaving}
            onDeleteVisit={onDeleteVisit}
            places={countryPlaces}
            profiles={profiles}
            session={session}
            title={`添加 ${country.localName || country.name} 的地点`}
            visitedPlaceIds={visitedPlaceIds}
            visits={visits}
          />
          <div className="modal-map-wrap">
            <MiniCountryMap
              cityPlaces={cityPlaces}
              country={country}
              regionPlaces={regionPlaces}
              visitedByLevel={visitedByLevel}
              visitedPlaces={countryPlaces.filter((place) => visitedPlaceIds.has(place.id))}
            />
          </div>
          <aside className="modal-summary">
            <div className="country-metrics">
              <span>
                <strong>{regionTotal ? visitedRegions.size : "-"}</strong>
                {regionTotal ? ` / ${regionTotal} 省 / 自治区` : "省级统计暂未启用"}
              </span>
              <span>
                <strong>{visitedCities.size}</strong>
                城市 / 地点
              </span>
            </div>
            <p className="modal-note">
              地图上已点亮 {visitedRegions.size} 个行政区，打卡 {visitedCities.size} 个城市 / 地点。
            </p>
            <h3>按行政区展开</h3>
            {grouped.length === 0 && <p className="empty">尚未标记地点。</p>}
            {grouped.map((group) => (
              <div className="admin-group" key={group.id}>
                <strong>{group.name}</strong>
                <span>{group.count} 城市 / 地点</span>
              </div>
            ))}
          </aside>
        </div>
      </section>
    </div>
  );
}

function buildCountryGroups(visits, placeLookup) {
  const groups = new Map();
  for (const visit of visits) {
    const place = placeLookup.get(visit.placeId);
    const region = resolvePlaceForLevel(visit.placeId, "region", placeLookup);
    const key = region?.id || place?.province || "other";
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: region?.localName || place?.province || "其他地点",
        count: 0,
      });
    }
    groups.get(key).count += 1;
  }
  return Array.from(groups.values()).sort((a, b) =>
    b.count - a.count || a.name.localeCompare(b.name),
  );
}

function MiniCountryMap({
  cityPlaces,
  country,
  regionPlaces,
  visitedByLevel,
  visitedPlaces,
}) {
  const miniRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!miniRef.current || mapRef.current) return;
    const map = L.map(miniRef.current, {
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
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
    if (!map || !country) return;
    if (layerRef.current) layerRef.current.remove();

    const layer = L.layerGroup().addTo(map);
    const boundaryPlaces =
      country.id === "CHN" ? regionPlaces : country.geometry ? [country] : [];
    if (boundaryPlaces.length > 0) {
      L.geoJSON(
        {
          type: "FeatureCollection",
          features: boundaryPlaces.map(placeToFeature),
        },
        {
          style: (feature) => {
            const id = feature.properties.id;
            const visitInfo = visitedByLevel.get(id);
            return {
              color: visitInfo ? "#8a5518" : "#748177",
              weight: visitInfo ? 1.2 : 0.55,
              fillColor: visitInfo ? "#f4b35e" : "#f7f3ea",
              fillOpacity: visitInfo ? 0.72 : 0.42,
            };
          },
        },
      ).addTo(layer);
    }

    for (const place of visitedPlaces.filter((item) => item.level === "city")) {
      const [lon, lat] = place.center || [];
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      L.circleMarker([lat, lon], {
        radius: 4,
        color: "#fff",
        weight: 1.2,
        fillColor: "#16361f",
        fillOpacity: 0.92,
      })
        .bindTooltip(place.localName || place.name, { sticky: true })
        .addTo(layer);
    }

    layerRef.current = layer;
    const bounds = layer.getBounds?.();
    if (bounds?.isValid()) {
      map.fitBounds(bounds, { padding: [16, 16], animate: false });
    }
  }, [cityPlaces, country, regionPlaces, visitedByLevel, visitedPlaces]);

  return <div className="mini-country-map" ref={miniRef} />;
}

function CountryPanel({
  addPlace,
  authMessage,
  country,
  countryPlaces,
  isEditor,
  isSaving,
  profiles,
  selectedVisits,
  session,
  visits,
  visitedPlaceIds,
}) {
  const provinceCount = new Set(
    visits
      .map((visit) => countryPlaces.find((place) => place.id === visit.placeId)?.parentId)
      .filter(Boolean),
  ).size;
  const cityCount = new Set(visits.map((visit) => visit.placeId)).size;
  const regionTotal = country.id === "CHN"
    ? countryPlaces.filter((place) => place.level === "region").length
    : 0;

  return (
    <aside className="country-panel">
      <div className="country-panel-head">
        <div>
          <p className="eyebrow">Selected Country</p>
          <h2>
            <span>{country.flag || "◇"}</span>
            {country.localName || country.name}
          </h2>
        </div>
        <X size={18} aria-hidden="true" />
      </div>

      <div className="country-metrics">
        <span>
          <strong>{regionTotal ? provinceCount : "-"}</strong>
          {regionTotal ? ` / ${regionTotal} 省级单位` : "省级统计暂仅支持中国"}
        </span>
        <span>
          <strong>{cityCount}</strong>
          打卡城市/地点
        </span>
      </div>

      <div className="country-records">
        <h3>当前选区记录</h3>
        <p className="empty">点击地图上的国家会打开完整添加弹窗。</p>
        {selectedVisits.length === 0 && <p className="empty">还没有符合当前筛选的足迹。</p>}
        {selectedVisits.slice(0, 6).map((visit) => (
          <p key={visit.id}>
            <span>{visit.visitedAt}</span>
            {visit.type}
          </p>
        ))}
      </div>
    </aside>
  );
}

function PlaceSearchPanel({
  activeProfile,
  addPlace,
  authMessage,
  compact = false,
  isEditor,
  isSaving,
  places,
  profiles,
  session,
  title,
  visitedPlaceIds,
  visits,
  onDeleteVisit,
}) {
  const [query, setQuery] = useState("");
  const [profileId, setProfileId] = useState(profiles[0]?.id || "");
  const [visitedAt, setVisitedAt] = useState("");
  const [type, setType] = useState("旅行");

  useEffect(() => {
    const validIds = new Set(profiles.map((profile) => profile.id));
    if (activeProfile && activeProfile !== "all" && validIds.has(activeProfile)) {
      setProfileId(activeProfile);
    } else if ((!profileId || !validIds.has(profileId)) && profiles[0]) {
      setProfileId(profiles[0].id);
    }
  }, [activeProfile, profileId, profiles]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return places
      .filter((place) => placeSearchText(place).includes(needle))
      .slice(0, compact ? 8 : 12);
  }, [compact, places, query]);

  const addedPlaces = useMemo(() => {
    return visits
      .map((visit) => {
        const place = places.find((item) => item.id === visit.placeId);
        return place ? { place, visit } : null;
      })
      .filter(Boolean)
      .slice(0, compact ? 5 : 10);
  }, [compact, places, visits]);

  async function handleAdd(place) {
    const ok = await addPlace(place, { profileId, type, visitedAt });
    if (ok) setQuery("");
  }

  return (
    <div className={compact ? "place-search compact" : "place-search"}>
      <div className="place-search-title">
        <h3>{title}</h3>
        <span>已添加 {addedPlaces.length}</span>
      </div>
      {!session && <p className="empty">请先到“编辑”页登录，登录后这里可以直接添加。</p>}
      {session && !isEditor && <p className="empty">当前账号没有编辑权限。</p>}
      <div className="mini-form">
        <select
          disabled={!session || !isEditor}
          onChange={(event) => setProfileId(event.target.value)}
          value={profileId}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
        <select
          disabled={!session || !isEditor}
          onChange={(event) => setType(event.target.value)}
          value={type}
        >
          {tripTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          disabled={!session || !isEditor}
          onChange={(event) => setVisitedAt(event.target.value)}
          type="date"
          value={visitedAt}
        />
      </div>
      <label className="search-field">
        <Search size={16} />
        <input
          disabled={!session || !isEditor}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索国家、城市或省份"
          value={query}
        />
      </label>
      <div className="search-results">
        {query.trim() && results.length === 0 && (
          <p className="empty">没有找到匹配地点。</p>
        )}
        {results.map((place) => (
          <button
            disabled={!session || !isEditor || isSaving}
            key={place.id}
            onClick={() => handleAdd(place)}
            type="button"
          >
            <FlagIcon place={place} />
            <span>
              <strong>{place.localName || place.name}</strong>
              <small>
                {place.countryName}
                {place.province ? ` · ${place.province}` : ""}
              </small>
            </span>
            <em>{visitedPlaceIds.has(place.id) ? "已去过" : "+"}</em>
          </button>
        ))}
      </div>
      {authMessage && <p className="dock-message">{authMessage}</p>}
      <div className="added-list">
        <p>你去过的地方</p>
        {addedPlaces.length === 0 && <small>尚未标记地点。</small>}
        {addedPlaces.map(({ place, visit }) => (
          <div key={visit.id}>
            <FlagIcon place={place} />
            <span>
              <strong>{place.localName || place.name}</strong>
              <small>{place.countryName}</small>
            </span>
            {onDeleteVisit && (
              <button
                aria-label={`删除 ${place.localName || place.name}`}
                disabled={isSaving}
                onClick={() => onDeleteVisit(visit.id)}
                type="button"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({ placeLookup, profiles, selectedPlaceId, visits }) {
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

function VisitList({ placeLookup, profiles, visits }) {
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

function TravelOverview({ continentSummary }) {
  const defaultContinents = ["亚洲", "北美洲", "欧洲", "非洲", "大洋洲", "南美洲", "南极洲"];
  const existing = new Set(continentSummary.map((item) => item.label));
  const items = [
    ...continentSummary,
    ...defaultContinents
      .filter((label) => !existing.has(label))
      .map((label) => ({ label, count: 0, countries: [] })),
  ];

  return (
    <section className="overview-section" aria-label="足迹总览">
      <div className="section-title">
        <p className="eyebrow">Overview</p>
        <h2>按大洲浏览足迹</h2>
      </div>
      <div className="continent-grid">
        {items.map((continent) => (
          <article className="continent-block" key={continent.label}>
            <header>
              <h3>{continent.label}</h3>
              <strong>{continent.count}</strong>
            </header>
            {continent.countries.length === 0 && <p className="empty">尚未标记地点。</p>}
            {continent.countries.map((country) => (
              <div className="country-summary" key={country.id}>
                <strong>{country.name}</strong>
                <span>
                  {country.regions.size ? `${country.regions.size} 省州，` : ""}
                  {country.cities.size || country.visits} 城市 / 地点
                </span>
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminForm({
  addVisit,
  authMessage,
  isEditor,
  isSaving,
  onSignIn,
  onSignOut,
  placeLookup,
  profiles,
  session,
}) {
  if (!session) {
    return (
      <section className="admin-view">
        <div className="section-title">
          <p className="eyebrow">Editor Login</p>
          <h2>登录后编辑足迹</h2>
        </div>
        <form className="editor-form auth-form" onSubmit={onSignIn}>
          <label>
            Supabase 邮箱
            <input name="email" required type="email" />
          </label>
          <label>
            密码
            <input name="password" required type="password" />
          </label>
          <button className="primary-action" type="submit">
            <ShieldCheck size={18} />
            登录
          </button>
          {authMessage && <p className="form-message wide">{authMessage}</p>}
        </form>
      </section>
    );
  }

  if (!isEditor) {
    return (
      <section className="admin-view">
        <div className="section-title">
          <p className="eyebrow">Editor Permission</p>
          <h2>当前账号没有编辑权限</h2>
        </div>
        <p className="form-message">
          已登录 {session.user.email}，但它不在 app_editors 表里。
        </p>
        <button className="primary-action inline-action" onClick={onSignOut} type="button">
          退出登录
        </button>
      </section>
    );
  }

  return (
    <section className="admin-view">
      <div className="section-title">
        <p className="eyebrow">Editor Account</p>
        <h2>编辑账号已连接</h2>
        <p className="editor-account">已登录 {session.user.email}</p>
      </div>
      <p className="form-message">
        回到地图页，把鼠标移到最左侧即可展开添加面板；点击某个国家后，右侧国家面板也可以只搜索该国家内的地点。
      </p>
      <button className="primary-action inline-action" onClick={onSignOut} type="button">
        退出登录
      </button>
    </section>
  );
}

export default App;
