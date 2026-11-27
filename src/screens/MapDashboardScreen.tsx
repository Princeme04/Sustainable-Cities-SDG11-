import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Circle, Region } from 'react-native-maps';
import { useCivicStore } from '../store/useCivicStore';
import { requestLocationForMap } from '../hooks/useLocationTracking';
import { calculateHaversineDistance } from '../utils/spatial';
import { ReportMarker } from '../components/map/ReportMarker';
import { PermissionDeniedBanner } from '../components/map/PermissionDeniedBanner';
import { NearestReportHUD } from '../components/map/NearestReportHUD';
import type { Coordinates, CivicReport, RiskLevel } from '../types/civic';
import { reportSearch } from '../services/reportSearch';
import { connectRealtimeReports } from '../services/realtimeReports';

const MALANG_FALLBACK: Coordinates = {
  latitude: -7.9666,
  longitude: 112.6326,
};

const DEFAULT_DELTA = 0.035;

const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  MODERATE: 'rgba(255, 193, 7, 0.20)',
  HIGH: 'rgba(255, 87, 34, 0.25)',
  EXTREME: 'rgba(211, 47, 47, 0.30)',
};

const RISK_LEVEL_STROKE_COLORS: Record<RiskLevel, string> = {
  MODERATE: 'rgba(255, 193, 7, 0.60)',
  HIGH: 'rgba(255, 87, 34, 0.65)',
  EXTREME: 'rgba(211, 47, 47, 0.70)',
};

/**
 * Finds the report closest to the given coordinates.
 * Returns the report and its distance in meters, or null if no reports exist.
 */
function findNearestReport(
  origin: Coordinates,
  reports: CivicReport[],
): { report: CivicReport; distanceMeters: number } | null {
  if (reports.length === 0) return null;

  let nearestReport = reports[0];
  let shortestDistance = calculateHaversineDistance(origin, nearestReport.coordinates);

  for (let i = 1; i < reports.length; i++) {
    const distance = calculateHaversineDistance(origin, reports[i].coordinates);
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestReport = reports[i];
    }
  }

  return { report: nearestReport, distanceMeters: shortestDistance };
}

