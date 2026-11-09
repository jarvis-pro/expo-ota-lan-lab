import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, shadow } from '../theme';
import { LEVEL_META, Member, MemberLevel } from '../store';

const emptyArt = require('../../assets/illustration-empty.png');

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionText}>{title}</Text>
      <View style={{ flex: 1 }} />
      {action}
    </View>
  );
}

export function LevelBadge({ level }: { level: MemberLevel }) {
  const meta = LEVEL_META[level];
  return (
    <View style={[styles.badge, { backgroundColor: meta.soft }]}>
      <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const AVATAR_COLORS = ['#4F46E5', '#0E9F8A', '#D97706', '#DB2777', '#2F6BFF', '#7C3AED', '#0891B2', '#65A30D'];

export function MemberAvatar({ member, size = 44 }: { member: Member; size?: number }) {
  const hash = member.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '700' }}>{member.name.slice(0, 1)}</Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Image source={emptyArt} style={styles.emptyImage} resizeMode="contain" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    ...shadow.card,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 12 },
  sectionBar: { width: 4, height: 16, borderRadius: 2, backgroundColor: colors.primary, marginRight: 8 },
  sectionText: { fontSize: font.section, fontWeight: '700', color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyImage: { width: 180, height: 167 },
  emptyTitle: { marginTop: 8, fontSize: font.body, fontWeight: '600', color: colors.textSub },
  emptySubtitle: { marginTop: 4, fontSize: font.caption, color: colors.textFaint },
});
