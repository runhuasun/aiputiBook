export type themeType =
  | "Vintage"
  | "Dinamic simple"
  | "Minimalistic"
  | "Flat 2D, Vector"
  | "Cartoon";

export type roomType =
  | "DALL-E"
  | "SD2.1"

export const themes: themeType[] = [
  "Vintage",
  "Dinamic simple",
  "Minimalistic",
  "Flat 2D, Vector",
  "Cartoon",
];

export const rooms: roomType[] = [
  "DALL-E",
  "SD2.1",
 ];

export const themeNames = new Map();
themeNames.set("Vintage","古典风格");
themeNames.set("Dinamic simple","现代动感");
themeNames.set("Minimalistic","极简风格");
themeNames.set("Flat 2D, Vector","扁平风格");
themeNames.set("Cartoon","卡通风格");

export const roomNames = new Map();
roomNames.set("DALL-E","OPENAI DALL-E");
roomNames.set("SD2.1","Stable Diffusion 2.1");


