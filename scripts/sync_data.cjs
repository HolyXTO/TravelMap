const fs = require("fs");
const path = require("path");
const https = require("https");

const SUPABASE_URL = "https://yxwflztibppjcyxdulho.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d2ZsenRpYnBwamN5eGR1bGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDYxOTIsImV4cCI6MjA5Nzg4MjE5Mn0.ORs5mJEB5JUNJt6jjHVObSRnoCJtLtXyYabUP5yK9ew";

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
  console.log("🚀 [静态编译同步] 正在从 Supabase 同步最新的真实旅行足迹（不包含示例脏数据）...");
  try {
    // 1. 获取 profiles 
    console.log("⏳ 正在读取云端真实 profiles...");
    const rawProfiles = await getJson("/rest/v1/travel_profiles?select=id,display_name,color&order=created_at.asc");
    const profiles = rawProfiles.map(p => ({
      id: p.id,
      name: p.display_name,
      color: p.color
    }));

    // 2. 获取 visits
    console.log("⏳ 正在读取云端真实 visits...");
    const rawVisits = await getJson("/rest/v1/visits?select=id,profile_id,place_id,visited_at,trip_type,note,visit_photos(id,storage_path,caption)&order=visited_at.desc");
    const visits = rawVisits.map(v => {
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

    // 3. 覆盖写入 src/data/mockData.js（仅写入真实的云端成员与打卡）
    console.log("⏳ 正在同步并覆盖写入 src/data/mockData.js...");
    const mockDataContent = `import { placeLevels, tripTypes, places } from "./mockData_static";
export { placeLevels, tripTypes, places };

// =========================================================================
// 此文件由 scripts/sync_data.cjs 脚本从云端拉取真实数据后自动生成。
// 仅包含你的真实旅行数据，不包含任何示例脏数据。请勿手动修改此文件。
// =========================================================================

export const profiles = ${JSON.stringify(profiles, null, 2)};

export const initialVisits = ${JSON.stringify(visits, null, 2)};
`;
    fs.writeFileSync(path.join(__dirname, "../src/data/mockData.js"), mockDataContent, "utf8");

    // 4. 获取 travel_notes
    console.log("⏳ 正在读取云端真实 travel_notes...");
    const rawNotes = await getJson("/rest/v1/travel_notes?select=*&order=created_at.desc");
    const notes = rawNotes.map(n => ({
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

    // 5. 覆盖写入 src/data/defaultNotes.js
    console.log("⏳ 正在同步并覆盖写入 src/data/defaultNotes.js...");
    const notesContent = `// =========================================================================
// 此文件由 scripts/sync_data.cjs 脚本从云端拉取你的真实旅行记录自动生成。
// 仅包含你的真实日记，不包含任何示例日记。请勿手动修改此文件。
// =========================================================================

export const defaultTravelNotes = ${JSON.stringify(notes, null, 2)};
`;
    fs.writeFileSync(path.join(__dirname, "../src/data/defaultNotes.js"), notesContent, "utf8");

    console.log("✨ 恭喜！你的真实云端旅行数据已成功固化到本地代码中！");
  } catch (error) {
    console.error("❌ 数据同步失败，错误详情：", error.message);
  }
}

run();
