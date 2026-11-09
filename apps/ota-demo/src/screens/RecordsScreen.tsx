import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius } from '../theme';
import { TXN_META, TxnType, useLedger } from '../store';
import { dayLabel, fmtMoney } from '../utils';
import { EmptyState } from '../components/ui';
import { TxnRow } from '../components/TxnRow';

type Filter = 'all' | TxnType;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'recharge', label: '充值' },
  { key: 'consume', label: '消费' },
  { key: 'refund', label: '退款' },
];

export function RecordsScreen({ onAddTxn }: { onAddTxn: () => void }) {
  const { txns } = useLedger();
  const [filter, setFilter] = useState<Filter>('all');

  const groups = useMemo(() => {
    const filtered = txns
      .filter((t) => filter === 'all' || t.type === filter)
      .sort((a, b) => b.time.getTime() - a.time.getTime());
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const key = dayLabel(t.time);
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    return [...map.entries()];
  }, [txns, filter]);

  const summary = useMemo(() => {
    const list = txns.filter((t) => filter === 'all' || t.type === filter);
    const income = list.filter((t) => TXN_META[t.type].sign > 0).reduce((s, t) => s + t.amount, 0);
    const expense = list.filter((t) => TXN_META[t.type].sign < 0).reduce((s, t) => s + t.amount, 0);
    return { count: list.length, income, expense };
  }, [txns, filter]);

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.title}>账本流水</Text>
        <Text style={styles.subtitle}>
          {summary.count} 笔 · 入 ¥{fmtMoney(summary.income)} · 出 ¥{fmtMoney(summary.expense)}
        </Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable key={f.key} style={[styles.chip, active && styles.chipActive]} onPress={() => setFilter(f.key)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
        {groups.length === 0 ? (
          <EmptyState title="暂无相关流水" subtitle="换个筛选条件，或点击右下角记一笔" />
        ) : (
          groups.map(([label, list]) => (
            <View key={label} style={{ marginBottom: 8 }}>
              <Text style={styles.groupLabel}>{label}</Text>
              {list.map((t) => (
                <TxnRow key={t.id} txn={t} />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={onAddTxn}>
        <Text style={styles.fabText}>＋ 记一笔</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { marginTop: 4, fontSize: font.caption, color: colors.textSub },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.body, color: colors.textSub, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  groupLabel: { fontSize: font.caption, fontWeight: '700', color: colors.textFaint, marginBottom: 8, marginLeft: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: font.body, fontWeight: '700' },
});
