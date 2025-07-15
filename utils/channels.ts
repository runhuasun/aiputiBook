export type channelType =
//  | "MOTHER"
  | "ACTOR"
//  | "MAGIC"
  | "ART"
  | "COMIC"
  | "DESIGN"
  | "ARCH"
  | "NATURE"
//  | "CLOTH"
//  | "HOME"
//  | "VEHICLE"
//  | "PET"
//  | "PLANT"
  | "TRAVEL"
  | "FASHION"
  | "PUBLIC"
  | "BOOK"
  | "PORTRAIT"
  | "PLD"
  | "DRAW"
;

export const channels: channelType[] = [
//  "MOTHER",
  "ACTOR",
//  "MAGIC",
  "FASHION",  
  "ART",
  "COMIC",
  "DESIGN",
  "ARCH",
  "NATURE",
//  "CLOTH",
//  "HOME",
//  "VEHICLE",
//  "PET",
//  "PLANT",
  "TRAVEL",
  "BOOK",
  "PORTRAIT",
  "DRAW",
  "PUBLIC",
];

export const loraChannels: channelType[] = [
  "FASHION",  
  "ART",
  "COMIC",
  "DESIGN",
  "ARCH",
  "NATURE",
  "PORTRAIT",
  "TRAVEL",
  "DRAW",
  "PLD"
];


export const channelNames = new Map();
channelNames.set("PLD", "拍立得");


// channelNames.set("MOTHER","母亲节");
channelNames.set("ACTOR", "对话");

//channelNames.set("MAGIC","魔法");
channelNames.set("FASHION","人物");
channelNames.set("PORTRAIT","写真");
channelNames.set("DRAW","绘画");

channelNames.set("ART","艺术");
channelNames.set("COMIC","漫画");
channelNames.set("DESIGN","设计");
channelNames.set("ARCH","建筑");
channelNames.set("NATURE","自然");
channelNames.set("BOOK","书籍");

//channelNames.set("CLOTH","服装");
//channelNames.set("HOME","家居");
//channelNames.set("VEHICLE","交通");
// channelNames.set("PET","宠物");
// channelNames.set("PLANT","花草");
 channelNames.set("TRAVEL","旅行");
 channelNames.set("PUBLIC","综合");


