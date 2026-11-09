// 纯单机内存数据仓库：会员 + 流水，带种子演示数据。
// 注意：本应用是 OTA 演示客户端，刻意不引入任何新原生依赖（AsyncStorage/SQLite 等），
// 以便整套界面可以作为一个热更包推送到已安装的旧版原生壳上。重启后数据会重置为种子数据。
import React, { createContext, useContext, useMemo, useReducer } from 'react';

export type MemberLevel = 'gold' | 'silver' | 'normal';
export type TxnType = 'recharge' | 'consume' | 'refund';

export interface Member {
  id: string;
  name: string;
  phone: string;
  level: MemberLevel;
  balance: number;
  joinedAt: Date;
}

export interface Txn {
  id: string;
  memberId: string;
  type: TxnType;
  amount: number;
  note: string;
  time: Date;
}

export const TXN_META: Record<TxnType, { label: string; sign: 1 | -1; color: string; soft: string; icon: string }> = {
  recharge: { label: '充值', sign: 1, color: '#16A34A', soft: '#E7F6EC', icon: '💰' },
  consume: { label: '消费', sign: -1, color: '#EA7C28', soft: '#FDF0E3', icon: '🛒' },
  refund: { label: '退款', sign: 1, color: '#2F6BFF', soft: '#E9EFFF', icon: '↩️' },
};

export const LEVEL_META: Record<MemberLevel, { label: string; color: string; soft: string }> = {
  gold: { label: '金卡', color: '#B45309', soft: '#FDF1DE' },
  silver: { label: '银卡', color: '#64748B', soft: '#EFF2F7' },
  normal: { label: '普通', color: '#4F46E5', soft: '#EEF0FE' },
};

// ---------- 种子数据 ----------

function daysAgo(n: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const seedMembers: Member[] = [
  { id: 'm1', name: '林晚舟', phone: '138****2201', level: 'gold', balance: 2680.0, joinedAt: daysAgo(210, 10, 0) },
  { id: 'm2', name: '沈亦臻', phone: '139****8842', level: 'gold', balance: 1520.5, joinedAt: daysAgo(180, 11, 30) },
  { id: 'm3', name: '顾清让', phone: '137****5630', level: 'silver', balance: 468.0, joinedAt: daysAgo(96, 15, 20) },
  { id: 'm4', name: '苏念安', phone: '150****3317', level: 'silver', balance: 305.5, joinedAt: daysAgo(64, 9, 45) },
  { id: 'm5', name: '陈默存', phone: '186****7754', level: 'silver', balance: 88.0, joinedAt: daysAgo(40, 14, 10) },
  { id: 'm6', name: '江离', phone: '133****9028', level: 'normal', balance: 156.0, joinedAt: daysAgo(21, 19, 5) },
  { id: 'm7', name: '温既白', phone: '155****4463', level: 'normal', balance: 42.5, joinedAt: daysAgo(9, 12, 40) },
  { id: 'm8', name: '许南乔', phone: '188****1190', level: 'normal', balance: 20.0, joinedAt: daysAgo(3, 16, 25) },
];

// [memberId, type, amount, note, 几天前, 时, 分]
const seedTxnRows: [string, TxnType, number, string, number, number, number][] = [
  ['m1', 'recharge', 1000, '门店充值送100', 7, 10, 12],
  ['m2', 'recharge', 500, '微信充值', 7, 11, 3],
  ['m3', 'consume', 68.5, '咖啡+甜点套餐', 7, 15, 40],
  ['m4', 'consume', 120, '精品咖啡豆 250g', 6, 9, 55],
  ['m1', 'consume', 236, '双人下午茶', 6, 14, 22],
  ['m6', 'recharge', 200, '首次充值', 5, 18, 6],
  ['m5', 'consume', 45, '手冲单品', 5, 10, 31],
  ['m2', 'consume', 89, '挂耳咖啡礼盒', 4, 13, 48],
  ['m3', 'recharge', 300, '支付宝充值', 4, 16, 15],
  ['m8', 'recharge', 100, '新会员首充', 3, 16, 30],
  ['m7', 'consume', 32, '冰美式', 3, 12, 50],
  ['m1', 'consume', 158, '法甜拼盘', 2, 15, 8],
  ['m4', 'recharge', 200, '门店现金充值', 2, 11, 26],
  ['m5', 'refund', 20, '误刷退回', 2, 17, 41],
  ['m6', 'consume', 56, '拿铁+可颂', 1, 9, 14],
  ['m2', 'consume', 132, '冷萃瓶装 x4', 1, 13, 37],
  ['m3', 'consume', 78, '季节限定特调', 1, 19, 55],
  ['m8', 'consume', 45, '会员价美式', 1, 20, 10],
  ['m1', 'recharge', 800, '月末储值活动', 0, 9, 32],
  ['m4', 'consume', 96, '手冲双人份', 0, 10, 48],
  ['m7', 'recharge', 100, '小程序充值', 0, 12, 20],
  ['m6', 'consume', 38, 'Dirty 一杯', 0, 14, 5],
  ['m2', 'refund', 36, '商品缺货退款', 0, 15, 42],
  ['m3', 'consume', 52, '燕麦拿铁', 0, 16, 58],
];

const seedTxns: Txn[] = seedTxnRows.map(([memberId, type, amount, note, d, h, m], i) => ({
  id: `t${i + 1}`,
  memberId,
  type,
  amount,
  note,
  time: daysAgo(d, h, m),
}));

// ---------- Reducer ----------

interface LedgerState {
  members: Member[];
  txns: Txn[];
}

type LedgerAction = { type: 'member/add'; member: Member } | { type: 'txn/add'; txn: Txn };

function reducer(state: LedgerState, action: LedgerAction): LedgerState {
  switch (action.type) {
    case 'member/add':
      return { ...state, members: [action.member, ...state.members] };
    case 'txn/add': {
      const { txn } = action;
      const meta = TXN_META[txn.type];
      return {
        txns: [txn, ...state.txns],
        members: state.members.map((m) =>
          m.id === txn.memberId ? { ...m, balance: Math.max(0, m.balance + meta.sign * txn.amount) } : m,
        ),
      };
    }
  }
}

export interface LedgerContextValue extends LedgerState {
  memberById: (id: string) => Member | undefined;
  addMember: (input: { name: string; phone: string; level: MemberLevel; initRecharge: number }) => void;
  addTxn: (input: { memberId: string; type: TxnType; amount: number; note: string }) => void;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { members: seedMembers, txns: seedTxns });

  const value = useMemo<LedgerContextValue>(
    () => ({
      ...state,
      memberById: (id) => state.members.find((m) => m.id === id),
      addMember: ({ name, phone, level, initRecharge }) => {
        const member: Member = { id: nextId('m'), name, phone, level, balance: 0, joinedAt: new Date() };
        dispatch({ type: 'member/add', member });
        if (initRecharge > 0) {
          dispatch({
            type: 'txn/add',
            txn: { id: nextId('t'), memberId: member.id, type: 'recharge', amount: initRecharge, note: '开卡首充', time: new Date() },
          });
        }
      },
      addTxn: ({ memberId, type, amount, note }) => {
        dispatch({ type: 'txn/add', txn: { id: nextId('t'), memberId, type, amount, note, time: new Date() } });
      },
    }),
    [state],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger 必须在 LedgerProvider 内使用');
  return ctx;
}
