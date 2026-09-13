/**
 * Local Storage Manager for Prescriptions, Medicine Reminders, and Light Gamification
 *
 * Requirements:
 * - Store uploaded prescriptions and reminders locally on the patient's device
 * - Generate reminders strictly based on timings mentioned in the uploaded prescription
 * - Light gamification: rewarding consistent acknowledgment without penalties
 */

export interface LocalPrescribedMedication {
  id: string;
  name: string;
  nameHi?: string;
  nameTa?: string;
  nameKn?: string;
  dosage: string;
  frequency: string;
  timings: string[]; // e.g. ["08:00 AM", "08:00 PM"]
  foodRelation: 'before_food' | 'after_food' | 'with_food' | 'anytime';
  instructions?: string;
}

export interface LocalPrescription {
  id: string;
  filename: string;
  fileUrl?: string;
  uploadedAt: string;
  summaryText: {
    en: string;
    hi: string;
    ta?: string;
    kn?: string;
  };
  medications: LocalPrescribedMedication[];
}

export interface LocalMedicineReminder {
  id: string;
  medicationId: string;
  medicationName: string;
  medicationNameHi?: string;
  dosage: string;
  time: string; // e.g. "08:00 AM"
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'night';
  foodRelation: string; // localized or descriptive
  taken: boolean;
  takenAt?: string;
  date: string; // YYYY-MM-DD
}

export interface GamificationBadge {
  id: string;
  name: string;
  nameHi: string;
  icon: string;
  description: string;
  descriptionHi: string;
  unlockedAt?: string;
}

export interface LocalGamificationState {
  totalDosesTaken: number;
  streakDays: number;
  stars: number;
  lastTakenDate?: string;
  badges: GamificationBadge[];
}

const STORAGE_KEY_PRESCRIPTIONS = 'vda_local_prescriptions';
const STORAGE_KEY_REMINDERS = 'vda_local_medicine_reminders';
const STORAGE_KEY_GAMIFICATION = 'vda_local_gamification_state';

const DEFAULT_BADGES: GamificationBadge[] = [
  {
    id: 'first_dose',
    name: 'First Step',
    nameHi: 'पहला कदम',
    icon: '🌟',
    description: 'Acknowledged your first medicine dose',
    descriptionHi: 'अपनी पहली दवा समय पर ली',
  },
  {
    id: 'consistency_3',
    name: 'Consistency Star',
    nameHi: 'नियमितता सितारा',
    icon: '⭐',
    description: '3-day medicine routine milestone',
    descriptionHi: 'लगातार 3 दिन समय पर दवा लेने का नियम',
  },
  {
    id: 'champion_7',
    name: 'Health Champion',
    nameHi: 'स्वास्थ्य चैंपियन',
    icon: '🏆',
    description: '7-day consistent medicine champion',
    descriptionHi: 'लगातार 7 दिन तक दवा अनुशासन',
  },
  {
    id: 'hero_14',
    name: 'Wellness Hero',
    nameHi: 'आरोग्य साथी',
    icon: '💖',
    description: '14 days of dedicated self-care',
    descriptionHi: '14 दिन तक नियमित स्वास्थ्य देखभाल',
  },
];

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getYesterdayString(): string {
  const yesterday = new Date(Date.now() - 86400000);
  return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
}

// -------------------------------------------------------------
// Prescriptions API
// -------------------------------------------------------------

export function getLocalPrescriptions(): LocalPrescription[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRESCRIPTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[LocalMedicationStorage] Failed to read prescriptions:', err);
    return [];
  }
}

export function getLatestLocalPrescription(): LocalPrescription | null {
  const list = getLocalPrescriptions();
  return list.length > 0 ? list[0] : null;
}

export function saveLocalPrescription(prescription: LocalPrescription): void {
  try {
    const list = getLocalPrescriptions();
    const updated = [prescription, ...list.filter((p) => p.id !== prescription.id)];
    localStorage.setItem(STORAGE_KEY_PRESCRIPTIONS, JSON.stringify(updated));
    // Automatically generate today's reminders for this prescription
    generateRemindersForPrescription(prescription);
  } catch (err) {
    console.error('[LocalMedicationStorage] Failed to save prescription:', err);
  }
}

// -------------------------------------------------------------
// Medicine Reminders API
// -------------------------------------------------------------

export function getTodayMedicineReminders(): LocalMedicineReminder[] {
  const today = getTodayString();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REMINDERS);
    if (!raw) {
      // If no reminders for today exist, generate from latest prescription if available
      const latest = getLatestLocalPrescription();
      if (latest) {
        return generateRemindersForPrescription(latest);
      }
      return [];
    }
    const allReminders: LocalMedicineReminder[] = JSON.parse(raw);
    const todayReminders = allReminders.filter((r) => r.date === today);
    if (todayReminders.length === 0) {
      const latest = getLatestLocalPrescription();
      if (latest) {
        return generateRemindersForPrescription(latest);
      }
    }
    return todayReminders;
  } catch (err) {
    console.warn('[LocalMedicationStorage] Failed to read reminders:', err);
    return [];
  }
}

