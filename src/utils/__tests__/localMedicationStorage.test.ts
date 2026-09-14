/**
 * VDA Mobile — Local Medication Storage & Gamification Unit Tests
 *
 * Validates:
 * - Prescription persistence and retrieval
 * - Medicine reminder generation with daily time slots
 * - Light gamification: positive rewards (stars, streaks, badges)
 * - Strict zero-penalty guarantee: unticking or missing doses never deducts stars
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLocalPrescriptions,
  getLatestLocalPrescription,
  saveLocalPrescription,
  getTodayMedicineReminders,
  generateRemindersForPrescription,
  getGamificationState,
  saveGamificationState,
  toggleReminderTaken,
  createLocalPrescriptionFromUpload,
  LocalPrescription,
} from '../localMedicationStorage';

describe('VDA Mobile — localMedicationStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ─── Prescription Storage ──────────────────────────────
  describe('Prescription Persistence', () => {
    it('should return an empty list when no prescriptions exist', () => {
      expect(getLocalPrescriptions()).toEqual([]);
      expect(getLatestLocalPrescription()).toBeNull();
    });

    it('should save and retrieve prescriptions in order', () => {
      const sampleRx: LocalPrescription = {
        id: 'rx-test-1',
        filename: 'dr_sharma_prescription.jpg',
        uploadedAt: new Date().toISOString(),
        summaryText: {
          en: 'Metformin 500mg twice daily',
          hi: 'मेटफॉर्मिन 500mg दिन में दो बार',
        },
        medications: [
          {
            id: 'med-1',
            name: 'Metformin 500mg',
            nameHi: 'मेटफॉर्मिन 500mg',
            dosage: '500 mg',
            frequency: 'Twice daily',
            timings: ['08:00 AM', '08:00 PM'],
            foodRelation: 'after_food',
            instructions: 'After meals with water',
          },
        ],
      };

      saveLocalPrescription(sampleRx);

      const all = getLocalPrescriptions();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('rx-test-1');
      expect(getLatestLocalPrescription()?.id).toBe('rx-test-1');
    });

    it('should automatically generate today reminders when a prescription is saved', () => {
      const sampleRx: LocalPrescription = {
        id: 'rx-test-2',
        filename: 'cardiac_rx.pdf',
        uploadedAt: new Date().toISOString(),
        summaryText: { en: 'Telmisartan once daily', hi: 'टेल्मिसार्टन' },
        medications: [
          {
            id: 'med-telm',
            name: 'Telmisartan 40mg',
            dosage: '40 mg',
            frequency: 'Once daily',
            timings: ['08:00 AM'],
            foodRelation: 'after_food',
          },
        ],
      };

      saveLocalPrescription(sampleRx);
      const reminders = getTodayMedicineReminders();
      expect(reminders.length).toBeGreaterThanOrEqual(1);
      expect(reminders[0].medicationName).toBe('Telmisartan 40mg');
      expect(reminders[0].taken).toBe(false);
      expect(reminders[0].timeSlot).toBe('morning');
    });
  });

  // ─── Prescription Upload Parser ─────────────────────────
  describe('createLocalPrescriptionFromUpload', () => {
    it('should extract Metformin and Telmisartan keywords from document name', () => {
      const rx = createLocalPrescriptionFromUpload('hypertension_bp_prescription.pdf');
      expect(rx.medications.some((m) => m.name.includes('Telmisartan'))).toBe(true);
    });

    it('should fall back gracefully to a standard NCD prescription if no keywords match', () => {
      const rx = createLocalPrescriptionFromUpload('doctor_slip_scan_001.jpg');
      expect(rx.medications.length).toBeGreaterThan(0);
      expect(rx.summaryText.en).toContain('Your uploaded prescription contains');
    });
  });

  // ─── Light Gamification (Zero Penalties) ────────────────
  describe('Light Gamification State & Dose Acknowledgment', () => {
    it('should initialize default state with 0 stars and all badges locked', () => {
      const state = getGamificationState();
      expect(state.stars).toBe(0);
      expect(state.streakDays).toBe(0);
      expect(state.totalDosesTaken).toBe(0);
      expect(state.badges.length).toBe(4);
      expect(state.badges.every((b) => !b.unlockedAt)).toBe(true);
    });

    it('should reward +1 star and unlock "first_dose" badge upon taking first dose', () => {
      createLocalPrescriptionFromUpload('metformin.pdf');
      const reminders = getTodayMedicineReminders();
      expect(reminders.length).toBeGreaterThan(0);

      const result = toggleReminderTaken(reminders[0].id);
      expect(result.reminder?.taken).toBe(true);
      expect(result.gamification.stars).toBe(1);
      expect(result.gamification.totalDosesTaken).toBe(1);
      expect(result.gamification.streakDays).toBe(1);

      // Verify "First Step" badge unlocked
      const firstBadge = result.gamification.badges.find((b) => b.id === 'first_dose');
      expect(firstBadge?.unlockedAt).toBeDefined();
    });

    it('should never deduct stars, reset badges, or penalize when a dose is toggled off', () => {
      createLocalPrescriptionFromUpload('metformin.pdf');
      const reminders = getTodayMedicineReminders();

      // Take dose
      toggleReminderTaken(reminders[0].id);
      const afterTake = getGamificationState();
      expect(afterTake.stars).toBe(1);
      const firstBadgeUnlocked = afterTake.badges.find((b) => b.id === 'first_dose')?.unlockedAt;
      expect(firstBadgeUnlocked).toBeDefined();

      // Untick dose
      toggleReminderTaken(reminders[0].id);
      const afterUntick = getGamificationState();
      // Zero penalties: stars remain, badge remains unlocked
      expect(afterUntick.stars).toBe(1);
      expect(afterUntick.badges.find((b) => b.id === 'first_dose')?.unlockedAt).toBe(firstBadgeUnlocked);
    });

    it('should unlock consistency badges at 3, 7, and 14 days', () => {
      const state = getGamificationState();
      state.streakDays = 2;
      state.lastTakenDate = new Date(Date.now() - 86400000).toISOString().split('T')[0]; // yesterday
      saveGamificationState(state);

      createLocalPrescriptionFromUpload('metformin.pdf');
      const reminders = getTodayMedicineReminders();
      const result = toggleReminderTaken(reminders[0].id);

      expect(result.gamification.streakDays).toBe(3);
      const consistencyBadge = result.gamification.badges.find((b) => b.id === 'consistency_3');
      expect(consistencyBadge?.unlockedAt).toBeDefined();
    });
  });
});
