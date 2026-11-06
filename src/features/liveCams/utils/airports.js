/**
 * Airport Database with major global hubs and dynamic resolution.
 * Adapted from OSIRIS Aviation module.
 */

export const RAW_AIRPORTS = [
  // North America — US
  ['ATL','KATL','Hartsfield-Jackson','Atlanta','US',33.6367,-84.4281],
  ['LAX','KLAX','Los Angeles Intl','Los Angeles','US',33.9425,-118.4081],
  ['ORD','KORD',"O'Hare Intl",'Chicago','US',41.9742,-87.9073],
  ['DFW','KDFW','Dallas/Fort Worth','Dallas','US',32.8998,-97.0403],
  ['DEN','KDEN','Denver Intl','Denver','US',39.8561,-104.6737],
  ['JFK','KJFK','John F Kennedy','New York','US',40.6399,-73.7787],
  ['SFO','KSFO','San Francisco Intl','San Francisco','US',37.6213,-122.3790],
  ['SEA','KSEA','Seattle-Tacoma','Seattle','US',47.4502,-122.3088],
  ['LAS','KLAS','Harry Reid Intl','Las Vegas','US',36.0840,-115.1537],
  ['MCO','KMCO','Orlando Intl','Orlando','US',28.4312,-81.3081],
  ['MIA','KMIA','Miami Intl','Miami','US',25.7959,-80.2870],
  ['EWR','KEWR','Newark Liberty','Newark','US',40.6895,-74.1745],
  ['CLT','KCLT','Charlotte Douglas','Charlotte','US',35.2140,-80.9431],
  ['PHX','KPHX','Phoenix Sky Harbor','Phoenix','US',33.4373,-112.0078],
  ['IAH','KIAH','George Bush Intercontinental','Houston','US',29.9902,-95.3368],
  ['MSP','KMSP','Minneapolis-Saint Paul','Minneapolis','US',44.8848,-93.2223],
  ['DTW','KDTW','Detroit Metropolitan','Detroit','US',42.2124,-83.3534],
  ['BOS','KBOS','Logan Intl','Boston','US',42.3656,-71.0096],
  ['FLL','KFLL','Fort Lauderdale-Hollywood','Fort Lauderdale','US',26.0726,-80.1527],
  ['LGA','KLGA','LaGuardia','New York','US',40.7769,-73.8740],
  ['BWI','KBWI','Baltimore/Washington','Baltimore','US',39.1754,-76.6684],
  ['IAD','KIAD','Washington Dulles','Washington','US',38.9445,-77.4558],
  ['DCA','KDCA','Reagan National','Washington','US',38.8521,-77.0377],
  ['SAN','KSAN','San Diego Intl','San Diego','US',32.7336,-117.1897],
  ['TPA','KTPA','Tampa Intl','Tampa','US',27.9755,-82.5332],
  ['PDX','KPDX','Portland Intl','Portland','US',45.5887,-122.5975],
  ['SLC','KSLC','Salt Lake City Intl','Salt Lake City','US',40.7884,-111.9778],
  ['STL','KSTL','St Louis Lambert','St Louis','US',38.7487,-90.3700],
  ['HNL','PHNL','Daniel K Inouye','Honolulu','US',21.3187,-157.9225],
  ['AUS','KAUS','Austin-Bergstrom','Austin','US',30.1945,-97.6699],
  ['BNA','KBNA','Nashville Intl','Nashville','US',36.1263,-86.6774],
  ['RDU','KRDU','Raleigh-Durham','Raleigh','US',35.8776,-78.7875],
  // Canada
  ['YYZ','CYYZ','Toronto Pearson','Toronto','CA',43.6777,-79.6248],
  ['YVR','CYVR','Vancouver Intl','Vancouver','CA',49.1947,-123.1790],
  ['YUL','CYUL','Montréal Trudeau','Montréal','CA',45.4706,-73.7408],
  ['YYC','CYYC','Calgary Intl','Calgary','CA',51.1215,-114.0076],
  // Mexico
  ['MEX','MMMX','Mexico City Intl','Mexico City','MX',19.4363,-99.0721],
  ['CUN','MMUN','Cancún Intl','Cancún','MX',21.0365,-86.8771],
  // Europe — UK
  ['LHR','EGLL','Heathrow','London','GB',51.4700,-0.4543],
  ['LGW','EGKK','Gatwick','London','GB',51.1481,-0.1903],
  ['MAN','EGCC','Manchester','Manchester','GB',53.3537,-2.2750],
  ['EDI','EGPH','Edinburgh','Edinburgh','GB',55.9508,-3.3725],
  // Europe — France
  ['CDG','LFPG','Charles de Gaulle','Paris','FR',49.0097,2.5479],
  ['ORY','LFPO','Orly','Paris','FR',48.7233,2.3794],
  ['NCE','LFMN',"Nice Côte d'Azur",'Nice','FR',43.6584,7.2159],
  // Europe — Germany
  ['FRA','EDDF','Frankfurt','Frankfurt','DE',50.0333,8.5706],
  ['MUC','EDDM','Munich','Munich','DE',48.3538,11.7861],
  ['BER','EDDB','Berlin Brandenburg','Berlin','DE',52.3667,13.5033],
  // Europe — Netherlands / Belgium
  ['AMS','EHAM','Schiphol','Amsterdam','NL',52.3086,4.7639],
  ['BRU','EBBR','Brussels','Brussels','BE',50.9014,4.4844],
  // Europe — Spain / Portugal / Italy / Switzerland
  ['MAD','LEMD','Adolfo Suárez Madrid–Barajas','Madrid','ES',40.4936,-3.5668],
  ['BCN','LEBL','El Prat','Barcelona','ES',41.2971,2.0785],
  ['SVQ','LEZL','Seville Airport','Seville','ES',37.4180,-5.8931],
  ['AGP','LEMG','Málaga Airport','Málaga','ES',36.6749,-4.4991],
  ['VLC','LEVC','Valencia Airport','Valencia','ES',39.4893,-0.4816],
  ['LIS','LPPT','Humberto Delgado','Lisbon','PT',38.7756,-9.1354],
  ['OPO','LPPR','Francisco Sá Carneiro','Porto','PT',41.2481,-8.6814],
  ['FCO','LIRF','Fiumicino','Rome','IT',41.8003,12.2389],
  ['MXP','LIMC','Malpensa','Milan','IT',45.6306,8.7281],
  ['ZRH','LSZH','Zürich','Zürich','CH',47.4647,8.5492],
  ['VIE','LOWW','Vienna Intl','Vienna','AT',48.1103,16.5697],
  ['DUB','EIDW','Dublin Airport','Dublin','IE',53.4213,-6.2701],
  ['CPH','EKCH','Copenhagen Airport','Copenhagen','DK',55.6180,12.6560],
  ['OSL','ENGM','Oslo Gardermoen','Oslo','NO',60.1976,11.1004],
  ['ARN','ESSA','Stockholm Arlanda','Stockholm','SE',59.6519,17.9186],
  ['HEL','EFHK','Helsinki Vantaa','Helsinki','FI',60.3172,24.9633],
  ['WAW','EPWA','Warsaw Chopin','Warsaw','PL',52.1657,20.9671],
  ['PRG','LKPR','Václav Havel','Prague','CZ',50.1008,14.2600],
  ['BUD','LHBP','Budapest Ferenc Liszt','Budapest','HU',47.4369,19.2556],
  ['ATH','LGAV','Eleftherios Venizelos','Athens','GR',37.9364,23.9445],
  // Middle East & Turkey
  ['IST','LTFM','Istanbul Airport','Istanbul','TR',41.2753,28.7519],
  ['DXB','OMDB','Dubai Intl','Dubai','AE',25.2528,55.3644],
  ['DOH','OTHH','Hamad Intl','Doha','QA',25.2731,51.6081],
  ['AUH','OMAA','Abu Dhabi Intl','Abu Dhabi','AE',24.4330,54.6511],
  ['RUH','OERK','King Khalid','Riyadh','SA',24.9576,46.6988],
  // East Asia — China
  ['PEK','ZBAA','北京首都国际机场 (Beijing Capital)','Beijing','CN',40.0799,116.6031],
  ['PKX','ZBAD','北京大兴国际机场 (Beijing Daxing)','Beijing','CN',39.5098,116.4105],
  ['PVG','ZSPD','上海浦东国际机场 (Shanghai Pudong)','Shanghai','CN',31.1434,121.8052],
  ['SHA','ZSSS','上海虹桥国际机场 (Shanghai Hongqiao)','Shanghai','CN',31.1979,121.3364],
  ['CAN','ZGGG','广州白云国际机场 (Guangzhou Baiyun)','Guangzhou','CN',23.3924,113.2988],
  ['SZX','ZGSZ','深圳宝安国际机场 (Shenzhen Baoan)','Shenzhen','CN',22.6393,113.8107],
  ['CTU','ZUUU','成都双流国际机场 (Chengdu Shuangliu)','Chengdu','CN',30.5785,103.9471],
  ['TFU','ZUTF','成都天府国际机场 (Chengdu Tianfu)','Chengdu','CN',30.3191,104.4451],
  ['CKG','ZUCK','重庆江北国际机场 (Chongqing Jiangbei)','Chongqing','CN',29.7192,106.6417],
  ['XIY','ZLXY','西安咸阳国际机场 (Xian Xianyang)','Xian','CN',34.4471,108.7515],
  ['KMG','ZPPP','昆明长水国际机场 (Kunming Changshui)','Kunming','CN',25.1019,102.9292],
  ['HGH','ZSHC','杭州萧山国际机场 (Hangzhou Xiaoshan)','Hangzhou','CN',30.2295,120.4344],
  ['WUH','ZHHH','武汉天河国际机场 (Wuhan Tianhe)','Wuhan','CN',30.7838,114.2081],
  ['NKG','ZSNJ','南京禄口国际机场 (Nanjing Lukou)','Nanjing','CN',31.7420,118.8620],
  ['CGO','ZHCC','郑州新郑国际机场 (Zhengzhou Xinzheng)','Zhengzhou','CN',34.5197,113.8408],
  ['TAO','ZSQD','青岛胶东国际机场 (Qingdao Jiaodong)','Qingdao','CN',36.3689,120.0886],
  ['TSN','ZBTJ','天津滨海国际机场 (Tianjin Binhai)','Tianjin','CN',39.1244,117.3461],
  ['XMN','ZSAM','厦门高崎国际机场 (Xiamen Gaoqi)','Xiamen','CN',24.5440,118.1278],
  ['CSX','ZGHA','长沙黄花国际机场 (Changsha Huanghua)','Changsha','CN',28.1892,113.2197],
  ['URC','ZWWW','乌鲁木齐地窝堡 (Urumqi Diwopu)','Urumqi','CN',43.9072,87.4742],
  ['SYX','ZJSY','三亚凤凰国际机场 (Sanya Phoenix)','Sanya','CN',18.3028,109.4122],
  ['HAK','ZJHK','海口美兰国际机场 (Haikou Meilan)','Haikou','CN',19.9349,110.4589],
  ['HKG','VHHH','香港国际机场 (Hong Kong Intl)','Hong Kong','HK',22.3089,113.9144],
  ['MFM','VMMC','澳门国际机场 (Macau Intl)','Macau','MO',22.1496,113.5920],
  ['TPE','RCTP','台湾桃园国际机场 (Taiwan Taoyuan)','Taipei','TW',25.0777,121.2325],
  // East Asia — Japan / Korea
  ['NRT','RJAA','Narita','Tokyo','JP',35.7647,140.3864],
  ['HND','RJTT','Haneda','Tokyo','JP',35.5494,139.7798],
  ['KIX','RJBB','Kansai','Osaka','JP',34.4347,135.2441],
  ['ICN','RKSI','Incheon','Seoul','KR',37.4602,126.4407],
  ['GMP','RKSS','Gimpo','Seoul','KR',37.5586,126.7906],
  // Southeast Asia & Oceania
  ['SIN','WSSS','Changi','Singapore','SG',1.3502,103.9940],
  ['BKK','VTBS','Suvarnabhumi','Bangkok','TH',13.6900,100.7501],
  ['KUL','WMKK','Kuala Lumpur Intl','Kuala Lumpur','MY',2.7456,101.7099],
  ['CGK','WIII','Soekarno-Hatta','Jakarta','ID',-6.1256,106.6559],
  ['MNL','RPLL','Ninoy Aquino','Manila','PH',14.5086,121.0198],
  ['SYD','YSSY','Kingsford Smith','Sydney','AU',-33.9399,151.1753],
  ['MEL','YMML','Tullamarine','Melbourne','AU',-37.6733,144.8433],
  ['AKL','NZAA','Auckland','Auckland','NZ',-37.0082,174.7850],
  // South America & Africa
  ['GRU','SBGR','Guarulhos','São Paulo','BR',-23.4356,-46.4731],
  ['EZE','SAEZ','Ministro Pistarini','Buenos Aires','AR',-34.8222,-58.5358],
  ['JNB','FAOR','O R Tambo','Johannesburg','ZA',-26.1392,28.2460],
  ['CAI','HECA','Cairo Intl','Cairo','EG',30.1219,31.4056],
];

