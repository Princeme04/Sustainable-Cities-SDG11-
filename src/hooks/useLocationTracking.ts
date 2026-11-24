import * as Location from 'expo-location';
import { useCivicStore } from '../store/useCivicStore';

/** Starts location access only when the user explicitly opens the map feature. */
export async function requestLocationForMap(): Promise<void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  const store = useCivicStore.getState();
  if (status !== 'granted') {
    store.setPermissionStatus(status === 'denied' ? 'denied' : 'restricted');
    return;
  }
  store.setPermissionStatus('granted');
  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    store.setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
  } catch {
    // Keep the map usable with its fallback center if the fix is unavailable.
  }
}
