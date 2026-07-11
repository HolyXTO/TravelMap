const fs = require("fs");
const path = require("path");
const https = require("https");

const SUPABASE_URL = "https://yxwflztibppjcyxdulho.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d2ZsenRpYnBwamN5eGR1bGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDYxOTIsImV4cCI6MjA5Nzg4MjE5Mn0.ORs5mJEB5JUNJt6jjHVObSRnoCJtLtXyYabUP5yK9ew";

// 经典的默认示例成员
const defaultProfiles = [
  { id: "person-a", name: "Bobo", color: "#2563eb" },
  { id: "person-b", name: "Yier", color: "#dc2626" },
];

// 经典的默认示例打卡
const defaultVisits = [
  {
    id: "visit-1",
    profileId: "person-a",
    placeId: "city-shanghai",
    visitedAt: "2023-04-12",
    type: "居住",
    note: "长期生活的起点，适合做默认高亮城市。",
    photos: [],
  },
  {
    id: "visit-2",
    profileId: "person-b",
    placeId: "city-suzhou",
    visitedAt: "2023-05-03",
    type: "旅行",
    note: "周末短途，园林和运河都可以放进照片墙。",
    photos: [],
  },
  {
    id: "visit-3",
    profileId: "person-a",
    placeId: "city-dresden",
    visitedAt: "2024-09-18",
    type: "学习",
    note: "示例：德国 - 萨克森 - 德累斯顿。",
    photos: [],
  },
  {
    id: "visit-4",
    profileId: "person-b",
    placeId: "city-tokyo",
    visitedAt: "2024-05-21",
    type: "旅行",
    note: "城市点位和城市区域都可以在城市层级高亮。",
    photos: [],
  },
  {
    id: "visit-5",
    profileId: "person-a",
    placeId: "city-paris",
    visitedAt: "2025-02-09",
    type: "旅行",
    note: "这里将来可以展示多张上传照片。",
    photos: [],
  },
];

