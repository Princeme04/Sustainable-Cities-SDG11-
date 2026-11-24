import * as SecureStore from 'expo-secure-store';

export type SensitiveCredential = 'authToken' | 'nik' | 'credentials';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Stores small secrets in the platform Keychain / Android Keystore. */
export const secureVault = {
  get(key: SensitiveCredential): Promise<string | null> {
    return SecureStore.getItemAsync(key, OPTIONS);
  },
  set(key: SensitiveCredential, value: string): Promise<void> {
    return SecureStore.setItemAsync(key, value, OPTIONS);
  },
  remove(key: SensitiveCredential): Promise<void> {
    return SecureStore.deleteItemAsync(key, OPTIONS);
  },
};
