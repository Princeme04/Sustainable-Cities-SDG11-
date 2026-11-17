import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PermissionDeniedBannerProps {
  status: 'denied' | 'restricted';
}

/**
 * Non-blocking banner displayed when location permission is denied
 * or restricted. The map still renders with fallback coordinates.
 */
export function PermissionDeniedBanner({ status }: PermissionDeniedBannerProps) {
  const message =
    status === 'denied'
      ? 'Location permission denied. Showing default area.'
      : 'Location services are restricted on this device.';

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B',
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    color: '#92400E',
    textAlign: 'center',
  },
});
