// Types conforming to ABDM & FHIR R4 standard structures for VDA

export type LanguageCode = 'hi' | 'en' | 'ta' | 'kn';

export type GoldCategoryCode =
  | 'NCD_GLUCOSE_BP'
  | 'PRESCRIPTION_INTERPRETATION'
  | 'LAB_EXPLANATION'
  | 'EMERGENCY_ESCALATION'
  | 'SCHEME_BENEFITS'
  | 'FACILITY_SEARCH'
  | 'MULTILINGUAL_PARITY';

export interface GoldPatientSummary {
  id: string; // e.g. "synth-patient-001"
  abhaNumber: string; // Non-issuable namespace: 98-XXXX-XXXX-XXXX
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  language: string;
  state: string; // Himachal Pradesh | Haryana
  district: string;
  goldCategory: string;
  categoryCode: GoldCategoryCode;
  conditions: string[];
  medications: {
    name: string;
    dosage: string;
  }[];
  labs: {
    name: string;
    value: string;
    unit: string;
  }[];
  pmjayEligible: boolean;
  escalationTriggered: boolean;
  bundlePath?: string;
}

export interface PatientDemographics {
  id: string;
  name: string;
  nameHi?: string;
  nameTa?: string;
  nameKn?: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  abhaNumber: string; // Non-issuable format 98-XXXX-XXXX-XXXX
  abhaAddress: string; // e.g. vijay.chauhan@abdm
  phone: string;
  bloodGroup: string;
  district: string;
  districtHi?: string;
  districtTa?: string;
  districtKn?: string;
  state: string;
  goldCategory?: string;
  categoryCode?: GoldCategoryCode;
  pmjayEligible?: boolean;
  escalationTriggered?: boolean;
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  };
  ayushmanCardNumber?: string;
  photoUrl?: string;
}

export interface FhirCondition {
  id: string;
  code: string; // SNOMED CT or ICD-10
  display: string;
  displayHi?: string;
  displayTa?: string;
  displayKn?: string;
  clinicalStatus: 'active' | 'recurrence' | 'relapse' | 'remission' | 'resolved';
  verificationStatus: 'confirmed' | 'provisional';
  severity: 'mild' | 'moderate' | 'severe';
  onsetDateTime: string;
  recordedDate: string;
  sourceFacility: string;
  doctorName?: string;
  notes?: string;
  notesHi?: string;
  notesTa?: string;
  notesKn?: string;
}

export interface FhirMedication {
  id: string;
  name: string;
  nameHi?: string;
  nameTa?: string;
  nameKn?: string;
  code: string; // RxNorm / SNOMED CT
  dosage: string;
  dosageHi?: string;
  dosageTa?: string;
  dosageKn?: string;
  frequency: string;
  frequencyHi?: string;
  frequencyTa?: string;
  frequencyKn?: string;
  timing: 'before_meal' | 'after_meal' | 'with_meal' | 'anytime';
  timingHi?: string;
  timingTa?: string;
  timingKn?: string;
  prescribedDate: string;
  duration: string;
  refillCount: number;
  totalDays: number;
  daysRemaining: number;
  sourceFacility: string;
  takenToday: boolean;
  timeOfDay: string[]; // e.g. ['08:00 AM', '08:00 PM']
  adherenceRate: number; // percentage e.g. 92
}

export interface FhirObservation {
  id: string;
  code: string; // LOINC code e.g. 4548-4 for HbA1c
  display: string;
  displayHi?: string;
  displayTa?: string;
  displayKn?: string;
  category: 'vital-signs' | 'laboratory';
  value: number;
  unit: string;
  interpretation: 'normal' | 'high' | 'critical-high' | 'low' | 'critical-low';
  referenceRange: string;
  effectiveDateTime: string;
  sourceFacility: string;
  history?: { date: string; value: number }[];
  clinicalMeaning?: string;
  clinicalMeaningHi?: string;
  clinicalMeaningTa?: string;
  clinicalMeaningKn?: string;
}

export interface FhirDocument {
  id: string;
  title: string;
  titleHi?: string;
  titleTa?: string;
  titleKn?: string;
  type: 'Prescription' | 'Lab Report' | 'Discharge Summary' | 'OPD Slip';
  date: string;
  facility: string;
  doctor: string;
  size: string;
  tags: string[];
  summary: string;
  summaryHi?: string;
  summaryTa?: string;
  summaryKn?: string;
  thumbnailUrl?: string;
}

