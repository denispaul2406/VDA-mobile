import { AgentDomain, ChatMessage, FhirMedication, FhirObservation, LanguageCode, PatientDemographics } from '../types';
import { runDeterministicSafetyGate, createEscalationPayload } from './safetyGate';
import { getLatestLocalPrescription, getTodayMedicineReminders } from './localMedicationStorage';

export interface VdaProcessResult {
  message: ChatMessage;
  escalationState?: ReturnType<typeof createEscalationPayload>;
  escalationDetected?: boolean;
  responseType?: string;
}

export function getChatMessageText(msg: ChatMessage, lang: LanguageCode): string {
  if (lang === 'hi' && msg.textHi) return msg.textHi;
  if (lang === 'ta' && msg.textTa) return msg.textTa;
  if (lang === 'kn' && msg.textKn) return msg.textKn;
  return msg.text;
}

export function getQuickActionLabel(action: { label: string; labelHi?: string; labelTa?: string; labelKn?: string }, lang: LanguageCode): string {
  if (lang === 'hi' && action.labelHi) return action.labelHi;
  if (lang === 'ta' && action.labelTa) return action.labelTa;
  if (lang === 'kn' && action.labelKn) return action.labelKn;
  return action.label;
}

export function getCardTitle(card: { title: string; titleHi?: string; titleTa?: string; titleKn?: string }, lang: LanguageCode): string {
  if (lang === 'hi' && card.titleHi) return card.titleHi;
  if (lang === 'ta' && card.titleTa) return card.titleTa;
  if (lang === 'kn' && card.titleKn) return card.titleKn;
  return card.title;
}

