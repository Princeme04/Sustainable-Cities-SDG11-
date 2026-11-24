import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MapDashboardScreen from './src/screens/MapDashboardScreen';
import PrivacyToolsScreen from './src/screens/PrivacyToolsScreen';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function App() {
  const [screen, setScreen] = useState<'map' | 'privacy'>('map');
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.tabs}>
          <Pressable onPress={() => setScreen('map')} style={[styles.tab, screen === 'map' && styles.activeTab]}><Text style={[styles.tabText, screen === 'map' && styles.activeText]}>Peta</Text></Pressable>
          <Pressable onPress={() => setScreen('privacy')} style={[styles.tab, screen === 'privacy' && styles.activeTab]}><Text style={[styles.tabText, screen === 'privacy' && styles.activeText]}>Offline & Privasi</Text></Pressable>
        </View>
        {screen === 'map' ? <MapDashboardScreen /> : <PrivacyToolsScreen />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, backgroundColor: '#FFFFFF', gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F1F5F9' },
  activeTab: { backgroundColor: '#CCFBF1' },
  tabText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  activeText: { color: '#0F766E' },
});
