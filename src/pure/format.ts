/**
 * 显示格式化工具（纯逻辑，不依赖 vscode）
 *
 * 从 core/logMonitor.ts 抽出。
 */

/** 将字节数格式化为带单位的字符串（右对齐 8 位，便于树视图对齐）。 */
export function formatSize(bytes: number): string {
    let result: string;
    if (!bytes || bytes < 0) {
        result = '0 B';
    } else if (bytes < 1024) {
        result = bytes + ' B';
    } else if (bytes < 1048576) {
        result = (bytes / 1024).toFixed(1) + ' KB';
    } else if (bytes < 1073741824) {
        result = (bytes / 1048576).toFixed(1) + ' MB';
    } else {
        result = (bytes / 1073741824).toFixed(2) + ' GB';
    }
    return result.padStart(8);
}

/** 将日期格式化为 `MM-DD HH:MM`。解析失败返回空串。 */
export function formatDate(date: Date): string {
    try {
        const d = new Date(date);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        return `${month}-${day} ${hour}:${minute}`;
    } catch {
        return '';
    }
}