// 经典的默认卡片数据
const defaultNotes = [
  {
    id: "note-1",
    city: "巴黎",
    coverImage: "/TravelMap/paris_eiffel_sunset.jpg",
    coverImagePosition: { x: 50, y: 50 },
    startDate: "2024-05-10",
    endDate: "2024-05-15",
    rating: 10,
    summary: "游览卢浮宫珍贵藏品，品味左岸咖啡馆的慵懒，以及塞纳河畔的迷人日落。",
    center: [48.8566, 2.3522],
    addresses: [
      {
        id: "addr-1-1",
        name: "巴黎卢浮宫",
        coordinates: { lat: 48.8606, lng: 2.3376 },
        text: "🎟️ 预约前准备\n\n购票渠道：首选卢浮宫官网（ticket.louvre.fr），最稳妥。第三方平台虽然方便，但有买到假票或无效票的风险。\n门票价格：成人票价为22欧元。\n\n免费政策：\n1. 18岁以下游客（不限国籍）免费。\n2. 26岁以下的欧盟居民免费。\n3. 每月第一个周五晚18:00后免费（7、8月除外），但需提前在官网预约。\n4. 法国国庆日（7月14日）全天免费。\n\n巴黎博物馆通票：如果你买了通票，同样需要在官网预约一个具体入馆时间，预约时选择“Paris Museum Pass holders”选项，费用为0欧元。"
      },
      {
        id: "addr-1-2",
        name: "巴黎奥利机场",
        coordinates: { lat: 48.7262, lng: 2.3652 },
        text: "2024年5月10日 14:30 抵达。机场旁边购买巴黎交通周卡。"
      },
      {
        id: "addr-1-3",
        name: "巴黎北站",
        coordinates: { lat: 48.8809, lng: 2.3553 },
        text: "2024年5月10日 14:30 抵达。"
      }
    ]
  },
  {
    id: "note-2",
    city: "巴黎 · 经典地标漫步",
    coverImage: "/TravelMap/paris_louvre_night.jpg",
    coverImagePosition: { x: 50, y: 50 },
    startDate: "2024-06-01",
    endDate: "2024-06-05",
    rating: 9,
    summary: "在夏乐宫远眺铁塔的壮丽，穿过凯旋门俯瞰十二条放射状的大街，尽享巴黎的宏伟。",
    center: [48.8584, 2.2945],
    addresses: [
      {
        id: "addr-2-1",
        name: "埃菲尔铁塔",
        coordinates: { lat: 48.8584, lng: 2.2945 },
        text: "🗼 登塔攻略：建议提前1个月在官网买票。日落时分登塔最美，可以看到金色的巴黎市区 and 闪耀的铁塔灯光。"
      },
      {
        id: "addr-2-2",
        name: "凯旋门",
        coordinates: { lat: 48.8738, lng: 2.2950 },
        text: "登顶凯旋门可以看到放射状的十二条大道，非常震撼！门票可以用博物馆通票。"
      }
    ]
  },
  {
    id: "note-3",
    city: "巴黎 · 艺术与浪漫之旅",
    coverImage: "/TravelMap/paris_montmartre.jpg",
    coverImagePosition: { x: 50, y: 50 },
    startDate: "2024-07-15",
    endDate: "2024-07-20",
    rating: 10,
    summary: "步入莫奈与梵高的艺术世界，在红磨坊旁留下笑影，在圣心大教堂俯瞰巴黎全景。",
    center: [48.8867, 2.3431],
    addresses: [
      {
        id: "addr-3-1",
        name: "圣心大教堂",
        coordinates: { lat: 48.8867, lng: 2.3431 },
        text: "🏰 蒙马特高地：俯瞰巴黎全景 of 蒙马特。注意台阶上挂红绳的小商贩，注意防盗。"
      },
      {
        id: "addr-3-2",
        name: "奥赛博物馆",
        coordinates: { lat: 48.8599, lng: 2.3265 },
        text: "🎨 莫奈、梵高、塞尚的杰作聚集地！巨大的火车站改建的展馆本身就是一件艺术品。"
      }
    ]
  },
  {
    id: "note-4",
    city: "莫斯科",
    coverImage: "/TravelMap/moscow_cover_evening.jpg",
    coverImagePosition: { x: 50, y: 50 },
    startDate: "2024-08-10",
    endDate: "2024-08-15",
    rating: 10,
    summary: "漫步在红场，仰望瓦西里升天大教堂缤纷的洋葱头穹顶，感受克里姆林宫的庄严气势。",
    center: [55.7558, 37.6173],
    addresses: [
      {
        id: "addr-4-1",
        name: "瓦西里升天大教堂",
        coordinates: { lat: 55.7525, lng: 37.6231 },
        text: "🏰 瓦西里升天大教堂是莫斯科最具标志性的建筑，拥有九个色彩缤纷的洋葱头圆顶。建议黄昏时分来打卡，建筑在晚霞下散发着梦幻般的光彩。\n\n🎟️ 门票信息：外国游客成人票约1000卢布，内部现已改为博物馆，展示俄罗斯中世纪的壁画和宗教艺术品。",
        image: "/TravelMap/moscow_basil_portrait.jpg"
      },
      {
        id: "addr-4-2",
        name: "克里姆林宫",
        coordinates: { lat: 55.7520, lng: 37.6175 },
        text: "🏛️ 俄罗斯权力的中心，红墙环绕，塔楼巍峨。建议从亚历山大花园一侧购票排队安检入内。内部包括伊凡大帝钟楼、天使长大教堂等宏伟建筑群，以及珍宝馆（兵器库）。\n\n📌 参观攻略：一定要留足半天时间，兵器库和钻石馆的门票需要单独购买，非常推荐！",
        image: "/TravelMap/moscow_kremlin_landscape.jpg"
      }
    ]
  },
  {
    id: "note-5",
    city: "新加坡",
    coverImage: "/TravelMap/singapore_cover.jpg",
    coverImagePosition: { x: 50, y: 50 },
    startDate: "2024-09-01",
    endDate: "2024-09-05",
    rating: 10,
    summary: "狮城探索之旅：漫步滨海湾花园，打卡标志性鱼尾狮，享受克拉码头夜色与圣淘沙岛阳光。",
    center: [1.2868, 103.8545],
    addresses: [
      { id: "addr-5-1", day: 1, name: "新加坡樟宜机场", coordinates: { lat: 1.3644, lng: 103.9915 }, text: "✈️ 抵达樟宜机场，世界最美机场之一！顺便打卡星耀樟宜的汇丰雨漩涡（室内瀑布），感受震撼的水雾与灯光。" },
      { id: "addr-5-2", day: 1, name: "鱼尾狮公园", coordinates: { lat: 1.2868, lng: 103.8545 }, text: "🦁 新加坡的地标！在这里摆各种创意姿势与喷水的鱼尾狮合影。建议黄昏来，不仅能看到白天的鱼尾狮，还能欣赏滨海湾金沙酒店的夜间激光秀。", image: "/TravelMap/singapore_merlion.jpg" },
      { id: "addr-5-3", day: 1, name: "滨海湾金沙酒店", coordinates: { lat: 1.2847, lng: 103.8610 }, text: "🏨 宏伟的三塔建筑群，楼顶的无边泳池举世闻名。即使不入住，也可以前往空中花园观景台俯瞰整个海湾夜景。" },
      { id: "addr-5-4", day: 2, name: "滨海湾花园 (Gardens by the Bay)", coordinates: { lat: 1.2816, lng: 103.8636 }, text: "🌲 仿佛置身阿凡达的潘多拉星球！巨大的超级树穹顶（Supertree Grove）令人叹为观止。千万不要错过晚上19:45和20:45的声光秀，超级树会随音乐闪烁变色，极其梦幻！", image: "/TravelMap/singapore_gardens.jpg" },
      { id: "addr-5-5", day: 2, name: "新加坡摩天观景轮", coordinates: { lat: 1.2893, lng: 103.8631 }, text: "🎡 亚洲最大的摩天轮之一。运转一圈大约30分钟，可以饱览滨海湾全景，甚至在晴朗时能眺望到邻国马来西亚和印尼的岛屿。" },
      { id: "addr-5-6", day: 2, name: "艺术科学博物馆 (ArtScience Museum)", coordinates: { lat: 1.2863, lng: 103.8592 }, text: "🎨 独特的白莲花造型建筑。内部的 teamLab '超跃未来' 互动展非常受欢迎，是拍照打卡的绝佳艺术空间。" },
      { id: "addr-5-7", day: 2, name: "螺旋桥", coordinates: { lat: 1.2876, lng: 103.8608 }, text: "🌉 结构灵感来自DNA双螺旋。夜晚桥身LED亮起蓝色和紫色，极具科幻未来感，是绝佳的漫步通道。" },
      { id: "addr-5-8", day: 2, name: "驳船码头 (Boat Quay)", coordinates: { lat: 1.2872, lng: 103.8497 }, text: "🍻 新加坡河畔的历史街区，现改为酒吧与餐饮街。吹着晚风，小酌一杯，非常惬意。" },
      { id: "addr-5-9", day: 3, name: "牛车水 (Chinatown)", coordinates: { lat: 1.2825, lng: 103.8442 }, text: "🏮 新加坡的唐人街。老式排屋和街巷布满了各种手工艺品店与地道中餐馆，红灯笼高挂，充满历史韵味。" },
      { id: "addr-5-10", day: 3, name: "佛牙寺龙华院", coordinates: { lat: 1.2814, lng: 103.8443 }, text: "🛕 百年唐代风格木结构寺庙，宏伟庄严。四楼供奉着释迦牟尼佛的真身佛牙舍利，内部装修金碧辉煌。" },
      { id: "addr-5-11", day: 3, name: "麦士威路美食中心 (Maxwell Food Centre)", coordinates: { lat: 1.2806, lng: 103.8438 }, text: "🍛 品尝地道星洲美食的大本营！最出名的是“天天海南鸡饭”，鸡肉极其鲜嫩，配上特制黑酱油与辣椒酱，简直人间美味。" },
      { id: "addr-5-12", day: 3, name: "克拉码头 (Clarke Quay)", coordinates: { lat: 1.2906, lng: 103.8465 }, text: "🌃 新加坡夜生活的核心区。五彩斑斓的旧仓库改建成了动感十足的酒吧与舞厅，运河游船在此穿梭，霓虹闪烁。" },
      { id: "addr-5-13", day: 4, name: "新加坡环球影城 (Universal Studios Singapore)", coordinates: { lat: 1.2543, lng: 103.8238 }, text: "🎢 圣淘沙岛的主角！包括变形金刚3D对决、双轨过山车、木乃伊复仇等热门项目，带给您一整天的尖叫与欢笑。" },
      { id: "addr-5-14", day: 4, name: "圣淘沙捷运", coordinates: { lat: 1.2646, lng: 103.8222 }, text: "🚝 连接主岛怡丰城与圣淘沙岛的轻轨捷运，出行非常便利。" },
      { id: "addr-5-15", day: 4, name: "巴拉湾海滩 (Palawan Beach)", coordinates: { lat: 1.2505, lng: 103.8189 }, text: "🏖️ 拥有连接亚洲大陆最南端小岛的吊桥，椰林树影，海水清澈，非常适合午后散步。" },
      { id: "addr-5-16", day: 4, name: "西乐索海滩 (Siloso Beach)", coordinates: { lat: 1.2558, lng: 103.8099 }, text: "🏄 新加坡最活跃的海滩，聚集了各种沙滩排球爱好者、冲浪俱乐部以及海滨小酒馆。" },
      { id: "addr-5-17", day: 4, name: "S.E.A. 海洋馆", coordinates: { lat: 1.2584, lng: 103.8193 }, text: "🐟 全球最大的海洋馆之一。巨大的深海观景区长 36 米，汇聚了双吻前口蝠鲼、魔鬼鱼、锤头鲨等数万只海洋生物，极具治愈感。" },
      { id: "addr-5-18", day: 4, name: "斜坡滑车 (Skyline Luge)", coordinates: { lat: 1.2524, lng: 103.8163 }, text: "🏎️ 坐在滑车上，沿特制轨道一路从高地滑行到底部沙滩，重力加速度带来的刺激感让人欲罢不能！" },
      { id: "addr-5-19", day: 4, name: "怡丰城 (VivoCity)", coordinates: { lat: 1.2638, lng: 103.8219 }, text: "🛍️ 新加坡最大的购物商场之一，从圣淘沙岛返回后的最佳逛吃地，顶层设有露天水上公园。" }
    ]
  }
];

