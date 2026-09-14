import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import type { LanguageCode } from '../types';

const STORAGE_GROUP = 'VDA_Medicine_Reminders';
const STORAGE_KEY = 'medicine-reminder-store-v1';
const ACTION_TYPE_ID = 'VDA_MEDICINE_REMINDER_ACTIONS';
const ACTION_TAKEN = 'TAKEN';
const ACTION_SNOOZE = 'SNOOZE';
const SNOOZE_MINUTES = 15;
const MAX_SNOOZES_PER_SLOT = 1;

export type PrescriptionMedicine = {
  medicationName?: string | null;
  normalizedName?: string | null;
  strength?: string | null;
  dosage?: string | null;
  dosageForm?: string | null;
  frequency?: string | null;
  timing?: string | null;
  duration?: string | null;
  instructions?: string | null;
  confidence?: string | null;
};

export type PrescriptionUpload = {
  id: string;
  prescriptionId?: string;
  extractionStatus?: string;
  medications?: PrescriptionMedicine[];
  createdAt?: string;
};

export type ReminderAcknowledgementStatus = 'TAKEN' | 'SNOOZED' | 'NOT_CONFIRMED';

export type DraftMedicineReminder = {
  id: string;
  medicineName: string;
  dosageText: string;
  frequency: string | null;
  timing: string | null;
  duration: string | null;
  times: string[];
  enabled: boolean;
  requiresConfirmation: boolean;
  confirmed: boolean;
  uncertaintyReason?: string;
};

export type PrescriptionReminderDraft = {
  id: string;
  patientId: string;
  prescriptionId: string;
  createdAt: string;
  extractionStatus: 'EXTRACTED' | 'APPROVED' | 'REVIEW_REQUIRED' | 'EXTRACTION_FAILED';
  medicines: DraftMedicineReminder[];
};

export type LocalMedicineReminder = {
  id: string;
  prescriptionId: string;
  medicineName: string;
  dosageText: string;
  frequency: string | null;
  times: string[];
  startDate: string;
  endDate?: string;
  active: boolean;
  /** Patient explicitly confirmed this extracted medicine in the local review UI. */
  confirmed: boolean;
  uncertaintyReason?: string;
  notificationIds: number[];
  createdAt: string;
};

export type LocalPrescriptionMedicine = {
  id: string;
  medicineName: string;
  dosageText: string;
  frequency: string | null;
  administrationInstruction: string | null;
  extractedTimingText: string | null;
  confirmed: boolean;
  requiresConfirmation: boolean;
  uncertaintyReason?: string;
};

export type LocalPrescription = {
  id: string;
  processedAt: string;
  status: 'PROCESSING' | 'EXTRACTED' | 'READY' | 'REVIEW_REQUIRED' | 'EXTRACTION_FAILED';
  medicines: LocalPrescriptionMedicine[];
};

export type LocalReminderEvent = {
  id: string;
  reminderId: string;
  medicineId: string;
  scheduledAt: string;
  acknowledgedAt: string;
  status: ReminderAcknowledgementStatus;
};

export type MedicineReminderProgress = {
  scheduledToday: number;
  takenToday: number;
  currentStreakDays: number;
};

export type MedicineReminderSnapshot = {
  reminders: LocalMedicineReminder[];
  progress: MedicineReminderProgress;
  notificationPermission: 'granted' | 'denied' | 'unavailable' | 'unknown';
  todayTakenKeys: string[];
  /** Local confirmed source used only to refresh the server-held safe session context. */
  activePrescription: LocalPrescription | null;
};

type PatientReminderStore = {
  prescriptions: LocalPrescription[];
  activePrescriptionId?: string | null;
  reminders: LocalMedicineReminder[];
  events: LocalReminderEvent[];
  notificationPermission: MedicineReminderSnapshot['notificationPermission'];
};

type ReminderStore = { patients: Record<string, PatientReminderStore> };

const defaultPatientStore = (): PatientReminderStore => ({
  prescriptions: [], activePrescriptionId: null, reminders: [], events: [], notificationPermission: 'unknown',
});

const localDateKey = (date = new Date()): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return formatter.format(date);
};

