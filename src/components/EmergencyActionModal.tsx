import React, { useState, useEffect } from 'react';
import { Phone, Hospital, ExternalLink, AlertTriangle, X, Volume2, VolumeX, ShieldAlert, Navigation } from 'lucide-react';
import { Facility, LanguageCode } from '../types';
import { speakText, stopSpeaking, playChime } from '../utils/i18n';
import { FACILITIES_LIST } from '../data/syntheticData';

interface EmergencyActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
  symptomQuery?: string;
  nearbyFacilities?: Facility[];
}

const label = (lang: LanguageCode, hi: string, en: string) => (lang === 'hi' ? hi : en);

export const EmergencyActionModal: React.FC<EmergencyActionModalProps> = ({
  isOpen,
  onClose,
  lang,
  symptomQuery,
  nearbyFacilities = FACILITIES_LIST,
}) => {
  const [speaking, setSpeaking] = useState(false);
  const [showAllFacilities, setShowAllFacilities] = useState(false);

  useEffect(() => {
    if (isOpen) {
      playChime('start');
    }
    return () => stopSpeaking();
  }, [isOpen]);

  if (!isOpen) return null;

  const guidanceText = label(
    lang,
    'यदि आपकी स्थिति गंभीर है या सीने में तेज दर्द, सांस लेने में तकलीफ अथवा बेहोशी जैसे लक्षण हैं, तो बिल्कुल इंतजार न करें। तुरंत 108 पर एम्बुलेंस बुलाएं या नजदीकी बड़े अस्पताल जाएं।',
    'If you are experiencing severe chest pain, extreme breathlessness, or collapse, do not wait. Call an ambulance at 108 or go to the nearest emergency hospital immediately.',
  );

  const toggleSpeakGuidance = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      speakText(guidanceText, lang, () => setSpeaking(false));
    }
  };

  // Filter facilities with emergency or hospital capabilities
  const hospitals = (nearbyFacilities && nearbyFacilities.length > 0 ? nearbyFacilities : FACILITIES_LIST)
    .filter((f) => f.emergencyCapabilityVerified || f.type === 'DISTRICT_HOSPITAL' || f.type === 'MEDICAL_COLLEGE')
    .slice(0, showAllFacilities ? 10 : 3);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-lg rounded-2xl border-2 border-red-500/80 bg-slate-950 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-red-900/60 bg-red-950/70 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/40">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h2 id="emergency-modal-title" className="text-sm sm:text-base font-extrabold text-white">
                {label(lang, '🚨 आपातकालीन सहायता (Emergency)', '🚨 Emergency Medical Assistance')}
              </h2>
              <p className="text-[11px] text-red-200/90 font-medium">
                {symptomQuery ? `${label(lang, 'लक्षण: ', 'Reported: ')} ${symptomQuery}` : label(lang, 'तुरंत चिकित्सकीय मदद लें', 'Immediate assistance available')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopSpeaking();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close emergency modal"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Urgent Warning Alert */}
          <section className="rounded-xl border border-red-500/40 bg-red-950/40 p-3.5 text-red-100">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1">
                <b className="block text-xs font-bold text-red-200 uppercase tracking-wide">
                  {label(lang, 'अति आवश्यक सलाह', 'Critical Clinical Guidance')}
                </b>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed text-red-100">{guidanceText}</p>
                <button
                  type="button"
                  onClick={toggleSpeakGuidance}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold transition-colors"
                >
                  {speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {speaking ? label(lang, 'आवाज़ रोकें', 'Stop Listening') : label(lang, 'बोलकर सुनें (Listen)', 'Listen Audio')}
                </button>
              </div>
            </div>
          </section>

          {/* Primary Action 1: Call Ambulance */}
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              {label(lang, '1. तुरंत एम्बुलेंस बुलाएं', '1. Immediate Ambulance')}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href="tel:108"
                className="flex items-center justify-between p-3.5 rounded-xl border-2 border-red-500 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950 transition-all active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                    <Phone className="h-5 w-5 text-white" />
                  </span>
                  <div>
                    <b className="block text-base leading-none">108</b>
                    <span className="text-[11px] text-red-100 font-medium">
                      {label(lang, 'आपातकालीन एम्बुलेंस (Toll-Free)', 'Emergency Ambulance (Free)')}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">
                  {label(lang, 'कॉल करें', 'Dial')}
                </span>
              </a>

              <a
                href="tel:102"
                className="flex items-center justify-between p-3.5 rounded-xl border border-amber-500/50 bg-slate-900 hover:bg-slate-800 text-amber-200 transition-all active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                    <Phone className="h-5 w-5" />
                  </span>
                  <div>
                    <b className="block text-base leading-none text-white">102</b>
                    <span className="text-[11px] text-slate-300 font-medium">
                      {label(lang, 'मातृ एवं शिशु सेवा / एम्बुलेंस', 'Maternal & Child Ambulance')}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold bg-amber-500/20 px-2 py-1 rounded-lg">
                  {label(lang, 'कॉल करें', 'Dial')}
                </span>
              </a>
            </div>
          </div>

          {/* Primary Action 2: eSanjeevani National Teleconsultation */}
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              {label(lang, '2. eSanjeevani राष्ट्रीय टेलीकंसल्टेशन', '2. eSanjeevani Teleconsultation')}
            </span>
            <div className="p-3.5 rounded-xl border border-sky-500/40 bg-sky-950/30 flex items-center justify-between gap-3">
              <div>
                <b className="block text-sm text-sky-200">
                  {label(lang, 'eSanjeevani OPD (भारत सरकार)', 'eSanjeevani OPD (Govt. of India)')}
                </b>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {label(lang, 'निःशुल्क डॉक्टर से ऑनलाइन परामर्श या 1075 पर कॉल करें', 'Free doctor consultation or call national helpline 1075')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a
                  href="tel:1075"
                  className="px-2.5 py-1.5 rounded-lg border border-sky-400/50 bg-sky-900/60 text-sky-200 text-xs font-bold flex items-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5" /> 1075
                </a>
                <button
                  type="button"
                  onClick={() => window.open('https://esanjeevani.mohfw.gov.in', '_blank')}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> {label(lang, 'खोलें', 'Open')}
                </button>
              </div>
            </div>
          </div>

          {/* Primary Action 3: Nearby Emergency Hospitals */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {label(lang, '3. नजदीकी आपातकालीन अस्पताल', '3. Nearby Emergency Hospitals')}
              </span>
              <button
                type="button"
                onClick={() => setShowAllFacilities(!showAllFacilities)}
                className="text-xs text-emerald-400 font-semibold hover:underline"
              >
                {showAllFacilities ? label(lang, 'कम देखें', 'Show Fewer') : label(lang, 'सभी देखें', 'Show More')}
              </button>
            </div>

            <div className="space-y-2.5">
              {hospitals.map((facility, index) => (
                <article
                  key={`${facility.id || facility.name}-${index}`}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-900 text-xs space-y-1.5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <b className="text-sm font-bold text-white block">{facility.name}</b>
                      <p className="text-[11px] text-slate-300">{[facility.district, facility.state].filter(Boolean).join(', ')}</p>
                    </div>
                    {facility.contactPhone && (
                      <a
                        href={`tel:${facility.contactPhone}`}
                        className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 flex items-center gap-1 font-bold text-[11px] shrink-0"
                      >
                        <Phone className="w-3.5 h-3.5" /> {label(lang, 'कॉल', 'Call')}
                      </a>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 font-semibold border border-red-500/30">
                      🚨 24x7 Emergency
                    </span>
                    {(facility.schemes?.includes('AYUSHMAN_BHARAT') || facility.schemes?.includes('PMJAY')) && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                        🛡️ PM-JAY Ayushman
                      </span>
                    )}
                    {facility.icuBeds && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                        ICU: {facility.icuBeds} Beds
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-800 bg-slate-900/90 p-3 flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
          >
            {label(lang, 'वापस जाएं (Dismiss)', 'Back to App')}
          </button>
        </footer>
      </div>
    </div>
  );
};
