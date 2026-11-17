import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CivicReport, DisasterCategory } from '../../types/civic';

interface NearestReportHUDProps {
  report: CivicReport;
  distanceMeters: number;
}

const CATEGORY_ICONS: Record<DisasterCategory, string> = {
  FLOOD: '🌊',
  ROAD_DAMAGE: '🚧',
  FALLEN_TREE: '🌳',
  LANDSLIDE: '⛰️',
};

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Bottom HUD card showing the nearest civic report and its
 * real-time Haversine distance from the user's location.
 */
export function NearestReportHUD({ report, distanceMeters }: NearestReportHUDProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{CATEGORY_ICONS[report.category]}</Text>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {report.title}
        </Text>
        <Text style={styles.meta}>
          {report.category.replace('_', ' ')} · {report.severity}
        </Text>
      </View>

      <View style={styles.distanceContainer}>
        <Text style={styles.distanceValue}>{formatDistance(distanceMeters)}</Text>
        <Text style={styles.distanceLabel}>away</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  meta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  distanceContainer: {
    alignItems: 'flex-end',
  },
  distanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
  },
  distanceLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