export default function MapDashboardScreen() {
  const userLocation = useCivicStore((s) => s.userLocation);
  const permissionStatus = useCivicStore((s) => s.locationPermissionStatus);
  const reports = useCivicStore((s) => s.reports);
  const reportsConnection = useCivicStore((s) => s.reportsConnection);
  const addReport = useCivicStore((s) => s.addReport);
  const setReportsConnection = useCivicStore((s) => s.setReportsConnection);
  const hazardZones = useCivicStore((s) => s.hazardZones);
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState('ALL');
  const [filteredReports, setFilteredReports] = useState(reports);

  useEffect(() => {
    reportSearch.publishReports(reports);
  }, [reports]);

  useEffect(() => {
    reportSearch.publishQuery({ text: searchText, category });
  }, [searchText, category]);

  useEffect(() => reportSearch.subscribe(setFilteredReports), []);

  useEffect(() => connectRealtimeReports(
    (report) => addReport(report),
    (status) => setReportsConnection(status),
  ), [addReport, setReportsConnection]);

  const mapRef = useRef<MapView>(null);
  const userLocationRef = useRef(userLocation);
  const hasAnimatedToUserRef = useRef(false);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  const mapCenter = userLocation ?? MALANG_FALLBACK;

  // Stable initial region computed once on mount to prevent MapView prop churn
  const initialRegion: Region = useMemo(
    () => ({
      latitude: (userLocation ?? MALANG_FALLBACK).latitude,
      longitude: (userLocation ?? MALANG_FALLBACK).longitude,
      latitudeDelta: DEFAULT_DELTA,
      longitudeDelta: DEFAULT_DELTA,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const nearestResult = useMemo(
    () => findNearestReport(mapCenter, reports),
    [mapCenter, reports],
  );

  // Stable onMapReady callback to prevent passing new references on every render
  const handleMapReady = useCallback(() => {
    if (userLocationRef.current && !hasAnimatedToUserRef.current && mapRef.current) {
      hasAnimatedToUserRef.current = true;
      mapRef.current.animateToRegion({
        latitude: userLocationRef.current.latitude,
        longitude: userLocationRef.current.longitude,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      });
    }
  }, []);

  // Animate once when user location becomes available after map is mounted
  useEffect(() => {
    if (userLocation && !hasAnimatedToUserRef.current && mapRef.current) {
      hasAnimatedToUserRef.current = true;
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      });
    }
  }, [userLocation]);

  // Memoize hazard zone circles to avoid recreating native elements on map renders
  const renderedHazardZones = useMemo(
    () =>
      hazardZones.map((zone) => (
        <Circle
          key={zone.id}
          center={zone.center}
          radius={zone.radiusMeters}
          fillColor={RISK_LEVEL_COLORS[zone.riskLevel]}
          strokeColor={RISK_LEVEL_STROKE_COLORS[zone.riskLevel]}
          strokeWidth={2}
        />
      )),
    [hazardZones],
  );

  // Memoize report markers to prevent re-instantiating marker components when user location moves
  const renderedMarkers = useMemo(
    () => filteredReports.map((report) => <ReportMarker key={report.id} report={report} />),
    [filteredReports],
  );

  const isPermissionDenied =
    permissionStatus === 'denied' || permissionStatus === 'restricted';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchPanel}>
        <TextInput value={searchText} onChangeText={setSearchText} placeholder="Cari laporan" style={styles.searchInput} returnKeyType="search" />
        <View style={styles.filterRow}>
          {['ALL', 'FLOOD', 'ROAD_DAMAGE', 'FALLEN_TREE', 'LANDSLIDE'].map((value) => (
            <Pressable key={value} onPress={() => setCategory(value)} style={[styles.filterChip, category === value && styles.filterChipActive]}>
              <Text style={[styles.filterText, category === value && styles.filterTextActive]}>{value === 'ALL' ? 'Semua' : value.replace('_', ' ')}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.connectionText}>
          {reportsConnection === 'live'
            ? '● Live WebSocket'
            : reportsConnection === 'simulated'
              ? '● Live Stream (Simulasi Real-Time)'
              : reportsConnection === 'connecting'
                ? '◌ Menghubungkan… · laporan tersimpan tetap tersedia'
                : '○ Offline · menampilkan laporan tersimpan'}
        </Text>
      </View>
      {permissionStatus === 'undetermined' && userLocation === null && (
        <View style={styles.locationPrompt}>
          <Text style={styles.promptTitle}>Gunakan lokasi Anda?</Text>
          <Text style={styles.promptBody}>Lokasi membantu memusatkan peta dan menghitung laporan terdekat.</Text>
          <Pressable accessibilityRole="button" onPress={() => void requestLocationForMap()} style={styles.locationButton}>
            <Text style={styles.locationButtonText}>Aktifkan lokasi</Text>
          </Pressable>
          <Text style={styles.fallbackText}>Peta tetap tersedia tanpa lokasi.</Text>
        </View>
      )}
      {isPermissionDenied && (
        <PermissionDeniedBanner status={permissionStatus as 'denied' | 'restricted'} />
      )}

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={!isPermissionDenied}
          showsMyLocationButton
          onMapReady={handleMapReady}
        >
          {renderedHazardZones}
          {renderedMarkers}
        </MapView>

        {nearestResult && (
          <NearestReportHUD
            report={nearestResult.report}
            distanceMeters={nearestResult.distanceMeters}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  locationPrompt: { backgroundColor: '#FFFFFF', margin: 14, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  searchPanel: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  searchInput: { height: 42, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 12, color: '#0F172A', backgroundColor: '#F8FAFC' },
  filterRow: { flexDirection: 'row', gap: 6, paddingVertical: 8, flexWrap: 'wrap' },
  filterChip: { backgroundColor: '#F1F5F9', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 6 },
  filterChipActive: { backgroundColor: '#CCFBF1' },
  filterText: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  filterTextActive: { color: '#0F766E' },
  connectionText: { color: '#64748B', fontSize: 11, marginTop: 2 },
  promptTitle: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  promptBody: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 5 },
  locationButton: { backgroundColor: '#0F766E', height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  locationButtonText: { color: '#FFFFFF', fontWeight: '700' },
  fallbackText: { color: '#64748B', fontSize: 12, marginTop: 8, textAlign: 'center' },
});
