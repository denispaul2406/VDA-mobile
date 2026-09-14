import React, { useState } from 'react';
import { Sparkles, FileText, Building2, User } from 'lucide-react';
import { ChatMessage, ClinicalReviewState, FhirCondition, FhirDocument, FhirMedication, FhirObservation, LanguageCode, PatientDemographics } from './types';
import { SYNTHETIC_PATIENTS, FACILITIES_LIST, HEALTH_SCHEMES_LIST } from './data/syntheticData';
import { getTranslation, playChime } from './utils/i18n';
import { apiService } from './services/api';

// Tab & Modal Components
import { OnboardingModal } from './components/OnboardingModal';
import { VdaTab } from './components/VdaTab';
import { RecordsTab } from './components/RecordsTab';
import { FacilitiesTab } from './components/FacilitiesTab';
import { ProfileTab } from './components/ProfileTab';
import { LogVitalModal } from './components/LogVitalModal';
import { MedicineRemindersModal } from './components/MedicineRemindersModal';
import { MedicineReminderSnapshot, PrescriptionReminderDraft, classifyPrescriptionMedicineQuery, isPrescriptionMedicineFollowUp, medicineReminderService, parseReminderTime, prescriptionToReminderDraft } from './services/medicine-reminder.service';

const emptyMedicineReminderSnapshot: MedicineReminderSnapshot = {
  reminders: [],
  progress: { scheduledToday: 0, takenToday: 0, currentStreakDays: 0 },
  notificationPermission: 'unknown',
  todayTakenKeys: [],
  activePrescription: null,
};

type ReminderSetupPhase = 'OFFER' | 'CONFIRM_MEDICINE' | 'ASK_TIME' | 'ASK_PERIOD' | 'CONFIRM_TIME' | 'ACTIVATE';
type ReminderSetup = {
  draft: PrescriptionReminderDraft;
  phase: ReminderSetupPhase;
  medicineIndex: number;
  timeIndex?: number;
  pendingTime?: string;
  pendingHour?: number;
  pendingMinute?: number;
};
type ReminderStepStatus = 'ACTIVE' | 'ANSWERED' | 'EXPIRED';
type ReminderResponseResult = { handled: boolean; answered: boolean };

const isAffirmative = (text: string) => /(?:^|\s)(?:हाँ|हां|ha|haan|yes|y|ठीक है|theek hai|ठीक|laga do|लगा दो|रिमाइंडर लगाएँ|चालू करें|चालू कर दो|activate)(?:$|\s)/i.test(text.trim());
const isNegative = (text: string) => /^(?:नहीं|nahi|nahin|no|अभी नहीं|abhi nahi)$/i.test(text.trim());
const isReminderActivationConfirmation = (text: string) => (
  isAffirmative(text)
  || /^(?:कर दो|कर दीजिए|चालू कर दें|चालू कर दीजिए|रिमाइंडर चालू करें|activate reminders)$/i.test(text.trim())
);
const reminderTimeLabel = (time: string, lang: LanguageCode) => {
  const [hourValue, minute] = time.split(':').map(Number);
  const period = hourValue < 12 ? (lang === 'hi' ? 'सुबह' : 'AM') : (lang === 'hi' ? 'रात' : 'PM');
  const hour = hourValue % 12 || 12;
  return lang === 'hi' ? `${period} ${hour}${minute ? `:${String(minute).padStart(2, '0')}` : ''} बजे` : `${hour}:${String(minute).padStart(2, '0')} ${period}`;
};

