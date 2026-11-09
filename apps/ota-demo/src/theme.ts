// 全局设计规范：配色 / 圆角 / 阴影 / 字号
export const colors = {
  primary: '#4F46E5',
  primaryDark: '#3B35C3',
  primarySoft: '#EEF0FE',
  bg: '#F5F6FA',
  card: '#FFFFFF',
  text: '#1B1D29',
  textSub: '#6B7186',
  textFaint: '#9AA1B5',
  border: '#E9EBF3',
  income: '#16A34A',
  incomeSoft: '#E7F6EC',
  expense: '#EA7C28',
  expenseSoft: '#FDF0E3',
  refund: '#2F6BFF',
  refundSoft: '#E9EFFF',
  gold: '#B45309',
  goldSoft: '#FDF1DE',
  silver: '#64748B',
  silverSoft: '#EFF2F7',
  danger: '#DC2626',
} as const;

export const radius = { sm: 10, md: 14, lg: 20, full: 999 } as const;

export const shadow = {
  card: {
    shadowColor: '#1B1D29',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  float: {
    shadowColor: '#1B1D29',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export const font = {
  hero: 30,
  title: 20,
  section: 16,
  body: 14,
  caption: 12,
} as const;
