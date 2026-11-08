import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';

// ===== 热更标记：发布 v2 时只需改这两行 =====
const BUNDLE_LABEL = 'v1（内置包）';
const BUNDLE_COLOR = '#1e90ff';
// ==========================================

export default function App() {
  const { currentlyRunning, isUpdateAvailable, isUpdatePending, isChecking, isDownloading, downloadProgress, lastCheckForUpdateTimeSinceRestart, checkError, downloadError } =
    Updates.useUpdates();

  useEffect(() => {
    if (isUpdatePending) {
      Updates.reloadAsync();
    }
  }, [isUpdatePending]);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: BUNDLE_COLOR }]}>
      <Text style={styles.banner}>{BUNDLE_LABEL}</Text>

      <View style={styles.card}>
        <Text style={styles.row}>updates 启用: {String(Updates.isEnabled)}</Text>
        <Text style={styles.row}>运行来源: {currentlyRunning.isEmbeddedLaunch ? '内置 bundle' : 'OTA 下载的更新'}</Text>
        <Text style={styles.row} numberOfLines={1}>updateId: {currentlyRunning.updateId ?? '(null)'}</Text>
        <Text style={styles.row}>runtimeVersion: {currentlyRunning.runtimeVersion ?? '(null)'}</Text>
        <Text style={styles.row}>检查中: {String(isChecking)}  下载中: {String(isDownloading)}{isDownloading ? ` ${Math.round((downloadProgress ?? 0) * 100)}%` : ''}</Text>
        <Text style={styles.row}>有可用更新: {String(isUpdateAvailable)}  已下载待重启: {String(isUpdatePending)}</Text>
        <Text style={styles.row}>上次检查: {lastCheckForUpdateTimeSinceRestart?.toLocaleTimeString() ?? '(未检查)'}</Text>
        {checkError ? <Text style={styles.error}>检查出错: {checkError.message}</Text> : null}
        {downloadError ? <Text style={styles.error}>下载出错: {downloadError.message}</Text> : null}
      </View>

      <View style={styles.buttons}>
        <Button title="手动检查更新" onPress={() => Updates.checkForUpdateAsync().catch((e) => console.warn(e))} />
        <Button title="下载更新" onPress={() => Updates.fetchUpdateAsync().catch((e) => console.warn(e))} />
        <Button title="立即重启应用更新" onPress={() => Updates.reloadAsync().catch((e) => console.warn(e))} />
      </View>
      <StatusBar style="light" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  banner: { fontSize: 34, fontWeight: '800', color: '#fff', marginBottom: 24 },
  card: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: 16, width: '100%', marginBottom: 24 },
  row: { fontSize: 13, marginVertical: 3, color: '#222' },
  error: { fontSize: 12, marginVertical: 3, color: '#c00' },
  buttons: { width: '100%', gap: 8 },
});
