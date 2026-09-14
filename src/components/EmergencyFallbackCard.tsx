import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, ExternalLink, Hospital, Phone } from 'lucide-react';
import { ClinicalReviewState, LanguageCode } from '../types';

type Props = {
  review: ClinicalReviewState;
  lang: LanguageCode;
  onOpenTeleconsultation: () => Promise<void>;
  onBack: () => void;
};

const label = (lang: LanguageCode, hi: string, en: string) => lang === 'hi' ? hi : en;

/** Patient-side emergency card. It does not connect to or wait for a clinician. */
export const EmergencyFallbackCard: React.FC<Props> = ({ review, lang, onOpenTeleconsultation, onBack }) => {
  const [showAllFacilities, setShowAllFacilities] = useState(false);
  const [error, setError] = useState('');
  const facilities = showAllFacilities ? review.nearbyFacilities : review.nearbyFacilities.slice(0, 3);
  const openTeleconsultation = async () => {
    setError('');
    try { await onOpenTeleconsultation(); }
    catch { setError(label(lang, 'eSanjeevani खोलने में समस्या हुई।', 'Unable to open eSanjeevani.')); }
  };
  return <section className="w-full rounded-2xl border border-red-400/45 bg-red-950/45 p-3.5 shadow-lg shadow-red-950/40">
    <div className="mb-2 flex justify-end"><button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-red-100 underline underline-offset-2"><ArrowLeft className="h-3.5 w-3.5" />{label(lang, 'वापस जाएं', 'Back')}</button></div>
    <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" /><div><h2 className="text-sm font-bold text-red-50">{label(lang, 'जरूरी सूचना', 'Important information')}</h2><p className="mt-1 text-sm leading-relaxed text-red-50">{label(lang, 'अगर आपकी हालत गंभीर है या तकलीफ बढ़ रही है, तो इंतजार न करें। तुरंत नजदीकी बड़े अस्पताल जाएं या एम्बुलेंस बुलाएं।', 'If your condition is serious or getting worse, do not wait. Go to a nearby large hospital or call an ambulance now.')}</p></div></div>
    <div className="mt-3 grid grid-cols-3 gap-2"><a href="tel:108" className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-red-300/50 bg-red-900/55 px-2 text-center text-xs font-bold text-white"><Phone className="h-4 w-4 shrink-0" />{label(lang, 'एम्बुलेंस बुलाएं', 'Call ambulance')}</a><a href="#emergency-hospitals" className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-500 bg-slate-900 px-2 text-center text-xs font-bold text-white"><Hospital className="h-4 w-4 shrink-0 text-emerald-300" />{label(lang, 'नजदीकी अस्पताल', 'Nearby hospitals')}</a><button type="button" onClick={() => void openTeleconsultation()} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-white px-2 text-center text-xs font-bold text-slate-900"><ExternalLink className="h-4 w-4 shrink-0" />eSanjeevani</button></div>
    <section id="emergency-hospitals" className="mt-3 space-y-2 border-t border-red-300/20 pt-3"><h3 className="text-xs font-bold text-red-100">{label(lang, 'नजदीकी अस्पताल', 'Nearby hospitals')}</h3>{facilities.length === 0 && <p className="text-xs leading-relaxed text-red-100">{label(lang, 'इस जगह के लिए कोई उपयुक्त अस्पताल नहीं मिला। 108 पर कॉल करें या नजदीकी बड़े अस्पताल जाएं।', 'No suitable hospital was found for this area. Call 108 or go to a nearby large hospital.')}</p>}{facilities.map((facility, index) => <article key={`${facility.name}-${index}`} className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5"><b className="block text-sm text-white">{facility.name}</b><p className="mt-0.5 text-xs text-slate-300">{[facility.district, facility.city, facility.state].filter(Boolean).join(', ')}</p>{(facility.hospitalType || facility.schemes.length > 0) && <p className="mt-1 text-xs text-slate-400">{[facility.hospitalType, facility.schemes.includes('AYUSHMAN_BHARAT') || facility.schemes.includes('PMJAY') ? 'PM-JAY listed' : ''].filter(Boolean).join(' • ')}</p>}<small className="mt-1 block text-[11px] text-amber-100">{facility.emergencyCapabilityVerified ? label(lang, 'आपात सुविधा की जानकारी स्रोत में दर्ज है। जाने से पहले पुष्टि कर लें।', 'The source lists emergency capability; please confirm before visiting.') : label(lang, 'जाने से पहले सुविधा की उपलब्धता की पुष्टि कर लें।', 'Please confirm availability with the facility before visiting.')}</small></article>)}{review.nearbyFacilities.length > 3 && <button type="button" onClick={() => setShowAllFacilities((value) => !value)} className="text-xs font-semibold text-red-100 underline underline-offset-2">{showAllFacilities ? label(lang, 'कम अस्पताल देखें', 'Show fewer hospitals') : label(lang, 'और अस्पताल देखें', 'See more hospitals')}</button>}</section>
    {error && <p role="alert" className="mt-3 rounded-lg border border-red-300/40 bg-red-950 p-2 text-xs text-red-50">{error}</p>}
  </section>;
};
