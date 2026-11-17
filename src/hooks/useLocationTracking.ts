import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { useCivicStore } from '../store/useCivicStore';
import { isWithinHazardZone } from '../utils/spatial';
import type { Coordinates, HazardZone } from '../types/civic';

const NORMAL_DISTANCE_INTERVAL_METERS = 10;
const HAZARD_DISTANCE_INTERVAL_METERS = 5;

/**
 * Picks the tighter tracking interval when the user is inside any
 * hazard zone, otherwise uses the normal interval.
 */
function resolveDistanceInterval(
  userCoord: Coordinates,
  hazardZones: HazardZone[],
): number {
  const insideHazard = hazardZones.some((zone) =>
    isWithinHazardZone(userCoord, zone),
  );
  return insideHazard
    ? HAZARD_DISTANCE_INTERVAL_METERS
    : NORMAL_DISTANCE_INTERVAL_METERS;
}

/**
 * Foreground location tracking hook.
 *
 * - Requests permission, surfacing denial/restriction states via the store.
 * - Watches position with an adaptive distance interval (tighter inside
 *   hazard zones).
 * - Cleans up the subscription on unmount to prevent memory leaks.
 */
export function useLocationTracking(): void {
  const setUserLocation = useCivicStore((s) => s.setUserLocation);
  const setPermissionStatus = useCivicStore((s) => s.setPermissionStatus);
  const hazardZones = useCivicStore((s) => s.hazardZones);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const hazardZonesRef = useRef(hazardZones);
  hazardZonesRef.current = hazardZones;

  const startWatching = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      setPermissionStatus(status === 'denied' ? 'denied' : 'restricted');
      return;
    }

    setPermissionStatus('granted');

    // Seed an initial position for the first render frame
    const initialPosition = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const initialCoord: Coordinates = {
      latitude: initialPosition.coords.latitude,
      longitude: initialPosition.coords.longitude,
    };
    setUserLocation(initialCoord);

    const distanceInterval = resolveDistanceInterval(
      initialCoord,
      hazardZonesRef.current,
    );

    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval,
      },
      (locationUpdate) => {
        const updatedCoord: Coordinates = {
          latitude: locationUpdate.coords.latitude,
          longitude: locationUpdate.coords.longitude,
        };
        setUserLocation(updatedCoord);
      },
    );
  }, [setUserLocation, setPermissionStatus]);

  useEffect(() => {
    startWatching();

    return () => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [startWatching]);
}
