import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

/**
 * Pulsing skeleton shown while acquiring the initial GPS lock.
 * Pure presentational component with zero logic dependencies.
 */
export function MapLoadingSkeleton() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={styles.label}>Acquiring GPS lock…</Text>
      <Text style={styles.sublabel}>
        Please ensure location services are enabled
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  label: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  sublabel: {
    marginTop: 6,
    fontSize: 13,
    color: '#94A3B8',
  },
});
