import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import type { CivicReport, DisasterCategory } from '../../types/civic';

interface ReportMarkerProps {
  report: CivicReport;
}

const CATEGORY_COLORS: Record<DisasterCategory, string> = {
  FLOOD: '#2196F3',
  ROAD_DAMAGE: '#FF9800',
  FALLEN_TREE: '#4CAF50',
  LANDSLIDE: '#9C27B0',
};

const CATEGORY_LABELS: Record<DisasterCategory, string> = {
  FLOOD: '🌊',
  ROAD_DAMAGE: '🚧',
  FALLEN_TREE: '🌳',
  LANDSLIDE: '⛰️',
};

function ReportMarkerInner({ report }: ReportMarkerProps) {
  const pinColor = CATEGORY_COLORS[report.category];

  return (
    <Marker
      coordinate={report.coordinates}
      pinColor={pinColor}
      tracksViewChanges={false}
    >
      <View style={[styles.markerBubble, { backgroundColor: pinColor }]}>
        <Text style={styles.markerEmoji}>
          {CATEGORY_LABELS[report.category]}
        </Text>
      </View>

      <Callout tooltip>
        <View style={styles.calloutContainer}>
          <Text style={styles.calloutTitle}>{report.title}</Text>
          <Text style={styles.calloutMeta}>
            {report.category.replace('_', ' ')} · {report.severity}
          </Text>
        </View>
      </Callout>
    </Marker>
  );
}

function arePropsEqual(
  prev: ReportMarkerProps,
  next: ReportMarkerProps,
): boolean {
  const p = prev.report;
  const n = next.report;
  return (
    p.id === n.id &&
    p.title === n.title &&
    p.category === n.category &&
    p.severity === n.severity &&
    p.coordinates.latitude === n.coordinates.latitude &&
    p.coordinates.longitude === n.coordinates.longitude
  );
}

export const ReportMarker = React.memo(ReportMarkerInner, arePropsEqual);

const styles = StyleSheet.create({
  markerBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerEmoji: {
    fontSize: 18,
  },
  calloutContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    minWidth: 160,
    maxWidth: 240,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  calloutMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
});
