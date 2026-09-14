import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Clock3, Pill, Trash2, X } from 'lucide-react';
import {
  DraftMedicineReminder,
  LocalMedicineReminder,
  MedicineReminderSnapshot,
  PrescriptionReminderDraft,
} from '../services/medicine-reminder.service';
import { LanguageCode } from '../types';

type Props = {
  lang: LanguageCode;
  draft: PrescriptionReminderDraft | null;
  snapshot: MedicineReminderSnapshot;
  onClose: () => void;
  onConfirmDraft: (draft: PrescriptionReminderDraft) => Promise<void>;
  onUpdateReminder: (id: string, patch: Pick<LocalMedicineReminder, 'times' | 'active'>) => Promise<void>;
  onDeleteReminder: (id: string) => Promise<void>;
  onEnableNotifications: () => Promise<void>;
  onDisableAll: () => Promise<void>;
};

const text = (lang: LanguageCode, hi: string, en: string) => lang === 'hi' ? hi : en;

export const MedicineRemindersModal: React.FC<Props> = ({
  lang, draft, snapshot, onClose, onConfirmDraft, onUpdateReminder, onDeleteReminder, onEnableNotifications, onDisableAll,
}) => {
  const [draftState, setDraftState] = useState<PrescriptionReminderDraft | null>(draft);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => { setDraftState(draft); setNotice(''); }, [draft]);

  const changeDraftMedicine = (id: string, patch: Partial<DraftMedicineReminder>) => {
    setDraftState((current) => current ? {
      ...current,
      medicines: current.medicines.map((medicine) => medicine.id === id ? { ...medicine, ...patch } : medicine),
    } : null);
  };
  const changeDraftTime = (id: string, index: number, value: string) => {
    const medicine = draftState?.medicines.find((item) => item.id === id);
    if (!medicine) return;
    const times = [...medicine.times]; times[index] = value;
    changeDraftMedicine(id, { times });
  };
  const confirmDraft = async () => {
    if (!draftState || busy) return;
    const enabled = draftState.medicines.filter((medicine) => medicine.enabled);
    if (!enabled.length) { setNotice(text(lang, 'कम से कम एक दवा चुनें।', 'Select at least one medicine.')); return; }
    const invalid = enabled.find((medicine) => !medicine.confirmed || medicine.times.some((time) => !time));
    if (invalid) { setNotice(text(lang, 'हर चुनी हुई दवा का समय भरें और अनिश्चित जानकारी की पुष्टि करें।', 'Set a time and confirm any uncertain information for each selected medicine.')); return; }
    setBusy(true); setNotice('');
    try { await onConfirmDraft(draftState); }
    catch { setNotice(text(lang, 'रिमाइंडर अभी सेव नहीं हो पाए। कृपया फिर कोशिश करें।', 'Reminders could not be saved. Please try again.')); }
    finally { setBusy(false); }
  };
  const updateReminder = async (reminder: LocalMedicineReminder, patch: Pick<LocalMedicineReminder, 'times' | 'active'>) => {
    setBusy(true); setNotice('');
    try { await onUpdateReminder(reminder.id, patch); }
    catch { setNotice(text(lang, 'रिमाइंडर अपडेट नहीं हो पाया।', 'Reminder could not be updated.')); }
    finally { setBusy(false); }
  };
  const changeReminderTime = (reminder: LocalMedicineReminder, index: number, value: string) => {
    const times = [...reminder.times]; times[index] = value;
    void updateReminder(reminder, { times, active: reminder.active });
  };
  const deleteReminder = async (id: string) => {
    setBusy(true); setNotice('');
    try { await onDeleteReminder(id); }
    catch { setNotice(text(lang, 'रिमाइंडर हटाया नहीं जा सका।', 'Reminder could not be removed.')); }
    finally { setBusy(false); }
  };

  const isDraft = Boolean(draftState);
  return <div className="absolute inset-0 z-[60] flex flex-col bg-slate-950 text-slate-100">
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex items-center gap-2"><span className="rounded-xl bg-emerald-500/15 p-2 text-emerald-300"><Bell className="h-4 w-4" /></span><div><h2 className="text-sm font-bold">{text(lang, 'दवा रिमाइंडर', 'Medicine reminders')}</h2><p className="text-[11px] text-slate-400">{text(lang, 'यह जानकारी सिर्फ इस फोन में सेव रहती है।', 'This information stays on this phone only.')}</p></div></div>
      <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"><X className="h-5 w-5" /></button>
    </header>
    <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {isDraft && draftState && <>
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/25 p-3">
          <h3 className="text-sm font-bold text-emerald-100">{text(lang, 'इस पर्ची में डॉक्टर ने ये दवाइयाँ लिखी हैं:', 'These medicines are written on the prescription:')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">{text(lang, 'समय बदल सकते हैं। पर्ची में समय साफ़ न हो तो अपनी सुविधा का समय चुनें।', 'You can change times. Choose a time when it is not clear on the prescription.')}</p>
        </section>
        {draftState.medicines.length === 0 && <p className="rounded-xl border border-amber-400/30 bg-amber-950/20 p-3 text-sm text-amber-100">{text(lang, 'पर्ची से साफ़ दवा की जानकारी नहीं मिली। कृपया पर्ची को दोबारा जाँचें।', 'No clear medicine details were found. Please check the prescription again.')}</p>}
        {draftState.medicines.map((medicine) => <section key={medicine.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
          <div className="flex items-start justify-between gap-3"><div><h3 className="flex items-center gap-1.5 text-sm font-bold text-white"><Pill className="h-4 w-4 text-emerald-300" />{medicine.medicineName}</h3><p className="mt-0.5 text-xs text-slate-400">{medicine.dosageText}{medicine.frequency ? ` • ${medicine.frequency}` : ''}</p></div><label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={medicine.enabled} onChange={(event) => changeDraftMedicine(medicine.id, { enabled: event.target.checked })} />{text(lang, 'रिमाइंडर', 'Reminder')}</label></div>
          {medicine.enabled && <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
            {medicine.times.map((time, index) => <label key={`${medicine.id}-${index}`} className="flex items-center justify-between gap-3 text-xs text-slate-300"><span>{medicine.times.length > 1 ? `${text(lang, 'समय', 'Time')} ${index + 1}` : text(lang, 'समय', 'Time')}</span><input type="time" value={time} onChange={(event) => changeDraftTime(medicine.id, index, event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white" /></label>)}
            {medicine.requiresConfirmation && <label className="flex items-start gap-2 rounded-lg bg-amber-950/25 p-2 text-xs text-amber-100"><input className="mt-0.5" type="checkbox" checked={medicine.confirmed} onChange={(event) => changeDraftMedicine(medicine.id, { confirmed: event.target.checked })} /><span>{medicine.uncertaintyReason || text(lang, 'कृपया जानकारी की पुष्टि करें।', 'Please confirm this information.')}</span></label>}
          </div>}
        </section>)}
        {notice && <p role="alert" className="rounded-lg border border-amber-400/30 bg-amber-950/25 p-2 text-xs text-amber-100">{notice}</p>}
        <button type="button" disabled={busy || draftState.medicines.length === 0} onClick={() => void confirmDraft()} className="w-full rounded-xl bg-emerald-500 px-3 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">{busy ? text(lang, 'सेव हो रहा है…', 'Saving…') : text(lang, 'दवा के रिमाइंडर चालू करें', 'Enable medicine reminders')}</button>
      </>}
      {!isDraft && <>
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/25 p-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-emerald-100">{text(lang, 'आज की दवाइयाँ', 'Today’s medicines')}</h3><p className="mt-1 text-xs text-slate-300">{text(lang, `आज ${snapshot.progress.takenToday}/${snapshot.progress.scheduledToday} रिमाइंडर पूरे`, `${snapshot.progress.takenToday}/${snapshot.progress.scheduledToday} reminders completed today`)}</p></div><CheckCircle2 className="h-6 w-6 text-emerald-300" /></div>{snapshot.progress.currentStreakDays > 1 && <p className="mt-2 text-xs text-emerald-200">{text(lang, `${snapshot.progress.currentStreakDays} दिन से रिमाइंडर पूरे किए`, `Reminders completed for ${snapshot.progress.currentStreakDays} days`)}</p>}</section>
        {snapshot.notificationPermission !== 'granted' && <section className="rounded-xl border border-amber-400/30 bg-amber-950/25 p-3 text-xs text-amber-100"><p>{snapshot.notificationPermission === 'denied' ? text(lang, 'नोटिफिकेशन बंद हैं। समय पर याद दिलाने के लिए इन्हें अनुमति दें।', 'Notifications are off. Allow them for timely reminders.') : text(lang, 'रिमाइंडर इस फोन में सेव हैं। नोटिफिकेशन चालू करने पर समय पर याद दिलाया जाएगा।', 'Reminders are saved on this phone. Enable notifications for timely alerts.')}</p><button type="button" disabled={busy} onClick={() => void onEnableNotifications()} className="mt-2 rounded-lg border border-amber-300/50 px-2.5 py-1.5 font-bold">{text(lang, 'नोटिफिकेशन चालू करें', 'Enable notifications')}</button></section>}
        {snapshot.reminders.length === 0 && <p className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300">{text(lang, 'अभी कोई दवा रिमाइंडर नहीं है। पर्ची अपलोड करके रिमाइंडर जोड़ें।', 'No medicine reminders yet. Upload a prescription to add reminders.')}</p>}
        {snapshot.reminders.map((reminder) => <section key={reminder.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="flex items-center gap-1.5 text-sm font-bold text-white"><Pill className="h-4 w-4 text-emerald-300" />{reminder.medicineName}</h3><p className="mt-0.5 text-xs text-slate-400">{reminder.dosageText}{reminder.frequency ? ` • ${reminder.frequency}` : ''}</p></div><label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={reminder.active} onChange={(event) => void updateReminder(reminder, { times: reminder.times, active: event.target.checked })} />{reminder.active ? text(lang, 'चालू', 'On') : text(lang, 'बंद', 'Off')}</label></div><div className="mt-3 space-y-2 border-t border-slate-800 pt-3">{reminder.times.map((time, index) => <label key={`${reminder.id}-${index}`} className="flex items-center justify-between text-xs text-slate-300"><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5 text-slate-400" />{text(lang, 'समय', 'Time')} {reminder.times.length > 1 ? index + 1 : ''}</span><input type="time" value={time} onChange={(event) => changeReminderTime(reminder, index, event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white" /></label>)}</div><button type="button" disabled={busy} onClick={() => void deleteReminder(reminder.id)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-red-300"><Trash2 className="h-3.5 w-3.5" />{text(lang, 'हटाएँ', 'Remove')}</button></section>)}
        {snapshot.reminders.length > 0 && <button type="button" disabled={busy} onClick={() => void onDisableAll()} className="w-full rounded-xl border border-slate-600 px-3 py-2.5 text-sm font-semibold text-slate-200">{text(lang, 'सभी रिमाइंडर बंद करें', 'Disable all reminders')}</button>}
        {notice && <p role="alert" className="rounded-lg border border-amber-400/30 bg-amber-950/25 p-2 text-xs text-amber-100">{notice}</p>}
      </>}
    </main>
  </div>;
};
