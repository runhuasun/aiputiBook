// import * as lunar from "LunarCalendar";
import moment from 'moment-timezone';


const dateTimeOptions = {
    timeZone: "Asia/Shanghai" as const,
    year: "numeric" as const,
    month: "2-digit" as const,
    day: "2-digit" as const,
    hour: "2-digit" as const,
    minute: "2-digit" as const,
    second: "2-digit" as const,
    hour12: false
};

const dateOptions = {
    timeZone: "Asia/Shanghai" as const,
    year: "numeric" as const,
    month: "2-digit" as const,
    day: "2-digit" as const,
};


// 返回例如：2025-05-01
export function getLocalDateStr(date:Date):string{
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Shanghai' // 显式指定时区（可选）
    });
}

export function showDateTime(date:Date):string{
    return date.toLocaleString("zh-CN", dateTimeOptions );
}

export function showDate(date:Date):string{
    return date.toLocaleDateString("zh-CN", dateOptions);
}

export function UTCtoBJ(d:Date){
    if(d){
        return new Date(d.getTime() + 8 * 3600 * 1000);
    }else{
        return d;
    }
}


// 将时间输出为"2024年4月11日14点35分四十二秒"的格式：
export function showChineseDateTime(date:Date):string{
    var lunar = require("lunar-calendar");
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();
    const weekday = date.getDay();
    
    const daysOfWeek = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const lunarDate = lunar.solarToLunar(year, month, day);
    
    let cnDate = `${year}年${month}月${day}日${hour}点${minute}分${second}秒，${daysOfWeek[weekday]}，农历${lunarDate.GanZhiYear}年${lunarDate.lunarMonthName}${lunarDate.lunarDayName}`;
    if(lunarDate.term){
        cnDate +=  `，${lunarDate.term}`;
    }
    if(lunarDate.lunarFestival){
        cnDate += `，${lunarDate.lunarFestival}`;
    }
    if(lunarDate.solarFestival){
        cnDate += `，${lunarDate.solarFestival}`;
    }
    
    return cnDate;
}

// 使用UTC时间，精确到秒，使用遵循ISO 8601标准的格式：YYYYMMDD'T'HHMMSS'Z'	20201103T104027Z
export function getUTCString(date:Date){  
    if(date){
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }else{
        return "";
    }
}

  
