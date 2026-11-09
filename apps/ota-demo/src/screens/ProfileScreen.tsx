import * as Updates from 'expo-updates';
import React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius } from '../theme';
import { fmtMoney, fmtTime } from '../utils';
import { Card, SectionTitle } from '../components/ui';
import { useLedger } from '../store';
import { BUNDLE_COLOR, BUNDLE_LABEL } from '../ota';

// 资源热更标记：被 require 引用的资源会随更新包分发。
// v1 内置的是绿色 ASSET V1；发布 v2 时换成橙色 ASSET V2（scripts/make-ota-art.py 生成）。
const otaArt = require('../../assets/ota-art.png');

export function ProfileScreen() {
  const { members, txns } = useLedger();
  const {
    currentlyRunning,
    isUpdateAvailable,
    isUpdatePending,
    isChecking,
    isDownloading,
    downloadProgress,
    lastCheckForUpdateTimeSinceRestart,
    checkError,
    downloadError,
  } = Updates.useUpdates();

  // resolveAssetSource 是原生端 API，react-native-web 未实现，Web 预览时降级显示
  const otaArtUri =
    Platform.OS === 'web' ? '(Web 平台不适用)' : (Image.resolveAssetSource(otaArt)?.uri ?? '(unknown)');
  const totalBalance = members.reduce((s, m) => s + m.balance, 0);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
      {/* 店铺资料 */}
      <Card style={styles.shopCard}>
        <View style={styles.shopAvatar}>
          <Text style={{ fontSize: 26 }}>🏪</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.shopName}>云杉咖啡 · 旗舰店</Text>
          <Text style={styles.shopSub}>
            {members.length} 位会员 · {txns.length} 笔流水 · 储值 ¥{fmtMoney(totalBalance)}
          </Text>
        </View>
        <View style={[styles.versionBadge, { backgroundColor: BUNDLE_COLOR }]}>
          <Text style={styles.versionText}>{BUNDLE_LABEL}</Text>
        </View>
      </Card>

      {/* OTA 更新中心 */}
      <SectionTitle title="OTA 更新中心" />
      <Card>
        <StatusRow label="updates 启用" value={String(Updates.isEnabled)} />
        <StatusRow label="运行来源" value={currentlyRunning.isEmbeddedLaunch ? '内置 bundle' : 'OTA 下载的更新'} />
        <StatusRow label="updateId" value={currentlyRunning.updateId ?? '(null)'} mono />
        <StatusRow label="runtimeVersion" value={currentlyRunning.runtimeVersion ?? '(null)'} mono />
        <StatusRow
          label="状态"
          value={
            isChecking
              ? '正在检查更新…'
              : isDownloading
                ? `正在下载 ${Math.round((downloadProgress ?? 0) * 100)}%`
                : isUpdatePending
                  ? '已下载，待重启生效'
                  : isUpdateAvailable
                    ? '发现新版本'
                    : '已是最新'
          }
        />
        <StatusRow label="上次检查" value={lastCheckForUpdateTimeSinceRestart ? fmtTime(lastCheckForUpdateTimeSinceRestart) : '(未检查)'} last />
        {checkError ? <Text style={styles.error}>检查出错：{checkError.message}</Text> : null}
        {downloadError ? <Text style={styles.error}>下载出错：{downloadError.message}</Text> : null}

        <View style={styles.btnRow}>
          <OtaButton label="检查更新" onPress={() => Updates.checkForUpdateAsync().catch((e) => console.warn(e))} />
          <OtaButton label="下载更新" onPress={() => Updates.fetchUpdateAsync().catch((e) => console.warn(e))} />
          <OtaButton label="重启生效" primary onPress={() => Updates.reloadAsync().catch((e) => console.warn(e))} />
        </View>
      </Card>

      {/* 资源热更演示 */}
      <SectionTitle title="资源热更演示" />
      <Card>
        <Image source={otaArt} style={styles.otaArt} resizeMode="cover" />
        <Text style={styles.otaCaption}>↑ 此图由 require 引入，热更时应随更新包变色</Text>
        <Text style={styles.otaUri} numberOfLines={2}>
          资源加载自：{otaArtUri}
        </Text>
      </Card>

      {/* 关于 */}
      <SectionTitle title="关于" />
      <Card>
        <Text style={styles.about}>
          纯单机演示账本：所有数据保存在内存中（种子数据自动生成），不连接任何业务服务器，重启后数据重置。
          唯一的网络行为是向局域网更新服务器查询 OTA 热更。
        </Text>
      </Card>
    </ScrollView>
  );
}

function StatusRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <View style={[styles.statusRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, mono && styles.mono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function OtaButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      style={[styles.btn, primary ? { backgroundColor: colors.primary } : { backgroundColor: colors.primarySoft }]}
      onPress={onPress}
    >
      <Text style={[styles.btnText, { color: primary ? '#fff' : colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shopCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shopAvatar: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: { fontSize: font.section, fontWeight: '700', color: colors.text },
  shopSub: { marginTop: 4, fontSize: font.caption, color: colors.textSub },
  versionBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  versionText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  statusLabel: { fontSize: font.body, color: colors.textSub },
  statusValue: { flex: 1, textAlign: 'right', fontSize: font.body, fontWeight: '600', color: colors.text },
  mono: { fontFamily: 'Menlo', fontSize: 12 },
  error: { marginTop: 8, fontSize: font.caption, color: colors.danger },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
  btnText: { fontSize: font.body, fontWeight: '700' },
  otaArt: { width: '100%', height: 130, borderRadius: radius.md },
  otaCaption: { marginTop: 8, fontSize: font.caption, color: colors.textSub, textAlign: 'center' },
  otaUri: { marginTop: 6, fontSize: 11, color: colors.textFaint, fontFamily: 'Menlo' },
  about: { fontSize: font.body, color: colors.textSub, lineHeight: 22 },
});