export interface ConsentArtifact {
  id: string;
  purpose: string;
  purposeHi?: string;
  purposeTa?: string;
  purposeKn?: string;
  scope: string;
  scopeHi?: string;
  scopeTa?: string;
  scopeKn?: string;
  grantedTo: string;
  grantedDate: string;
  expiryDate: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

export interface Facility {
  id: string;
  name: string;
  nameHi?: string;
  nameTa?: string;
  nameKn?: string;
  type: 'District Hospital' | 'Primary Health Centre (PHC)' | 'Community Health Centre (CHC)' | 'Tertiary AIIMS' | 'Diagnostic Lab' | 'Blood Bank';
  distanceKm: number;
  address: string;
  addressHi?: string;
  addressTa?: string;
  addressKn?: string;
  phone: string;
  opdTimings: string;
  hasAbdmQrCheckin: boolean;
  hasEmergency24x7: boolean;
  availableBeds?: number;
  schemesAccepted: string[];
}

export interface HealthScheme {
  id: string;
  name: string;
  nameHi?: string;
  nameTa?: string;
  nameKn?: string;
  shortCode: string;
  category: string;
  description: string;
  descriptionHi?: string;
  descriptionTa?: string;
  descriptionKn?: string;
  coverageAmount: string;
  eligibility: string;
  eligibilityHi?: string;
  eligibilityTa?: string;
  eligibilityKn?: string;
  requiredDocuments: string[];
  helpline: string;
  applyUrl?: string;
}

export type AgentDomain = 
  | 'router'
  | 'triage'
  | 'medication'
  | 'lab_explainer'
  | 'facility'
  | 'scheme'
  | 'lifestyle_diet'
  | 'maternal_rch'
  | 'safety_gate'
  | 'clinician_escalation';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'vda' | 'clinician' | 'system';
  agent?: AgentDomain;
  text: string;
  textHi?: string;
  textTa?: string;
  textKn?: string;
  timestamp: string;
  isEscalationTrigger?: boolean;
  /** Device-local prescription reminder workflow step; never sent to the backend. */
  reminderStepId?: string;
  /** Backend explanation restricted to the exact uploaded prescription, not FHIR data. */
  prescriptionScoped?: boolean;
  quickActions?: { label: string; labelHi?: string; labelTa?: string; labelKn?: string; action: string; icon?: string }[];
  cardData?: {
    type: 'medication_reminder' | 'lab_highlight' | 'facility_qr' | 'scheme_summary' | 'vitals_logged';
    title: string;
    titleHi?: string;
    titleTa?: string;
    titleKn?: string;
    details: Record<string, any>;
  };
  attachment?: {
    name: string;
    type: string;
    url?: string;
    isImage: boolean;
  };
  audioAvailable?: boolean;
}

export type ClinicalChatState = 'WAITING_FOR_CLINICIAN' | 'CLINICIAN_CONNECTED' | 'ENDED';

/** Deterministic clinical follow-up reminder. It is intentionally separate from medication adherence. */
export interface ClinicalFollowUp {
  id: string;
  type: 'CLINICAL_REVIEW' | 'MEDICATION_REVIEW' | 'LAB_REVIEW' | 'CHECKUP';
  title: string;
  dueDate: string;
  daysUntil: number;
  status: 'DUE_TODAY' | 'DUE_TOMORROW' | 'UPCOMING' | 'ATTENDANCE_CHECK';
  dateSource: 'EXPLICIT' | 'DERIVED_30_DAY';
  attendanceStatus: 'PENDING' | 'COMPLETED' | 'MISSED';
  requiresAttendanceCheck: boolean;
  condition?: string;
  guidance?: string;
}

export interface FollowUpListResponse {
  asOfDate: string;
  timezone: string;
  followUps: ClinicalFollowUp[];
  progress: FollowUpProgress;
}

/** Patient-scoped checkup completion progress; intentionally separate from medication adherence. */
export interface FollowUpProgress {
  completedFollowUpCount: number;
}

export interface FollowUpAttendanceResponse {
  followUpId: string;
  attendanceStatus: 'COMPLETED' | 'MISSED';
  message: string;
}

/** Server-authoritative patient view of a persisted clinical escalation. */
export interface ClinicalReviewFacility {
  name: string;
  state: string | null;
  district: string | null;
  city: string | null;
  address: string | null;
  contactNumber: string | null;
  hospitalType: string | null;
  schemes: string[];
  emergencyCapabilityVerified: boolean;
  distanceKm: number | null;
  travelTimeMinutes: number | null;
}

export interface ClinicalReviewState {
  reviewRequested: boolean;
  teleconsultationOffered: boolean;
  teleconsultationConfigured: boolean;
  clinicalChatState: ClinicalChatState;
  clinicianResponseDeadline: string | null;
  firstClinicianResponseAt: string | null;
  fallbackShownAt: string | null;
  nearbyFacilities: ClinicalReviewFacility[];
  messages: Array<{ speaker: 'PATIENT' | 'CLINICIAN'; text: string; createdAt: string }>;
}

export interface VaccineRecord {
  id: string;
  vaccineName: string;
  vaccineNameHi?: string;
  vaccineNameTa?: string;
  vaccineNameKn?: string;
  doseNumber: string;
  doseNumberHi?: string;
  doseNumberTa?: string;
  doseNumberKn?: string;
  dateAdministered: string;
  facility: string;
  facilityHi?: string;
  facilityTa?: string;
  facilityKn?: string;
  beneficiaryRef: string;
  certificateQr: string;
  status: 'COMPLETED' | 'DUE' | 'UPCOMING';
  dueDate?: string;
}

export interface JanAushadhiItem {
  id: string;
  genericName: string;
  genericNameHi?: string;
  genericNameTa?: string;
  genericNameKn?: string;
  marketBrandName: string;
  dosage: string;
  marketPrice: number;
  janAushadhiPrice: number;
  savingsPercentage: number;
  category: string;
  availableAtKendra: boolean;
}

export interface BloodStockItem {
  group: string;
  unitsAvailable: number;
  status: 'SUFFICIENT' | 'CRITICAL' | 'MODERATE';
}

