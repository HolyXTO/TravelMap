// -*- coding: utf-8 -*-
/**
 * satelliteOwners.js
 *
 * CelesTrak SATCAT 官方 OWNER 所属国/国际组织代码映射与展示辅助。
 * 参考 CelesTrak 官方目录规范 (https://celestrak.org/satcat/sources.php)，
 * 将国家代码映射至中文名、英文名与 flag-icons 国旗，确保与航班/摄像头模块侧栏保持一致的按国家分组体验。
 */
import { getCountryDisplayName } from "./airports.js";

const SATCAT_OWNER_TO_COUNTRY = {
  US: "United States",
  USBZ: "United States",
  GLOB: "United States",
  ORB: "United States",
  PRC: "China",
  ROC: "Taiwan",
  CHBZ: "China",
  CIS: "Russia",
  UK: "United Kingdom",
  O3B: "United Kingdom",
  IM: "United Kingdom",
  JPN: "Japan",
  IT: "Italy",
  FR: "France",
  FRIT: "France",
  IND: "India",
  SKOR: "South Korea",
  NKOR: "North Korea",
  GER: "Germany",
  SPN: "Spain",
  CA: "Canada",
  TURK: "Turkey",
  AUS: "Australia",
  ARGN: "Argentina",
  FIN: "Finland",
  GREC: "Greece",
  UAE: "United Arab Emirates",
  NOR: "Norway",
  ISRA: "Israel",
  POL: "Poland",
  SING: "Singapore",
  SAUD: "Saudi Arabia",
  AB: "Saudi Arabia",
  BRAZ: "Brazil",
  POR: "Portugal",
  LUXE: "Luxembourg",
  SES: "Luxembourg",
  IRAN: "Iran",
  BEL: "Belgium",
  NETH: "Netherlands",
  INDO: "Indonesia",
  EGYP: "Egypt",
  SWTZ: "Switzerland",
  PAKI: "Pakistan",
  MALA: "Malaysia",
  RWA: "Rwanda",
  THAI: "Thailand",
  ALG: "Algeria",
  KAZ: "Kazakhstan",
  BUL: "Bulgaria",
  DEN: "Denmark",
  MEX: "Mexico",
  AZER: "Azerbaijan",
  VTNM: "Vietnam",
  BELA: "Belarus",
  HUN: "Hungary",
  MA: "Morocco",
  ASRA: "Austria",
  SWED: "Sweden",
  CZCH: "Czech Republic",
  CHLE: "Chile",
  NIG: "Nigeria",
  SVN: "Slovenia",
  RP: "Philippines",
  LTU: "Lithuania",
  SAFR: "South Africa",
  SVK: "Slovakia",
  KWT: "Kuwait",
  ECU: "Ecuador",
  UKR: "Ukraine",
  VENZ: "Venezuela",
  BHR: "Bahrain",
  ANG: "Angola",
  BGD: "Bangladesh",
  BWA: "Botswana",
  HRV: "Croatia",
  DJI: "Djibouti",
  ROM: "Romania",
  ETH: "Ethiopia",
  SLB: "Solomon Islands",
  JOR: "Jordan",
  LAOS: "Laos",
  MNE: "Montenegro",
  PERU: "Peru",
  IRAQ: "Iraq",
  BOL: "Bolivia",
  NZ: "New Zealand",
  TMMC: "Turkmenistan",
};