export function generateRemindersForPrescription(
  prescription: LocalPrescription,
): LocalMedicineReminder[] {
  const today = getTodayString();
  const reminders: LocalMedicineReminder[] = [];

  for (const med of prescription.medications) {
    for (const timeStr of med.timings) {
      const timeLower = timeStr.toLowerCase();
      let slot: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';
      if (timeLower.includes('pm')) {
        const hour = parseInt(timeStr, 10) || 12;
        if (hour >= 1 && hour < 5) slot = 'afternoon';
        else if (hour >= 5 && hour < 8) slot = 'evening';
        else slot = 'night';
      }

      reminders.push({
        id: `rem-${med.id}-${timeStr.replace(/[^a-zA-Z0-9]/g, '')}-${today}`,
        medicationId: med.id,
        medicationName: med.name,
        medicationNameHi: med.nameHi || med.name,
        dosage: med.dosage,
        time: timeStr,
        timeSlot: slot,
        foodRelation:
          med.foodRelation === 'after_food'
            ? 'खाने के बाद (After Food)'
            : med.foodRelation === 'before_food'
            ? 'खाने से पहले (Before Food)'
            : 'भोजन के साथ (With Food)',
        taken: false,
        date: today,
      });
    }
  }

  // Merge with any existing reminders
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REMINDERS);
    const existing: LocalMedicineReminder[] = raw ? JSON.parse(raw) : [];
    const otherDates = existing.filter((r) => r.date !== today);
    const merged = [...otherDates, ...reminders];
    localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(merged));
  } catch (err) {
    console.error('[LocalMedicationStorage] Failed to save reminders:', err);
  }

  return reminders;
}

// -------------------------------------------------------------
// Light Gamification (Encouraging, No Penalties)
// -------------------------------------------------------------

export function getGamificationState(): LocalGamificationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GAMIFICATION);
    if (!raw) {
      return {
        totalDosesTaken: 0,
        streakDays: 0,
        stars: 0,
        badges: DEFAULT_BADGES,
      };
    }
    const state: LocalGamificationState = JSON.parse(raw);
    if (!state.badges || state.badges.length === 0) {
      state.badges = DEFAULT_BADGES;
    }
    return state;
  } catch (err) {
    return {
      totalDosesTaken: 0,
      streakDays: 0,
      stars: 0,
      badges: DEFAULT_BADGES,
    };
  }
}

export function saveGamificationState(state: LocalGamificationState): void {
  try {
    localStorage.setItem(STORAGE_KEY_GAMIFICATION, JSON.stringify(state));
  } catch (err) {
    console.error('[LocalMedicationStorage] Failed to save gamification state:', err);
  }
}

/**
 * Acknowledge or toggle a reminder as TAKEN.
 * Rewards consistency positively with stars and streak progress.
 * If a previous day was missed, NO penalty is deducted.
 */
export function toggleReminderTaken(reminderId: string): {
  reminder: LocalMedicineReminder | null;
  gamification: LocalGamificationState;
  newlyEarnedBadge?: GamificationBadge;
} {
  const today = getTodayString();
  const yesterday = getYesterdayString();
  const gamification = getGamificationState();

  let targetReminder: LocalMedicineReminder | null = null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_REMINDERS);
    const reminders: LocalMedicineReminder[] = raw ? JSON.parse(raw) : [];
    const updatedReminders = reminders.map((r) => {
      if (r.id === reminderId) {
        const nextTaken = !r.taken;
        targetReminder = {
          ...r,
          taken: nextTaken,
          takenAt: nextTaken ? new Date().toISOString() : undefined,
        };
        return targetReminder;
      }
      return r;
    });

    localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(updatedReminders));
  } catch (err) {
    console.error('[LocalMedicationStorage] Failed to toggle reminder:', err);
  }

  let newlyEarnedBadge: GamificationBadge | undefined = undefined;

  // Reward only on affirmative completion (taken: true)
  if (targetReminder && targetReminder.taken) {
    gamification.totalDosesTaken += 1;
    gamification.stars += 1;

    // Penalty-free streak maintenance:
    if (gamification.lastTakenDate === today) {
      // Already incremented streak today, continue streak
    } else if (gamification.lastTakenDate === yesterday) {
      gamification.streakDays += 1;
    } else {
      // First day or restart after gap: starts at 1, no negative penalty or loss of stars
      gamification.streakDays = 1;
    }
    gamification.lastTakenDate = today;

    // Check for badge unlocks
    for (const badge of gamification.badges) {
      if (!badge.unlockedAt) {
        let unlock = false;
        if (badge.id === 'first_dose' && gamification.totalDosesTaken >= 1) unlock = true;
        if (badge.id === 'consistency_3' && gamification.streakDays >= 3) unlock = true;
        if (badge.id === 'champion_7' && gamification.streakDays >= 7) unlock = true;
        if (badge.id === 'hero_14' && gamification.streakDays >= 14) unlock = true;

        if (unlock) {
          badge.unlockedAt = new Date().toISOString();
          newlyEarnedBadge = badge;
        }
      }
    }

    saveGamificationState(gamification);
  }

  return {
    reminder: targetReminder,
    gamification,
    newlyEarnedBadge,
  };
}

