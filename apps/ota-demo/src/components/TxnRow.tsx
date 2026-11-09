import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius } from '../theme';
import { TXN_META, Txn, useLedger } from '../store';
import { fmtMoney, fmtTime } from '../utils';
import { MemberAvatar } from './ui';

export function TxnRow({ txn, showAvatar = true }: { txn: Txn; showAvatar?: boolean }) {
  const { memberById } = useLedger();
  const member = memberById(txn.memberId);
  const meta = TXN_META[txn.type];
  return (
    <View style={styles.row}>
      {showAvatar && member ? (
        <MemberAvatar member={member} size={40} />
      ) : (
        <View style={[styles.iconCircle, { backgroundColor: meta.soft }]}>
          <Text style={{ fontSize: 16 }}>{meta.icon}</Text>
        </View>
      )}
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {member?.name ?? '未知会员'} · {meta.label}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {txn.note ? `${txn.note} · ` : ''}
          {fmtTime(txn.time)}
        </Text>
      </View>
      <Text style={[styles.amount, { color: meta.color }]}>
        {meta.sign > 0 ? '+' : '-'}¥{fmtMoney(txn.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, marginHorizontal: 12 },
  title: { fontSize: font.body, fontWeight: '600', color: colors.text },
  subtitle: { marginTop: 3, fontSize: font.caption, color: colors.textFaint },
  amount: { fontSize: 15, fontWeight: '700' },
});
