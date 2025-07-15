export type themeType =
  | "Original"
  | "80"
  | "70"
  | "60"
  | "50"
  | "40"
  | "30"
  | "20"  
;


export const themes: themeType[] = [
  "Original",
  "80",
  "70",
  "60",
  "50",
  "40",
  "30",
  "20",
  
];

export const themeNames = new Map();
themeNames.set("Original","原始占比");
themeNames.set("80","占画面80%");
themeNames.set("70","占画面70%");
themeNames.set("60","占画面60%");
themeNames.set("50","占画面50%");
themeNames.set("40","占画面40%");
themeNames.set("30","占画面30%");
themeNames.set("20","占画面20%");
