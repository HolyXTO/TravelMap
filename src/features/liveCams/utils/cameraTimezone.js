// -*- coding: utf-8 -*-
/**
 * cameraTimezone.js
 * 
 * 全球监控探头本地真实时区解析与格式化工具：
 * 根据探头国家、省市及经纬度坐标，智能映射至对应的 IANA 时区（如 EST, GMT, JST, CST 等）。
 */

export function getCameraTimezone(camera) {
  if (!camera) return "UTC";
  const { country = "", lng = 0, city = "" } = camera;

  // 1. 中国及港澳台
  if (["中国", "中国香港", "中国澳门", "中国台湾", "台湾"].includes(country)) {
    return "Asia/Shanghai";
  }

  // 2. 日本 / 韩国
  if (country === "日本") return "Asia/Tokyo";
  if (country === "韩国") return "Asia/Seoul";

  // 3. 英国 / 爱尔兰 / 冰岛
  if (["英国", "爱尔兰"].includes(country)) return "Europe/London";
  if (country === "冰岛") return "Atlantic/Reykjavik";

  // 4. 欧洲中部时区 CET (法、德、意、西、奥、瑞、荷、比、波兰等)
  if (
    [
      "法国", "德国", "意大利", "西班牙", "奥地利", "瑞典", "挪威", "荷兰",
      "比利时", "瑞士", "波兰", "克罗地亚", "斯洛伐克", "捷克", "丹麦",
      "匈牙利", "塞尔维亚", "斯洛文尼亚"
    ].includes(country)
  ) {
    return "Europe/Paris";
  }

  // 5. 欧洲东部时区 EET (芬兰、希腊、罗马尼亚、保加利亚、立陶宛、塞浦路斯、乌克兰)
  if (
    ["芬兰", "希腊", "罗马尼亚", "保加利亚", "立陶宛", "塞浦路斯", "乌克兰"].includes(
      country
    )
  ) {
    return "Europe/Helsinki";
  }

  // 6. 土耳其 / 以色列 / 中东
  if (country === "土耳其") return "Europe/Istanbul";
  if (country === "以色列") return "Asia/Jerusalem";
  if (country === "阿联酋") return "Asia/Dubai";

  // 7. 俄罗斯 (跨越多个时区)
  if (country === "俄罗斯") {
    if (lng < 40) return "Europe/Moscow";
    if (lng < 60) return "Asia/Yekaterinburg";
    if (lng < 90) return "Asia/Novosibirsk";
    if (lng < 110) return "Asia/Krasnoyarsk";
    return "Asia/Vladivostok";
  }

  // 8. 美国 (按经度精细划分 4 大核心大陆时区 + 阿拉斯加/夏威夷)
  if (country === "美国") {
    if (lng < -140) return "Pacific/Honolulu";
    if (lng < -130) return "America/Anchorage";
    if (lng < -114) return "America/Los_Angeles"; // 太平洋时区 PST/PDT (加州、华盛顿州、内华达等)
    if (lng < -102) return "America/Denver";      // 山地时区 MST/MDT (科罗拉多、犹他、亚利桑那等)
    if (lng < -86) return "America/Chicago";       // 中部时区 CST/CDT (德州、伊利诺伊等)
    return "America/New_York";                     // 东部时区 EST/EDT (特拉华、纽约、佛罗里达等)
  }

  // 9. 加拿大
  if (country === "加拿大") {
    if (lng < -120) return "America/Vancouver";
    if (lng < -110) return "America/Edmonton";
    if (lng < -90) return "America/Winnipeg";
    if (lng < -70) return "America/Toronto";
    return "America/Halifax";
  }

  // 10. 澳大利亚 / 新西兰
  if (country === "澳大利亚") {
    if (lng < 129) return "Australia/Perth";
    if (lng < 138) return "Australia/Adelaide";
    return "Australia/Sydney";
  }
  if (country === "新西兰") return "Pacific/Auckland";

  // 11. 东南亚
  if (country === "新加坡") return "Asia/Singapore";
  if (country === "泰国") return "Asia/Bangkok";
  if (country === "印度尼西亚") {
    if (lng < 110) return "Asia/Jakarta";
    if (lng < 120) return "Asia/Makassar";
    return "Asia/Jayapura";
  }

  // 12. 美洲其他
  if (country === "巴西") return "America/Sao_Paulo";
  if (country === "阿根廷") return "America/Argentina/Buenos_Aires";
  if (country === "墨西哥") return "America/Mexico_City";

  // 13. 非洲
  if (country === "南非") return "Africa/Johannesburg";
  if (country === "埃及") return "Africa/Cairo";

  // 兜底：根据经度自动匹配时区
  try {
    const offsetHours = Math.round(lng / 15);
    const sign = offsetHours >= 0 ? "+" : "-";
    return `Etc/GMT${sign === "+" ? "-" : "+"}${Math.abs(offsetHours)}`;
  } catch (e) {
    return "UTC";
  }
}

/**
 * 格式化探头当地真实时间：
 * 输出样例：Mon, 02 Nov 2026 10:36:25 EST
 */
export function formatCameraLocalTime(date, timeZone) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "UTC",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });

    const parts = dtf.formatToParts(date);
    const getVal = (type) => parts.find((p) => p.type === type)?.value || "";
    const weekday = getVal("weekday");
    const day = getVal("day");
    const month = getVal("month");
    const year = getVal("year");
    const hour = getVal("hour");
    const minute = getVal("minute");
    const second = getVal("second");
    const tzName = getVal("timeZoneName");

    return `${weekday}, ${day} ${month} ${year} ${hour}:${minute}:${second} ${tzName}`;
  } catch (e) {
    return date.toUTCString().replace("GMT", "UTC");
  }
}
