import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius } from '../theme';
import { MemberLevel, useLedger } from '../store';
import { fmtMoney } from '../utils';
import { Card, EmptyState, LevelBadge, MemberAvatar } from '../components/ui';

type Filter = 'all' | MemberLevel;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'gold', label: '金卡' },
  { key: 'silver', label: '银卡' },
  { key: 'normal', label: '普通' },
];

export function MembersScreen({ onAddMember }: { onAddMember: () => void }) {
  const { members, txns } = useLedger();
  const [filter, setFilter] = useState<Filter>('all');

  const consumeByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txns) {
      if (t.type === 'consume') map.set(t.memberId, (map.get(t.memberId) ?? 0) + t.amount);
    }
    return map;
  }, [txns]);

  const list = useMemo(
    () =>
      members
        .filter((m) => filter === 'all' || m.level === filter)
        .sort((a, b) => b.balance - a.balance),
    [members, filter],
  );

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.title}>会员管理</Text>
        <Text style={styles.subtitle}>共 {members.length} 位会员 · 储值总额 ¥{fmtMoney(members.reduce((s, m) => s + m.balance, 0))}</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
        {list.length === 0 ? (
          <EmptyState title="这个等级还没有会员" subtitle="点击右下角按钮，给门店添一位新会员吧" />
        ) : (
          list.map((m) => (
            <Card key={m.id} style={styles.memberCard}>
              <MemberAvatar member={m} />
              <View style={styles.memberMiddle}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <LevelBadge level={m.level} />
                </View>
                <Text style={styles.memberPhone}>{m.phone}</Text>
                <Text style={styles.memberConsume}>
                  累计消费 ¥{fmtMoney(consumeByMember.get(m.id) ?? 0)}
                </Text>
              </View>
              <View style={styles.memberRight}>
                <Text style={styles.balanceLabel}>余额</Text>
                <Text style={styles.balanceValue}>¥{fmtMoney(m.balance)}</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={onAddMember}>
        <Text style={styles.fabText}>＋ 新增会员</Text>
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
  memberCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, padding: 14 },
  memberMiddle: { flex: 1, marginLeft: 12 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.text },
  memberPhone: { marginTop: 3, fontSize: font.caption, color: colors.textFaint },
  memberConsume: { marginTop: 3, fontSize: font.caption, color: colors.textSub },
  memberRight: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 11, color: colors.textFaint },
  balanceValue: { marginTop: 2, fontSize: 15, fontWeight: '800', color: colors.primary },
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
