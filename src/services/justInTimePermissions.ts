import * as Camera from 'expo-camera';
import * as Location from 'expo-location';

export type JustInTimePermission = 'granted' | 'denied' | 'restricted';

function normalize(status: string): JustInTimePermission {
  if (status === 'granted') return 'granted';
  return status === 'denied' ? 'denied' : 'restricted';
}

export const justInTimePermissions = {
  async requestCamera(): Promise<JustInTimePermission> {
    const result = await Camera.Camera.requestCameraPermissionsAsync();
    return normalize(result.status);
  },
  async requestLocation(): Promise<JustInTimePermission> {
    const result = await Location.requestForegroundPermissionsAsync();
    return normalize(result.status);
  },
};
