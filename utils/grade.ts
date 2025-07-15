export const grades = [
  { grade: 0, bc: 0, name: "尊享体验", "en": "Starter VIP" },
  { grade: 1, bc: 1000, name: "青铜VIP",    "en": "Bronze VIP" },
  { grade: 2, bc: 4000, name: "黄金VIP",    "en": "Gold VIP" },
  { grade: 3, bc: 7500, name: "白金VIP",    "en": "Platinum VIP" },
  { grade: 4, bc: 16500, name: "黑金VIP",   "en": "Black Diamond" },
  { grade: 5, bc: 36000, name: "钻石VIP",    "en": "Diamond VIP" },
  { grade: 6, bc: 80000, name: "原神VIP",    "en": "Legend VIP" },
  { grade: 7, bc: 222000, name: "天使VIP", "en": "Angel VIP" },
  { grade: 8, bc: 1000000, name: "天神VIP", "en": "Celestial VIP" }
];

    

export function getGradeByBC(bc:number){
    let result = grades[0];
    for(const g of grades){
        if(bc >= g.bc){
            result = g;
        }
    }
    return result;
}

export function getGrade(grade:number){
    let result = grades[0];
    if(grade){
        for(const g of grades){
            if(grade == g.grade){
                return g;
            }
        }
    }
    return result;
}

export function getGradeName(config:any, grade:number){
    const g = getGrade(grade) || grades[0];
    switch(config?.locale){
        case "en-US":
            return g.en;
        default:
            return g.name;
    }
}
