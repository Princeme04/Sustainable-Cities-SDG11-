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
  const [tracksViewChanges, setTracksViewChanges] = React.useState(true);
  const pinColor = CATEGORY_COLORS[report.category];

  // Stop tracking view changes after the initial render snapshot to prevent excessive map re-renders
  React.useEffect(() => {
    if (tracksViewChanges) {
      const timer = setTimeout(() => {
        setTracksViewChanges(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [tracksViewChanges]);

  // Re-enable tracking briefly if visual report data updates
  const prevReportRef = React.useRef(report);
  React.useEffect(() => {
    if (
      prevReportRef.current.category !== report.category ||
      prevReportRef.current.title !== report.title ||
      prevReportRef.current.severity !== report.severity ||
      prevReportRef.current.coordinates.latitude !== report.coordinates.latitude ||
      prevReportRef.current.coordinates.longitude !== report.coordinates.longitude
    ) {
      prevReportRef.current = report;
      setTracksViewChanges(true);
    }
  }, [report]);

  const bubbleStyle = React.useMemo(
    () => [styles.markerBubble, { backgroundColor: pinColor }],
    [pinColor],
  );

  return (
    <Marker
      identifier={report.id}
      coordinate={report.coordinates}
      pinColor={pinColor}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={bubbleStyle}>
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