export const AIRPORTS_BY_ICAO = {};
export const AIRPORTS_BY_IATA = {};

for (const [iata, icao, name, city, country, lat, lng] of RAW_AIRPORTS) {
  const item = { iata, icao, name, city, country, lat, lng };
  AIRPORTS_BY_ICAO[icao] = item;
  if (!AIRPORTS_BY_IATA[iata]) {
    AIRPORTS_BY_IATA[iata] = item;
  }
}

/**
 * 机场代码检索 (支持 IATA 或 ICAO，如 PEK 或 ZBAA)
 */
export function lookupAirport(code) {
  if (!code) return null;
  const upper = String(code).toUpperCase().trim();
  return AIRPORTS_BY_ICAO[upper] || AIRPORTS_BY_IATA[upper] || null;
}

/**
 * 查找距离某坐标最近的机场
 */
export function nearestAirport(lat, lng, maxKm = 40) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best = null;
  let bestKm = maxKm;
  const lngScale = Math.cos((lat * Math.PI) / 180);
  for (const ap of Object.values(AIRPORTS_BY_ICAO)) {
    const dy = (ap.lat - lat) * 111.32;
    const dx = (ap.lng - lng) * 111.32 * lngScale;
    const d = Math.hypot(dx, dy);
    if (d < bestKm) {
      bestKm = d;
      best = ap;
    }
  }
  return best;
}

/**
 * 计算大圆航线坐标点 (Great-circle geodesic coordinates)
 */
export function greatCirclePoints(lat1, lng1, lat2, lng2, n = 64) {
  const toR = (d) => (d * Math.PI) / 180;
  const toD = (r) => (r * 180) / Math.PI;
  const φ1 = toR(lat1), λ1 = toR(lng1), φ2 = toR(lat2), λ2 = toR(lng2);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
  ));
  if (d < 1e-9) return [[lng1, lat1], [lng2, lat2]];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    pts.push([toD(Math.atan2(y, x)), toD(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return pts;
}

/**
 * 计算两点间球面距离 (公里)
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