const safeId = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const notificationId = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2_000_000_000 || 1;
};

const frequencyCount = (frequency?: string | null): number | null => {
  const value = (frequency || '').toLowerCase();
  if (/\b(three times|tds|tid|3 times)\b/.test(value)) return 3;
  if (/\b(twice|bd|bid|2 times)\b/.test(value)) return 2;
  if (/\b(once|od|daily|1 time)\b/.test(value)) return 1;
  return null;
};

type ParsedReminderTime = { value?: string; ambiguous: boolean; hour?: number; minute?: number };

const hindiNumberWords: Record<string, string> = {
  'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5', 'पाँच': '5', 'छह': '6',
  'सात': '7', 'आठ': '8', 'नौ': '9', 'दस': '10', 'ग्यारह': '11', 'बारह': '12',
};

const normalizeTimeWords = (value: string) => Object.entries(hindiNumberWords)
  .reduce((result, [word, number]) => result.replace(new RegExp(word, 'g'), number), value.toLowerCase());

/** Parses a patient-provided clock time without assigning an AM/PM value that was not stated. */
export const parseReminderTime = (input: string): ParsedReminderTime => {
  const normalized = normalizeTimeWords(input);
  const match = normalized.match(/(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*(?:बजे|baje|o'?clock|am|a\.m\.|pm|p\.m\.)?/i);
  if (!match) return { ambiguous: false };
  const hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59 || hour > 23 || hour === 0) return { ambiguous: false };
  const prefix = normalized.slice(Math.max(0, match.index! - 16), match.index! + match[0].length + 12);
  const isAm = /\b(?:am|a\.m\.)\b|सुबह|morning/.test(prefix);
  const isPm = /\b(?:pm|p\.m\.)\b|दोपहर|शाम|रात|afternoon|evening|night/.test(prefix);
  if (isAm && isPm) return { ambiguous: false };
  // A leading zero (08:00) and 13:00-23:59 are explicit 24-hour values. A plain
  // “7 बजे” is deliberately not scheduled until the patient says morning/evening.
  const isExplicit24Hour = hour > 12 || (match[1].length === 2 && match[1].startsWith('0'));
  if (!isAm && !isPm && !isExplicit24Hour && hour <= 12) return { ambiguous: true, hour, minute };
  const hour24 = isPm && hour < 12 ? hour + 12 : isAm && hour === 12 ? 0 : hour;
  return { value: `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, ambiguous: false };
};

/** Only explicit, unambiguous clock values can become a notification time. */
const mappedTimes = (medicine: PrescriptionMedicine): string[] => {
  const source = `${medicine.frequency || ''} ${medicine.timing || ''} ${medicine.instructions || ''}`;
  const parsed = parseReminderTime(source);
  const count = frequencyCount(medicine.frequency);
  const explicit = parsed.value ? [parsed.value] : [];
  const required = count || explicit.length || 1;
  return explicit.concat(Array.from({ length: Math.max(0, required - explicit.length) }, () => ''));
};

const dosageText = (medicine: PrescriptionMedicine) =>
  [medicine.strength, medicine.dosage].filter(Boolean).join(' • ') || 'खुराक की पुष्टि करें';

const medicineQuestionPattern = /(?:\b(?:medicine|medicines|medication|dose|dosage|tablet|tablets|pill|pills|reminder|reminders|prescription|dawai|dava)\b|दवाई|दवाइ|दवा|मेडिसिन|औषधि|गोली|गोलियां|खुराक|पर्ची|टैबलेट|रिमाइंडर|(?:कब|समय|कितनी बार)\s*(?:लेना|लूं|लूँ|लें|खाना|दवा|गोली|टैबलेट|रिमाइंडर)|(?:सुबह|शाम|रात)\s*(?:की|को)?\s*(?:दवा|गोली|टैबलेट|रिमाइंडर))/i;
const unsafeMedicineActionPattern = /(?:\b(?:increase|decrease|stop|start|change|adjust|double)\b.{0,32}\b(?:dose|dosage|medicine|medication|pill)\b|\b(?:taking double|double the dose|stop taking)\b|दवा\s*(?:बढ़ाना|घटाना|बंद|बदलना|शुरू)|(?:डबल|दोगुनी)\s*(?:खुराक|dose)|(?:दो|2)\s*(?:गोली|tablet|tablets|pills?)|(?:dose|dawa|medicine|dosage|medication)\s+(?:increase|decrease|stop|start|change|adjust|double|kam|zyada|badhana|ghatana|band))/i;

export type PrescriptionMedicineQueryRoute =
  | 'PRESCRIPTION_FACT'
  | 'MEDICINE_EDUCATION'
  | 'MEDICATION_SAFETY'
  | 'REMINDER_QUERY'
  | 'NONE';

const medicineEducationPattern = /(?:किस\s*(?:लिए|काम)|kis\s*(?:liye|liye)|क्या\s*(?:करती|करता|है)|kya\s*(?:karti|karta)|क्या\s*काम|what\s*(?:does|is)|why\s*(?:is|was)|use\s*(?:करते|करती|hoti|hota|hai)|क्यों\s*(?:दी|दिया|लिखी)|kyon\s*(?:di|likhi)|काम\s*(?:की|का|है))/i;
const reminderQueryPattern = /(?:reminder|रिमाइंडर|कितने बजे|कब\s*(?:लेना|लूं|लूँ|लें)|समय|timing|time|सुबह|शाम|रात)/i;
const hasNamedPrescriptionMedicine = (query: string, prescription: LocalPrescription): boolean => {
  const normalized = query.toLowerCase();
  return prescription.medicines.some((medicine) => (
    medicine.confirmed && normalized.includes(medicine.medicineName.toLowerCase())
  ));
};

/** Classifies prescription-only medicine questions without using patient clinical data. */
export const classifyPrescriptionMedicineQuery = (
  query: string,
  snapshot: MedicineReminderSnapshot,
): { route: PrescriptionMedicineQueryRoute } => {
  const prescription = snapshot.activePrescription;
  const normalized = query.toLowerCase();
  const hasNamedMedicine = prescription ? hasNamedPrescriptionMedicine(query, prescription) : false;

  if (isUnsafeMedicineAction(query)) return { route: 'MEDICATION_SAFETY' };
  if (reminderQueryPattern.test(normalized)) return { route: 'REMINDER_QUERY' };
  if (medicineEducationPattern.test(normalized)) return { route: 'MEDICINE_EDUCATION' };
  if (medicineQuestionPattern.test(query) || hasNamedMedicine) return { route: 'PRESCRIPTION_FACT' };
  return { route: 'NONE' };
};

/** Marks a short prescription follow-up for server-side sanitized-context resolution. */
export const isPrescriptionMedicineFollowUp = (query: string): boolean => /(?:\b(?:ye|this|it|these|them)\b|इसे|इसको|इन्हें|इनको|कब|समय|timing|time|सुबह|शाम)/i.test(query.trim());

/** A routing guard only; the backend SafetyGate remains the authority for WITHHOLD decisions. */
export const isUnsafeMedicineAction = (query: string): boolean => unsafeMedicineActionPattern.test(query);

export const prescriptionToReminderDraft = (patientId: string, prescription: PrescriptionUpload): PrescriptionReminderDraft => {
  const extractionStatus = (prescription.extractionStatus || ((prescription.medications || []).length ? 'EXTRACTED' : 'REVIEW_REQUIRED')).toUpperCase();
  const trustedExtraction = extractionStatus === 'EXTRACTED' || extractionStatus === 'APPROVED';
  return {
    id: safeId(),
    patientId,
    prescriptionId: prescription.id || prescription.prescriptionId || safeId(),
    createdAt: new Date().toISOString(),
    extractionStatus: trustedExtraction
      ? extractionStatus
      : extractionStatus === 'EXTRACTION_FAILED' || extractionStatus === 'FAILED'
        ? 'EXTRACTION_FAILED'
        : 'REVIEW_REQUIRED',
    medicines: trustedExtraction ? (prescription.medications || []).flatMap((medicine, index) => {
    const medicineName = (medicine.normalizedName || medicine.medicationName || '').trim();
    if (!medicineName) return [];
    const lowConfidence = (medicine.confidence || 'LOW').toUpperCase() === 'LOW';
    const times = mappedTimes(medicine);
    const requiresTimeConfirmation = times.some((time) => !time);
    return [{
      id: `${prescription.id || prescription.prescriptionId || 'rx'}-${index}`,
      medicineName,
      dosageText: dosageText(medicine),
      frequency: medicine.frequency || null,
      timing: medicine.timing || null,
      duration: medicine.duration || null,
      times,
      enabled: true,
      requiresConfirmation: lowConfidence || requiresTimeConfirmation,
      confirmed: !lowConfidence,
      uncertaintyReason: lowConfidence
        ? 'OCR में इस दवा की जानकारी साफ़ नहीं है। नाम और समय देखकर पुष्टि करें।'
        : requiresTimeConfirmation
          ? 'समय पर्ची में साफ़ नहीं है। अपनी सुविधा का समय चुनें।'
          : undefined,
    }];
    }) : [],
  };
};

class MedicineReminderService {
  private initialized = false;

  private async configure() {
    await Preferences.configure({ group: STORAGE_GROUP });
  }

  private async readStore(): Promise<ReminderStore> {
    await this.configure();
    const stored = await Preferences.get({ key: STORAGE_KEY });
    if (!stored.value) return { patients: {} };
    try {
      const parsed = JSON.parse(stored.value) as ReminderStore;
      if (!parsed?.patients) return { patients: {} };
      // Migrate only prior device-local reminder records. No backend/FHIR data is read.
      for (const patient of Object.values(parsed.patients)) {
        if (!Array.isArray(patient.prescriptions)) patient.prescriptions = [];
        if (!Array.isArray(patient.reminders)) patient.reminders = [];
        const hasStructuredPrescription = patient.prescriptions.some((prescription) => Array.isArray(prescription?.medicines));
        if (!hasStructuredPrescription && patient.reminders.length) {
          patient.prescriptions.unshift({
            id: `local-migrated-${safeId()}`,
            processedAt: new Date().toISOString(),
            status: 'READY',
            medicines: patient.reminders.map((reminder) => ({
              id: reminder.id,
              medicineName: reminder.medicineName,
              dosageText: reminder.dosageText,
              frequency: reminder.frequency,
              administrationInstruction: null,
              extractedTimingText: null,
              confirmed: reminder.confirmed === true,
              requiresConfirmation: reminder.confirmed !== true,
              uncertaintyReason: reminder.uncertaintyReason,
            })),
          });
        }
        if (!patient.activePrescriptionId) {
          const current = patient.prescriptions.find((prescription) => (
            (prescription.status === 'EXTRACTED' || prescription.status === 'READY')
            && prescription.medicines.length > 0
            && prescription.medicines.every((medicine) => medicine.confirmed)
          ));
          patient.activePrescriptionId = current?.id || null;
        }
      }
      return parsed;
    } catch {
      return { patients: {} };
    }
  }

  private async writeStore(store: ReminderStore) {
    await this.configure();
    await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(store) });
  }

  private async patientStore(patientId: string): Promise<[ReminderStore, PatientReminderStore]> {
    const store = await this.readStore();
    const patient = store.patients[patientId] || defaultPatientStore();
    store.patients[patientId] = patient;
    return [store, patient];
  }

  async beginPrescriptionProcessing(patientId: string): Promise<void> {
    const [store, patient] = await this.patientStore(patientId);
    patient.prescriptions = [{
      id: safeId(), processedAt: new Date().toISOString(), status: 'PROCESSING', medicines: [],
    }, ...patient.prescriptions];
    await this.writeStore(store);
  }

  async saveExtractedPrescription(draft: PrescriptionReminderDraft): Promise<MedicineReminderSnapshot> {
    const [store, patient] = await this.patientStore(draft.patientId);
    const prescription: LocalPrescription = {
      id: draft.prescriptionId,
      processedAt: new Date().toISOString(),
      status: draft.extractionStatus === 'REVIEW_REQUIRED'
        ? 'REVIEW_REQUIRED'
        : draft.extractionStatus === 'EXTRACTION_FAILED' || !draft.medicines.length
          ? 'EXTRACTION_FAILED'
          : 'EXTRACTED',
      medicines: draft.medicines.map((medicine) => ({
        id: medicine.id,
        medicineName: medicine.medicineName,
        dosageText: medicine.dosageText,
        frequency: medicine.frequency,
        administrationInstruction: medicine.timing || medicine.duration || null,
        extractedTimingText: medicine.timing,
        confirmed: medicine.confirmed,
        requiresConfirmation: medicine.requiresConfirmation,
        uncertaintyReason: medicine.uncertaintyReason,
      })),
    };
    patient.prescriptions = [prescription, ...patient.prescriptions.filter((item) => item.id !== prescription.id && item.status !== 'PROCESSING')];
    if (
      (prescription.status === 'EXTRACTED' || prescription.status === 'READY')
      && prescription.medicines.length > 0
      && prescription.medicines.every((medicine) => medicine.confirmed)
    ) {
      // A newer trusted, confirmed prescription replaces—not merges with—the
      // prior device-local medicine source.
      patient.activePrescriptionId = prescription.id;
    }
    await this.writeStore(store);
    return this.snapshot(draft.patientId);
  }

  async markPrescriptionExtractionFailed(patientId: string): Promise<void> {
    const [store, patient] = await this.patientStore(patientId);
    const latest = patient.prescriptions[0];
    if (latest?.status === 'PROCESSING') latest.status = 'EXTRACTION_FAILED';
    await this.writeStore(store);
  }

  private progress(patient: PatientReminderStore): MedicineReminderProgress {
    const today = localDateKey();
    const active = patient.reminders.filter((reminder) => reminder.active);
    const scheduledToday = active.reduce((count, reminder) => count + reminder.times.length, 0);
    const takenKeys = new Set(
      patient.events
        .filter((event) => event.status === 'TAKEN' && localDateKey(new Date(event.scheduledAt)) === today)
        .map((event) => `${event.reminderId}:${event.scheduledAt.slice(11, 16)}`),
    );
    const takenToday = takenKeys.size;
    let currentStreakDays = 0;
    for (let offset = 0; offset < 365; offset += 1) {
      const day = new Date();
      day.setDate(day.getDate() - offset);
      const dayKey = localDateKey(day);
      const eligible = active.filter((reminder) => reminder.startDate <= dayKey && (!reminder.endDate || reminder.endDate >= dayKey));
      if (!eligible.length) break;
      const total = eligible.reduce((count, reminder) => count + reminder.times.length, 0);
      const completed = new Set(patient.events
        .filter((event) => event.status === 'TAKEN' && localDateKey(new Date(event.scheduledAt)) === dayKey)
        .map((event) => `${event.reminderId}:${event.scheduledAt.slice(11, 16)}`)).size;
      if (completed < total) break;
      currentStreakDays += 1;
    }
    return { scheduledToday, takenToday, currentStreakDays };
  }

  async snapshot(patientId: string): Promise<MedicineReminderSnapshot> {
    const [, patient] = await this.patientStore(patientId);
    const today = localDateKey();
    const todayTakenKeys = [...new Set(patient.events
      .filter((event) => event.status === 'TAKEN' && localDateKey(new Date(event.scheduledAt)) === today)
      .map((event) => `${event.reminderId}:${event.scheduledAt.slice(11, 16)}`))];
    return {
      reminders: patient.reminders,
      progress: this.progress(patient),
      notificationPermission: patient.notificationPermission,
      todayTakenKeys,
      activePrescription: patient.prescriptions.find((prescription) => prescription.id === patient.activePrescriptionId) || null,
    };
  }

  async initialize(onAction: (patientId: string) => void): Promise<() => void> {
    if (!Capacitor.isNativePlatform()) return () => undefined;
    if (!this.initialized) {
      await LocalNotifications.createChannel({ id: 'vda-medicine-reminders', name: 'Medicine reminders', description: 'VDA medicine reminder notifications', importance: 4, visibility: 1, sound: 'default', vibration: true });
      await LocalNotifications.registerActionTypes({
        types: [{ id: ACTION_TYPE_ID, actions: [
          { id: ACTION_TAKEN, title: 'ले ली' },
          { id: ACTION_SNOOZE, title: 'बाद में याद दिलाएँ' },
        ] }],
      });
      this.initialized = true;
    }
    const listener = await LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
      const patientId = String(action.notification.extra?.patientId || '');
      const reminderId = String(action.notification.extra?.reminderId || '');
      const scheduledTime = String(action.notification.extra?.scheduledTime || '');
      if (!patientId || !reminderId || !scheduledTime) return;
      if (action.actionId === ACTION_TAKEN) await this.recordTaken(patientId, reminderId, scheduledTime);
      if (action.actionId === ACTION_SNOOZE) await this.snooze(patientId, reminderId, scheduledTime);
      onAction(patientId);
    });
    return () => { void listener.remove(); };
  }

  private async permission(patient: PatientReminderStore): Promise<'granted' | 'denied' | 'unavailable'> {
    if (!Capacitor.isNativePlatform()) {
      patient.notificationPermission = 'unavailable';
      return 'unavailable';
    }
    const current = await LocalNotifications.checkPermissions();
    const result = current.display === 'granted' ? current : await LocalNotifications.requestPermissions();
    patient.notificationPermission = result.display === 'granted' ? 'granted' : 'denied';
    return patient.notificationPermission;
  }

  private async syncNotifications(patientId: string, patient: PatientReminderStore) {
    if (!Capacitor.isNativePlatform() || patient.notificationPermission !== 'granted') return;
    const ids = patient.reminders.flatMap((reminder) => reminder.notificationIds);
    if (ids.length) await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
    for (const reminder of patient.reminders) {
      reminder.notificationIds = reminder.times.map((time) => notificationId(`${patientId}:${reminder.id}:${time}`));
    }
    const notifications = patient.reminders
      .filter((reminder) => reminder.active)
      .flatMap((reminder) => reminder.times.map((time, index) => {
        const [hour, minute] = time.split(':').map(Number);
        return {
          id: reminder.notificationIds[index],
          title: 'दवा लेने का समय',
          body: `${reminder.medicineName} लेने का समय हो गया है।`,
          channelId: 'vda-medicine-reminders',
          actionTypeId: ACTION_TYPE_ID,
          extra: { patientId, reminderId: reminder.id, scheduledTime: time },
          schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: false },
          isExactNotification: false,
        };
      }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  }

  async confirmDraft(draft: PrescriptionReminderDraft): Promise<MedicineReminderSnapshot> {
    const [store, patient] = await this.patientStore(draft.patientId);
    const reminders = draft.medicines.map((medicine) => ({
      id: safeId(), prescriptionId: draft.prescriptionId, medicineName: medicine.medicineName,
      dosageText: medicine.dosageText, frequency: medicine.frequency,
      times: medicine.times.filter(Boolean), startDate: localDateKey(),
      active: medicine.enabled && medicine.confirmed && medicine.times.every(Boolean),
      confirmed: medicine.confirmed,
      uncertaintyReason: medicine.uncertaintyReason,
      notificationIds: [], createdAt: new Date().toISOString(),
    }));
    patient.prescriptions = patient.prescriptions.map((prescription) => prescription.id === draft.prescriptionId
      ? {
          ...prescription,
          status: 'READY',
          medicines: prescription.medicines.map((medicine) => {
            const draftMedicine = draft.medicines.find((item) => item.id === medicine.id);
            return draftMedicine
              ? { ...medicine, confirmed: draftMedicine.confirmed, requiresConfirmation: draftMedicine.requiresConfirmation, uncertaintyReason: draftMedicine.uncertaintyReason }
              : medicine;
          }),
        }
      : prescription);
    const activePrescription = patient.prescriptions.find((prescription) => prescription.id === draft.prescriptionId);
    if (activePrescription?.medicines.length && activePrescription.medicines.every((medicine) => medicine.confirmed)) {
      patient.activePrescriptionId = activePrescription.id;
    }
    patient.reminders = [...patient.reminders, ...reminders];
    await this.writeStore(store);
    const permission = await this.permission(patient);
    if (permission === 'granted') await this.syncNotifications(draft.patientId, patient);
    await this.writeStore(store);
    return this.snapshot(draft.patientId);
  }

  async enableNotifications(patientId: string): Promise<MedicineReminderSnapshot> {
    const [store, patient] = await this.patientStore(patientId);
    const permission = await this.permission(patient);
    if (permission === 'granted') await this.syncNotifications(patientId, patient);
    await this.writeStore(store);
    return this.snapshot(patientId);
  }

  async updateReminder(patientId: string, reminderId: string, patch: Pick<LocalMedicineReminder, 'times' | 'active'>): Promise<MedicineReminderSnapshot> {
    const [store, patient] = await this.patientStore(patientId);
    patient.reminders = patient.reminders.map((reminder) => reminder.id === reminderId
      ? { ...reminder, ...patch, times: patch.times.filter(Boolean) }
      : reminder);
    await this.syncNotifications(patientId, patient);
    await this.writeStore(store);
    return this.snapshot(patientId);
  }

  async deleteReminder(patientId: string, reminderId: string): Promise<MedicineReminderSnapshot> {
    const [store, patient] = await this.patientStore(patientId);
    const deleted = patient.reminders.find((reminder) => reminder.id === reminderId);
    if (Capacitor.isNativePlatform() && deleted?.notificationIds.length) {
      await LocalNotifications.cancel({ notifications: deleted.notificationIds.map((id) => ({ id })) });
    }
    patient.reminders = patient.reminders.filter((reminder) => reminder.id !== reminderId);
    await this.writeStore(store);
    return this.snapshot(patientId);
  }

  private async recordTaken(patientId: string, reminderId: string, time: string) {
    const [store, patient] = await this.patientStore(patientId);
    const scheduledAt = `${localDateKey()}T${time}:00+05:30`;
    const exists = patient.events.some((event) => event.status === 'TAKEN' && event.reminderId === reminderId && event.scheduledAt === scheduledAt);
    if (!exists) patient.events.push({ id: safeId(), reminderId, medicineId: reminderId, scheduledAt, acknowledgedAt: new Date().toISOString(), status: 'TAKEN' });
    await this.writeStore(store);
  }

  async recordTakenFromApp(patientId: string, reminderId: string, time: string): Promise<MedicineReminderSnapshot> {
    await this.recordTaken(patientId, reminderId, time);
    return this.snapshot(patientId);
  }

  private async snooze(patientId: string, reminderId: string, time: string) {
    const [store, patient] = await this.patientStore(patientId);
    const scheduledAt = `${localDateKey()}T${time}:00+05:30`;
    const priorSnoozes = patient.events.filter((event) => event.status === 'SNOOZED' && event.reminderId === reminderId && localDateKey(new Date(event.scheduledAt)) === localDateKey()).length;
    if (priorSnoozes >= MAX_SNOOZES_PER_SLOT) return;
    patient.events.push({ id: safeId(), reminderId, medicineId: reminderId, scheduledAt, acknowledgedAt: new Date().toISOString(), status: 'SNOOZED' });
    const reminder = patient.reminders.find((item) => item.id === reminderId);
    if (Capacitor.isNativePlatform() && patient.notificationPermission === 'granted' && reminder) {
      const at = new Date(Date.now() + SNOOZE_MINUTES * 60_000);
      await LocalNotifications.schedule({ notifications: [{
        id: notificationId(`${patientId}:${reminderId}:${localDateKey()}:snooze:${priorSnoozes}`),
        title: 'दवा लेने का समय', body: `${reminder.medicineName} लेने की याद दिला रहे हैं।`,
        channelId: 'vda-medicine-reminders', actionTypeId: ACTION_TYPE_ID,
        extra: { patientId, reminderId, scheduledTime: time },
        schedule: { at }, isExactNotification: false,
      }] });
    }
    await this.writeStore(store);
  }

  async snoozeFromApp(patientId: string, reminderId: string, time: string): Promise<MedicineReminderSnapshot> {
    await this.snooze(patientId, reminderId, time);
    return this.snapshot(patientId);
  }
}

export const medicineReminderService = new MedicineReminderService();
