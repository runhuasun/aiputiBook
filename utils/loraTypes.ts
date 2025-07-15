export type themeType =
  | "FACE"
  | "OBJECT"
  | "STYLE"
;

export const themes: themeType[] = [
  "FACE",
  "OBJECT",
  "STYLE",
];

export const themeNames = new Map();
themeNames.set("FACE","模仿素材照片中的人物");
themeNames.set("OBJECT","模仿素材照片中的物体");
themeNames.set("STYLE","模仿素材照片的构图风格");



export type roomType =
  | "realistic"
  | "MidJourney-V4"
  | "cartoon" 
;

export const rooms: roomType[] = [
  "realistic",
  "MidJourney-V4",
  "cartoon",
 ];



export const roomNames = new Map();
roomNames.set("realistic","AI菩提全真世界画面风格");
roomNames.set("MidJourney-V4","MidJourney-V4画面风格");
roomNames.set("cartoon","卡通画面风格");