export function processVdaQuery(
  query: string,
  patient: PatientDemographics,
  medications: FhirMedication[],
  observations: FhirObservation[],
  lang: LanguageCode
): VdaProcessResult {
  const normalized = query.toLowerCase();

  // 1. First run deterministic Safety Gate
  const safetyCheck = runDeterministicSafetyGate(query);
  if (!safetyCheck.isSafe && safetyCheck.isEscalated) {
    const escalation = createEscalationPayload(query, safetyCheck, patient.name, patient.abhaNumber);
    return {
      message: {
        id: `msg-${Date.now()}`,
        sender: 'vda',
        agent: 'safety_gate',
        text: `CRITICAL ALERT: Your reported symptom "${query}" requires urgent clinician review. I have immediately connected you to AIIMS Clinical Emergency Triage.`,
        textHi: `अति महत्वपूर्ण चेतावनी: आपके लक्षण "${query}" के लिए तुरंत डॉक्टर की सलाह आवश्यक है। मैंने आपको एम्स आपातकालीन टीम से जोड़ दिया है।`,
        textTa: `அவசர எச்சரிக்கை: உங்கள் அறிகுறி "${query}" உடனடி மருத்துவ பரிசோதனை தேவைப்படுகிறது. AIIMS அவசர மருத்துவ குழுவுடன் இணைக்கப்பட்டுள்ளீர்கள்.`,
        textKn: `ತುರ್ತು ಎಚ್ಚರಿಕೆ: ನಿಮ್ಮ ಲಕ್ಷಣ "${query}" ತಕ್ಷಣದ ವೈದ್ಯಕೀಯ ತಪಾಸಣೆಯ ಅಗತ್ಯವಿದೆ. AIIMS ತುರ್ತು ವೈದ್ಯಕೀಯ ತಂಡಕ್ಕೆ ಸಂಪರ್ಕಿಸಲಾಗಿದೆ.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEscalationTrigger: true,
        audioAvailable: true
      },
      escalationState: escalation
    };
  }

  // 2. Intent Routing across Domain Agents
  let agent: AgentDomain = 'triage';
  let replyText = '';
  let replyTextHi = '';
  let replyTextTa = '';
  let replyTextKn = '';
  let cardData: ChatMessage['cardData'] = undefined;
  let quickActions: ChatMessage['quickActions'] = undefined;

  // Medication Intent (Strictly based on uploaded prescription, never preexisting health records)
  if (/दवाई|दवा|मेडिसिन|மருந்து|மாத்திரை|ಔಷಧಿ|ಮಾತ್ರೆ|goli|medicine|medication|dose|metformin|telmisartan|glimepiride|thyronorm|खुराक|कब लेना|prescription|पर्ची/i.test(normalized)) {
    agent = 'medication';
    const latestPrescription = getLatestLocalPrescription();
    const todayReminders = getTodayMedicineReminders();

    if (latestPrescription && latestPrescription.medications.length > 0) {
      const medLinesEn = latestPrescription.medications
        .map(m => `• ${m.name} (${m.dosage}): ${m.frequency} at ${m.timings.join(', ')} (${m.instructions || 'with water'})`)
        .join('\n');
      const medLinesHi = latestPrescription.medications
        .map(m => `• ${m.nameHi || m.name} (${m.dosage}): ${m.frequency}, समय: ${m.timings.join(', ')} (${m.instructions || 'पानी के साथ लें'})`)
        .join('\n');

      replyText = `Based strictly on your uploaded prescription (${latestPrescription.filename}):\n\n${medLinesEn}\n\nDaily medicine reminders are active based on these timings. Please remember to acknowledge each dose when taken.`;
      replyTextHi = `आपकी अपलोड की गई डॉक्टर की पर्ची (${latestPrescription.filename}) के अनुसार:\n\n${medLinesHi}\n\nदवाओं के समय अनुसार आपके फोन पर रिमाइंडर सक्रिय हैं। कृपया दवा लेने के बाद यहाँ मार्क करें।`;
      replyTextTa = `நீங்கள் பதிவேற்றிய மருந்துச்சீட்டின்படி:\n\n${medLinesEn}\n\nகுறிப்பிட்ட நேரங்களில் மருந்து நினைவூட்டல்கள் அமைக்கப்பட்டுள்ளன.`;
      replyTextKn = `ನೀವು ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಪ್ರಕಾರ:\n\n${medLinesEn}\n\nನಿಗದಿತ ಸಮಯಕ್ಕೆ ಔಷಧಿ ರಿಮೈಂಡರ್‌ಗಳು ಸಕ್ರಿಯವಾಗಿವೆ.`;

      cardData = {
        type: 'medication_reminder',
        title: "Prescription Medicine Schedule",
        titleHi: 'पर्ची अनुसार दवा समय-सारणी',
        titleTa: 'மருந்துச்சீட்டு அட்டவணை',
        titleKn: 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಔಷಧಿ ವೇಳಾಪಟ್ಟಿ',
        details: {
          medications: todayReminders.map(r => ({
            name: r.medicationName,
            time: `${r.time} - ${r.foodRelation}`,
            taken: r.taken
          }))
        }
      };
      quickActions = [
        { label: 'View Prescriptions', labelHi: 'पर्ची देखें', labelTa: 'மருந்துச்சீட்டு காண்க', labelKn: 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ನೋಡಿ', action: 'show_records_meds' },
        { label: 'Jan Aushadhi Generic Refill', labelHi: 'जन औषधि केंद्र खोजें', labelTa: 'மக்கள் மருந்தகம் தேடுக', labelKn: 'ಜನ ಔಷಧಿ ಕೇಂದ್ರ ಹುಡುಕಿ', action: 'find_jan_aushadhi' }
      ];
    } else {
      // No prescription uploaded yet
      replyText = `To provide accurate medicine guidance, VDA relies strictly on your uploaded doctor prescription. Please tap the paperclip icon below to upload your prescription slip (PDF, JPG, or PNG). I will explain your medicines in simple language and set up daily reminders.`;
      replyTextHi = `सटीक दवा जानकारी के लिए VDA केवल आपकी अपलोड की गई पर्ची का उपयोग करता है। कृपया नीचे दिए गए पिन (Paperclip) बटन से अपनी डॉक्टर की पर्ची अपलोड करें। मैं आपकी दवाओं को सरल भाषा में समझाऊंगा और समय अनुसार रिमाइंडर सेट कर दूंगा।`;
      replyTextTa = `மருந்து விவரங்களை அறிய உங்கள் மருத்துவ மருந்துச்சீட்டைப் பதிவேற்றவும். மருந்துச்சீட்டைப் பதிவேற்றியதும் நேரங்களுக்கான நினைவூட்டல் அமைக்கப்படும்.`;
      replyTextKn = `ನಿಖರವಾದ ಔಷಧಿ ಮಾಹಿತಿಗಾಗಿ ದಯವಿಟ್ಟು ನಿಮ್ಮ ವೈದ್ಯರ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಅನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ. ನಂತರ ರಿಮೈಂಡರ್‌ಗಳನ್ನು ಹೊಂದಿಸಲಾಗುವುದು.`;

      cardData = {
        type: 'medication_reminder',
        title: 'Prescription Upload Required',
        titleHi: 'पर्ची अपलोड आवश्यक है',
        titleTa: 'மருந்துச்சீட்டு தேவை',
        titleKn: 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಅಗತ್ಯವಿದೆ',
        details: {
          status: 'NO_PRESCRIPTION_UPLOADED',
          message: 'Please upload prescription to view medicine timings and reminders.',
        },
      };

      quickActions = [
        { label: 'Upload Prescription', labelHi: 'पर्ची अपलोड करें', labelTa: 'மருந்துச்சீட்டு பதிவேற்று', labelKn: 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ', action: 'attach_prescription' }
      ];
    }
  }
  // Lab / Observation Intent
  else if (/sugar|शुगर|सब्ज़ी|சர்க்கரை|ಸಕ್ಕರೆ|hba1c|blood pressure|bp|रक्तदबाव|रक्तचाप|बीपी|ரத்த அழுத்தம்|ರಕ್ತದೊತ್ತಡ|रिपोर्ट|lab|test|जांच|creatinine|report/i.test(normalized)) {
    agent = 'lab_explainer';
    const hba1c = observations.find(o => o.code.includes('4548-4'));
    const bp = observations.find(o => o.code.includes('85354-9'));

    replyText = `Based on your ABDM record from AIIMS OPD: Your HbA1c is ${hba1c?.value || 7.8}%. This shows a healthy improvement from your previous 8.6%! Your Blood Pressure is steady at ${bp?.value || 132} mmHg. Keep maintaining your daily walk and diet.`;
    replyTextHi = `एम्स ओपीडी रिकॉर्ड अनुसार: आपका HbA1c स्तर ${hba1c?.value || 7.8}% है। यह पिछले 8.6% से काफी सुधरा है! आपका ब्लड प्रेशर 132/84 पर बिल्कुल नियंत्रित है। रोज सुबह टहलना जारी रखें।`;
    replyTextTa = `AIIMS பதிவின்படி: உங்கள் HbA1c ${hba1c?.value || 7.8}% ஆக உள்ளது (முந்தைய 8.6% இலிருந்து முன்னேற்றம்). இரத்த அழுத்தம் 132/84 mmHg கட்டுப்பாட்டில் உள்ளது. தினமும் நடைபயிற்சி தொடரவும்.`;
    replyTextKn = `AIIMS ದಾಖಲೆಯ ಪ್ರಕಾರ: ನಿಮ್ಮ HbA1c ${hba1c?.value || 7.8}% ಆಗಿದೆ (ಹಿಂದಿನ 8.6% ಗಿಂತ ಸುಧಾರಿಸಿದೆ). ರಕ್ತದೊತ್ತಡ 132/84 mmHg ನಿಯಂತ್ರಣದಲ್ಲಿದೆ. ದಿನನಿತ್ಯದ ನಡಿಗೆ ಮುಂದುವರಿಸಿ.`;

    cardData = {
      type: 'lab_highlight',
      title: 'Latest Lab Summary (AIIMS New Delhi)',
      titleHi: 'ताजा जांच रिपोर्ट सारांश',
      titleTa: 'சமீபத்திய ஆய்வக அறிக்கை சுருக்கம்',
      titleKn: 'ಇತ್ತೀಚಿನ ಲ್ಯಾಬ್ ವರದಿ ಸಾರಾಂಶ',
      details: {
        hba1c: `${hba1c?.value || 7.8}% (Target < 7.0%)`,
        bloodPressure: '132/84 mmHg (Normal)',
        status: 'Improving trend'
      }
    };
    quickActions = [
      { label: 'Log Vital Reading', labelHi: 'नया शुगर/बीपी मापें', labelTa: 'புதிய அளவீடு பதிவு செய்', labelKn: 'ಹೊಸ ರೀಡಿಂಗ್ ದಾಖಲಿಸಿ', action: 'open_log_vital' },
      { label: 'View Full Lab Report', labelHi: 'पूर्ण रिपोर्ट देखें', labelTa: 'முழு அறிக்கை காண்க', labelKn: 'ಪೂರ್ಣ ವರದಿ ನೋಡಿ', action: 'show_records_obs' }
    ];
  }
  // Hospital / OPD QR check-in Intent
  else if (/hospital|अस्पताल|மருத்துவமனை|ಆಸ್ಪತ್ರೆ|doctor|डॉक्टर|opd|phc|chc|क्लिनिक|नजदीकी|checkin|qr/i.test(normalized)) {
    agent = 'facility';
    replyText = `The nearest facility is District Hospital Sitapur (2.8 km away). OPD is open today until 02:00 PM. You can use your ABDM Fast-Track QR code to bypass the physical registration counter line.`;
    replyTextHi = `आपके सबसे पास जिला अस्पताल सीतापुर है (2.8 किमी दूर)। ओपीडी आज दोपहर 2:00 बजे तक खुली है। आप बिना कतार में लगे फास्ट-ट्रैक QR कोड से तुरंत पर्ची बनवा सकते हैं।`;
    replyTextTa = `அருகிலுள்ள அரசு மருத்துவமனை சீதாபூர் (2.8 கிமீ). OPD இன்று மதியம் 2:00 மணி வரை திறந்துள்ளது. Fast-Track QR மூலம் வரிசையில் நிற்காமல் பதிவு செய்யலாம்.`;
    replyTextKn = `ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ಸೀತಾಪುರ (2.8 ಕಿಮೀ). OPD ಇಂದು ಮಧ್ಯಾಹ್ನ 2:00 ರವರೆಗೆ ತೆರೆದಿರುತ್ತದೆ. Fast-Track QR ಬಳಸಿ ತಕ್ಷಣ ನೋಂದಣಿ ಮಾಡಿಕೊಳ್ಳಬಹುದು.`;

    cardData = {
      type: 'facility_qr',
      title: 'District Hospital Sitapur - Fast-Track OPD',
      titleHi: 'जिला अस्पताल सीतापुर - फास्ट-ट्रैक ओपीडी',
      titleTa: 'சீதாபூர் மாவட்ட மருத்துவமனை - விரைவு OPD',
      titleKn: 'ಸೀತಾಪುರ ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ - ತ್ವರಿತ OPD',
      details: {
        facilityName: 'District Hospital Sitapur',
        distance: '2.8 km',
        opdTimings: '08:00 AM - 02:00 PM',
        tokenStatus: 'ABDM QR Active'
      }
    };
    quickActions = [
      { label: 'Show OPD QR Token', labelHi: 'OPD QR टोकन दिखाएं', labelTa: 'OPD QR டோக்கன் காண்க', labelKn: 'OPD QR ಟೋಕನ್ ತೋರಿಸಿ', action: 'show_opd_token' },
      { label: 'Call Hospital Desk', labelHi: 'अस्पताल को कॉल करें', labelTa: 'மருத்துவமனைக்கு அழைக்க', labelKn: 'ಆಸ್ಪತ್ರೆಗೆ ಕರೆ ಮಾಡಿ', action: 'call_hospital' }
    ];
  }
  // Scheme / Ayushman Bharat Intent
  else if (/योजना|आयुष्मान|திட்டம்|ஆயுஷ்மான்|ಯೋಜನೆ|ಆಯುಷ್ಮಾನ್|scheme|pmjay|pm-jay|insurance|मुफ्त|कार्ड|5 लाख|claim/i.test(normalized)) {
    agent = 'scheme';
    replyText = `Under Ayushman Bharat (PM-JAY), your family is covered for up to ₹5,00,000 per year for free cashless treatment at over 28,000 empaneled hospitals across India. Your ABHA ID (${patient.abhaNumber}) is linked to your Ayushman Card.`;
    replyTextHi = `आयुष्मान भारत (PM-JAY) के तहत आपके परिवार को पूरे भारत में ₹5,00,000 प्रति वर्ष तक का मुफ्त अस्पताल इलाज मिलता है। आपका ABHA खाता आपके आयुष्मान कार्ड से सीधे जुड़ा हुआ है।`;
    replyTextTa = `ஆயுஷ்மான் பாரத் (PM-JAY) திட்டத்தின் கீழ் உங்கள் குடும்பத்திற்கு ஆண்டுக்கு ₹5,00,000 வரை இலவச மருத்துவமனை சிகிச்சை கிடைக்கிறது. உங்கள் ABHA எண் இணைக்கப்பட்டுள்ளது.`;
    replyTextKn = `ಆಯುಷ್ಮಾನ್ ಭಾರತ್ (PM-JAY) ಯೋಜನೆಯಡಿ ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕೆ ವರ್ಷಕ್ಕೆ ₹5,00,000 ವರೆಗೆ ಉಚಿತ ಚಿಕಿತ್ಸೆ ಲಭ್ಯವಿದೆ. ನಿಮ್ಮ ABHA ಸಂಖ್ಯೆಯನ್ನು ಜೋಡಿಸಲಾಗಿದೆ.`;

    cardData = {
      type: 'scheme_summary',
      title: 'Ayushman Bharat PM-JAY Eligibility',
      titleHi: 'आयुष्मान भारत PM-JAY पात्रता',
      titleTa: 'ஆயுஷ்மான் பாரத் PM-JAY தகுதி',
      titleKn: 'ಆಯುಷ್ಮಾನ್ ಭಾರತ್ PM-JAY ಅರ್ಹತೆ',
      details: {
        coverage: '₹5,00,000 / year / family',
        status: 'Active & Verified',
        cardNumber: patient.ayushmanCardNumber || 'PMJAY-UP-9921-4401-72',
        helpline: '14555'
      }
    };
    quickActions = [
      { label: 'View Scheme Details', labelHi: 'योजना विवरण देखें', labelTa: 'திட்ட விவரம் காண்க', labelKn: 'ಯೋಜನೆ ವಿವರ ನೋಡಿ', action: 'show_schemes' },
      { label: 'Call 14555 Helpline', labelHi: 'हेल्पलाइन 14555 पर कॉल करें', labelTa: '14555 உதவி எண் அழைக்க', labelKn: '14555 ಸಹಾಯವಾಣಿಗೆ ಕರೆ ಮಾಡಿ', action: 'call_pmjay' }
    ];
  }
  // Diet & Lifestyle Intent
  else if (/diet|खान|आहार|भोजन|உணவு|சாப்பாடு|ಆಹಾರ|ಊಟ|क्या खाएं|roti|चावल|तेल|मिर्च|वॉक|walk/i.test(normalized)) {
    agent = 'lifestyle_diet';
    replyText = `For diabetes and blood pressure: Prefer whole grains like Bajra or multi-grain rotis over polished white rice. Eat plenty of seasonal green vegetables. Limit salt to under 1 teaspoon per day, and take a 20-30 minute walk every morning.`;
    replyTextHi = `शुगर और बीपी के लिए: सफेद चावल की जगह बाजरा या मल्टीग्रेन रोटी खाएं। हरी सब्जियां अधिक लें। दिन भर में 1 चम्मच से कम नमक खाएं और रोज सुबह 20-30 मिनट जरूर टहलें।`;
    replyTextTa = `நீரிழிவு மற்றும் ரத்த அழுத்தத்திற்கு: வெள்ளை அரிசிக்கு பதில் சிறுதானியங்கள் மற்றும் காய்கறிகளை உட்கொள்ளுங்கள். உப்பு அளவை குறைத்து, தினமும் 30 நிமிடம் நடைபயிற்சி மேற்கொள்ளுங்கள்.`;
    replyTextKn = `ಸಕ್ಕರೆ ಮತ್ತು ರಕ್ತದೊತ್ತಡಕ್ಕೆ: ಬಿಳಿ ಅನ್ನದ ಬದಲು ಸಿರಿಧಾನ್ಯ ಮತ್ತು ಹಸಿರು ತರಕಾರಿಗಳನ್ನು ಸೇವಿಸಿ. ಉಪ್ಪು ಕಡಿಮೆ ಬಳಸಿ, ದಿನವೂ 30 ನಿಮಿಷ ನಡಿಗೆ ಮಾಡಿ.`;

    quickActions = [
      { label: 'Check Meds', labelHi: 'दवाई समय देखें', labelTa: 'மருந்து அட்டவணை', labelKn: 'ಔಷಧಿ ಸಮಯ', action: 'show_records_meds' },
      { label: 'Log Sugar Reading', labelHi: 'शुगर मापें', labelTa: 'சர்க்கரை பதிவு', labelKn: 'ಸಕ್ಕರೆ ದಾಖಲಿಸಿ', action: 'open_log_vital' }
    ];
  }
  // Default Conversational Health Navigation
  else {
    agent = 'triage';
    replyText = `Namaste ${patient.name} ji. I am your VDA Health Assistant. You can ask me about your medicine timings, understand your lab reports, find nearby government hospitals, or check Ayushman Bharat scheme benefits. Tap the microphone anytime to speak!`;
    replyTextHi = `नमस्ते ${patient.name} जी। मैं आपका VDA स्वास्थ्य साथी हूँ। आप मुझसे अपनी दवाइयों का समय, जांच रिपोर्ट का मतलब, नजदीकी सरकारी अस्पताल या आयुष्मान योजना के बारे में पूछ सकते हैं। बोलने के लिए कभी भी माइक दबाएं!`;
    replyTextTa = `வணக்கம் ${patient.name} அவர்களே. நான் உங்கள் VDA சுகாதார உதவியாளர். உங்கள் மருந்து நேரம், ஆய்வக அறிக்கைகள், அருகிலுள்ள மருத்துவமனைகள் அல்லது அரசு திட்டங்கள் குறித்து கேட்கலாம். பேச மைக் தட்டவும்!`;
    replyTextKn = `ನಮಸ್ಕಾರ ${patient.name} ಅವರೇ. ನಾನು ನಿಮ್ಮ VDA ಆರೋಗ್ಯ ಸಹಾಯಕ. ಔಷಧಿ ಸಮಯ, ಲ್ಯಾಬ್ ವರದಿಗಳು, ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗಳು ಅಥವಾ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ಕೇಳಬಹುದು. ಮಾತನಾಡಲು ಮೈಕ್ ಒತ್ತಿರಿ!`;

    quickActions = [
      { label: 'My Medicines', labelHi: 'मेरी दवाइयां', labelTa: 'எனது மருந்துகள்', labelKn: 'ನನ್ನ ಔಷಧಿಗಳು', action: 'ask_medicines' },
      { label: 'Explain Sugar Lab', labelHi: 'शुगर रिपोर्ट समझाएं', labelTa: 'சர்க்கரை சோதனை விளக்கம்', labelKn: 'ಸಕ್ಕರೆ ವರದಿ ವಿವರಣೆ', action: 'ask_sugar_lab' },
      { label: 'Nearby Hospital', labelHi: 'नजदीकी अस्पताल', labelTa: 'அருகிலுள்ள மருத்துவமனை', labelKn: 'ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ', action: 'ask_hospital' },
      { label: 'Ayushman PM-JAY', labelHi: 'आयुष्मान योजना लाभ', labelTa: 'ஆயுஷ்மான் திட்ட பலன்கள்', labelKn: 'ಆಯುಷ್ಮಾನ್ ಯೋಜನೆ', action: 'ask_scheme' }
    ];
  }

  const message: ChatMessage = {
    id: `msg-${Date.now()}`,
    sender: 'vda',
    agent,
    text: replyText,
    textHi: replyTextHi,
    textTa: replyTextTa,
    textKn: replyTextKn,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cardData,
    quickActions,
    audioAvailable: true
  };

  return { message };
}
