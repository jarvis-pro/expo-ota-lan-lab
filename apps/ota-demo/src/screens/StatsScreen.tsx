import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { LEVEL_META, MemberLevel, TXN_META, useLedger } from '../store';
import { fmtMoney, isSameDay } from '../utils';
import { Card, MemberAvatar, SectionTitle } from '../components/ui';

const BAR_MAX_HEIGHT = 120;

export function StatsScreen() {
  const { members, txns } = useLedger();

  // 本月概览
  const month = useMemo(() => {
    const now = new Date();
    const inMonth = txns.filter((t) => t.time.getFullYear() === now.getFullYear() && t.time.getMonth() === now.getMonth());
    const recharge = inMonth.filter((t) => t.type === 'recharge').reduce((s, t) => s + t.amount, 0);
    const consume = inMonth.filter((t) => t.type === 'consume').reduce((s, t) => s + t.amount, 0);
    const refund = inMonth.filter((t) => t.type === 'refund').reduce((s, t) => s + t.amount, 0);
    return { recharge, consume, refund, count: inMonth.length };
  }, [txns]);

  // 近 7 日收支柱状图
  const week = useMemo(() => {
    const days: { label: string; income: number; expense: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayTxns = txns.filter((t) => isSameDay(t.time, d));
      days.push({
        label: i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`,
        income: dayTxns.filter((t) => TXN_META[t.type].sign > 0).reduce((s, t) => s + t.amount, 0),
        expense: dayTxns.filter((t) => TXN_META[t.type].sign < 0).reduce((s, t) => s + t.amount, 0),
      });
    }
    return days;
  }, [txns]);

  const weekMax = Math.max(1, ...week.map((d) => Math.max(d.income, d.expense)));

  // 会员等级分布
  const levelDist = useMemo(() => {
    const count: Record<MemberLevel, number> = { gold: 0, silver: 0, normal: 0 };
    for (const m of members) count[m.level] += 1;
    return count;
  }, [members]);

  // 消费排行
  const topConsumers = useMemo(() => {
    const sum = new Map<string, number>();
    for (const t of txns) {
      if (t.type === 'consume') sum.set(t.memberId, (sum.get(t.memberId) ?? 0) + t.amount);
    }
    return members
      .map((m) => ({ member: m, total: sum.get(m.id) ?? 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [members, txns]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>经营报表</Text>
        <Text style={styles.subtitle}>数据实时汇总自本机账本</Text>
      </View>

      {/* 本月概览 */}
      <Card>
        <Text style={styles.cardTitle}>本月概览</Text>
        <View style={styles.monthRow}>
          <MonthStat label="充值" value={month.recharge} color={colors.income} />
          <MonthStat label="消费" value={month.consume} color={colors.expense} />
          <MonthStat label="退款" value={month.refund} color={colors.refund} />
        </View>
        <Text style={styles.monthFoot}>
          本月共 {month.count} 笔流水 · 净收入{' '}
          <Text style={{ fontWeight: '700', color: colors.text }}>¥{fmtMoney(month.recharge + month.refund - month.consume)}</Text>
        </Text>
      </Card>

      {/* 近7日收支 */}
      <SectionTitle title="近 7 日收支" />
      <Card>
        <View style={styles.chartRow}>
          {week.map((d, i) => (
            <View key={i} style={styles.chartCol}>
              <View style={styles.chartBars}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(3, (d.income / weekMax) * BAR_MAX_HEIGHT), backgroundColor: colors.income },
                  ]}
                />
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(3, (d.expense / weekMax) * BAR_MAX_HEIGHT), backgroundColor: colors.expense },
                  ]}
                />
              </View>
              <Text style={styles.chartLabel}>{d.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.legendRow}>
          <Legend color={colors.income} label="收入" />
          <Legend color={colors.expense} label="支出" />
        </View>
      </Card>

      {/* 会员等级分布 */}
      <SectionTitle title="会员等级分布" />
      <Card style={{ gap: 14 }}>
        {(Object.keys(LEVEL_META) as MemberLevel[]).map((lv) => {
          const meta = LEVEL_META[lv];
          const count = levelDist[lv];
          const ratio = members.length ? count / members.length : 0;
          return (
            <View key={lv}>
              <View style={styles.distLabelRow}>
                <Text style={[styles.distLabel, { color: meta.color }]}>{meta.label}会员</Text>
                <Text style={styles.distCount}>
                  {count} 位 · {Math.round(ratio * 100)}%
                </Text>
              </View>
              <View style={styles.distTrack}>
                <View style={[styles.distFill, { width: `${Math.max(4, ratio * 100)}%`, backgroundColor: meta.color }]} />
              </View>
            </View>
          );
        })}
      </Card>

      {/* 消费排行 */}
      <SectionTitle title="消费排行 TOP 3" />
      <Card style={{ gap: 12 }}>
        {topConsumers.map(({ member, total }, i) => (
          <View key={member.id} style={styles.rankRow}>
            <Text style={[styles.rankNo, i === 0 && { color: colors.gold }]}>{i + 1}</Text>
            <MemberAvatar member={member} size={36} />
            <Text style={styles.rankName}>{member.name}</Text>
            <Text style={styles.rankValue}>¥{fmtMoney(total)}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function MonthStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[styles.monthValue, { color }]}>¥{fmtMoney(value)}</Text>
      <Text style={styles.monthLabel}>{label}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 4, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { marginTop: 4, fontSize: font.caption, color: colors.textSub },
  cardTitle: { fontSize: font.section, fontWeight: '700', color: colors.text, marginBottom: 14 },
  monthRow: { flexDirection: 'row' },
  monthValue: { fontSize: 17, fontWeight: '800' },
  monthLabel: { marginTop: 4, fontSize: font.caption, color: colors.textSub },
  monthFoot: { marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, fontSize: font.caption, color: colors.textSub },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4 },
  chartCol: { alignItems: 'center', flex: 1 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: BAR_MAX_HEIGHT },
  bar: { width: 10, borderRadius: 5 },
  chartLabel: { marginTop: 8, fontSize: 10, color: colors.textFaint },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: font.caption, color: colors.textSub },
  distLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  distLabel: { fontSize: font.body, fontWeight: '600' },
  distCount: { fontSize: font.caption, color: colors.textSub },
  distTrack: { height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' },
  distFill: { height: 8, borderRadius: 4 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankNo: { width: 20, fontSize: 16, fontWeight: '800', color: colors.textFaint, textAlign: 'center' },
  rankName: { flex: 1, fontSize: font.body, fontWeight: '600', color: colors.text },
  rankValue: { fontSize: font.body, fontWeight: '700', color: colors.text },
});
