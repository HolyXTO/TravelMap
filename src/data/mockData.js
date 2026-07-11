import { placeLevels, tripTypes, places } from "./mockData_static";
export { placeLevels, tripTypes, places };

// =========================================================================
// 此文件由 scripts/sync_data.cjs 脚本从云端拉取真实数据后，与经典示例数据进行智能合并生成。
// 请勿直接手动修改此文件。
// =========================================================================

export const profiles = [
  {
    "id": "person-b",
    "name": "Tang",
    "color": "#2563eb"
  },
  {
    "id": "person-a",
    "name": "Xiao",
    "color": "#dc2626"
  }
];

export const initialVisits = [
  {
    "id": "2db27493-b4fb-4790-9b93-27e7a8e5c895",
    "profileId": "person-a",
    "placeId": "CN043140",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "b4db7c48-f040-4e48-be99-c0e1e1706f0e",
    "profileId": "person-b",
    "placeId": "W-658225",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e75bc07a-5949-4fe3-9704-300814005042",
    "profileId": "person-a",
    "placeId": "EXTRA-BUDVA",
    "visitedAt": null,
    "type": "旅行",
    "note": "{\"dateDisplay\":\"\",\"datePrecision\":\"none\",\"rating\":5,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": []
  },
  {
    "id": "5ea7da7f-490d-4f79-a22a-c00197dbfe1d",
    "profileId": "person-a",
    "placeId": "CN037050",
    "visitedAt": null,
    "type": "旅行",
    "note": "{\"dateDisplay\":\"\",\"datePrecision\":\"none\",\"rating\":3,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": []
  },
  {
    "id": "1df2e016-c877-49c1-b8c1-9b485e1ad695",
    "profileId": "person-a",
    "placeId": "EXTRA-LOFOTEN",
    "visitedAt": null,
    "type": "旅行",
    "note": "{\"dateDisplay\":\"\",\"datePrecision\":\"none\",\"rating\":10,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": []
  },
  {
    "id": "6f9c655e-608f-43ec-a03b-ebfa3352a414",
    "profileId": "person-a",
    "placeId": "EXTRA-CANNES",
    "visitedAt": null,
    "type": "旅行",
    "note": "{\"dateDisplay\":\"\",\"datePrecision\":\"none\",\"rating\":6,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": []
  },
  {
    "id": "7f789abb-bfa3-417d-a561-184cdb9d5832",
    "profileId": "person-b",
    "placeId": "CN043080",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "cab46a7c-cade-49a1-be5c-f19bddc8d68e",
    "profileId": "person-b",
    "placeId": "CN043140",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "8e1d12b9-d659-4c0e-9281-bbc552fda34a",
    "profileId": "person-a",
    "placeId": "W-658225",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "9377e20c-f38a-41cd-8fce-53baa8514089",
    "profileId": "person-a",
    "placeId": "W-146400",
    "visitedAt": null,
    "type": "旅行",
    "note": "{\"dateDisplay\":\"\",\"datePrecision\":\"none\",\"rating\":6,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": []
  },
  {
    "id": "46ddc1ba-7ecc-4d5a-a4b9-6c44ca25e3a7",
    "profileId": "person-a",
    "placeId": "W-2988507",
    "visitedAt": null,
    "type": "旅行",
    "note": "{\"dateDisplay\":\"\",\"datePrecision\":\"none\",\"rating\":9,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": []
  },
  {
    "id": "ce6051cc-d105-4825-90ab-27800289ef08",
    "profileId": "person-a",
    "placeId": "W-2993458",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": [
      {
        "id": "d9511934-41ce-4746-83ad-90d810dccec0",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314497327-0-IMG_20241030_154828.jpg",
        "caption": ""
      },
      {
        "id": "805b3473-ff16-4310-aa7c-ed12d18dfeb0",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314502086-1-IMG_20241030_154922.jpg",
        "caption": ""
      },
      {
        "id": "33fb49ca-06a8-48d2-89a5-ab8e2ac22911",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314505588-2-IMG_20241030_154146.jpg",
        "caption": ""
      },
      {
        "id": "3478f02d-42d3-470d-a88e-3ced053f4664",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314509483-3-IMG_20241030_153401.jpg",
        "caption": ""
      },
      {
        "id": "2150c9c4-6dcf-4b3b-a263-cc43e237c60b",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314513030-4-IMG_20241030_153058.jpg",
        "caption": ""
      },
      {
        "id": "b740e50c-9507-4667-9678-4196d4f2212f",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314518449-5-IMG_20241030_160535.jpg",
        "caption": ""
      },
      {
        "id": "5c7258e4-fa02-4ba9-beb7-c40bd8bdca72",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314523889-6-IMG_20241030_162343.jpg",
        "caption": ""
      },
      {
        "id": "48ee8a87-61b7-4695-bd8b-4e35614bc74d",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314528991-7-IMG_20241030_163202.jpg",
        "caption": ""
      },
      {
        "id": "246b9809-456f-4113-9312-cfe52ceac802",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314533011-8-IMG_20241030_165424.jpg",
        "caption": ""
      },
      {
        "id": "7700380c-659d-49fb-a267-44a10cc1689c",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314550543-9-IMG_20241030_171603.jpg",
        "caption": ""
      },
      {
        "id": "adc68622-73cf-47b8-b956-a50b80e09c1b",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314553612-10-IMG_20241030_175710.jpg",
        "caption": ""
      },
      {
        "id": "19ec72f5-9595-4673-b646-b33df3e0fcb9",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314557597-11-IMG_20241030_173123.jpg",
        "caption": ""
      },
      {
        "id": "a70873c4-429d-44ff-b21b-fd1b0212bb86",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314561411-12-IMG_20241030_155149.jpg",
        "caption": ""
      },
      {
        "id": "e035de82-b66d-4055-9cec-47e7239b24c7",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783314565382-13-IMG_20241030_152224.jpg",
        "caption": ""
      },
      {
        "id": "0a3575a6-7c04-408d-bc66-d9d2838f39cd",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783316550713-0-IMG_20241030_154828.jpg",
        "caption": ""
      },
      {
        "id": "18f16cc1-82ce-4d64-aa88-8491f66428fa",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783316554501-1-IMG_20241030_154922.jpg",
        "caption": ""
      },
      {
        "id": "63db914e-4e2d-4dd1-9a65-77b6ebc223e3",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783316557516-2-IMG_20241030_154146.jpg",
        "caption": ""
      },
      {
        "id": "0751b97d-b046-4123-abf0-98087b2f78f7",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783316560171-3-IMG_20241030_153401.jpg",
        "caption": ""
      },
      {
        "id": "8065e351-2a14-4d06-97bc-3598331f6b5d",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783316563314-4-IMG_20241030_153058.jpg",
        "caption": ""
      },
      {
        "id": "517afa36-7c00-4acd-8051-ff111d898d16",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783316567252-5-IMG_20241030_160535.jpg",
        "caption": ""
      },
      {
        "id": "e48e1e86-ffdb-4722-8d35-cd3066559a7f",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783316571403-6-IMG_20241030_162343.jpg",
        "caption": ""
      },
      {
        "id": "215ace21-746e-4ae4-a9e9-dc551936bea9",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783316575376-7-IMG_20241030_163202.jpg",
        "caption": ""
      },
      {
        "id": "9f3c36c5-05a9-49a8-aa73-e2c2579c37d3",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783316578309-8-IMG_20241030_165424.jpg",
        "caption": ""
      },
      {
        "id": "25516596-0731-4bfa-bd8a-ef6e263c8403",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/ce6051cc-d105-4825-90ab-27800289ef08/1783316593914-9-IMG_20241030_171603.jpg",
        "caption": ""
      }
    ]
  },
  {
    "id": "665a06c0-085f-4925-959e-e0a64b72dd2e",
    "profileId": "person-a",
    "placeId": "W-588409",
    "visitedAt": null,
    "type": "旅行",
    "note": "{\"dateDisplay\":\"\",\"datePrecision\":\"none\",\"rating\":9,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": []
  },
  {
    "id": "e56331e4-cfbd-408f-a436-22ec355f021d",
    "profileId": "person-a",
    "placeId": "W-3130067",
    "visitedAt": null,
    "type": "旅行",
    "note": "{\"dateDisplay\":\"\",\"datePrecision\":\"none\",\"rating\":6,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": []
  },
  {
    "id": "3c4fd49c-a0ef-4e98-8afb-7ab413024be1",
    "profileId": "person-a",
    "placeId": "W-3164603",
    "visitedAt": null,
    "type": "旅行",
    "note": "{\"dateDisplay\":\"\",\"datePrecision\":\"none\",\"rating\":8,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": []
  },
  {
    "id": "3f9be830-0c66-487c-a95d-3821a1c0a09b",
    "profileId": "person-a",
    "placeId": "W-3369157",
    "visitedAt": null,
    "type": "旅行",
    "note": "{\"dateDisplay\":\"\",\"datePrecision\":\"none\",\"rating\":9,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": []
  },
  {
    "id": "ff4f1c94-15e7-456b-abe0-5b4a45138e91",
    "profileId": "person-b",
    "placeId": "city-rome",
    "visitedAt": null,
    "type": "旅行",
    "note": "���啦啦",
    "photos": []
  },
  {
    "id": "5ca7e714-0ffc-48fb-8b29-95dad845266a",
    "profileId": "person-a",
    "placeId": "W-3168070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "04a79475-cba4-420d-b3aa-3855b0afe83b",
    "profileId": "person-a",
    "placeId": "W-2512989",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "b666687d-652a-4d62-a0ab-53d9f50672f5",
    "profileId": "person-a",
    "placeId": "W-456172",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "95c88056-0835-4aa5-9dca-f75ea3f557ec",
    "profileId": "person-a",
    "placeId": "W-3099434",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "570dd77f-f03f-4c25-afc6-65f0e0f37070",
    "profileId": "person-a",
    "placeId": "CN023060",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "52e98dfa-7669-4bed-9cf3-ade9a73b1696",
    "profileId": "person-a",
    "placeId": "CN023030",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "0a2dbf51-4a2a-428b-9179-21c59f409d6c",
    "profileId": "person-a",
    "placeId": "CN023080",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "0c2348eb-431c-4c22-83c9-07338e632ead",
    "profileId": "person-b",
    "placeId": "W-456172",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "daf58b88-5c23-4f47-8eb3-dc623bdcac61",
    "profileId": "person-b",
    "placeId": "W-3099434",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "56c597ac-8770-48d9-b15d-352d016da5b1",
    "profileId": "person-b",
    "placeId": "W-2879139",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "72e4d96f-abe4-4beb-bd03-f84087e2cead",
    "profileId": "person-b",
    "placeId": "W-3143244",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "a2d4fa4e-ccde-400c-8f70-e43f6ddd9812",
    "profileId": "person-b",
    "placeId": "W-2267057",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "c7f03b84-9b94-4a4e-b79b-8e0f4c54cdab",
    "profileId": "person-b",
    "placeId": "W-2820256",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "ea002bce-3624-4005-913d-35cee5f0831a",
    "profileId": "person-b",
    "placeId": "W-2940132",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "ae9d19c4-8066-4f4c-9d02-76f315f2d0dd",
    "profileId": "person-b",
    "placeId": "W-2988507",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "dc1b4031-4da9-4581-8cc0-bd388ca2e9b4",
    "profileId": "person-a",
    "placeId": "W-2879139",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "bb5a29ba-a1bd-4f00-b73d-d730802c0256",
    "profileId": "person-a",
    "placeId": "W-3143244",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "8b44ffd0-2eab-4030-8ade-ddda900b9da1",
    "profileId": "person-a",
    "placeId": "W-2267057",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "f84bdc2f-10d1-4fb5-8267-b5b246a2acbf",
    "profileId": "person-a",
    "placeId": "W-2820256",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "304afb08-90a5-4f03-9160-1e6f09a9586f",
    "profileId": "person-a",
    "placeId": "W-2940132",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "527f3b92-5add-4fd8-bf24-0438da40bbd1",
    "profileId": "person-a",
    "placeId": "W-2867714",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "b7804438-a5d9-46ce-8b9b-91069bd7911e",
    "profileId": "person-a",
    "placeId": "W-2886242",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "df8632b2-7e33-4192-9068-2f5dbcb9b931",
    "profileId": "person-a",
    "placeId": "W-2950159",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "4c7c9dc8-aa6e-448c-bf37-57fccb438f9b",
    "profileId": "person-a",
    "placeId": "W-2852458",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "f9cf0391-9e66-4d74-8462-914e067d517d",
    "profileId": "person-a",
    "placeId": "W-593116",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "29e9eebe-c961-46b2-9e7b-3c1f49db2337",
    "profileId": "person-a",
    "placeId": "W-683506",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "08714497-ce05-4566-b338-33dfbebc9ac7",
    "profileId": "person-a",
    "placeId": "W-727011",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "525bf371-ab51-41d0-9a3d-c0b03b428da0",
    "profileId": "person-a",
    "placeId": "W-3183875",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "400a05c8-66fd-42fb-a319-50bda8e1ee2a",
    "profileId": "person-a",
    "placeId": "W-3185728",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "4437e9a1-2c8f-4c7c-91e3-07a9d07faf60",
    "profileId": "person-a",
    "placeId": "W-3193044",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "9b943165-f667-4499-a5a1-2faff6255236",
    "profileId": "person-a",
    "placeId": "W-2990440",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "ee7dbf44-9937-42c4-a2f2-c4a1aaec0bb5",
    "profileId": "person-a",
    "placeId": "W-792680",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "eca1a974-a794-40ed-aba6-9255358d5a49",
    "profileId": "person-a",
    "placeId": "W-3201047",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "b78de5d5-4935-43c2-9be6-254ede454f31",
    "profileId": "person-a",
    "placeId": "W-3196359",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "4293bc69-2df7-478e-b56d-349dd12230fe",
    "profileId": "person-a",
    "placeId": "W-2692969",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "036b6938-8aba-4a4b-a232-f99566061ffa",
    "profileId": "person-a",
    "placeId": "W-2960316",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "1203247a-ed7b-41d0-8738-a730b9a0e4a8",
    "profileId": "person-a",
    "placeId": "W-2800866",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "fd571b2d-41b6-45a5-9537-6517067620ed",
    "profileId": "person-a",
    "placeId": "W-2803138",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "936ca097-bbf8-4d75-b7fa-371347017363",
    "profileId": "person-a",
    "placeId": "W-2797656",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "a97e041e-c817-4c55-a23d-ae7a5bb8cf14",
    "profileId": "person-a",
    "placeId": "W-2747891",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "49e3af8a-b50b-427a-a7e3-67b5065406d1",
    "profileId": "person-a",
    "placeId": "W-2759794",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "4b9557de-2f9f-49db-afe0-0a9dfd2ad8a5",
    "profileId": "person-a",
    "placeId": "W-2747373",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "a3e3ce31-76d0-48ed-9592-6cbb35ee914a",
    "profileId": "person-a",
    "placeId": "W-2657896",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "9f41cdf9-a0f0-4e2d-b4dc-1e9535eea1a2",
    "profileId": "person-a",
    "placeId": "W-3042030",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "bc6c628c-323a-4bb0-9daf-e515507825e2",
    "profileId": "person-a",
    "placeId": "W-3160881",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "c8893f6d-403d-4888-b40f-62bb97b8136a",
    "profileId": "person-a",
    "placeId": "W-3054643",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "d183bcac-9875-4acf-944c-da44a64460ec",
    "profileId": "person-a",
    "placeId": "W-2761369",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "16a12931-a7a2-443c-9431-912ac894435c",
    "profileId": "person-a",
    "placeId": "W-4548393",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "fc045eb3-bf1b-4e87-bf03-24c20a652d57",
    "profileId": "person-a",
    "placeId": "W-3060972",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "083490b2-e6e2-4406-9c83-bcdd08e0a3eb",
    "profileId": "person-a",
    "placeId": "W-2618425",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "341bdf0e-58af-4636-b05a-7e7cc89a9035",
    "profileId": "person-a",
    "placeId": "W-3173435",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e78096ed-523e-4c2f-9219-e0d8f49336a5",
    "profileId": "person-a",
    "placeId": "W-3169070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "0c3cfa74-f660-4c7d-a03e-f4cf17fad3a8",
    "profileId": "person-a",
    "placeId": "W-6691831",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "eee519d9-f1c2-4d39-bc64-9f71ffffa266",
    "profileId": "person-a",
    "placeId": "W-3170647",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "616ac6b1-0855-4fbb-93d8-f2bf4ca2e86e",
    "profileId": "person-a",
    "placeId": "W-2659811",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "53debadb-8dc1-4423-a28c-f5fe8cd8ff2d",
    "profileId": "person-a",
    "placeId": "W-264371",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "dc66f480-4966-4a1d-accb-932620e9b56c",
    "profileId": "person-a",
    "placeId": "W-3128760",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "44871a51-ac25-4032-a680-e9efb41b1a61",
    "profileId": "person-a",
    "placeId": "W-3176959",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "6a788c39-fd59-4aa7-9703-ce01bd24a18b",
    "profileId": "person-a",
    "placeId": "W-3413829",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "9b1d57df-5fef-4fba-991a-4446d976d094",
    "profileId": "person-a",
    "placeId": "W-3133895",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e5edc2e3-b718-4988-acb9-8574f2c87919",
    "profileId": "person-a",
    "placeId": "W-1835848",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "c9359522-e609-4b9d-bab8-8a288ba22092",
    "profileId": "person-a",
    "placeId": "W-1880252",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "8a480549-6df3-4fe2-a611-7971ec875dea",
    "profileId": "person-a",
    "placeId": "CN022030",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "90b2b349-02c4-432f-b880-3dd57977feab",
    "profileId": "person-a",
    "placeId": "CN021130",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "41cb92a3-06cc-450e-b7a8-e3b2282bd2e7",
    "profileId": "person-a",
    "placeId": "CN021120",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "22f16eff-8e93-4dcf-88c6-6119cfe500b1",
    "profileId": "person-a",
    "placeId": "CN011010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "b6b814f0-3d11-4fd1-b682-de41e78567b7",
    "profileId": "person-a",
    "placeId": "CN013080",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "c72f6398-10cf-418d-a432-ca85706981ad",
    "profileId": "person-a",
    "placeId": "CN037140",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e8423ed8-4c9f-4091-8efe-6f0b7867e6c1",
    "profileId": "person-a",
    "placeId": "CN041160",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "2f6b8de7-0ddd-4127-9a86-5eeb5ac20f88",
    "profileId": "person-a",
    "placeId": "CN041070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e34b3f51-784e-44bd-814a-f5651fc81683",
    "profileId": "person-a",
    "placeId": "CN032040",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "06ff5b38-29e0-496e-8a8b-aefd7265a2fe",
    "profileId": "person-a",
    "placeId": "CN032100",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "11370bde-b8ea-4fdc-b36b-73e26986f231",
    "profileId": "person-a",
    "placeId": "CN032070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "dd2ecd90-f899-4246-aeeb-e70775dd3eca",
    "profileId": "person-a",
    "placeId": "CN032110",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "ce1f2a9d-8c4b-4560-bce2-d4084e15692e",
    "profileId": "person-a",
    "placeId": "CN033010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "97a4e966-86bc-4d75-9e1e-59a6fbb763f0",
    "profileId": "person-a",
    "placeId": "CN033070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "252fc202-559f-471c-bc3f-1791bbc08045",
    "profileId": "person-a",
    "placeId": "CN033040",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "a8e2bbc1-98fe-4fa3-a962-6dbf54cfc839",
    "profileId": "person-a",
    "placeId": "CN033060",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "dc7f592c-2fe6-499d-b36d-c3b76f274220",
    "profileId": "person-a",
    "placeId": "CN035080",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "30789656-d7d3-42d2-a6c2-1856055c9355",
    "profileId": "person-a",
    "placeId": "CN036060",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "97e6a939-33e6-4075-b3c2-29d9f892561f",
    "profileId": "person-a",
    "placeId": "CN036040",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "1d3f1b53-143c-4cde-bdd3-07c598b82eac",
    "profileId": "person-a",
    "placeId": "CN036050",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "065e34c3-0fb9-4ad4-8cd9-59bebfe3a094",
    "profileId": "person-a",
    "placeId": "CN044040",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "3972ee6f-87d6-4168-b01b-69165353568d",
    "profileId": "person-a",
    "placeId": "CN044150",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "66b3e5ae-955d-4f43-9b19-389d2e2a2552",
    "profileId": "person-a",
    "placeId": "CN046150",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e5a29ec4-7106-467b-a947-744f5ea088dc",
    "profileId": "person-a",
    "placeId": "CN045060",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "cb26650e-59d8-4364-b416-10f118c0f52d",
    "profileId": "person-a",
    "placeId": "CN045110",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "88881a7d-f3f1-43bc-b74e-572f725b9ba3",
    "profileId": "person-a",
    "placeId": "CN045030",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "a29aa7a1-51f7-49ab-bac2-f3370c93d976",
    "profileId": "person-a",
    "placeId": "CN052030",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "ebefe772-752c-49df-83c6-addecb61efe5",
    "profileId": "person-a",
    "placeId": "CN051020",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "4b3cf0c7-94fa-4376-975c-154e75cecee3",
    "profileId": "person-a",
    "placeId": "CN050010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "d334db74-3456-4acf-b34c-d68ae098a90e",
    "profileId": "person-a",
    "placeId": "CN043020",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "ce2c1f20-8f88-4547-86d8-ebaad560dca1",
    "profileId": "person-a",
    "placeId": "CN043070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "4ef6adcb-a4d0-4ebc-a917-aebd0280b2e7",
    "profileId": "person-a",
    "placeId": "CN042120",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "092a86c5-48ce-4b0d-bbec-b79c8f6a8a7c",
    "profileId": "person-a",
    "placeId": "CN042100",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "1746b81b-5953-4845-bbdf-f4f527cf5366",
    "profileId": "person-a",
    "placeId": "CN042030",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "f957d05d-6e30-42a6-851b-5803a842cdeb",
    "profileId": "person-a",
    "placeId": "CN042020",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "52cc7471-28e2-410b-9271-05fe39cba511",
    "profileId": "person-a",
    "placeId": "CN042160",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "45350b5b-60a3-49e5-9cfd-b1d95384d2f4",
    "profileId": "person-a",
    "placeId": "CN042130",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "33e801bd-f838-425e-beac-4f987fde2cd2",
    "profileId": "person-a",
    "placeId": "CN042050",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "2d54ca13-1307-462e-b141-267f36959a3b",
    "profileId": "person-a",
    "placeId": "CN042040",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "fdc1e977-2d74-41d4-92a1-36e448e1ea51",
    "profileId": "person-a",
    "placeId": "CN034010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "eff9cb2a-8892-4b31-9cd6-5fbc802c4718",
    "profileId": "person-a",
    "placeId": "CN034100",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "37f2eeda-5705-4222-b9fe-2798a04e6573",
    "profileId": "person-a",
    "placeId": "EXTRA-LONGYEARBYEN",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "023dfb58-1bc6-4568-bc7d-ce0e362c4c26",
    "profileId": "person-a",
    "placeId": "EXTRA-BLED",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "3657fe94-ac34-41e4-9993-2bf2a5b14f35",
    "profileId": "person-a",
    "placeId": "EXTRA-SANTORINI",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "28a101bc-3395-4a03-bdda-2cc788d744ec",
    "profileId": "person-a",
    "placeId": "CN061080",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "a4045963-75ec-4d78-b72a-f721860eefcb",
    "profileId": "person-a",
    "placeId": "CN061070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "731b64b3-8912-4906-8087-3744ed59caa0",
    "profileId": "person-a",
    "placeId": "CN064040",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "88f548af-97ff-4e8e-b59c-3f096a9e7164",
    "profileId": "person-a",
    "placeId": "CN014080",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e38298d7-1370-4112-b155-2fd3ff2857a0",
    "profileId": "person-a",
    "placeId": "CN053070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "86b42ca8-402b-4106-924c-db0c101db3ef",
    "profileId": "person-a",
    "placeId": "CN031010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "a472d33c-ac4e-4b87-b34a-37796ce9e640",
    "profileId": "person-a",
    "placeId": "EXTRA-AYIA-NAPA",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "2d7986e0-8895-4126-855e-909fcb76f5f8",
    "profileId": "person-a",
    "placeId": "EXTRA-VIK",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "d716f277-d3a4-4cfd-8e04-1ad81615902f",
    "profileId": "person-a",
    "placeId": "EXTRA-JURMALA",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "d0636268-45dd-470a-9506-4cf2f5be3cdf",
    "profileId": "person-a",
    "placeId": "EXTRA-MENTON",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e525f82d-1ac1-4d65-8ab1-98d0ded8170f",
    "profileId": "person-a",
    "placeId": "EXTRA-RIMINI",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "6244f2b3-435a-45d1-b0ba-6716a8a9129f",
    "profileId": "person-a",
    "placeId": "CN045100",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "8fddc273-817c-43f1-b305-a589ee6de650",
    "profileId": "person-b",
    "placeId": "W-2935022",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "aae2157f-7d12-425f-93c8-f6dc37d3064a",
    "profileId": "person-b",
    "placeId": "W-3168070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "7d8d21ea-df28-43ee-804d-f4a8bda2d593",
    "profileId": "person-b",
    "placeId": "W-2512989",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "623812f7-c579-4952-b6d6-f42414e0e4f6",
    "profileId": "person-b",
    "placeId": "W-588409",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "bdc66ee2-0c1b-4cf3-9008-61349747f1af",
    "profileId": "person-b",
    "placeId": "W-2867714",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "7669bd38-d4b4-4cb8-81d5-4f675d916139",
    "profileId": "person-b",
    "placeId": "W-2886242",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "76c0bb20-2ad2-45ed-8b78-b9f4945208b1",
    "profileId": "person-b",
    "placeId": "W-2950159",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "f5c51ea3-32dc-418f-b2dd-4c2d5eb8fa5b",
    "profileId": "person-b",
    "placeId": "W-2852458",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "351daec4-3d7e-4574-95c0-b7f1b57e2117",
    "profileId": "person-b",
    "placeId": "W-593116",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "372eb2eb-b33d-4b1c-b58b-34fda79466c4",
    "profileId": "person-b",
    "placeId": "W-683506",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "b8f5f38e-44a1-41fd-81f0-5b3031c3922d",
    "profileId": "person-b",
    "placeId": "W-727011",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "ab119161-1f58-4ea3-95dd-63bb4970416d",
    "profileId": "person-a",
    "placeId": "W-3191281",
    "visitedAt": null,
    "type": "旅行",
    "note": "{\"dateDisplay\":\"\",\"datePrecision\":\"none\",\"rating\":8,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": []
  },
  {
    "id": "e43cc565-3922-484f-9a30-3ba6e76bc912",
    "profileId": "person-b",
    "placeId": "W-3183875",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e4a3f9d3-1f93-4b86-94b9-b8f0026c3911",
    "profileId": "person-b",
    "placeId": "W-3185728",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "4fe51370-a07a-473f-ba36-bfc140023e2c",
    "profileId": "person-b",
    "placeId": "W-3193044",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "5e2246cf-4ed0-4da8-8e90-14493bfc0139",
    "profileId": "person-b",
    "placeId": "W-2990440",
    "visitedAt": null,
    "type": "���行",
    "note": "",
    "photos": []
  },
  {
    "id": "fa599d78-88d9-4a82-a916-04a56b6e549a",
    "profileId": "person-b",
    "placeId": "W-3164603",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e002598c-7d58-4d7c-9250-5d4efb619057",
    "profileId": "person-b",
    "placeId": "W-146400",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "02760616-80f0-41bc-b76c-a986b17f5d17",
    "profileId": "person-b",
    "placeId": "W-792680",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "483cf827-e089-4064-b4fc-aaccb2319e71",
    "profileId": "person-b",
    "placeId": "W-3201047",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "953ddb16-8b70-4d33-b9e7-2b48b5e55cec",
    "profileId": "person-b",
    "placeId": "W-3196359",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "3d976f8e-b61c-4ffb-bc16-8dc8af97f22f",
    "profileId": "person-b",
    "placeId": "W-3130067",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "0a4fb580-e439-4a08-aa54-fdd4645717b6",
    "profileId": "person-b",
    "placeId": "W-2692969",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "77d93028-7fef-474f-9040-c95fefc4df4e",
    "profileId": "person-b",
    "placeId": "W-2960316",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "c11bf60e-93bf-4e77-b4a5-8bc305d7e4eb",
    "profileId": "person-b",
    "placeId": "W-2800866",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "165140a9-eb10-4cc0-89a8-334869727a69",
    "profileId": "person-b",
    "placeId": "W-2747891",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "84ae8541-fb7e-430c-b12c-ba4c251a781d",
    "profileId": "person-b",
    "placeId": "W-2759794",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "45aba189-e564-4bb3-a3c4-ec402e431701",
    "profileId": "person-b",
    "placeId": "W-2747373",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "7a1e91c1-0e1e-45ea-ae7d-6537ba7293e1",
    "profileId": "person-b",
    "placeId": "W-2657896",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "afe265bb-64d3-4aeb-80d8-91c44ad0f86c",
    "profileId": "person-b",
    "placeId": "W-3042030",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "7dcc83bf-b56f-498c-b158-12d2b13be1fc",
    "profileId": "person-b",
    "placeId": "W-3160881",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "75195eaf-e85b-481a-a4c1-4d84d37b0914",
    "profileId": "person-b",
    "placeId": "W-3054643",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "56fea376-6c90-4535-bfef-6fdc17802142",
    "profileId": "person-b",
    "placeId": "W-2761369",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "365d0692-2ce1-4368-a719-b4bf3041d1ff",
    "profileId": "person-b",
    "placeId": "W-4548393",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "4184a5ee-bbad-4741-8b15-db7773ac4a6e",
    "profileId": "person-b",
    "placeId": "W-3060972",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "28477ad2-1f2f-4a50-b8aa-8e027f7b963d",
    "profileId": "person-b",
    "placeId": "W-2618425",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "5012bd9c-4354-4bd9-a267-30d32273f062",
    "profileId": "person-b",
    "placeId": "W-3173435",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "4c695805-6696-487e-b564-6f929ea51893",
    "profileId": "person-b",
    "placeId": "W-3169070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "f81225c9-02ca-4390-98f3-1d63dd9919f7",
    "profileId": "person-b",
    "placeId": "W-6691831",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "8d9cba78-b81c-4e8d-a8b1-22852d7acaf1",
    "profileId": "person-b",
    "placeId": "W-3170647",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "ec0d5e85-c809-4706-a113-00a24f356c82",
    "profileId": "person-b",
    "placeId": "W-2659811",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "9b346025-3136-4b6c-8aca-a6fecaa35410",
    "profileId": "person-b",
    "placeId": "W-264371",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "2e729aff-b9ee-48cc-9636-f50877bafc6e",
    "profileId": "person-b",
    "placeId": "W-3191281",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "15f2029b-249f-469c-8b5b-d96ac84264c2",
    "profileId": "person-b",
    "placeId": "W-3128760",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "745419a2-7711-49ac-8818-c3448c1284ce",
    "profileId": "person-b",
    "placeId": "W-3176959",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "b486890d-0cc7-44ee-9071-a17ce9ef3f43",
    "profileId": "person-b",
    "placeId": "W-3413829",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "b656c6e1-66be-444c-86fc-169fc89be299",
    "profileId": "person-b",
    "placeId": "W-3133895",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "3e13906a-e81e-4a33-945f-383644a64600",
    "profileId": "person-b",
    "placeId": "W-1835848",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "6fd2033b-0f17-4cb0-892c-49894c3a8a31",
    "profileId": "person-b",
    "placeId": "W-2993458",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "93e582ff-9c2f-4e01-92ce-63e131266c42",
    "profileId": "person-b",
    "placeId": "CN023060",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "91915a30-0fd6-4765-833a-c78575578e25",
    "profileId": "person-b",
    "placeId": "CN023030",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "514d2cbf-becb-4f32-b762-455b3d749932",
    "profileId": "person-b",
    "placeId": "CN011010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "7a7a96d6-092e-40da-8bb5-9555802bdb10",
    "profileId": "person-b",
    "placeId": "CN013080",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "6c21643f-133e-46a9-bc35-54437de10390",
    "profileId": "person-b",
    "placeId": "CN037050",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "9954755a-5980-4268-83cf-eca7f4a30a66",
    "profileId": "person-b",
    "placeId": "CN037140",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "7c0efebb-7393-4baa-94f9-1ee088055dc6",
    "profileId": "person-b",
    "placeId": "CN041160",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "8821f01a-5f15-48a1-bfb2-e0d0e05530e2",
    "profileId": "person-b",
    "placeId": "CN041070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "746f9626-bb2e-45f7-b5ee-b09b48842955",
    "profileId": "person-b",
    "placeId": "CN032040",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "38c5b115-8fc5-49f9-b96e-13f05c5a86c5",
    "profileId": "person-b",
    "placeId": "CN032100",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "a508a0f4-5162-4e97-a499-1795e194e388",
    "profileId": "person-b",
    "placeId": "CN032070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "68a2a9fa-7810-4007-9f79-801d25bd6d01",
    "profileId": "person-b",
    "placeId": "CN033010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "74ad7aa1-578e-4545-af96-a3b3130fffcd",
    "profileId": "person-b",
    "placeId": "CN033070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e6eaf7ca-90c4-44c1-a515-b2948b39af0c",
    "profileId": "person-b",
    "placeId": "CN033040",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "456de3fd-1d26-4c03-ac3e-81601da9ca74",
    "profileId": "person-b",
    "placeId": "CN035080",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "be43f13f-dfbc-46e8-9c8e-785fd59e9761",
    "profileId": "person-b",
    "placeId": "CN036060",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "d59dd81a-0217-4dba-b908-972441291b2a",
    "profileId": "person-b",
    "placeId": "CN036040",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "d26e8269-d326-4401-814f-cf64f72e2af3",
    "profileId": "person-b",
    "placeId": "CN036050",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "885516bf-6a74-4bc5-a8eb-da6c899b136a",
    "profileId": "person-b",
    "placeId": "CN044040",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "b7e95f90-243e-4eca-9b25-88396c31656d",
    "profileId": "person-b",
    "placeId": "CN045060",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "f78fd4e6-9372-4838-b89c-1eca7f74b09e",
    "profileId": "person-b",
    "placeId": "CN045110",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "871fb0b3-0294-4814-a380-f6aec8edea94",
    "profileId": "person-b",
    "placeId": "CN045030",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "8d094060-d1b6-4e97-80e9-1f89c41e1ee6",
    "profileId": "person-b",
    "placeId": "CN052030",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "baab7dbf-f6a1-4b4e-804c-91be27f9e1f7",
    "profileId": "person-b",
    "placeId": "CN051020",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "8a88a674-b902-45dd-8abf-d7da26c970ba",
    "profileId": "person-b",
    "placeId": "CN050010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "5a44d167-1a60-48a4-a846-a20e19ea5ec5",
    "profileId": "person-b",
    "placeId": "CN043020",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "5f8d533a-16be-435e-92e5-cafa43a1b036",
    "profileId": "person-b",
    "placeId": "CN043070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "4ccb5f18-0f58-48f5-934e-16004232eeb6",
    "profileId": "person-b",
    "placeId": "CN042120",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "41509ad3-b8ba-4f95-99ec-ba0172c8a63c",
    "profileId": "person-b",
    "placeId": "CN042020",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e61b05f5-30df-423a-9e38-bd2b0e26582c",
    "profileId": "person-b",
    "placeId": "CN042160",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "b6ce36c5-813e-4a53-a50e-ae1b13daa1c1",
    "profileId": "person-b",
    "placeId": "CN042130",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "f65e039e-0a96-4275-a955-fcc051075405",
    "profileId": "person-b",
    "placeId": "CN042050",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "8faafb5f-ff62-479d-9294-53ec33f32474",
    "profileId": "person-b",
    "placeId": "CN034010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e8541a8d-0a63-46ab-8e1a-cd28c49ce2f6",
    "profileId": "person-b",
    "placeId": "CN034100",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "6dd12262-1aee-43e0-bf6a-02e7698a12e7",
    "profileId": "person-b",
    "placeId": "EXTRA-LONGYEARBYEN",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "bada3349-50d4-400a-8ad9-cf5fd7afa33b",
    "profileId": "person-b",
    "placeId": "EXTRA-LOFOTEN",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "9a292d42-e74f-468b-bba0-080ccd44bfde",
    "profileId": "person-b",
    "placeId": "EXTRA-BLED",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e4d119f3-9df5-4431-93bb-1b61d4d63e38",
    "profileId": "person-b",
    "placeId": "EXTRA-SANTORINI",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "1ce95d74-3e77-409a-9703-91c67eab699a",
    "profileId": "person-b",
    "placeId": "CN061080",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "1ea0255b-d0cd-4736-97a1-6a98ee6cbbae",
    "profileId": "person-b",
    "placeId": "CN061070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "1b585046-669e-45c9-94ba-9d988e250a82",
    "profileId": "person-b",
    "placeId": "CN064040",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "bc0c1a7c-2426-4112-9f74-8f79dd3b47bb",
    "profileId": "person-b",
    "placeId": "CN014080",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "751f5808-1cb6-4c7e-b92f-de9925ab9ff2",
    "profileId": "person-b",
    "placeId": "CN053070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "b512d517-11f3-4afd-b765-a3f850a03bc9",
    "profileId": "person-b",
    "placeId": "CN031010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "06ebbc97-bbc0-4420-af84-a5344cb5624e",
    "profileId": "person-b",
    "placeId": "EXTRA-AYIA-NAPA",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "9704bbad-39a1-4d03-b16a-8a6b2f3215d0",
    "profileId": "person-b",
    "placeId": "EXTRA-BUDVA",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "b8721887-b39e-4798-8bc7-a051a81a5add",
    "profileId": "person-b",
    "placeId": "EXTRA-VIK",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "7f5b3501-db1c-4573-a4ba-fa7d08ca06ad",
    "profileId": "person-b",
    "placeId": "EXTRA-JURMALA",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "8196ea88-1f38-44bf-97cd-9f625ff8d7d8",
    "profileId": "person-b",
    "placeId": "EXTRA-MENTON",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "9659aaf9-6e72-402b-94d6-1459041955cc",
    "profileId": "person-b",
    "placeId": "EXTRA-CANNES",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "4ebb4ed1-80c4-4d0d-a244-6c37febc38f8",
    "profileId": "person-b",
    "placeId": "EXTRA-RIMINI",
    "visitedAt": null,
    "type": "���行",
    "note": "",
    "photos": []
  },
  {
    "id": "8cc3504f-e40d-4532-8b15-8713b20d6de1",
    "profileId": "person-b",
    "placeId": "CN045100",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "96a3774b-5e90-4dd6-b32a-ac619cbadd02",
    "profileId": "person-b",
    "placeId": "CN064050",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "35966918-5d17-4670-8ec3-513252bd6923",
    "profileId": "person-b",
    "placeId": "CN037160",
    "visitedAt": null,
    "type": "旅行",
    "note": "{\"rating\":6,\"text\":\"\"}",
    "photos": [
      {
        "id": "2540f428-67f0-4580-8530-6f9815bf77ec",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/35966918-5d17-4670-8ec3-513252bd6923/1782467189542-_1.jpg",
        "caption": ""
      }
    ]
  },
  {
    "id": "63758bd3-69e5-4860-a82f-7f82c924f4ef",
    "profileId": "person-a",
    "placeId": "W-2562305",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "937058ce-3311-4cf6-862e-ea6c8339dc63",
    "profileId": "person-a",
    "placeId": "W-290030",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "bcf453ab-895a-470d-8077-40b6e99811b2",
    "profileId": "person-a",
    "placeId": "W-292968",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "52b38b62-c0a7-48cf-8faa-0277ef97c686",
    "profileId": "person-a",
    "placeId": "W-2192362",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "0c8a14a9-8b32-4e18-b3d2-c153b36953f3",
    "profileId": "person-a",
    "placeId": "W-2193733",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "eebfccd9-49de-4da5-a61e-ee196621f4cc",
    "profileId": "person-a",
    "placeId": "CN062070",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "cbe11942-198c-42d6-9338-49dbad923b9c",
    "profileId": "person-a",
    "placeId": "CN064050",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "bf5ef2a5-67d2-48c5-9ee3-5da83c040f62",
    "profileId": "person-a",
    "placeId": "W-2925533",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "d7032180-b63e-4a43-9109-d85866ee03be",
    "profileId": "person-b",
    "placeId": "CN046080",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "13aacc30-c8f9-46ca-9923-cdbd355e5745",
    "profileId": "person-b",
    "placeId": "CN034150",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "42a43ea6-4fad-4e79-88f3-259e8330b65d",
    "profileId": "person-b",
    "placeId": "CN022020",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "89ff4baa-9144-493d-9626-4abaf9094998",
    "profileId": "person-b",
    "placeId": "CN012010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "c64403a1-e19c-4996-9d20-f838fcc62108",
    "profileId": "person-b",
    "placeId": "CN035030",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "e450a7b0-a377-42ba-ab67-c633b13d6635",
    "profileId": "person-b",
    "placeId": "CN043130",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "3bd900ad-c3db-4858-b552-8dd95fb970be",
    "profileId": "person-b",
    "placeId": "CN051050",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "9ce253d8-268c-4b8f-8447-97f78ebc0382",
    "profileId": "person-a",
    "placeId": "CN052010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "0e9ae4e2-c601-4eb5-871c-22ce0bf0f13e",
    "profileId": "person-a",
    "placeId": "CN052060",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "7d2bf9e3-f65f-4260-b12d-58d8caa987b5",
    "profileId": "person-b",
    "placeId": "CN052010",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "3afa79c1-c470-4259-b402-bf8e7baa1e34",
    "profileId": "person-b",
    "placeId": "CN052060",
    "visitedAt": null,
    "type": "旅行",
    "note": "",
    "photos": []
  },
  {
    "id": "eb846da0-76fa-489b-91a4-15499f592d98",
    "profileId": "person-a",
    "placeId": "CN037160",
    "visitedAt": "2026-06-21",
    "type": "旅行",
    "note": "{\"dateDisplay\":\"2026-06-21\",\"datePrecision\":\"day\",\"rating\":4,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": [
      {
        "id": "0efd029a-ceae-444b-80f2-31c27a7226f9",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/eb846da0-76fa-489b-91a4-15499f592d98/1782470403350-_1.jpg",
        "caption": ""
      }
    ]
  },
  {
    "id": "68e83a6e-15fd-4a01-8a34-b0d2de65f9cc",
    "profileId": "person-a",
    "placeId": "W-2935022",
    "visitedAt": "2024-01-01",
    "type": "旅行",
    "note": "{\"dateDisplay\":\"2024\",\"datePrecision\":\"year\",\"rating\":9,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": [
      {
        "id": "2ee50a35-853b-4712-8c53-4ee093dbd202",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/68e83a6e-15fd-4a01-8a34-b0d2de65f9cc/1783252942417-IMG_20250613_212756.jpg",
        "caption": ""
      },
      {
        "id": "766a7fc8-569f-47ee-a084-d21b66367d61",
        "url": "https://yxwflztibppjcyxdulho.supabase.co/storage/v1/object/public/travel-photos/d54e38cf-f4f0-4f58-9cdd-de574727cc06/68e83a6e-15fd-4a01-8a34-b0d2de65f9cc/1783253128708-IMG_20250613_204134.jpg",
        "caption": ""
      }
    ]
  },
  {
    "id": "f2dd3506-d33d-4e3e-8c72-b88ef9b17d0e",
    "profileId": "person-a",
    "placeId": "CN081010",
    "visitedAt": "2017-01-01",
    "type": "旅行",
    "note": "{\"dateDisplay\":\"2017\",\"datePrecision\":\"year\",\"rating\":5,\"text\":\"\",\"transportMode\":\"\"}",
    "photos": []
  },
  {
    "id": "visit-1",
    "profileId": "person-a",
    "placeId": "city-shanghai",
    "visitedAt": "2023-04-12",
    "type": "居住",
    "note": "长期生活的起点，适合做默认高亮城市。",
    "photos": []
  },
  {
    "id": "visit-2",
    "profileId": "person-b",
    "placeId": "city-suzhou",
    "visitedAt": "2023-05-03",
    "type": "旅行",
    "note": "周末短途，园林和运河都可以放进照片墙。",
    "photos": []
  },
  {
    "id": "visit-3",
    "profileId": "person-a",
    "placeId": "city-dresden",
    "visitedAt": "2024-09-18",
    "type": "学习",
    "note": "示例：德国 - 萨克森 - 德累斯顿。",
    "photos": []
  },
  {
    "id": "visit-4",
    "profileId": "person-b",
    "placeId": "city-tokyo",
    "visitedAt": "2024-05-21",
    "type": "旅行",
    "note": "城市点位和城市区域都可以在城市层级高亮。",
    "photos": []
  },
  {
    "id": "visit-5",
    "profileId": "person-a",
    "placeId": "city-paris",
    "visitedAt": "2025-02-09",
    "type": "旅行",
    "note": "这里将来可以展示多张上传照片。",
    "photos": []
  }
];
