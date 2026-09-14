/**
 * VDA Mobile — API Service Unit Tests (P0 Integration & Resilience)
 *
 * Validates:
 * - Auth token storage and lifecycle
 * - Local synthetic fallback when backend is unreachable
 * - Standardized FHIR R4 payload handling
 * - eSanjeevani deep-link launcher behavior
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiService } from '../api';
import { SYNTHETIC_PATIENTS } from '../../data/syntheticData';

describe('VDA Mobile — ApiService', () => {
  const patientData = SYNTHETIC_PATIENTS['synth-patient-001'];

  beforeEach(() => {
    localStorage.clear();
    apiService.clearAuthToken();
    vi.restoreAllMocks();
  });

  // ─── Token Management ──────────────────────────────────
  describe('Authentication Token Lifecycle', () => {
    it('should store and retrieve auth token in localStorage', () => {
      apiService.setAuthToken('test-jwt-token-123');
      expect(localStorage.getItem('vda_auth_token')).toBe('test-jwt-token-123');
    });

    it('should clear auth token from memory and localStorage', () => {
      apiService.setAuthToken('temp-token');
      apiService.clearAuthToken();
      expect(localStorage.getItem('vda_auth_token')).toBeNull();
    });

    it('should report backend is configured when base URL exists', () => {
      expect(apiService.isBackendConfigured()).toBe(true);
    });
  });

  // ─── Fallback Handling when Backend Offline ────────────
  describe('Graceful Fallback to Synthetic Data', () => {
    it('should fall back to local synthetic patients when backend fetch fails', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error: Connection refused'));

      const patients = await apiService.getPatients();
      expect(patients).toBeDefined();
      expect(patients.length).toBeGreaterThan(0);
      expect(patients[0].name).toBeDefined();
      expect(patients[0].abhaNumber).toBeDefined();
    });

    it('should fall back to local vdaEngine when backend turn endpoint fails', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Backend offline'));

      const result = await apiService.processVdaQuery(
        'What is my blood sugar?',
        patientData.demographics,
        patientData.medications,
        patientData.observations,
        'en'
      );

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.message.sender).toBe('vda');
      expect(result.message.text).toBeTruthy();
    });

    it('should return synthetic facility list', async () => {
      const facilities = await apiService.getFacilities();
      expect(facilities.length).toBeGreaterThan(0);
      expect(facilities[0].name).toBeDefined();
      expect(facilities[0].hasEmergency24x7).toBeDefined();
    });

    it('should return synthetic health schemes list', async () => {
      const schemes = await apiService.getSchemes();
      expect(schemes.length).toBeGreaterThan(0);
      expect(schemes.some(s => s.shortCode?.includes('PM') || s.name.includes('Ayushman'))).toBe(true);
    });

    it('should successfully acknowledge adherence toggle', async () => {
      const res = await apiService.toggleMedicationAdherence('med-001', true);
      expect(res.success).toBe(true);
    });

    it('should successfully acknowledge consent revocation', async () => {
      const res = await apiService.revokeConsent('consent-001');
      expect(res.success).toBe(true);
    });
  });

  // ─── Teleconsultation & eSanjeevani ─────────────────────
  describe('eSanjeevani Teleconsultation Launch', () => {
    it('should launch browser fallback when Capacitor native platform is unavailable', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      await apiService.openEsanjeevani();

      expect(openSpy).toHaveBeenCalledWith(
        'https://esanjeevani.mohfw.gov.in/#/patient/signin',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });
});