// 辅助方法：发送 HTTPS GET 请求
function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "yxwflztibppjcyxdulho.supabase.co",
      port: 443,
      path: urlPath,
      method: "GET",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("JSON 解析失败: " + e.message));
          }
        } else {
          reject(new Error(`请求失败，状态码: ${res.statusCode}`));
        }
      });
    });

    req.on("error", (e) => {
      reject(e);
    });
    req.end();
  });
}

async function run() {
  console.log("🚀 开始从 Supabase 拉取最新旅行足迹数据并进行智能合并同步...");
  try {
    // 1. 获取 profiles 并做合并
    console.log("⏳ 正在读取云端 profiles...");
    const rawProfiles = await getJson("/rest/v1/travel_profiles?select=id,display_name,color&order=created_at.asc");
    const cloudProfiles = rawProfiles.map(p => ({
      id: p.id,
      name: p.display_name,
      color: p.color
    }));
    
    // 合并：优先保留云端加载的成员，同时追加默认示例成员
    const mergedProfiles = [...cloudProfiles];
    defaultProfiles.forEach(def => {
      if (!mergedProfiles.some(p => p.id === def.id)) {
        mergedProfiles.push(def);
      }
    });

    // 2. 获取 visits 并做合并
    console.log("⏳ 正在读取云端 visits...");
    const rawVisits = await getJson("/rest/v1/visits?select=id,profile_id,place_id,visited_at,trip_type,note,visit_photos(id,storage_path,caption)&order=visited_at.desc");
    const cloudVisits = rawVisits.map(v => {
      const photos = (v.visit_photos || []).map(p => {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/travel-photos/${p.storage_path}`;
        return {
          id: p.id,
          url: publicUrl,
          caption: p.caption || ""
        };
      });
      return {
        id: v.id,
        profileId: v.profile_id,
        placeId: v.place_id,
        visitedAt: v.visited_at,
        type: v.trip_type,
        note: v.note || "",
        photos: photos
      };
    });

    // 合并：将云端拉取的打卡和默认打卡合并
    const mergedVisits = [...cloudVisits];
    defaultVisits.forEach(def => {
      // 通过 placeId + profileId 或 id 去重，避免重复展示
      if (!mergedVisits.some(v => v.id === def.id || (v.placeId === def.placeId && v.profileId === def.profileId))) {
        mergedVisits.push(def);
      }
    });

    // 3. 重写 src/data/mockData.js
    console.log("⏳ 正在同步并覆盖写入 src/data/mockData.js...");
    const mockDataContent = `import { placeLevels, tripTypes, places } from "./mockData_static";
export { placeLevels, tripTypes, places };

// =========================================================================
// 此文件由 scripts/sync_data.cjs 脚本从云端拉取真实数据后，与经典示例数据进行智能合并生成。
// 请勿直接手动修改此文件。
// =========================================================================

export const profiles = ${JSON.stringify(mergedProfiles, null, 2)};

export const initialVisits = ${JSON.stringify(mergedVisits, null, 2)};
`;
    fs.writeFileSync(path.join(__dirname, "../src/data/mockData.js"), mockDataContent, "utf8");

    // 4. 获取 travel_notes 并与 defaultNotes 合并
    console.log("⏳ 正在读取云端 travel_notes...");
    const rawNotes = await getJson("/rest/v1/travel_notes?select=*&order=created_at.desc");
    const cloudNotes = rawNotes.map(n => ({
      id: n.id,
      city: n.city,
      coverImage: n.cover_image,
      coverImagePosition: n.cover_image_position || { x: 50, y: 50 },
      startDate: n.start_date,
      endDate: n.end_date,
      rating: n.rating,
      summary: n.summary,
      center: n.center,
      addresses: n.addresses
    }));

    // 合并：旅行卡片合并
    const mergedNotes = [...cloudNotes];
    defaultNotes.forEach(def => {
      if (!mergedNotes.some(n => n.id === def.id || n.city === def.city)) {
        mergedNotes.push(def);
      }
    });

    // 5. 重写 src/data/defaultNotes.js
    console.log("⏳ 正在同步并覆盖写入 src/data/defaultNotes.js...");
    const notesContent = `// =========================================================================
// 此文件由 scripts/sync_data.cjs 脚本从云端拉取数据后与示例旅行日记智能合并自动生成。
// 请勿直接手动修改此文件。
// =========================================================================

export const defaultTravelNotes = ${JSON.stringify(mergedNotes, null, 2)};
`;
    fs.writeFileSync(path.join(__dirname, "../src/data/defaultNotes.js"), notesContent, "utf8");

    console.log("✨ 恭喜！云端旅行数据与默认示例已成功完成智能合并固化！");
  } catch (error) {
    console.error("❌ 数据同步失败。将保持本地已存的静态数据不变，错误详情：", error.message);
  }
}

run();
