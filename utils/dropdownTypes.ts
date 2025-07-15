// AI装修
export type decoTheme =
  | "Modern"
  | "Vintage"
  | "Minimalist"
  | "Tradtional Chinese style"
  | "New Chinese style"
  | "Affordable Luxury"
  | "Professional"
  | "Mediterranean"
  | "Japan Style"
  | "Southeast Asian Style"
  | "American Spanish Style"
  | "Rustic Cottage"
  | "Bohemian"
  | "Industrial"
  | "Scandinavian"
  | "Southern California";
;
export const decoThemes: decoTheme[] = [
  "Modern",
  "Minimalist",
  "Southeast Asian Style",
  "Vintage",
  "Tradtional Chinese style",
  "New Chinese style",
  "Affordable Luxury",
   "American Spanish Style",
   "Mediterranean",
   "Rustic Cottage",
   "Bohemian",
   "Industrial",
   "Scandinavian",
   "Southern California",
    "Japan Style",
    "Professional",
];
export const decoThemeNames = new Map();
decoThemeNames.set("Modern","现代");
decoThemeNames.set("Minimalist","极简");
decoThemeNames.set("Professional","专业");
decoThemeNames.set("Southeast Asian Style","东南亚");
decoThemeNames.set("Vintage","复古");
decoThemeNames.set("Tradtional Chinese style","传统中式");
decoThemeNames.set("New Chinese style","新中式");
decoThemeNames.set("Affordable Luxury","轻奢");
decoThemeNames.set("Japan Style","日式");
decoThemeNames.set("Mediterranean","地中海");
decoThemeNames.set("American Spanish Style","传统美式");
decoThemeNames.set("Rustic Cottage","田园");
decoThemeNames.set("Bohemian","波西米亚");
decoThemeNames.set("Industrial","工业风");
decoThemeNames.set("Scandinavian","北欧");
decoThemeNames.set("Southern California","南加州");

export type roomType =
  | "Living Room"
  | "Dining Room"
  | "Bedroom"
  | "Bathroom"
  | "Office"
  | "Kitchen"
  | "Gaming Room";

export const roomTypes: roomType[] = [
  "Living Room",
  "Dining Room",
  "Office",
  "Bedroom",
  "Bathroom",
  "Gaming Room",
  "Kitchen",
 ];
export const roomTypeNames = new Map();
roomTypeNames.set("Living Room","客厅");
roomTypeNames.set("Dining Room","餐厅");
roomTypeNames.set("Office","办公室");
roomTypeNames.set("Bedroom","卧室");
roomTypeNames.set("Bathroom","浴室");
roomTypeNames.set("Gaming Room","游戏室");
roomTypeNames.set("Kitchen","厨房");


// AI建筑渲染
export type archStyle =
  | "Modern"
  | "Vintage"
  | "Minimalist"
  | "Tradtional Chinese style"
  | "New Chinese style"
  | "Affordable Luxury"
  | "Professional"
  | "Mediterranean"
  | "Japan Style"
  | "Southeast Asian Style"
  | "American Spanish Style"
  | "Rustic Cottage"
  | "Bohemian"
  | "Industrial"
  | "Scandinavian"
  | "Southern California"
;
export const archStyles: archStyle[] = [
  "Modern",
  "Minimalist",
  "Southeast Asian Style",
  "Vintage",
  "Tradtional Chinese style",  
  "New Chinese style",
  "Affordable Luxury",
   "American Spanish Style",
   "Mediterranean",
   "Rustic Cottage",
   "Bohemian",
   "Industrial",
   "Scandinavian",
   "Southern California",
    "Japan Style",
    "Professional",
];
export const archStyleNames = new Map();
archStyleNames.set("Modern","现代");
archStyleNames.set("Minimalist","极简");
archStyleNames.set("Professional","专业");
archStyleNames.set("Southeast Asian Style","东南亚");
archStyleNames.set("Vintage","复古");
archStyleNames.set("Tradtional Chinese style","传统中式");
archStyleNames.set("New Chinese style","新中式");
archStyleNames.set("Affordable Luxury","轻奢");
archStyleNames.set("Japan Style","日式");
archStyleNames.set("Mediterranean","地中海");
archStyleNames.set("American Spanish Style","传统美式");
archStyleNames.set("Rustic Cottage","田园");
archStyleNames.set("Bohemian","波西米亚");
archStyleNames.set("Industrial","工业风");
archStyleNames.set("Scandinavian","北欧");
archStyleNames.set("Southern California","南加州");

