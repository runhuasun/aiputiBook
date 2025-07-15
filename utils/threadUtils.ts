import * as global from "../utils/globalUtils";
import { log, warn, error } from "../utils/debug";
import * as enums from "../utils/enums";

type WaitItem = { waitID: string; startTime: number };

// 工具函数：安全获取队列，若不存在则初始化
async function getQueue(listName: string): Promise<WaitItem[]> {
    let queue: WaitItem[] = [];
    const str = await global.globalGet("GLOBAL_WAITING_LIST", listName);
    try {
        queue = JSON.parse(str || "[]");
    } catch (e) {
        error(`解析队列失败，重置为默认空队列`);
        await setQueue(listName, []); // 强制重置为有效空数组
    }
    return queue;
}

// 工具函数：原子性设置队列（若不存在则直接创建，存在则更新）
async function setQueue(listName: string, newQueue: WaitItem[]): Promise<boolean> {
    // 使用 globalSet 的原子性保证（假设底层存储支持原子写入）
    await global.globalSet("GLOBAL_WAITING_LIST", listName, JSON.stringify(newQueue));
    return true;
}

// 安全初始化队列（仅当队列不存在时）
async function safeInitializeQueue(listName: string, waitID: string): Promise<boolean> {
    const existing = await getQueue(listName);
    if (existing.length === 0) {
        await setQueue(listName, [{ waitID, startTime: Date.now() }]);
        return true;
    }
    return false;
}

// 主函数：进入等待队列
export async function enterWaitingList(
    listName: string,
    waitID: string,
    params: { 
        queryInterval?: number; 
        maxLen?: number; 
        maxWorkers?: number; 
        maxWaitTime?: number // 秒
    } = {}
) {
    const startTime = Date.now();
    const { queryInterval = 5, maxLen = 1, maxWorkers = 1, maxWaitTime = 86400 } = params; // 默认等待24小时
    let waited = 0;

    // 第一次入列尝试
    let queue = await getQueue(listName);
    if (queue.length === 0) {
        const success = await safeInitializeQueue(listName, waitID);
        if (success) {
            log(`队列已由 ${waitID} 创建`);
            return waitID;
        } else {
            queue = await getQueue(listName); // 其他线程已创建，重新获取
        }
    }

    // 正常入列逻辑
    if (queue.length >= maxLen) return enums.resStatus.tooMuchWaiting;
    if (!queue.some(item => item.waitID === waitID)) {
        queue.push({ waitID, startTime });
        await setQueue(listName, queue);
    }

    // 轮询等待
    while (waited < maxWaitTime) {
        await new Promise(res => setTimeout(res, queryInterval * 1000));
        waited += queryInterval;

        let currentQueue = await getQueue(listName);

        // 如果队列被外界清空，触发重建
        if (currentQueue.length === 0) {
            const success = await safeInitializeQueue(listName, waitID);
            if (success) {
                log(`队列已由 ${waitID} 重建`);
                return waitID;
            } else {
                currentQueue = await getQueue(listName); // 重新获取其他线程创建的队列
            }
        }

        // 检查自身是否在可执行区
        const activeList = currentQueue.slice(0, maxWorkers).map(item => item.waitID);
        if (activeList.includes(waitID)) {
            log(`任务 ${waitID} 开始执行`);
            return waitID;
        }
    }

    error(`等待超时：${waitID}`);
    return enums.resStatus.timeout;
}

// 主函数：离开等待队列
export async function leaveWaitingList(
    listName: string,
    waitID: string,
    params: { BPM?: number; maxWorkers?: number } = {}
){
    const BPM = params.BPM ?? 1;
    const maxWorkers = params.maxWorkers ?? 1;
    const endTime = Date.now();

    let queue = await getQueue(listName);
    const index = queue.findIndex(item => item.waitID === waitID);

    if (index !== -1) {
        const timeSpent = (endTime - queue[index].startTime) / 1000;
        const idealGap = (60 / BPM) / maxWorkers;
        const delayTime = idealGap - timeSpent;

        if (delayTime > 0) {
            log(`并发保护：延迟 ${delayTime.toFixed(2)} 秒`);
            await new Promise(res => setTimeout(res, delayTime * 1000));
        }

        queue.splice(index, 1);
        await setQueue(listName, queue);
        log(`已移除 ${waitID}，队列更新完毕`);
    } else {
        warn(`任务 ${waitID} 不在队列中，可能已被处理`);
    }
}
