import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius } from '../theme';
import { TXN_META, useLedger } from '../store';
import { fmtMoney, greeting, isSameDay, weekdayLabel } from '../utils';
import { Card, SectionTitle } from '../components/ui';
import { TxnRow } from '../components/TxnRow';

const heroArt = require('../../assets/illustration-hero.png');

export function HomeScreen({
  onGoTab,
  onAddTxn,
  onAddMember,
}: {
  onGoTab: (tab: 'members' | 'records' | 'stats') => void;
  onAddTxn: () => void;
  onAddMember: () => void;
}) {
  const { members, txns } = useLedger();
  const now = new Date();

  const todayTxns = txns.filter((t) => isSameDay(t.time, now));
  const todayIncome = todayTxns.filter((t) => TXN_META[t.type].sign > 0).reduce((s, t) => s + t.amount, 0);
  const todayExpense = todayTxns.filter((t) => TXN_META[t.type].sign < 0).reduce((s, t) => s + t.amount, 0);
  const totalBalance = members.reduce((s, m) => s + m.balance, 0);
  const recent = [...txns].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
      {/* 头部：插画 + 问候 */}
      <View style={styles.header}>
        <View style={styles.headerCircle1} />
        <View style={styles.headerCircle2} />
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {greeting()}，店长
            </Text>
            <Text style={styles.date}>
              {now.getMonth() + 1}月{now.getDate()}日 · {weekdayLabel(now)}
            </Text>
            <Text style={styles.shop}>云杉咖啡 · 会员账本</Text>
          </View>
        </View>
        <Image source={heroArt} style={styles.heroArt} resizeMode="contain" />
      </View>

      {/* 今日概览 */}
      <View style={styles.overviewWrap}>
        <Card style={styles.overview}>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>今日收入</Text>
              <Text style={[styles.overviewValue, { color: colors.income }]}>¥{fmtMoney(todayIncome)}</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>今日支出</Text>
              <Text style={[styles.overviewValue, { color: colors.expense }]}>¥{fmtMoney(todayExpense)}</Text>
            </View>
          </View>
          <View style={styles.overviewFooter}>
            <Text style={styles.overviewFootText}>
              会员总数 <Text style={styles.overviewFootStrong}>{members.length}</Text> 位
            </Text>
            <View style={styles.overviewFootDot} />
            <Text style={styles.overviewFootText}>
              储值总额 <Text style={styles.overviewFootStrong}>¥{fmtMoney(totalBalance)}</Text>
            </Text>
          </View>
        </Card>
      </View>

      {/* 快捷操作 */}
      <View style={styles.quickRow}>
        <QuickAction icon="✏️" label="记一笔" tint={colors.primarySoft} onPress={onAddTxn} />
        <QuickAction icon="👤" label="加会员" tint="#E7F6EC" onPress={onAddMember} />
        <QuickAction icon="🧾" label="看流水" tint="#FDF0E3" onPress={() => onGoTab('records')} />
        <QuickAction icon="📊" label="查报表" tint="#E9EFFF" onPress={() => onGoTab('stats')} />
      </View>

      {/* 最近流水 */}
      <View style={{ paddingHorizontal: 16 }}>
        <SectionTitle
          title="最近流水"
          action={
            <Pressable onPress={() => onGoTab('records')} hitSlop={8}>
              <Text style={styles.more}>查看全部 ›</Text>
            </Pressable>
          }
        />
        {recent.map((t) => (
          <TxnRow key={t.id} txn={t} />
        ))}
      </View>
    </ScrollView>
  );
}

function QuickAction({ icon, label, tint, onPress }: { icon: string; label: string; tint: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickItem} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: tint }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 64,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -80,
    right: -50,
  },
  headerCircle2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: 40,
    right: 110,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff' },
  date: { marginTop: 4, fontSize: font.caption, color: 'rgba(255,255,255,0.75)' },
  shop: { marginTop: 10, fontSize: font.body, fontWeight: '600', color: 'rgba(255,255,255,0.92)' },
  heroArt: { width: '100%', height: 150, marginTop: 6 },
  overviewWrap: { paddingHorizontal: 16, marginTop: -44 },
  overview: { paddingVertical: 18 },
  overviewRow: { flexDirection: 'row', alignItems: 'center' },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewLabel: { fontSize: font.caption, color: colors.textSub },
  overviewValue: { marginTop: 6, fontSize: 22, fontWeight: '800' },
  overviewDivider: { width: 1, height: 36, backgroundColor: colors.border },
  overviewFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  overviewFootText: { fontSize: font.caption, color: colors.textSub },
  overviewFootStrong: { color: colors.text, fontWeight: '700' },
  overviewFootDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textFaint, marginHorizontal: 10 },
  quickRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 18, gap: 10 },
  quickItem: { flex: 1, alignItems: 'center' },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { marginTop: 6, fontSize: font.caption, color: colors.textSub, fontWeight: '500' },
  more: { fontSize: font.caption, color: colors.primary, fontWeight: '600' },
});
