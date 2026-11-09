import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { LedgerProvider } from './src/store';
import { colors } from './src/theme';
import { HomeScreen } from './src/screens/HomeScreen';
import { MembersScreen } from './src/screens/MembersScreen';
import { RecordsScreen } from './src/screens/RecordsScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AddMemberModal, AddTxnModal } from './src/components/modals';

// 热更版本标记已移至 src/ota.ts（BUNDLE_LABEL / BUNDLE_COLOR），发布热更时改那里。

type TabKey = 'home' | 'members' | 'records' | 'stats' | 'profile';

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: 'home', icon: '🏠', label: '首页' },
  { key: 'members', icon: '👥', label: '会员' },
  { key: 'records', icon: '🧾', label: '记账' },
  { key: 'stats', icon: '📊', label: '报表' },
  { key: 'profile', icon: '⚙️', label: '我的' },
];

export default function App() {
  return (
    <LedgerProvider>
      <Root />
    </LedgerProvider>
  );
}

function Root() {
  const [tab, setTab] = useState<TabKey>('home');
  const [txnModalVisible, setTxnModalVisible] = useState(false);
  const [memberModalVisible, setMemberModalVisible] = useState(false);

  // OTA：更新下载完成后自动重启生效（与原演示行为一致）
  const { isUpdatePending } = Updates.useUpdates();
  useEffect(() => {
    if (isUpdatePending) {
      Updates.reloadAsync();
    }
  }, [isUpdatePending]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.flex}>
          {tab === 'home' && (
            <HomeScreen
              onGoTab={(t) => setTab(t)}
              onAddTxn={() => setTxnModalVisible(true)}
              onAddMember={() => setMemberModalVisible(true)}
            />
          )}
          {tab === 'members' && <MembersScreen onAddMember={() => setMemberModalVisible(true)} />}
          {tab === 'records' && <RecordsScreen onAddTxn={() => setTxnModalVisible(true)} />}
          {tab === 'stats' && <StatsScreen />}
          {tab === 'profile' && <ProfileScreen />}
        </View>

        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)}>
                <Text style={[styles.tabIcon, !active && { opacity: 0.45 }]}>{t.icon}</Text>
                <Text style={[styles.tabLabel, active && { color: colors.primary, fontWeight: '700' }]}>{t.label}</Text>
                {active && <View style={styles.tabDot} />}
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>

      <AddTxnModal visible={txnModalVisible} onClose={() => setTxnModalVisible(false)} />
      <AddMemberModal visible={memberModalVisible} onClose={() => setMemberModalVisible(false)} />

      <StatusBar style={tab === 'home' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'android' ? 8 : 0,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabIcon: { fontSize: 20 },
  tabLabel: { marginTop: 2, fontSize: 10, color: colors.textFaint, fontWeight: '500' },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 3 },
});