export default function App() {
  // Active Persona & Language
  const [currentPersonaKey, setCurrentPersonaKey] = useState<string>('synth-patient-001');
  const activeProfile = SYNTHETIC_PATIENTS[currentPersonaKey] || SYNTHETIC_PATIENTS['synth-patient-001'];

  const [lang, setLang] = useState<LanguageCode>('hi');
  const [activeTab, setActiveTab] = useState<'vda' | 'records' | 'facilities' | 'profile'>('vda');

  // Backend VDA Session State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [medicineReminderSnapshot, setMedicineReminderSnapshot] = useState<MedicineReminderSnapshot>(emptyMedicineReminderSnapshot);
  const [prescriptionReminderDraft, setPrescriptionReminderDraft] = useState<PrescriptionReminderDraft | null>(null);
  const [isMedicineRemindersOpen, setIsMedicineRemindersOpen] = useState(false);
  const [reminderSetup, setReminderSetup] = useState<ReminderSetup | null>(null);
  const [activeReminderStepId, setActiveReminderStepId] = useState<string | null>(null);
  const [reminderStepStates, setReminderStepStates] = useState<Record<string, ReminderStepStatus>>({});
  const activeReminderStepRef = React.useRef<string | null>(null);
  const reminderActionInFlightRef = React.useRef(new Set<string>());
  const localPrescriptionMessageSequenceRef = React.useRef(0);
  const activeEmergencyTurnIdRef = React.useRef<string | null>(null);
  const [emergencyFallback, setEmergencyFallback] = useState<{ review: ClinicalReviewState; messageId: string } | null>(null);

  // App Flow Modals
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isLogVitalOpen, setIsLogVitalOpen] = useState(false);

  // Dynamic Clinical & Medical State
  const [patient, setPatient] = useState<PatientDemographics>(activeProfile.demographics);
  const [conditions, setConditions] = useState<FhirCondition[]>(activeProfile.conditions);
  const [medications, setMedications] = useState<FhirMedication[]>(activeProfile.medications);
  const [observations, setObservations] = useState<FhirObservation[]>(activeProfile.observations);
  const [documents, setDocuments] = useState<FhirDocument[]>(activeProfile.documents);
  const [consents, setConsents] = useState(activeProfile.consents);

  // Internal emergency facility refresh state. This is never a patient-facing clinician takeover.
  const [clinicalReview, setClinicalReview] = useState<ClinicalReviewState | null>(null);

  // Initialize Auth & Session on mount
  React.useEffect(() => {
    const initAppSession = async () => {
      await apiService.initAuthToken();
      const sessionRes = await apiService.createPatientSession(currentPersonaKey);
      const snapshot = await medicineReminderService.snapshot(currentPersonaKey);
      if (sessionRes?.session_id) {
        setActiveSessionId(sessionRes.session_id);
        await syncPrescriptionSessionContext(sessionRes.session_id, snapshot);
      }
      setMedicineReminderSnapshot(snapshot);
    };
    initAppSession();
  }, []);

  React.useEffect(() => {
    let dispose = () => undefined;
    let active = true;
    void medicineReminderService.initialize((patientId) => {
      if (active && patientId === currentPersonaKey) {
        void medicineReminderService.snapshot(patientId).then(setMedicineReminderSnapshot);
      }
    }).then((nextDispose) => { dispose = nextDispose; });
    return () => { active = false; dispose(); };
  }, [currentPersonaKey]);

  // Refresh facilities only for the emergency turn that created this card.
  React.useEffect(() => {
    const emergencyTurnId = emergencyFallback?.messageId;
    if (!activeSessionId || !emergencyTurnId || !clinicalReview?.reviewRequested) return;
    let active = true;
    const refresh = async () => {
      try {
        const next = await apiService.getClinicalReviewState(activeSessionId);
        if (active && activeEmergencyTurnIdRef.current === emergencyTurnId) {
          setClinicalReview(next);
          setEmergencyFallback((current) =>
            current?.messageId === emergencyTurnId ? { ...current, review: next } : current,
          );
        }
      } catch {
        // Keep the last server-confirmed safety state visible; never replace it with mock data.
      }
    };
    const interval = window.setInterval(() => void refresh(), 4_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [activeSessionId, clinicalReview?.reviewRequested, emergencyFallback?.messageId]);

  // VDA Conversation History
  const [isProcessingMessage, setIsProcessingMessage] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-01',
      sender: 'vda',
      agent: 'router',
      text: `Namaste ${activeProfile.demographics.name} ji. I am your VDA Health Assistant. I have linked your ABDM records from AIIMS New Delhi. How can I help you today?`,
      textHi: `नमस्ते ${activeProfile.demographics.name} जी। मैं आपका VDA स्वास्थ्य साथी हूँ। आपके एम्स अस्पताल के सभी रिकॉर्ड जुड़ चुके हैं। आज मैं आपकी क्या सहायता कर सकता हूँ?`,
      textTa: `வணக்கம் ${activeProfile.demographics.name} அவர்களே. நான் உங்கள் VDA சுகாதார உதவியாளர். AIIMS புது தில்லி மருத்துவ பதிவுகள் இணைக்கப்பட்டுள்ளன. இன்று உங்களுக்கு எவ்வாறு உதவலாம்?`,
      textKn: `ನಮಸ್ಕಾರ ${activeProfile.demographics.name} ಅವರೇ. ನಾನು ನಿಮ್ಮ VDA ಆರೋಗ್ಯ ಸಹಾಯಕ. AIIMS ನವದೆಹಲಿ ಆಸ್ಪತ್ರೆಯ ದಾಖಲೆಗಳು ಸಂಪರ್ಕಗೊಂಡಿವೆ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      audioAvailable: true,
      quickActions: [
        { label: 'My Medicines', labelHi: 'मेरी दवाइयां', labelTa: 'எனது மருந்துகள்', labelKn: 'ನನ್ನ ಔಷಧಿಗಳು', action: 'ask_medicines' },
        { label: 'Explain Sugar Lab', labelHi: 'शुगर रिपोर्ट समझाएं', labelTa: 'சர்க்கரை சோதனை விளக்கம்', labelKn: 'ಸಕ್ಕರೆ ವರದಿ ವಿವರಣೆ', action: 'ask_sugar_lab' },
        { label: 'Nearby Hospital', labelHi: 'नजदीकी अस्पताल', labelTa: 'அருகிலுள்ள மருத்துவமனை', labelKn: 'ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ', action: 'ask_hospital' },
        { label: 'Ayushman PM-JAY', labelHi: 'आयुष्मान योजना लाभ', labelTa: 'ஆயுஷ்மான் திட்ட பலன்கள்', labelKn: 'ಆಯುಷ್ಮಾನ್ ಯೋಜನೆ', action: 'ask_scheme' }
      ]
    }
  ]);

  // Switch patient profile and create new session in backend
  const handleSwitchPersona = async (key: string) => {
    setCurrentPersonaKey(key);
    const newProfile = SYNTHETIC_PATIENTS[key] || SYNTHETIC_PATIENTS['synth-patient-001'];
    setPatient(newProfile.demographics);
    setConditions(newProfile.conditions);
    setMedications(newProfile.medications);
    setObservations(newProfile.observations);
    setDocuments(newProfile.documents);
    setConsents(newProfile.consents);
    activeEmergencyTurnIdRef.current = null;
    setClinicalReview(null);
    setEmergencyFallback(null);
    setPrescriptionReminderDraft(null);
    setIsMedicineRemindersOpen(false);
    setReminderSetup(null);
    activeReminderStepRef.current = null;
    setActiveReminderStepId(null);
    setReminderStepStates({});
    const snapshot = await medicineReminderService.snapshot(key);
    setMedicineReminderSnapshot(snapshot);

    // Call backend session creation API for selected patient
    const sessionRes = await apiService.createPatientSession(key);
    if (sessionRes?.session_id) {
      setActiveSessionId(sessionRes.session_id);
      await syncPrescriptionSessionContext(sessionRes.session_id, snapshot);
    } else {
      setActiveSessionId(null);
    }

    setMessages([
      {
        id: `switch-${Date.now()}`,
        sender: 'vda',
        agent: 'router',
        text: `Switched profile to ${newProfile.demographics.name} (${newProfile.demographics.district}, ${newProfile.demographics.state}). Active ABDM ABHA: ${newProfile.demographics.abhaNumber}. Category: ${newProfile.demographics.goldCategory || 'NCD Profile'}.`,
        textHi: `मरीज प्रोफाइल बदला गया: ${newProfile.demographics.name} (${newProfile.demographics.district}, ${newProfile.demographics.state})। सक्रिय ABHA संख्या: ${newProfile.demographics.abhaNumber}।`,
        textTa: `நோயாளி சுயவிவரம் மாற்றப்பட்டது: ${newProfile.demographics.name}। செயலில் உள்ள ABHA: ${newProfile.demographics.abhaNumber}।`,
        textKn: `ರೋಗಿ ಪ್ರೊಫೈಲ್ ಬದಲಾಯಿಸಲಾಗಿದೆ: ${newProfile.demographics.name}। ಸಕ್ರಿಯ ABHA: ${newProfile.demographics.abhaNumber}।`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        audioAvailable: true
      }
    ]);
  };

  // Toggle medication checklist
  const handleToggleMedication = (medId: string) => {
    playChime('success');
    setMedications((prev) =>
      prev.map((m) => {
        if (m.id === medId) {
          const updatedTaken = !m.takenToday;
          apiService.toggleMedicationAdherence(medId, updatedTaken).catch(console.error);
          return {
            ...m,
            takenToday: updatedTaken,
            adherenceRate: updatedTaken ? Math.min(100, m.adherenceRate + 2) : Math.max(70, m.adherenceRate - 2)
          };
        }
        return m;
      })
    );
  };

  const activateReminderStep = (stepId: string) => {
    activeReminderStepRef.current = stepId;
    setActiveReminderStepId(stepId);
    setReminderStepStates((previous) => {
      const next = { ...previous };
      Object.entries(next).forEach(([id, status]) => {
        if (status === 'ACTIVE') next[id] = 'EXPIRED';
      });
      next[stepId] = 'ACTIVE';
      return next;
    });
  };

  const markReminderStepAnswered = (stepId: string) => {
    if (activeReminderStepRef.current === stepId) {
      activeReminderStepRef.current = null;
      setActiveReminderStepId(null);
    }
    setReminderStepStates((previous) => ({ ...previous, [stepId]: 'ANSWERED' }));
  };

  const appendConversationMessage = (
    textHi: string,
    quickActions?: ChatMessage['quickActions'],
    options?: { activateReminderStep?: boolean },
  ) => {
    localPrescriptionMessageSequenceRef.current += 1;
    const id = `local-prescription-${Date.now()}-${localPrescriptionMessageSequenceRef.current}`;
    const message: ChatMessage = {
      id,
      sender: 'vda',
      agent: 'medication',
      text: textHi,
      textHi,
      textTa: textHi,
      textKn: textHi,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      audioAvailable: true,
      quickActions,
      reminderStepId: options?.activateReminderStep ? id : undefined,
    };
    if (options?.activateReminderStep) activateReminderStep(id);
    setMessages((previous) => [...previous, message]);
    return id;
  };

  const askForReminderTime = (draft: PrescriptionReminderDraft, medicineIndex: number, timeIndex = 0) => {
    const medicine = draft.medicines[medicineIndex];
    if (!medicine) return;
    setReminderSetup({ draft, phase: 'ASK_TIME', medicineIndex, timeIndex });
    const instruction = medicine.timing ? ` पर्ची में “${medicine.timing}” लिखा है, पर यह रिमाइंडर का सही घड़ी समय नहीं बताता।` : '';
    const occurrence = medicine.times.length > 1 ? ` (दिन में ${timeIndex + 1}वीं बार)` : '';
    appendConversationMessage(`${medicine.medicineName}${medicine.frequency ? ` ${medicine.frequency}` : ''}${occurrence} लिखी है।${instruction} आपको इसकी याद किस समय दिलाऊँ?`);
  };

  const askForNextReminderTime = (draft: PrescriptionReminderDraft, startIndex: number) => {
    const medicineIndex = draft.medicines.findIndex((medicine, index) => index >= startIndex && medicine.enabled);
    if (medicineIndex < 0) {
      const scheduled = draft.medicines.filter((medicine) => medicine.enabled)
        .map((medicine) => `✓ ${medicine.medicineName} — ${medicine.times.map((time) => reminderTimeLabel(time, lang)).join(', ')}`)
        .join('\n');
      setReminderSetup({ draft, phase: 'ACTIVATE', medicineIndex: draft.medicines.length });
      appendConversationMessage(
        `मैंने आपके दवा रिमाइंडर तैयार कर दिए हैं:\n${scheduled}\n\nक्या मैं इन्हें चालू कर दूँ?`,
        [
          { label: 'हाँ, चालू करें', labelHi: 'हाँ, चालू करें', action: 'confirm_medicine_reminders' },
          { label: 'समय बदलें', labelHi: 'समय बदलें', action: 'change_medicine_reminder_time' },
        ],
        { activateReminderStep: true },
      );
      return;
    }
    const medicine = draft.medicines[medicineIndex];
    if (medicine.requiresConfirmation && !medicine.confirmed) {
      setReminderSetup({ draft, phase: 'CONFIRM_MEDICINE', medicineIndex });
      appendConversationMessage(
        `${medicine.medicineName} की जानकारी पर्ची में पूरी तरह साफ़ नहीं है। कृपया नाम और खुराक देखकर पुष्टि करें: ${medicine.dosageText}। क्या यह सही है?`,
        [
          { label: 'हाँ', labelHi: 'हाँ', action: 'confirm_medicine_reminders' },
          { label: 'नहीं', labelHi: 'नहीं', action: 'skip_medicine_reminders' },
        ],
        { activateReminderStep: true },
      );
      return;
    }
    askForReminderTime(draft, medicineIndex);
  };

  const reminderActivationMessage = (draft: PrescriptionReminderDraft, notificationPermission: MedicineReminderSnapshot['notificationPermission']) => {
    const schedule = draft.medicines
      .filter((medicine) => medicine.enabled && medicine.confirmed)
      .map((medicine) => `✓ ${medicine.medicineName} — ${medicine.times.map((time) => reminderTimeLabel(time, lang)).join(', ')}`)
      .join('\n');
    if (notificationPermission === 'granted') {
      return `ठीक है। आपके दवा रिमाइंडर चालू कर दिए गए हैं।\n\n${schedule}`;
    }
    if (notificationPermission === 'unavailable') {
      return `आपके रिमाइंडर इस ब्राउज़र में सेव कर दिए गए हैं। फोन ऐप में नोटिफिकेशन चालू होने पर आपको समय पर याद दिलाया जाएगा।\n\n${schedule}`;
    }
    return `आपके रिमाइंडर इस फोन में सेव कर दिए गए हैं। समय पर सूचना पाने के लिए नोटिफिकेशन की अनुमति दें।\n\n${schedule}`;
  };

  /** Sends only confirmed reminder names/times; server resolves prescription facts itself. */
  const syncPrescriptionSessionContext = async (
    sessionId: string,
    snapshot: MedicineReminderSnapshot,
  ) => {
    const prescription = snapshot.activePrescription;
    if (!prescription?.id || !['EXTRACTED', 'READY'].includes(prescription.status)) return;
    const reminders = snapshot.reminders
      .filter((reminder) => (
        reminder.active
        && reminder.confirmed
        && reminder.prescriptionId === prescription.id
        && reminder.times.length > 0
        && reminder.times.every((time) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
      ))
      .map((reminder) => ({ medicineName: reminder.medicineName, times: reminder.times }));
    await apiService.refreshPrescriptionSessionContext(sessionId, prescription.id, reminders);
  };

  const handleReminderSetupResponse = async (text: string): Promise<ReminderResponseResult> => {
    if (!reminderSetup) return { handled: false, answered: false };
    const answer = text.trim();
    const currentMedicine = reminderSetup.draft.medicines[reminderSetup.medicineIndex];

    if (reminderSetup.phase === 'OFFER') {
      if (isAffirmative(answer)) {
        askForNextReminderTime(reminderSetup.draft, 0);
      } else if (isNegative(answer)) {
        setReminderSetup(null);
        setPrescriptionReminderDraft(null);
        appendConversationMessage('ठीक है। आपकी पर्ची इस फोन में सुरक्षित है। जब चाहें, दवा रिमाइंडर चालू कर सकते हैं।');
      } else {
        appendConversationMessage('क्या मैं आपको इन दवाइयों को समय पर लेने के लिए याद दिलाऊँ? कृपया हाँ या नहीं कहें।');
      }
      return { handled: true, answered: isAffirmative(answer) || isNegative(answer) };
    }

    if (reminderSetup.phase === 'ACTIVATE') {
      const activationConfirmed = isReminderActivationConfirmation(answer);
      if (activationConfirmed) {
        const scheduledMedicines = reminderSetup.draft.medicines.filter((medicine) => (
          medicine.enabled
          && medicine.confirmed
          && medicine.times.length > 0
          && medicine.times.every(Boolean)
        ));
        if (!scheduledMedicines.length) {
          appendConversationMessage('रिमाइंडर चालू करने से पहले कम से कम एक दवा का समय चुनें।');
          askForNextReminderTime(reminderSetup.draft, 0);
          return { handled: true, answered: false };
        }
        const snapshot = await medicineReminderService.confirmDraft(reminderSetup.draft);
        setMedicineReminderSnapshot(snapshot);
        if (activeSessionId) await syncPrescriptionSessionContext(activeSessionId, snapshot);
        setPrescriptionReminderDraft(null);
        setReminderSetup(null);
        appendConversationMessage(reminderActivationMessage(reminderSetup.draft, snapshot.notificationPermission));
      } else if (isNegative(answer) || /बदल|change/i.test(answer)) {
        askForNextReminderTime(reminderSetup.draft, 0);
      } else {
        appendConversationMessage('क्या मैं रिमाइंडर चालू कर दूँ? कृपया हाँ या समय बदलें कहें।');
      }
      return { handled: true, answered: activationConfirmed || isNegative(answer) || /बदल|change/i.test(answer) };
    }

    if (!currentMedicine) return { handled: false, answered: false };
    if (reminderSetup.phase === 'CONFIRM_MEDICINE') {
      const medicines = reminderSetup.draft.medicines.map((medicine, index) => index === reminderSetup.medicineIndex
        ? { ...medicine, confirmed: isAffirmative(answer), enabled: isAffirmative(answer) }
        : medicine);
      const draft = { ...reminderSetup.draft, medicines };
      if (isAffirmative(answer)) askForNextReminderTime(draft, reminderSetup.medicineIndex);
      else if (isNegative(answer)) askForNextReminderTime(draft, reminderSetup.medicineIndex + 1);
      else appendConversationMessage('कृपया हाँ या नहीं कहकर पुष्टि करें।');
      return { handled: true, answered: isAffirmative(answer) || isNegative(answer) };
    }

    if (reminderSetup.phase === 'ASK_TIME') {
      const parsed = parseReminderTime(answer);
      if (parsed.value) {
        setReminderSetup({ ...reminderSetup, phase: 'CONFIRM_TIME', pendingTime: parsed.value });
        appendConversationMessage(`${currentMedicine.medicineName} के लिए रोज़ ${reminderTimeLabel(parsed.value, lang)} रिमाइंडर लगा दूँ?`, [
          { label: 'हाँ', labelHi: 'हाँ', action: 'confirm_medicine_reminders' },
          { label: 'समय बदलें', labelHi: 'समय बदलें', action: 'change_medicine_reminder_time' },
        ], { activateReminderStep: true });
      } else if (parsed.ambiguous) {
        setReminderSetup({ ...reminderSetup, phase: 'ASK_PERIOD', pendingHour: parsed.hour, pendingMinute: parsed.minute });
        appendConversationMessage('यह समय सुबह है या शाम?');
      } else {
        appendConversationMessage('मुझे सही समय समझ नहीं आया। जैसे “सुबह 8 बजे”, “शाम 6 बजे” या “8 AM” कहें।');
      }
      return { handled: true, answered: false };
    }

    if (reminderSetup.phase === 'ASK_PERIOD') {
      const period = /सुबह|morning|am/i.test(answer) ? 'AM' : /शाम|रात|evening|night|pm/i.test(answer) ? 'PM' : null;
      if (!period || !reminderSetup.pendingHour) {
        appendConversationMessage('कृपया सुबह या शाम कहें।');
        return { handled: true, answered: false };
      }
      const hour24 = period === 'PM' && reminderSetup.pendingHour < 12 ? reminderSetup.pendingHour + 12 : period === 'AM' && reminderSetup.pendingHour === 12 ? 0 : reminderSetup.pendingHour;
      const pendingTime = `${String(hour24).padStart(2, '0')}:${String(reminderSetup.pendingMinute || 0).padStart(2, '0')}`;
      setReminderSetup({ ...reminderSetup, phase: 'CONFIRM_TIME', pendingTime });
      appendConversationMessage(`${currentMedicine.medicineName} के लिए रोज़ ${reminderTimeLabel(pendingTime, lang)} रिमाइंडर लगा दूँ?`, [
        { label: 'हाँ', labelHi: 'हाँ', action: 'confirm_medicine_reminders' },
        { label: 'समय बदलें', labelHi: 'समय बदलें', action: 'change_medicine_reminder_time' },
      ], { activateReminderStep: true });
      return { handled: true, answered: true };
    }

    if (reminderSetup.phase === 'CONFIRM_TIME') {
      if (isAffirmative(answer) && reminderSetup.pendingTime) {
        const timeIndex = reminderSetup.timeIndex || 0;
        const medicines = reminderSetup.draft.medicines.map((medicine, index) => {
          if (index !== reminderSetup.medicineIndex) return medicine;
          const times = medicine.times.length ? [...medicine.times] : [''];
          times[timeIndex] = reminderSetup.pendingTime!;
          return { ...medicine, times, confirmed: true };
        });
        const draft = { ...reminderSetup.draft, medicines };
        const updatedMedicine = medicines[reminderSetup.medicineIndex];
        if (timeIndex + 1 < updatedMedicine.times.length) {
          askForReminderTime(draft, reminderSetup.medicineIndex, timeIndex + 1);
        } else {
          askForNextReminderTime(draft, reminderSetup.medicineIndex + 1);
        }
      } else if (isNegative(answer) || /बदल|change/i.test(answer)) {
        askForReminderTime(reminderSetup.draft, reminderSetup.medicineIndex, reminderSetup.timeIndex || 0);
      } else {
        appendConversationMessage('कृपया हाँ कहकर समय की पुष्टि करें, या समय बदलें कहें।');
      }
      return { handled: true, answered: Boolean(
        (isAffirmative(answer) && reminderSetup.pendingTime)
        || isNegative(answer)
        || /बदल|change/i.test(answer),
      ) };
    }

    return { handled: false, answered: false };
  };

  // Process user message with optional prescription document attachment
  const handleSendMessage = async (userText: string, attachmentFile?: File, submittedReminderStepId?: string) => {
    if (isProcessingMessage) return;
    playChime('start');
    setIsProcessingMessage(true);
    // Emergency presentation is strictly per turn. A new message always starts
    // with normal routing and cannot inherit an earlier emergency card or poll.
    activeEmergencyTurnIdRef.current = null;
    setClinicalReview(null);
    setEmergencyFallback(null);

    let attachmentInfo = undefined;
    if (attachmentFile) {
      const isImage = attachmentFile.type.startsWith('image/');
      attachmentInfo = {
        name: attachmentFile.name,
        type: attachmentFile.type.split('/')[1]?.toUpperCase() || 'DOCUMENT',
        url: isImage ? URL.createObjectURL(attachmentFile) : undefined,
        isImage
      };
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      textHi: userText,
      textTa: userText,
      textKn: userText,
      attachment: attachmentInfo,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);

    // Voice and typed replies use the same patient-led reminder conversation.
    const reminderStepIdAtSubmission = submittedReminderStepId || activeReminderStepRef.current;
    const hasLocalReminderWorkflow = Boolean(reminderSetup || reminderStepIdAtSubmission);
    const reminderResponse = !attachmentFile
      ? await handleReminderSetupResponse(userText)
      : { handled: false, answered: false };
    if (reminderResponse.handled) {
      if (reminderResponse.answered && reminderStepIdAtSubmission) {
        markReminderStepAnswered(reminderStepIdAtSubmission);
      }
      setIsProcessingMessage(false);
      return;
    }
    if (!attachmentFile && hasLocalReminderWorkflow) {
      // An active device-local workflow is never allowed to fall through into a
      // normal VDA turn, even if its persisted UI state was interrupted.
      appendConversationMessage('रिमाइंडर की जानकारी अभी पूरी नहीं हुई है। कृपया दिए गए समय या विकल्प के अनुसार जवाब दें।');
      setIsProcessingMessage(false);
      return;
    }

    // Ensure session exists and upload prescription attachment if attached
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const sessionRes = await apiService.createPatientSession(currentPersonaKey);
      if (sessionRes?.session_id) {
        currentSessionId = sessionRes.session_id;
        setActiveSessionId(currentSessionId);
      }
    }

    let extractedDraft: PrescriptionReminderDraft | null = null;
    if (attachmentFile && currentSessionId) {
      try {
        await medicineReminderService.beginPrescriptionProcessing(currentPersonaKey);
        setMedicineReminderSnapshot(await medicineReminderService.snapshot(currentPersonaKey));
        appendConversationMessage('मैं आपकी पर्ची देख रहा हूँ…');
        const prescription = await apiService.uploadPrescription(currentSessionId, attachmentFile);
        const draft = prescriptionToReminderDraft(currentPersonaKey, prescription);
        if (draft.medicines.length > 0) {
          extractedDraft = draft;
          setPrescriptionReminderDraft(draft);
        }
      } catch (err: any) {
        await medicineReminderService.markPrescriptionExtractionFailed(currentPersonaKey);
        setMedicineReminderSnapshot(await medicineReminderService.snapshot(currentPersonaKey));
        console.warn('[VDA App] Prescription upload failed:', err);
        const errMsg: ChatMessage = {
          id: `upload-err-${Date.now()}`,
          sender: 'vda',
          agent: 'router',
          text: `Prescription upload notice: ${err.message || 'Unable to upload file to backend.'}`,
          textHi: `पर्ची अपलोड सूचना: ${err.message || 'फाइल सर्वर तक नहीं पहुँच पाई।'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, errMsg]);
        setIsProcessingMessage(false);
        return;
      }
    }

    if (attachmentFile) {
      if (!extractedDraft) {
        appendConversationMessage('पर्ची से दवा की जानकारी की पुष्टि नहीं हो सकी। कृपया साफ़ फोटो या PDF फिर से अपलोड करें।');
      } else {
        try {
          // The backend resolves this exact session-owned prescription by ID.
          // No extracted medicine facts are sent from the device in this turn.
          const result = await apiService.processVdaQuery(
            'मेरी अपलोड की गई पर्ची में लिखी दवाओं को सरल भाषा में समझाएं।',
            patient,
            medications,
            observations,
            lang,
            currentSessionId,
            { disableLocalFallback: true, prescriptionId: extractedDraft.prescriptionId },
          );
          setMessages((previous) => [...previous, {
            ...result.message,
            prescriptionScoped: true,
          }]);

          // Only a successfully explained trusted prescription becomes the
          // active local source used to refresh the server-held safe context.
          const snapshot = await medicineReminderService.saveExtractedPrescription(extractedDraft);
          setMedicineReminderSnapshot(snapshot);
          if (currentSessionId) await syncPrescriptionSessionContext(currentSessionId, snapshot);
          setPrescriptionReminderDraft(extractedDraft);
          setReminderSetup({ draft: extractedDraft, phase: 'OFFER', medicineIndex: 0 });
          appendConversationMessage(
            'क्या मैं आपको इन दवाइयों को समय पर लेने के लिए रिमाइंडर लगा दूँ?',
            [
              { label: 'हाँ, रिमाइंडर लगाएँ', labelHi: 'हाँ, रिमाइंडर लगाएँ', action: 'setup_medicine_reminders' },
              { label: 'अभी नहीं', labelHi: 'अभी नहीं', action: 'skip_medicine_reminders' },
            ],
            { activateReminderStep: true },
          );
        } catch {
          appendConversationMessage('पर्ची की जानकारी अभी समझाई नहीं जा सकी। कृपया थोड़ी देर बाद फिर प्रयास करें।');
        }
      }
      setIsProcessingMessage(false);
      return;
    }

    try {
      const latestAssistantMessage = [...messages].reverse().find((message) => message.sender === 'vda');
      const followsLocalPrescriptionAnswer = Boolean(
        (latestAssistantMessage?.id.startsWith('local-prescription-') || latestAssistantMessage?.prescriptionScoped)
        && isPrescriptionMedicineFollowUp(userText),
      );
      const localSnapshot = await medicineReminderService.snapshot(currentPersonaKey);
      setMedicineReminderSnapshot(localSnapshot);
      const medicineRoute = classifyPrescriptionMedicineQuery(userText, localSnapshot);
      const isPrescriptionContextQuestion = !attachmentFile && (
        medicineRoute.route !== 'NONE' || followsLocalPrescriptionAnswer
      );
      if (isPrescriptionContextQuestion && currentSessionId) {
        await syncPrescriptionSessionContext(currentSessionId, localSnapshot);
      }

      // The backend owns all prescription-context reasoning. The device only
      // refreshes its confirmed reminder times and blocks any FHIR/mock fallback.
      // SafetyGate remains the backend's first decision for unsafe questions.
      const result = await apiService.processVdaQuery(
        userText,
        patient,
        medications,
        observations,
        lang,
        currentSessionId,
        isPrescriptionContextQuestion
          ? {
              disableLocalFallback: true,
              prescriptionContextRequired: true,
            }
          : undefined,
      );
      if (result.responseType !== 'clinical-review') setMessages((prev) => [...prev, result.message]);
      if (currentSessionId && (result.escalationDetected || result.responseType === 'clinical-review')) {
        const state = await apiService.getClinicalReviewState(currentSessionId);
        activeEmergencyTurnIdRef.current = userMsg.id;
        setClinicalReview(state);
        setEmergencyFallback({ review: state, messageId: userMsg.id });
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: `backend-unavailable-${Date.now()}`,
        sender: 'vda',
        agent: 'router',
        text: 'VDA service is unavailable. Please try again.',
        textHi: 'VDA सेवा अभी उपलब्ध नहीं है। कृपया फिर प्रयास करें।',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsProcessingMessage(false);
    }
  };

  // Trigger manual or test escalation
  // The test control now sends the same input through the backend SafetyGate.
  const handleTriggerEscalation = (reason: string) => { void handleSendMessage(reason); };

  const handleReminderQuickAction = async (stepId: string, action: string) => {
    if (activeReminderStepRef.current !== stepId || reminderStepStates[stepId] !== 'ACTIVE') return;
    if (reminderActionInFlightRef.current.has(stepId)) return;
    const textByAction: Record<string, string> = {
      setup_medicine_reminders: 'हाँ, रिमाइंडर लगाएँ',
      confirm_medicine_reminders: 'हाँ',
      skip_medicine_reminders: 'अभी नहीं',
      change_medicine_reminder_time: 'समय बदलें',
    };
    const response = textByAction[action];
    if (!response) return;
    reminderActionInFlightRef.current.add(stepId);
    try {
      // Do not clear the active step before the local state machine sees the
      // answer; it needs the current phase to process the final confirmation.
      await handleSendMessage(response, undefined, stepId);
    } finally {
      reminderActionInFlightRef.current.delete(stepId);
    }
  };

  const openEmergencyEsanjeevani = async () => {
    await apiService.openEsanjeevani();
  };

  const dismissEmergencyFallback = () => {
    activeEmergencyTurnIdRef.current = null;
    setClinicalReview(null);
    setEmergencyFallback(null);
  };

  const refreshMedicineReminders = async () => {
    const snapshot = await medicineReminderService.snapshot(currentPersonaKey);
    setMedicineReminderSnapshot(snapshot);
    if (activeSessionId) await syncPrescriptionSessionContext(activeSessionId, snapshot);
  };

  const confirmPrescriptionReminders = async (draft: PrescriptionReminderDraft) => {
    const snapshot = await medicineReminderService.confirmDraft(draft);
    setMedicineReminderSnapshot(snapshot);
    if (activeSessionId) await syncPrescriptionSessionContext(activeSessionId, snapshot);
    setPrescriptionReminderDraft(null);
  };

  const updateMedicineReminder = async (id: string, patch: { times: string[]; active: boolean }) => {
    const snapshot = await medicineReminderService.updateReminder(currentPersonaKey, id, patch);
    setMedicineReminderSnapshot(snapshot);
    if (activeSessionId) await syncPrescriptionSessionContext(activeSessionId, snapshot);
  };

  const deleteMedicineReminder = async (id: string) => {
    const snapshot = await medicineReminderService.deleteReminder(currentPersonaKey, id);
    setMedicineReminderSnapshot(snapshot);
    if (activeSessionId) await syncPrescriptionSessionContext(activeSessionId, snapshot);
  };

  const enableMedicineNotifications = async () => {
    setMedicineReminderSnapshot(await medicineReminderService.enableNotifications(currentPersonaKey));
  };

  const disableAllMedicineReminders = async () => {
    for (const reminder of medicineReminderSnapshot.reminders) {
      await medicineReminderService.updateReminder(currentPersonaKey, reminder.id, { times: reminder.times, active: false });
    }
    await refreshMedicineReminders();
  };

  const recordMedicineTaken = async (reminderId: string, time: string) => {
    setMedicineReminderSnapshot(await medicineReminderService.recordTakenFromApp(currentPersonaKey, reminderId, time));
  };

  const snoozeMedicineReminder = async (reminderId: string, time: string) => {
    setMedicineReminderSnapshot(await medicineReminderService.snoozeFromApp(currentPersonaKey, reminderId, time));
  };

  // Save new observation (e.g. self reported sugar/BP)
  const handleSaveVital = (newObs: FhirObservation) => {
    setObservations((prev) => [newObs, ...prev]);
    apiService.logObservation(newObs).catch(console.error);

    // Send confirmation in VDA chat
    const confirmMsg: ChatMessage = {
      id: `vital-conf-${Date.now()}`,
      sender: 'vda',
      agent: 'lab_explainer',
      text: `Recorded new ${newObs.display} of ${newObs.value} ${newObs.unit}. Added to your ABDM observation log.`,
      textHi: `नया माप दर्ज किया गया: ${newObs.displayHi || newObs.display} (${newObs.value} ${newObs.unit})। आपके स्वास्थ्य रिकॉर्ड में सुरक्षित हो गया।`,
      textTa: `புதிய அளவீடு பதிவு செய்யப்பட்டது: ${newObs.displayTa || newObs.display} (${newObs.value} ${newObs.unit})। உங்கள் சுகாதார பதிவில் சேர்க்கப்பட்டது.`,
      textKn: `ಹೊಸ ರೀಡಿಂಗ್ ದಾಖಲಾಗಿದೆ: ${newObs.displayKn || newObs.display} (${newObs.value} ${newObs.unit})। ನಿಮ್ಮ ಆರೋಗ್ಯ ದಾಖಲೆಯಲ್ಲಿ ಸೇರಿಸಲಾಗಿದೆ.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      audioAvailable: true
    };
    setMessages((prev) => [...prev, confirmMsg]);
  };

  // Revoke consent
  const handleRevokeConsent = (consentId: string) => {
    playChime('stop');
    apiService.revokeConsent(consentId).catch(console.error);
    setConsents((prev) =>
      prev.map((c) => (c.id === consentId ? { ...c, status: 'REVOKED' } : c))
    );
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-slate-950 text-slate-100 flex justify-center selection:bg-emerald-500 selection:text-white overflow-hidden">
      {/* Responsive Full-Screen Mobile App Container (Up to max-w-xl on larger screens) */}
      <div className="w-full max-w-xl h-full max-h-full bg-slate-950 flex flex-col relative border-x border-slate-800/80 shadow-2xl overflow-hidden">
        
        {/* Onboarding / Language & ABDM Login Modal */}
        <OnboardingModal
          isOpen={isOnboardingOpen}
          onComplete={(chosenLang) => {
            setLang(chosenLang);
            setIsOnboardingOpen(false);
          }}
          selectedLang={lang}
          onLangChange={setLang}
        />

        {/* Log Vital Metric Modal */}
        <LogVitalModal
          isOpen={isLogVitalOpen}
          onClose={() => setIsLogVitalOpen(false)}
          onSaveVital={handleSaveVital}
          lang={lang}
        />

        {isMedicineRemindersOpen && (
          <MedicineRemindersModal
            lang={lang}
            draft={prescriptionReminderDraft}
            snapshot={medicineReminderSnapshot}
            onClose={() => { setPrescriptionReminderDraft(null); setIsMedicineRemindersOpen(false); }}
            onConfirmDraft={confirmPrescriptionReminders}
            onUpdateReminder={updateMedicineReminder}
            onDeleteReminder={deleteMedicineReminder}
            onEnableNotifications={enableMedicineNotifications}
            onDisableAll={disableAllMedicineReminders}
          />
        )}

        {/* Main Tab Screen Switcher */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {activeTab === 'vda' && (
            <VdaTab
              patient={patient}
              lang={lang}
              messages={messages}
              medicineReminderSnapshot={medicineReminderSnapshot}
              emergencyFallback={emergencyFallback}
              isProcessing={isProcessingMessage}
              onSendMessage={handleSendMessage}
              activeReminderStepId={activeReminderStepId}
              reminderStepStates={reminderStepStates}
              onReminderQuickAction={handleReminderQuickAction}
              onNavigateTab={setActiveTab}
              onTriggerEscalation={handleTriggerEscalation}
              onOpenLogVital={() => setIsLogVitalOpen(true)}
              onOpenMedicineReminders={() => setIsMedicineRemindersOpen(true)}
              onRecordMedicineTaken={recordMedicineTaken}
              onSnoozeMedicineReminder={snoozeMedicineReminder}
              onOpenEmergencyTeleconsultation={openEmergencyEsanjeevani}
              onDismissEmergency={dismissEmergencyFallback}
            />
          )}

          {activeTab === 'records' && (
            <RecordsTab
              patient={patient}
              conditions={conditions}
              medications={medications}
              observations={observations}
              documents={documents}
              lang={lang}
              onToggleMedicationTaken={handleToggleMedication}
              onOpenLogVital={() => setIsLogVitalOpen(true)}
            />
          )}

          {activeTab === 'facilities' && (
            <FacilitiesTab
              facilities={FACILITIES_LIST}
              schemes={HEALTH_SCHEMES_LIST}
              patient={patient}
              lang={lang}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileTab
              patient={patient}
              consents={consents}
              lang={lang}
              onLangChange={setLang}
              onSwitchPersona={handleSwitchPersona}
              onRevokeConsent={handleRevokeConsent}
              onResetSession={() => setIsOnboardingOpen(true)}
            />
          )}
        </main>

        {/* Bottom Primary Mobile Navigation Tab Bar (44px+ touch targets) */}
        <nav aria-label="Main Navigation" className="flex-shrink-0 w-full bg-slate-900/95 border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around z-30 backdrop-blur-md">
          <button
            id="nav-tab-vda"
            onClick={() => {
              playChime('start');
              setActiveTab('vda');
            }}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-xl transition-all ${
              activeTab === 'vda'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'vda' ? 'bg-emerald-500/20' : ''}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight">{getTranslation(lang, 'tabVda')}</span>
          </button>

          <button
            id="nav-tab-records"
            onClick={() => {
              playChime('start');
              setActiveTab('records');
            }}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-xl transition-all ${
              activeTab === 'records'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'records' ? 'bg-emerald-500/20' : ''}`}>
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight">{getTranslation(lang, 'tabRecords')}</span>
          </button>

          <button
            id="nav-tab-facilities"
            onClick={() => {
              playChime('start');
              setActiveTab('facilities');
            }}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-xl transition-all ${
              activeTab === 'facilities'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'facilities' ? 'bg-emerald-500/20' : ''}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight">{getTranslation(lang, 'tabFacilities')}</span>
          </button>

          <button
            id="nav-tab-profile"
            onClick={() => {
              playChime('start');
              setActiveTab('profile');
            }}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-xl transition-all ${
              activeTab === 'profile'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-emerald-500/20' : ''}`}>
              <User className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-tight">{getTranslation(lang, 'tabProfile')}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
