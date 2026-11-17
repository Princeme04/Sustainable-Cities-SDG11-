import { useState, useEffect, useCallback } from 'react';
import {
  useCivicStore,
  useReporterIdentity,
  useIsVaultUnlocked,
} from '../store/useCivicStore';
import type { ReporterIdentity } from '../types/civic';

const REQUIRED_NIK_DIGITS = 16;
const NIK_REGEX = /^\d{16}$/;
const PREFIX_VISIBLE_COUNT = 6;
const SUFFIX_VISIBLE_COUNT = 4;

/**
 * Creates a masked NIK string (e.g., "357301******0001") for safe UI presentation.
 */
function maskNik(rawNik: string): string {
  const prefix = rawNik.slice(0, PREFIX_VISIBLE_COUNT);
  const suffix = rawNik.slice(rawNik.length - SUFFIX_VISIBLE_COUNT);
  return `${prefix}******${suffix}`;
}

/**
 * Validates Indonesian NIK format strictly.
 */
function isValidNikFormat(rawNik: string): boolean {
  return rawNik.length === REQUIRED_NIK_DIGITS && NIK_REGEX.test(rawNik);
}

/**
 * Generates an ISO-formatted mock token representing cryptographic enrollment.
 */
function generateMockAuthToken(reporterId: string): string {
  return `cp_sec_${reporterId}_${Date.now()}`;
}

/**
 * Custom hook isolating authentication, vault hydration, and reporter registration.
 */
export function useSecureIdentity() {
  const reporterIdentity = useReporterIdentity();
  const isVaultUnlocked = useIsVaultUnlocked();

  const hydrateIdentityFromVault = useCivicStore(
    (state) => state.hydrateIdentityFromVault,
  );
  const registerReporterSession = useCivicStore(
    (state) => state.registerReporterSession,
  );
  const logoutAndPurgeVault = useCivicStore(
    (state) => state.logoutAndPurgeVault,
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const hydrateVault = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await hydrateIdentityFromVault();
    } catch {
      setError('Unable to unlock secure vault on this device.');
    } finally {
      setIsLoading(false);
    }
  }, [hydrateIdentityFromVault]);

  useEffect(() => {
    hydrateVault();
  }, [hydrateVault]);

  const registerIdentity = useCallback(
    async (fullName: string, rawNik: string): Promise<boolean> => {
      const trimmedName = fullName.trim();
      const sanitizedNik = rawNik.trim();

      if (!trimmedName) {
        setError('Full name is required for verified reporting.');
        return false;
      }

      if (!isValidNikFormat(sanitizedNik)) {
        setError('NIK must be exactly 16 numeric digits.');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const reporterId = `rep_${Date.now()}`;
        const newIdentity: ReporterIdentity = {
          reporterId,
          fullName: trimmedName,
          nikMasked: maskNik(sanitizedNik),
          authToken: generateMockAuthToken(reporterId),
          verifiedAt: new Date().toISOString(),
        };

        await registerReporterSession(newIdentity, sanitizedNik);
        return true;
      } catch {
        setError('Hardware secure store failure. Unable to persist identity.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [registerReporterSession],
  );

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await logoutAndPurgeVault();
    } catch {
      setError('Failed to purge device security vault.');
    } finally {
      setIsLoading(false);
    }
  }, [logoutAndPurgeVault]);

  return {
    reporterIdentity,
    isVaultUnlocked,
    isLoading,
    error,
    clearError,
    registerIdentity,
    logout,
    hydrateVault,
  };
}