export type archType =
  | "House"
  | "Office Building"
  | "Apartment"
  | "Factory"
  | "Storehouse"
  | "Gymnasium"
  | "Skyscraper"
  | "Carve and mould"
  | "Bridge"
  | "Temple"
  | "Villa"
;
export const archTypes: archType[] = [
  "House",
  "Villa",
  "Office Building",
  "Apartment",
  "Factory",
  "Storehouse",
  "Gymnasium",
  "Skyscraper",
  "Carve and mould",
  "Bridge",
  "Temple",
 ];
export const archTypeNames = new Map();
archTypeNames.set("House","房子");
archTypeNames.set("Villa","豪宅别墅");
archTypeNames.set("Office Building","写字楼");
archTypeNames.set("Apartment","公寓");
archTypeNames.set("Factory","工厂");
archTypeNames.set("Storehouse","仓库");
archTypeNames.set("Gymnasium","体育馆");
archTypeNames.set("Skyscraper","摩天大楼");
archTypeNames.set("Carve and mould","雕塑");
archTypeNames.set("Bridge","桥梁");
archTypeNames.set("Temple","庙宇");


// AI花园
export type gardenStyle =
  | "British"
  | "Vintage"
  | "Minimalist"
  | "Tradtional Chinese Style"
  | "New Chinese Style"
  | "Affordable Luxury"
  | "Mediterranean"
  | "Japan Style"
  | "Southeast Asian Style"
  | "American Spanish Style"
  | "Rustic Cottage"
  | "Bohemian"
  | "Industrial"
  | "Scandinavian"
  | "Southern California";
;
export const gardenStyles: gardenStyle[] = [
  "British",
  "Minimalist",
  "Southeast Asian Style",
  // "Vintage",
  "Tradtional Chinese Style",
  "New Chinese Style",
  "Affordable Luxury",
   "American Spanish Style",
   "Mediterranean",
   "Rustic Cottage",
   "Bohemian",
   "Industrial",
   "Scandinavian",
   "Southern California",
    "Japan Style",
];
export const gardenStyleNames = new Map();
gardenStyleNames.set("British","英式");
gardenStyleNames.set("Minimalist","极简");
gardenStyleNames.set("Southeast Asian Style","东南亚");
//gardenStyleNames.set("Vintage","复古");
gardenStyleNames.set("Tradtional Chinese Style","传统中式");
gardenStyleNames.set("New Chinese Style","新中式");
gardenStyleNames.set("Affordable Luxury","轻奢");
gardenStyleNames.set("Japan Style","日式");
gardenStyleNames.set("Mediterranean","地中海");
gardenStyleNames.set("American Spanish Style","传统美式");
gardenStyleNames.set("Rustic Cottage","田园");
gardenStyleNames.set("Bohemian","波西米亚");
gardenStyleNames.set("Industrial","工业风");
gardenStyleNames.set("Scandinavian","北欧");
gardenStyleNames.set("Southern California","南加州");

export type reformType =
  | "Minor"
  | "Basic"
  | "Major"
  | "Thorough";
export const reformTypes: reformType[] = [
  "Minor",
//  "Basic",
  "Major",
  "Thorough",
 ];
export const reformTypeNames = new Map();
reformTypeNames.set("Minor","简单调整");
reformTypeNames.set("Basic","基本保持原貌");
reformTypeNames.set("Major","大改造");
reformTypeNames.set("Thorough","翻天覆地");


export const languageNames = new Map([
    ["zh","中文"],
    ["en","英文"],    
    ["fr", "法语"],
    ["de", "德语"],    
    ["ja", "日语"],    
    ["ru", "俄语"],    
    ["es", "西班牙语"],    
    ["ar", "阿拉伯语"],    
    ["pt", "葡萄牙语"],        
    ["it", "意大利语"],        
    ["kr", "韩语"],        
]);

export const languages = Array.from(languageNames.keys());
