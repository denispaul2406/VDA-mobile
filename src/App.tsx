import React, { useState } from 'react';
import { Sparkles, FileText, Building2, User } from 'lucide-react';
import { ChatMessage, ClinicalReviewState, FhirCondition, FhirDocument, FhirMedication, FhirObservation, LanguageCode, PatientDemographics } from './types';
import { SYNTHETIC_PATIENTS, FACILITIES_LIST, HEALTH_SCHEMES_LIST } from './data/syntheticData';
import { getTranslation, playChime } from './utils/i18n';
import { apiService } from './services/api';
import { createLocalPrescriptionFromUpload } from './utils/localMedicationStorage';

// Tab & Modal Components
import { OnboardingModal } from './components/OnboardingModal';
import { VdaTab } from './components/VdaTab';
import { RecordsTab } from './components/RecordsTab';
import { FacilitiesTab } from './components/FacilitiesTab';
import { ProfileTab } from './components/ProfileTab';
import { EscalationModal } from './components/EscalationModal';
import { LogVitalModal } from './components/LogVitalModal';

export default function App() {
  // Active Persona & Language
  const [currentPersonaKey, setCurrentPersonaKey] = useState<string>('synth-patient-001');
  const activeProfile = SYNTHETIC_PATIENTS[currentPersonaKey] || SYNTHETIC_PATIENTS['synth-patient-001'];

  const [lang, setLang] = useState<LanguageCode>('hi');
  const [activeTab, setActiveTab] = useState<'vda' | 'records' | 'facilities' | 'profile'>('vda');

  // Backend VDA Session State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

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

  // Clinical Escalation Takeover State
  const [clinicalReview, setClinicalReview] = useState<ClinicalReviewState | null>(null);

  // Initialize Auth & Session on mount
  React.useEffect(() => {
    const initAppSession = async () => {
      await apiService.initAuthToken();
      const sessionRes = await apiService.createPatientSession(currentPersonaKey);
      if (sessionRes?.session_id) {
        setActiveSessionId(sessionRes.session_id);
      }
    };
    initAppSession();
  }, []);

  // The backend owns the clinician deadline, fallback state, and connection state.
  React.useEffect(() => {
    if (!activeSessionId || !clinicalReview?.reviewRequested) return;
    let active = true;
    const refresh = async () => {
      try {
        const next = await apiService.getClinicalReviewState(activeSessionId);
        if (active) setClinicalReview(next);
      } catch {
        // Keep the last server-confirmed safety state visible; never replace it with mock data.
      }
    };
    const interval = window.setInterval(() => void refresh(), 4_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [activeSessionId, clinicalReview?.reviewRequested]);

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
    setClinicalReview(null);

    // Call backend session creation API for selected patient
    const sessionRes = await apiService.createPatientSession(key);
    if (sessionRes?.session_id) {
      setActiveSessionId(sessionRes.session_id);
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

  // Process user message with optional prescription document attachment
  const handleSendMessage = async (userText: string, attachmentFile?: File) => {
    if (isProcessingMessage) return;
    playChime('start');
    setIsProcessingMessage(true);

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

    // Ensure session exists and upload prescription attachment if attached
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const sessionRes = await apiService.createPatientSession(currentPersonaKey);
      if (sessionRes?.session_id) {
        currentSessionId = sessionRes.session_id;
        setActiveSessionId(currentSessionId);
      }
    }

    if (attachmentFile) {
      createLocalPrescriptionFromUpload(attachmentFile.name, undefined, attachmentInfo?.url);
    }

    if (attachmentFile && currentSessionId) {
      try {
        await apiService.uploadPrescription(currentSessionId, attachmentFile);
      } catch (err: any) {
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
      }
    }

    try {
      const result = await apiService.processVdaQuery(userText, patient, medications, observations, lang, currentSessionId);
      if (result.responseType !== 'clinical-review') setMessages((prev) => [...prev, result.message]);
      if (currentSessionId && (result.escalationDetected || result.responseType === 'clinical-review')) {
        const state = await apiService.getClinicalReviewState(currentSessionId);
        setClinicalReview(state);
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

  const handleClinicalMessage = async (text: string) => {
    if (!activeSessionId) throw new Error('NO_ACTIVE_SESSION');
    await apiService.processVdaQuery(text, patient, medications, observations, lang, activeSessionId);
    setClinicalReview(await apiService.getClinicalReviewState(activeSessionId));
  };

  const openTeleconsultation = async () => {
    if (!activeSessionId) throw new Error('NO_ACTIVE_SESSION');
    await apiService.requestClinicalReviewTeleconsultation(activeSessionId);
    await apiService.openEsanjeevani();
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

        {/* Direct Emergency Action Modal (Ambulance 108, eSanjeevani, Nearby Hospitals) */}
        {clinicalReview?.reviewRequested && (
          <EscalationModal
            review={clinicalReview}
            lang={lang}
            onSendMessageToClinician={handleClinicalMessage}
            onOpenTeleconsultation={openTeleconsultation}
            onClose={() => setClinicalReview(null)}
          />
        )}

        {/* Main Tab Screen Switcher */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {activeTab === 'vda' && (
            <VdaTab
              patient={patient}
              medications={medications}
              observations={observations}
              lang={lang}
              messages={messages}
              isProcessing={isProcessingMessage}
              onSendMessage={handleSendMessage}
              onToggleMedicationTaken={handleToggleMedication}
              onNavigateTab={setActiveTab}
              onTriggerEscalation={handleTriggerEscalation}
              onOpenLogVital={() => setIsLogVitalOpen(true)}
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