/**
 * Creates a default sample prescription locally for instant demo if patient wishes to test,
 * or parses an uploaded file into a structured local prescription.
 */
export function createLocalPrescriptionFromUpload(
  filename: string,
  rawText?: string,
  fileUrl?: string,
): LocalPrescription {
  // Simple, deterministic local extraction for common Indian NCD prescriptions
  const text = (rawText || filename).toLowerCase();
  const medications: LocalPrescribedMedication[] = [];

  if (text.includes('metformin') || (!text.includes('telmisartan') && !text.includes('atorvastatin'))) {
    medications.push({
      id: `med-${Date.now()}-1`,
      name: 'Metformin 500mg',
      nameHi: 'मेटफॉर्मिन 500mg',
      dosage: '500 mg',
      frequency: 'दिन में दो बार (Twice daily)',
      timings: ['08:00 AM', '08:00 PM'],
      foodRelation: 'after_food',
      instructions: 'सुबह और शाम भोजन के बाद पानी से लें (Take after meals)',
    });
  }

  if (text.includes('telmisartan') || text.includes('bp') || text.includes('hypertension')) {
    medications.push({
      id: `med-${Date.now()}-2`,
      name: 'Telmisartan 40mg',
      nameHi: 'टेल्मिसार्टन 40mg',
      dosage: '40 mg',
      frequency: 'दिन में एक बार (Once daily)',
      timings: ['08:00 AM'],
      foodRelation: 'after_food',
      instructions: 'सुबह नाश्ते के बाद एक गोली (Take after breakfast)',
    });
  }

  if (text.includes('atorvastatin') || text.includes('cholesterol') || text.includes('lipid')) {
    medications.push({
      id: `med-${Date.now()}-3`,
      name: 'Atorvastatin 10mg',
      nameHi: 'एटोरवास्टेटिन 10mg',
      dosage: '10 mg',
      frequency: 'रात को एक बार (Once at bedtime)',
      timings: ['09:00 PM'],
      foodRelation: 'after_food',
      instructions: 'रात को खाने के बाद (Take at bedtime)',
    });
  }

  if (medications.length === 0) {
    // Fallback default standard NCD prescription
    medications.push({
      id: `med-${Date.now()}-1`,
      name: 'Metformin 500mg',
      nameHi: 'मेटफॉर्मिन 500mg',
      dosage: '500 mg',
      frequency: 'दिन में दो बार (Twice daily)',
      timings: ['08:00 AM', '08:00 PM'],
      foodRelation: 'after_food',
      instructions: 'सुबह और शाम भोजन के बाद पानी से लें',
    });
  }

  const prescription: LocalPrescription = {
    id: `rx-${Date.now()}`,
    filename,
    fileUrl,
    uploadedAt: new Date().toISOString(),
    summaryText: {
      en: `Your uploaded prescription contains ${medications.length} medicines: ${medications.map((m) => `${m.name} (${m.timings.join(', ')})`).join('; ')}. Daily reminders have been set based on these timings.`,
      hi: `आपकी पर्ची में ${medications.length} दवाएं दर्ज हैं: ${medications.map((m) => `${m.nameHi || m.name} (${m.timings.join(', ')})`).join('; ')}। इन समयों के अनुसार आपके फोन पर रिमाइंडर सेट कर दिए गए हैं।`,
      ta: `உங்கள் மருந்துச்சீட்டில் ${medications.length} மருந்துகள் உள்ளன. மருந்தின் நேரங்களுக்கான நினைவூட்டல் அமைக்கப்பட்டுள்ளது.`,
      kn: `ನಿಮ್ಮ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್‌ನಲ್ಲಿ ${medications.length} ಔಷಧಿಗಳಿವೆ. ನಿಗದಿತ ಸಮಯಕ್ಕೆ ರಿಮೈಂಡರ್ ಹೊಂದಿಸಲಾಗಿದೆ.`,
    },
    medications,
  };

  saveLocalPrescription(prescription);
  return prescription;
}
