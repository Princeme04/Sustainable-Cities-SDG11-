import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { offlineFiles } from '../services/offlineFiles';
import { secureVault, type SensitiveCredential } from '../services/secureVault';
import { justInTimePermissions } from '../services/justInTimePermissions';

const SECRET_KEYS: { key: SensitiveCredential; label: string; placeholder: string }[] = [
  { key: 'authToken', label: 'Token sesi', placeholder: 'Tempel token' },
  { key: 'nik', label: 'NIK', placeholder: 'Masukkan NIK' },
  { key: 'credentials', label: 'Kredensial', placeholder: 'Masukkan kredensial' },
];

export default function PrivacyToolsScreen() {
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<SensitiveCredential, string>>({ authToken: '', nik: '', credentials: '' });
  const [status, setStatus] = useState('Data tersimpan di perangkat ini.');

  const saveSecret = async (key: SensitiveCredential) => {
    if (!values[key].trim()) {
      Alert.alert('Data kosong', 'Isi nilai terlebih dahulu sebelum menyimpan.');
      return;
    }
    try {
      await secureVault.set(key, values[key].trim());
      setValues((current) => ({ ...current, [key]: '' }));
      setStatus(`${SECRET_KEYS.find((item) => item.key === key)?.label} disimpan dengan aman.`);
    } catch {
      setStatus('Penyimpanan aman gagal. Periksa dukungan perangkat.');
    }
  };

  const pickPhoto = async () => {
    const permission = await justInTimePermissions.requestCamera();
    if (permission !== 'granted') {
      Alert.alert('Izin kamera diperlukan', 'Izinkan kamera saat mengambil foto laporan.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    try {
      const asset = result.assets[0];
      const uri = await offlineFiles.importMedia(asset.uri, asset.fileName ?? 'laporan.jpg');
      await offlineFiles.saveReport({ id: `draft-${Date.now()}`, title: 'Foto laporan', createdAt: Date.now(), mediaUri: uri });
      setStatus('Foto tersimpan di folder privat aplikasi.');
    } catch {
      setStatus('Foto gagal disalin ke penyimpanan lokal.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 16) + 12, paddingBottom: Math.max(insets.bottom, 16) + 20 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>OFFLINE & PRIVASI</Text>
      <Text style={styles.title}>Data tetap aman di perangkat</Text>
      <Text style={styles.description}>Token, NIK, dan kredensial disimpan di Keychain/Android Keystore. Dokumen laporan berada di ruang privat aplikasi.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Penyimpanan sensitif</Text>
        {SECRET_KEYS.map(({ key, label, placeholder }) => (
          <View key={key} style={styles.secretRow}>
            <View style={styles.inputWrap}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                value={values[key]}
                onChangeText={(value) => setValues((current) => ({ ...current, [key]: value }))}
                placeholder={placeholder}
                secureTextEntry
                autoCapitalize="none"
                style={styles.input}
              />
            </View>
            <Pressable accessibilityRole="button" onPress={() => void saveSecret(key)} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>Simpan</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Dokumen & izin saat diperlukan</Text>
        <Text style={styles.helper}>Akses kamera baru diminta saat Anda menekan tombol foto. Media disalin ke documentDirectory aplikasi.</Text>
        <Pressable accessibilityRole="button" onPress={() => void pickPhoto()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Ambil foto laporan</Text>
        </Pressable>
        <Text style={styles.helper}>Lokasi diminta saat membuka peta. Tidak ada izin penyimpanan umum; pemilih kamera dan folder sistem memberi akses terpilih bila diperlukan.</Text>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { paddingHorizontal: 20, flexGrow: 1 },
  eyebrow: { color: '#0F766E', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#0F172A', fontSize: 25, lineHeight: 31, fontWeight: '800', marginTop: 7 },
  description: { color: '#64748B', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  sectionTitle: { color: '#0F172A', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  secretRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 12 },
  inputWrap: { flex: 1 },
  label: { color: '#475569', fontSize: 12, fontWeight: '600', marginBottom: 5 },
  input: { height: 44, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, color: '#0F172A', backgroundColor: '#F8FAFC' },
  smallButton: { height: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#0F766E' },
  smallButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  helper: { color: '#64748B', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  primaryButton: { height: 48, borderRadius: 12, backgroundColor: '#0F766E', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  status: { color: '#334155', fontSize: 13, lineHeight: 19, paddingHorizontal: 2 },
});
