import * as SecureStore from 'expo-secure-store';
import type { ReporterIdentity } from '../../types/civic';

/**
 * Storage keys for encrypted vault items.
 * Kept private to this service module.
 */
const VAULT_KEY_PROFILE = 'civicpulse_vault_reporter_profile';
const VAULT_KEY_AUTH_TOKEN = 'civicpulse_vault_auth_token';
const VAULT_KEY_RAW_NIK = 'civicpulse_vault_raw_nik';

/**
 * Hardware-backed keychain accessibility configuration.
 * Data is only decrypted when the device is unlocked and never backed up to iCloud/cloud backups.
 */
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Custom domain error to prevent leaking raw cryptographic stack traces.
 */
export class SecurityVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityVaultError';
  }
}

/**
 * Profile metadata payload stored without the auth token or raw NIK.
 */
interface StoredProfileMetadata {
  reporterId: string;
  fullName: string;
  nikMasked: string;
  verifiedAt: string;
}

/**
 * Checks whether hardware-backed secure storage is accessible on the current device.
 */
export async function isVaultAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Stores reporter credentials securely.
 * The raw NIK and authorization token are split into distinct encrypted keys.
 * Raw values are never logged or exposed.
 */
export async function saveReporterCredentials(
  identity: ReporterIdentity,
  rawNik: string,
): Promise<void> {
  if (!identity.reporterId || !identity.authToken || !rawNik) {
    throw new SecurityVaultError('Cannot store incomplete reporter credentials.');
  }

  try {
    const profileMetadata: StoredProfileMetadata = {
      reporterId: identity.reporterId,
      fullName: identity.fullName,
      nikMasked: identity.nikMasked,
      verifiedAt: identity.verifiedAt,
    };

    await Promise.all([
      SecureStore.setItemAsync(
        VAULT_KEY_PROFILE,
        JSON.stringify(profileMetadata),
        SECURE_STORE_OPTIONS,
      ),
      SecureStore.setItemAsync(
        VAULT_KEY_AUTH_TOKEN,
        identity.authToken,
        SECURE_STORE_OPTIONS,
      ),
      SecureStore.setItemAsync(
        VAULT_KEY_RAW_NIK,
        rawNik,
        SECURE_STORE_OPTIONS,
      ),
    ]);
  } catch (error) {
    throw new SecurityVaultError('Failed to encrypt and persist credentials to secure vault.');
  }
}

/**
 * Retrieves non-sensitive reporter profile joined with the decrypted auth token.
 * Returns null if no active session is found in the vault.
 */
export async function getReporterIdentity(): Promise<ReporterIdentity | null> {
  try {
    const [serializedProfile, authToken] = await Promise.all([
      SecureStore.getItemAsync(VAULT_KEY_PROFILE, SECURE_STORE_OPTIONS),
      SecureStore.getItemAsync(VAULT_KEY_AUTH_TOKEN, SECURE_STORE_OPTIONS),
    ]);

    if (!serializedProfile || !authToken) {
      return null;
    }

    const metadata: StoredProfileMetadata = JSON.parse(serializedProfile);

    return {
      reporterId: metadata.reporterId,
      fullName: metadata.fullName,
      nikMasked: metadata.nikMasked,
      authToken,
      verifiedAt: metadata.verifiedAt,
    };
  } catch (error) {
    throw new SecurityVaultError('Failed to read reporter identity from secure vault.');
  }
}

/**
 * Decrypts and retrieves raw citizen NIK on demand.
 * Should only be called when constructing an official signed report payload.
 */
export async function getDecryptedNik(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(VAULT_KEY_RAW_NIK, SECURE_STORE_OPTIONS);
  } catch (error) {
    throw new SecurityVaultError('Failed to retrieve citizen NIK from secure vault.');
  }
}

/**
 * Clears all reporter credentials and security tokens from the device vault.
 */
export async function clearSecurityVault(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(VAULT_KEY_PROFILE, SECURE_STORE_OPTIONS),
      SecureStore.deleteItemAsync(VAULT_KEY_AUTH_TOKEN, SECURE_STORE_OPTIONS),
      SecureStore.deleteItemAsync(VAULT_KEY_RAW_NIK, SECURE_STORE_OPTIONS),
    ]);
  } catch (error) {
    throw new SecurityVaultError('Failed to purge security vault.');
  }
}