const SPECIAL_ORG_DISPLAY = {
  ESA: {
    zh: "欧洲航天局 / 欧空局",
    en: "ESA",
    code: "eu",
    isGlobe: false,
    flag: "🇪🇺",
    flagUrl: "https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/eu.svg",
    fallbackFlagUrl: null,
  },
  EUTE: {
    zh: "欧洲通信卫星组织",
    en: "EUTELSAT",
    code: "eu",
    isGlobe: false,
    flag: "🇪🇺",
    flagUrl: "https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/eu.svg",
    fallbackFlagUrl: null,
  },
  EUME: {
    zh: "欧洲气象卫星组织",
    en: "EUMETSAT",
    code: "eu",
    isGlobe: false,
    flag: "🇪🇺",
    flagUrl: "https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/eu.svg",
    fallbackFlagUrl: null,
  },
  ISS: {
    zh: "国际空间站联盟",
    en: "ISS Partnership",
    code: null,
    isGlobe: true,
    flag: "🌐",
    flagUrl: null,
    fallbackFlagUrl: null,
  },
  ITSO: {
    zh: "国际电信卫星组织",
    en: "ITSO / INTELSAT",
    code: null,
    isGlobe: true,
    flag: "🌐",
    flagUrl: null,
    fallbackFlagUrl: null,
  },
  AC: {
    zh: "亚太通信卫星联盟",
    en: "ACeS / Regional",
    code: null,
    isGlobe: true,
    flag: "🌐",
    flagUrl: null,
    fallbackFlagUrl: null,
  },
  ABS: {
    zh: "亚洲广播卫星公司",
    en: "ABS Global",
    code: null,
    isGlobe: true,
    flag: "🌐",
    flagUrl: null,
    fallbackFlagUrl: null,
  },
  NICO: {
    zh: "新铱星 / 跨国通信",
    en: "ICO Global",
    code: null,
    isGlobe: true,
    flag: "🌐",
    flagUrl: null,
    fallbackFlagUrl: null,
  },
  GRSA: {
    zh: "希腊-沙特联合卫星",
    en: "Hellas Sat",
    code: null,
    isGlobe: true,
    flag: "🌐",
    flagUrl: null,
    fallbackFlagUrl: null,
  },
  RASC: {
    zh: "非洲区域卫星通信",
    en: "RASCOM",
    code: null,
    isGlobe: true,
    flag: "🌐",
    flagUrl: null,
    fallbackFlagUrl: null,
  },
  STCT: {
    zh: "新加坡/中国台湾联合",
    en: "ST-2 Ventures",
    code: null,
    isGlobe: true,
    flag: "🌐",
    flagUrl: null,
    fallbackFlagUrl: null,
  },
  TBD: {
    zh: "未标明归属国 / 待确认",
    en: "Unassigned / TBD",
    code: null,
    isGlobe: true,
    flag: "🌐",
    flagUrl: null,
    fallbackFlagUrl: null,
  },
};

const NAME_FALLBACK_PATTERNS = [
  { owner: "US", pattern: /\b(STARLINK|GPS|NAVSTAR|NOAA|GOES|USA[- ]\d+|IRIDIUM|ORBCOMM|GLOBALSTAR|PLANET|FLOCK|LEMUR|CAPELLA|SPIRE|CREW DRAGON|DRAGON|ISS)\b/i },
  { owner: "PRC", pattern: /\b(CSS|TIANHE|WENTIAN|MENGTIAN|BEIDOU|FENGYUN|FY-|YAOGAN|GAOFEN|SHIJIAN|TIANLIAN|TIANHUI|QIANFAN|HULIANWANG|JILIN|ZHUHAI|CHINASAT|APSTAR)\b/i },
  { owner: "CIS", pattern: /\b(COSMOS|GLONASS|PROGRESS|SOYUZ|METEOR-M|EXPRESS|YAMAL)\b/i },
  { owner: "UK", pattern: /\b(ONEWEB|SKYNET)\b/i },
  { owner: "ESA", pattern: /\b(GALILEO|SENTINEL|METEOSAT|SWARM|CRYOSAT)\b/i },
  { owner: "JPN", pattern: /\b(QZSS|MICHIBIKI|HIMAWARI|ALOS|HTV)\b/i },
  { owner: "IND", pattern: /\b(INSAT|GSAT|CARTOSAT|RISAT|IRNSS|NAVIC)\b/i },
];

export function inferSatelliteOwnerCode({ owner = "", name = "" } = {}) {
  const cleanOwner = String(owner || "").trim().toUpperCase();
  if (cleanOwner && cleanOwner !== "UNKNOWN") {
    return cleanOwner;
  }
  const upperName = String(name || "").toUpperCase();
  for (const rule of NAME_FALLBACK_PATTERNS) {
    if (rule.pattern.test(upperName)) {
      return rule.owner;
    }
  }
  return "TBD";
}

/**
 * 返回可直接用于 UI 分组和国旗展示的标准国家信息。
 */
export function getSatelliteOwnerGroupKey(ownerCode) {
  const code = String(ownerCode || "TBD").trim().toUpperCase() || "TBD";
  if (SATCAT_OWNER_TO_COUNTRY[code]) {
    return SATCAT_OWNER_TO_COUNTRY[code];
  }
  if (SPECIAL_ORG_DISPLAY[code]) {
    return `__ORG_${code}`;
  }
  return "__ORG_TBD";
}

export function getSatelliteCountryDisplay(groupKey) {
  if (!groupKey) return SPECIAL_ORG_DISPLAY.TBD;
  if (groupKey.startsWith("__ORG_")) {
    const code = groupKey.slice(6);
    return SPECIAL_ORG_DISPLAY[code] || SPECIAL_ORG_DISPLAY.TBD;
  }
  return getCountryDisplayName(groupKey);
}
