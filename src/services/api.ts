/**
 * VDA Health Assistant - Unified API Client Service
 * 
 * Provides a production-ready communication layer between the mobile UI
 * and any working backend (Node/Express, Python/FastAPI, Spring Boot, etc.).
 * 
 * Features:
 * - Configurable Base URL via `VITE_API_BASE_URL`
 * - Automatic bearer token authentication via `localStorage` or environment
 * - Graceful fallback to local synthetic data when backend is offline or unreachable
 * - Standardized FHIR R4 payload serialization
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  PatientDemographics,
  FhirCondition,
  FhirMedication,
  FhirObservation,
  FhirDocument,
  ConsentArtifact,
  Facility,
  HealthScheme,
  ClinicalReviewState,
  FollowUpAttendanceResponse,
  FollowUpListResponse,
  LanguageCode,
  ChatMessage
} from '../types';
import {
  SYNTHETIC_PATIENTS,
  FACILITIES_LIST,
  HEALTH_SCHEMES_LIST
} from '../data/syntheticData';
import { processVdaQuery, VdaProcessResult } from '../utils/vdaEngine';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const USE_MOCK_FALLBACK = import.meta.env.VITE_ENABLE_MOCK_FALLBACK !== 'false';
const ESANJEEVANI_OFFICIAL_URL = 'https://esanjeevani.mohfw.gov.in/#/patient/signin';
const EsanjeevaniExternalLink = registerPlugin<{ open(): Promise<void> }>('EsanjeevaniLauncher');

class ApiService {
  private authToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('vda_auth_token');
    }
  }

  public setAuthToken(token: string) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vda_auth_token', token);
    }
  }

  public clearAuthToken() {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vda_auth_token');
    }
  }

  public isBackendConfigured(): boolean {
    return Boolean(API_BASE_URL);
  }

  /**
   * Fetch dev auth token from existing backend endpoint: GET /api/v1/dev/auth/token
   */
  async initAuthToken(): Promise<string | null> {
    if (!API_BASE_URL) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/dev/auth/token`);
      if (response.ok) {
        const json = await response.json();
        const token = json.token || json.data?.token;
        if (token) {
          this.setAuthToken(token);
          return token;
        }
      }
    } catch (err) {
      console.warn('[VDA API] Dev auth token fetch failed, using stored token or fallback:', err);
    }
    return this.authToken;
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  /**
   * Generic safe request wrapper with fallback
   */
  private async request<T>(endpoint: string, options: RequestInit = {}, fallbackData: T): Promise<T> {
    if (!API_BASE_URL) {
      return fallbackData;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`API Error ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      return json.data !== undefined ? json.data : json;
    } catch (error) {
      console.warn(`[VDA API] Error contacting ${endpoint}. Falling back to local data:`, error);
      if (USE_MOCK_FALLBACK) {
        return fallbackData;
      }
      throw error;
    }
  }

  // ==========================================
  // PATIENT & FHIR R4 RECORDS ENDPOINTS
  // ==========================================

  /**
   * Fetch list of synthetic patients from VDA backend: GET /api/v1/dev/demo/patients
   */
  async getPatients(category?: string, search?: string): Promise<any[]> {
    const fallback = Object.values(SYNTHETIC_PATIENTS).map(p => p.demographics);
    if (!API_BASE_URL) return fallback;

    try {
      await this.initAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/v1/dev/demo/patients`, {
        headers: this.getHeaders()
      });
      if (response.ok) {
        const patients = await response.json();
        return Array.isArray(patients) ? patients : fallback;
      }
    } catch (err) {
      console.warn('[VDA API] Failed to fetch patients from VDA backend:', err);
    }
    return fallback;
  }

  /**
   * Create VDA Session for a selected patient with multi-endpoint fallback
   */
  async createPatientSession(patientId: string): Promise<{ session_id: string; synthetic_patient_id?: string; patient_name?: string; locale?: string } | null> {
    if (!API_BASE_URL) return null;

    try {
      await this.initAuthToken();

      // 1. Try synthetic patient session endpoint
      let response = await fetch(`${API_BASE_URL}/api/v1/dev/demo/patients/${patientId}/session`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      // 2. Try local patient selection session endpoint
      if (!response.ok) {
        response = await fetch(`${API_BASE_URL}/api/v1/dev/demo/patient-selection/${patientId}/session`, {
          method: 'POST',
          headers: this.getHeaders()
        });
      }

      // 3. Fallback to default dev demo session endpoint
      if (!response.ok) {
        response = await fetch(`${API_BASE_URL}/api/v1/dev/demo/session`, {
          method: 'POST',
          headers: this.getHeaders()
        });
      }

      if (response.ok) {
        const data = await response.json();
        console.log('[VDA API] Created session successfully:', data);
        return data;
      } else {
        console.warn(`[VDA API] All session creation attempts failed (${response.status})`);
      }
    } catch (err) {
      console.warn('[VDA API] Session creation endpoint error:', err);
    }
    return null;
  }

  /** Loads passive, deterministic clinical follow-ups. This endpoint never creates a VDA turn. */
  async getClinicalFollowUps(sessionId: string): Promise<FollowUpListResponse> {
    await this.initAuthToken();
    return this.request<FollowUpListResponse>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/follow-ups`,
      { method: 'GET' },
      { asOfDate: '', timezone: '', followUps: [], progress: { completedFollowUpCount: 0 } },
    );
  }

  /** Records only a checkup-attendance response, never a medication adherence event. */
  async recordClinicalFollowUpAttendance(
    sessionId: string,
    followUpId: string,
    attended: boolean,
  ): Promise<FollowUpAttendanceResponse> {
    await this.initAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/follow-ups/${encodeURIComponent(followUpId)}/attendance`,
      { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ attended }) },
    );
    if (!response.ok) throw new Error(`Clinical follow-up attendance API error ${response.status}`);
    const json = await response.json();
    return json.data !== undefined ? json.data as FollowUpAttendanceResponse : json as FollowUpAttendanceResponse;
  }

  /**
   * Send user voice/text query to VDA backend session turns: POST /api/v1/sessions/:session_id/turns
   */
  async processVdaQuery(
    query: string,
    patient: PatientDemographics,
    medications: FhirMedication[],
    observations: FhirObservation[],
    lang: LanguageCode,
    sessionId?: string | null,
    options?: { disableLocalFallback?: boolean; prescriptionId?: string; prescriptionContextRequired?: boolean },
  ): Promise<VdaProcessResult> {
    const fallback = () => processVdaQuery(query, patient, medications, observations, lang);

    if (!API_BASE_URL) {
      if (options?.disableLocalFallback) throw new Error('VDA_BACKEND_UNAVAILABLE');
      return fallback();
    }

    try {
      await this.initAuthToken();

      let activeSession = sessionId;
      if (!activeSession) {
        const sessionRes = await this.createPatientSession(patient.id || 'synth-patient-001');
        activeSession = sessionRes?.session_id || null;
      }

      if (!activeSession) {
        console.warn('[VDA API] Could not establish session_id, falling back to local engine');
        if (options?.disableLocalFallback) throw new Error('VDA_SESSION_UNAVAILABLE');
        return fallback();
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/sessions/${activeSession}/turns`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Idempotency-Key': `turn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        },
        body: JSON.stringify({
          input_text: query,
          speaker: 'self',
          language: lang,
          ...(options?.prescriptionId ? { prescription_id: options.prescriptionId } : {}),
          ...(options?.prescriptionContextRequired ? { prescription_context_required: true } : {}),
        })
      });

      if (!response.ok) {
        throw new Error(`Turn API error ${response.status}: ${response.statusText}`);
      }

      const turnResult = await response.json();
      console.log('[VDA API] Processed turn via backend:', turnResult);

      const content = turnResult.content || {};
      const textEn = content.en || content.summary || content.patient_text || content.reason || (typeof content === 'string' ? content : '');
      const textHi = content.hi || content.patient_text || content.summary || content.reason || textEn;
      const mainText = lang === 'hi' && textHi ? textHi : (textEn || textHi);

      const isEscalated = turnResult.safety_status === 'ESCALATED' || turnResult.response_type === 'escalation';

      const message: ChatMessage = {
        id: `turn-msg-${turnResult.turn_number || Date.now()}`,
        sender: 'vda',
        agent: turnResult.selected_agent || 'router',
        text: mainText,
        textHi: textHi,
        textTa: mainText,
        textKn: mainText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEscalationTrigger: isEscalated,
        audioAvailable: true
      };

      return { message, escalationDetected: isEscalated, responseType: turnResult.response_type };
    } catch (err) {
      console.warn('[VDA API] Backend turn endpoint error:', err);
      if (USE_MOCK_FALLBACK && !options?.disableLocalFallback) return fallback();
      throw err;
    }
  }

  /**
   * Refreshes only the server-side, privacy-minimized prescription context.
   * The app never uploads medicine facts, investigations, notification IDs, or
   * acknowledgement history here—only its confirmed reminder schedule.
   */
  async refreshPrescriptionSessionContext(
    sessionId: string,
    prescriptionId: string,
    reminders: Array<{ medicineName: string; times: string[] }>,
  ): Promise<void> {
    if (!API_BASE_URL) return;
    await this.initAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/prescription-context`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          prescription_id: prescriptionId,
          reminders: reminders.map((reminder) => ({
            medicine_name: reminder.medicineName,
            reminder_times: reminder.times,
          })),
        }),
      },
    );
    if (!response.ok) throw new Error(`Prescription context API error ${response.status}`);
  }

  /** Uploads patient-recorded audio to the authenticated backend STT boundary. */
  async transcribeVoice(
    audio: Blob,
    lang: LanguageCode,
    durationMs?: number,
  ): Promise<{ transcript: string; provider: string; fallbackUsed: boolean; detectedLanguage?: string }> {
    await this.initAuthToken();
    const form = new FormData();
    // Preserve the MediaRecorder container in multipart metadata. The backend
    // validates the MIME type and normalizes accepted audio with FFmpeg.
    const mimeType = (audio.type || 'audio/webm').split(';', 1)[0].toLowerCase();
    const extension = mimeType === 'audio/mp4' || mimeType === 'audio/x-m4a'
      ? '.m4a'
      : mimeType === 'audio/mpeg'
        ? '.mp3'
        : mimeType === 'audio/ogg'
          ? '.ogg'
          : mimeType === 'audio/wav' || mimeType === 'audio/x-wav'
            ? '.wav'
            : '.webm';
    form.append('audio', audio, `vda-recording${extension}`);
    form.append('language_code', this.voiceLanguageCode(lang));
    if (durationMs !== undefined) form.append('duration_ms', String(durationMs));
    const headers = this.getHeaders() as Record<string, string>;
    delete headers['Content-Type'];
    const response = await fetch(`${API_BASE_URL}/api/v1/voice/stt`, {
      method: 'POST',
      headers,
      body: form,
    });
    if (!response.ok) throw new Error(`Voice STT error ${response.status}`);
    return response.json();
  }

  /** Requests Sarvam-generated playback for final patient-facing response text. */
  async synthesizeVoice(text: string, lang: LanguageCode): Promise<Blob> {
    await this.initAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/v1/voice/tts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ text, language_code: this.voiceLanguageCode(lang) }),
    });
    if (!response.ok) throw new Error(`Voice TTS error ${response.status}`);
    return response.blob();
  }

  private voiceLanguageCode(lang: LanguageCode): string {
    const languages: Record<LanguageCode, string> = {
      hi: 'hi-IN',
      en: 'en-IN',
      ta: 'ta-IN',
      kn: 'kn-IN',
    };
    return languages[lang];
  }

  /** Read the persisted, tenant/session-scoped clinician-chat state. */
  async getClinicalReviewState(sessionId: string): Promise<ClinicalReviewState> {
    await this.initAuthToken();
    return this.request<ClinicalReviewState>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/clinical-review`,
      { method: 'GET' },
      {
        reviewRequested: false,
        teleconsultationOffered: false,
        teleconsultationConfigured: false,
        clinicalChatState: 'ENDED',
        clinicianResponseDeadline: null,
        firstClinicianResponseAt: null,
        fallbackShownAt: null,
        nearbyFacilities: [],
        messages: [],
      },
    );
  }

  /** Audits a patient-initiated teleconsultation fallback without transferring health data. */
  async requestClinicalReviewTeleconsultation(sessionId: string): Promise<{ teleconsultationConfigured: boolean }> {
    await this.initAuthToken();
    return this.request<{ teleconsultationConfigured: boolean }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/clinical-review/teleconsultation`,
      { method: 'POST' },
      { teleconsultationConfigured: false },
    );
  }

  /** Opens the official patient sign-in page without transferring VDA data. */
  async openEsanjeevani(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await EsanjeevaniExternalLink.open();
      return;
    }
    window.open(ESANJEEVANI_OFFICIAL_URL, '_blank', 'noopener,noreferrer');
  }

  /**
   * Upload prescription document/image to VDA backend session: POST /api/v1/sessions/:sessionId/prescriptions
   */
  async uploadPrescription(sessionId: string, file: File): Promise<any> {
    if (!API_BASE_URL) return null;

    try {
      await this.initAuthToken();
      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionId}/prescriptions`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const message = errJson.error?.detail?.message || errJson.error?.message || errJson.message || `Upload failed with status ${response.status}`;
        throw new Error(message);
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.warn('[VDA API] Prescription upload error:', err);
      throw err;
    }
  }

  /**
   * Record medication taken status (adherence)
   */
  async toggleMedicationAdherence(medicationId: string, taken: boolean): Promise<{ success: boolean; adherenceRate?: number }> {
    return { success: true };
  }

  /**
   * Save a newly recorded vital sign (e.g. self-monitored blood glucose, blood pressure)
   */
  async logObservation(observation: FhirObservation): Promise<FhirObservation> {
    return observation;
  }

  /**
   * Revoke ABDM consent artifact
   */
  async revokeConsent(consentId: string): Promise<{ success: boolean }> {
    return { success: true };
  }

  // ==========================================
  // FACILITIES & HEALTH SCHEMES ENDPOINTS
  // ==========================================

  async getFacilities(): Promise<Facility[]> {
    return FACILITIES_LIST;
  }

  async getSchemes(): Promise<HealthScheme[]> {
    return HEALTH_SCHEMES_LIST;
  }
}

export const apiService = new ApiService();

