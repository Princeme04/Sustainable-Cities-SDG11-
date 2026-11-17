import React, { useMemo, useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Circle, Region } from 'react-native-maps';
import { useCivicStore } from '../store/useCivicStore';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { calculateHaversineDistance } from '../utils/spatial';
import { ReportMarker } from '../components/map/ReportMarker';
import { MapLoadingSkeleton } from '../components/map/MapLoadingSkeleton';
import { PermissionDeniedBanner } from '../components/map/PermissionDeniedBanner';
import { NearestReportHUD } from '../components/map/NearestReportHUD';
import type { Coordinates, CivicReport, RiskLevel } from '../types/civic';

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
  useLocationTracking();

  const userLocation = useCivicStore((s) => s.userLocation);
  const permissionStatus = useCivicStore((s) => s.locationPermissionStatus);
  const reports = useCivicStore((s) => s.reports);
  const hazardZones = useCivicStore((s) => s.hazardZones);

  const mapRef = useRef<MapView>(null);

  const mapCenter = userLocation ?? MALANG_FALLBACK;

  const initialRegion: Region = useMemo(
    () => ({
      latitude: mapCenter.latitude,
      longitude: mapCenter.longitude,
      latitudeDelta: DEFAULT_DELTA,
      longitudeDelta: DEFAULT_DELTA,
    }),
    [mapCenter.latitude, mapCenter.longitude],
  );

  const nearestResult = useMemo(
    () => findNearestReport(mapCenter, reports),
    [mapCenter.latitude, mapCenter.longitude, reports],
  );

  const handleMapReady = useCallback(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      });
    }
  }, [userLocation]);

  const isPermissionDenied =
    permissionStatus === 'denied' || permissionStatus === 'restricted';

  const isAcquiringLock =
    permissionStatus === 'undetermined' && userLocation === null;

  if (isAcquiringLock) {
    return (
      <SafeAreaView style={styles.container}>
        <MapLoadingSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
          {hazardZones.map((zone) => (
            <Circle
              key={zone.id}
              center={zone.center}
              radius={zone.radiusMeters}
              fillColor={RISK_LEVEL_COLORS[zone.riskLevel]}
              strokeColor={RISK_LEVEL_STROKE_COLORS[zone.riskLevel]}
              strokeWidth={2}
            />
          ))}

          {reports.map((report) => (
            <ReportMarker key={report.id} report={report} />
          ))}
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
});
