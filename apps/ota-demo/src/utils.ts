// 通用格式化工具（手写实现，避免依赖 Hermes 的 Intl/ICU 差异）

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 金额格式化：1280.5 -> "1,280.50" */
export function fmtMoney(n: number): string {
  const fixed = Math.abs(n).toFixed(2);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}${grouped}.${dec}`;
}

export function fmtTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 日期分组标签：今天 / 昨天 / x月x日 */
export function dayLabel(d: Date, now = new Date()): string {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, now)) return '今天';
  if (isSameDay(d, yesterday)) return '昨天';
  return fmtDate(d);
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function weekdayLabel(d: Date): string {
  return `周${WEEKDAYS[d.getDay()]}`;
}

/** 当前时段问候语 */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}
