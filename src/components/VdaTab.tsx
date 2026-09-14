import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Pill, Activity, Building2, Award, AlertTriangle, QrCode, ShieldAlert, Sparkles, CheckCircle2, Phone, Paperclip, FileText, X, LoaderCircle, Star, Flame, Clock } from 'lucide-react';
import { ChatMessage, FhirMedication, FhirObservation, LanguageCode, PatientDemographics } from '../types';
import { getTranslation, playChime, getLocalizedField } from '../utils/i18n';
import { getChatMessageText, getQuickActionLabel, getCardTitle } from '../utils/vdaEngine';
import { apiService } from '../services/api';
import {
  LocalMedicineReminder,
  LocalGamificationState,
  LocalPrescription,
  GamificationBadge,
  getTodayMedicineReminders,
  getGamificationState,
  getLatestLocalPrescription,
  toggleReminderTaken,
  createLocalPrescriptionFromUpload,
} from '../utils/localMedicationStorage';
import { EmergencyActionModal } from './EmergencyActionModal';

interface VdaTabProps {
  patient: PatientDemographics;
  medications: FhirMedication[];
  observations: FhirObservation[];
  lang: LanguageCode;
  messages: ChatMessage[];
  isProcessing: boolean;
  onSendMessage: (text: string, file?: File) => void;
  onToggleMedicationTaken?: (medId: string) => void;
  onNavigateTab: (tab: 'vda' | 'records' | 'facilities' | 'profile') => void;
  onTriggerEscalation: (reason: string) => void;
  onOpenLogVital: () => void;
}

export const VdaTab: React.FC<VdaTabProps> = ({
  patient,
  medications,
  observations,
  lang,
  messages,
  isProcessing,
  onSendMessage,
  onToggleMedicationTaken,
  onNavigateTab,
  onTriggerEscalation,
  onOpenLogVital,
}) => {
  const [inputText, setInputText] = useState('');
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing' | 'auto_sending' | 'waiting_for_vda' | 'error'>('idle');
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // Local prescription reminders & light gamification (no penalties)
  const [localReminders, setLocalReminders] = useState<LocalMedicineReminder[]>(() => getTodayMedicineReminders());
  const [gamification, setGamification] = useState<LocalGamificationState>(() => getGamificationState());
  const [latestPrescription, setLatestPrescription] = useState<LocalPrescription | null>(() => getLatestLocalPrescription());
  const [celebrationToast, setCelebrationToast] = useState<{ message: string; badge?: GamificationBadge } | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingCancelledRef = useRef(false);
  const voiceAutoSendRef = useRef(false);
  const voiceTurnStartedRef = useRef(false);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const audioBusyRef = useRef(false);
  const lastAutoSpokenMessageId = useRef<string | null>(messages[messages.length - 1]?.sender === 'vda' ? messages[messages.length - 1].id : null);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, voiceState, isProcessing]);

  // Voice uses the same parent-owned turn lifecycle as typed text. Keep the
  // controls locked until that existing turn finishes.
  useEffect(() => {
    if (voiceState !== 'waiting_for_vda') return;
    if (isProcessing) {
      voiceTurnStartedRef.current = true;
      return;
    }
    if (voiceTurnStartedRef.current) {
      voiceTurnStartedRef.current = false;
      voiceAutoSendRef.current = false;
      setSpeechTranscript('');
      setVoiceState('idle');
    }
  }, [isProcessing, voiceState]);

  // Patient replies are voice-first through the authenticated backend Sarvam TTS endpoint.
  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest || latest.sender === 'user' || latest.id === lastAutoSpokenMessageId.current) return;

    lastAutoSpokenMessageId.current = latest.id;
    void playResponseAudio(latest);
  }, [messages, lang]);

  useEffect(() => () => {
    recordingCancelledRef.current = true;
    recorderRef.current?.stop();
    playbackRef.current?.pause();
    audioBusyRef.current = false;
  }, []);

  const playTextAudio = async (audioId: string, text: string) => {
    if (speakingMsgId === audioId) {
      playbackRef.current?.pause();
      audioBusyRef.current = false;
      setSpeakingMsgId(null);
      return;
    }
    if (audioBusyRef.current) return;
    const textToSpeak = text.trim();
    if (!textToSpeak) return;
    try {
      playbackRef.current?.pause();
      audioBusyRef.current = true;
      setSpeakingMsgId(audioId);
      const audioBlob = await apiService.synthesizeVoice(textToSpeak.slice(0, 2500), lang);
      const url = URL.createObjectURL(audioBlob);
      const player = new Audio(url);
      player.onended = () => {
        URL.revokeObjectURL(url);
        audioBusyRef.current = false;
        setSpeakingMsgId(null);
      };
      player.onerror = () => {
        URL.revokeObjectURL(url);
        audioBusyRef.current = false;
        setSpeakingMsgId(null);
      };
      playbackRef.current = player;
      await player.play();
    } catch {
      // Text remains usable; device speech is not a silent fallback.
      audioBusyRef.current = false;
      setSpeakingMsgId(null);
      setVoiceError(lang === 'hi' ? 'आवाज़ चलाने में समस्या हुई। आप उत्तर पढ़ सकते हैं।' : 'Voice playback is unavailable. You can still read the response.');
    }
  };

  const playResponseAudio = async (msg: ChatMessage) => {
    await playTextAudio(msg.id, getChatMessageText(msg, lang));
  };

  const stopRecording = (cancel = false) => {
    if (!recorderRef.current) return;
    recordingCancelledRef.current = cancel;
    recorderRef.current.stop();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceState('error');
      setVoiceError(lang === 'hi' ? 'इस डिवाइस पर रिकॉर्डिंग उपलब्ध नहीं है। कृपया लिखकर पूछें।' : 'Recording is unavailable on this device. Please type your question.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        if (recordingCancelledRef.current) {
          recordingCancelledRef.current = false;
          recordingStartedAtRef.current = null;
          setVoiceState('idle');
          return;
        }
        const durationMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : undefined;
        recordingStartedAtRef.current = null;
        if (chunks.length === 0) {
          setVoiceState('error');
          setVoiceError(lang === 'hi' ? 'कोई आवाज़ रिकॉर्ड नहीं हुई। कृपया फिर से बोलें।' : 'No audio was recorded. Please try again.');
          return;
        }
        setVoiceState('transcribing');
        try {
          const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const result = await apiService.transcribeVoice(audio, lang, durationMs);
          const transcript = result.transcript.trim();
          if (!transcript) throw new Error('Voice transcription returned no text.');
          if (voiceAutoSendRef.current) return;
          voiceAutoSendRef.current = true;
          voiceTurnStartedRef.current = false;
          // Render the exact transcript, then submit it directly through the
          // existing text-turn callback instead of relying on async state.
          setInputText(transcript);
          setSpeechTranscript(transcript);
          setVoiceError('');
          setVoiceState('auto_sending');
          playChime('success');
          requestAnimationFrame(() => {
            onSendMessage(transcript);
            setInputText('');
            setVoiceState('waiting_for_vda');
          });
        } catch {
          voiceAutoSendRef.current = false;
          setVoiceState('error');
          setVoiceError(lang === 'hi' ? 'आवाज़ समझी नहीं जा सकी। कृपया लिखकर पूछें या फिर से बोलें।' : 'Your voice could not be understood. Please type your question or try again.');
          playChime('stop');
        }
      };
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      recordingCancelledRef.current = false;
      setVoiceError('');
      setSpeechTranscript('');
      setVoiceState('recording');
      recorder.start();
      playChime('start');
    } catch {
      setVoiceState('error');
      setVoiceError(lang === 'hi' ? 'माइक्रोफोन अनुमति नहीं मिली। कृपया लिखकर पूछें।' : 'Microphone permission was not granted. Please type your question.');
    }
  };

  const handleToggleListening = () => {
    if (voiceState === 'recording') stopRecording();
    else if (voiceState === 'idle' || voiceState === 'error') void startRecording();
  };

  const handleSpeakMessage = (msg: ChatMessage) => { void playResponseAudio(msg); };

  // Synchronization hook to refresh local prescription & reminders
  useEffect(() => {
    setLocalReminders(getTodayMedicineReminders());
    setGamification(getGamificationState());
    setLatestPrescription(getLatestLocalPrescription());
  }, [messages]);

  const handleToggleReminderDose = (reminderId: string) => {
    const result = toggleReminderTaken(reminderId);
    setLocalReminders(getTodayMedicineReminders());
    setGamification(result.gamification);

    if (result.reminder?.taken) {
      playChime('success');
      if (result.newlyEarnedBadge) {
        setCelebrationToast({
          message: lang === 'hi'
            ? `🎉 नया तमगा अनलॉक: ${result.newlyEarnedBadge.nameHi}!`
            : `🎉 New Badge Unlocked: ${result.newlyEarnedBadge.name}!`,
          badge: result.newlyEarnedBadge,
        });
      } else {
        setCelebrationToast({
          message: lang === 'hi'
            ? '⭐ शाबाश! आपने दवा समय पर ली। (+1 स्टार)'
            : '⭐ Great job taking your medicine on time! (+1 star)',
        });
      }
      setTimeout(() => setCelebrationToast(null), 3500);
    }
  };

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setAttachmentError(lang === 'hi' ? 'केवल PDF, JPG या PNG पर्ची अपलोड कर सकते हैं।' : 'Please select a PDF, JPG, or PNG prescription document.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAttachmentError(lang === 'hi' ? 'फाइल का साइज़ 10MB से कम होना चाहिए।' : 'File size must be under 10MB.');
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    setAttachmentError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;
    const textToSend = inputText.trim() || (selectedFile ? `[Prescription Attachment: ${selectedFile.name}]` : '');

    if (selectedFile) {
      createLocalPrescriptionFromUpload(selectedFile.name, undefined, filePreviewUrl || undefined);
      setLocalReminders(getTodayMedicineReminders());
      setGamification(getGamificationState());
      setLatestPrescription(getLatestLocalPrescription());
    }

    onSendMessage(textToSend, selectedFile || undefined);
    setInputText('');
    setSpeechTranscript('');
    setVoiceState('idle');
    handleRemoveFile();
  };

  const voiceInteractionBusy = voiceState === 'transcribing'
    || voiceState === 'auto_sending'
    || voiceState === 'waiting_for_vda';

  const renderAgentBadge = (agent?: string) => {
    switch (agent) {
      case 'medication':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Pill className="w-3 h-3" /> {getTranslation(lang, 'medicationAgent')}
          </span>
        );
      case 'lab_explainer':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-3 h-3" /> {getTranslation(lang, 'labAgent')}
          </span>
        );
      case 'facility':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Building2 className="w-3 h-3" /> {getTranslation(lang, 'hospitalAgent')}
          </span>
        );
      case 'scheme':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Award className="w-3 h-3" /> {getTranslation(lang, 'schemeAgent')}
          </span>
        );
      case 'safety_gate':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
            <ShieldAlert className="w-3 h-3" /> {getTranslation(lang, 'safetyGateAgent')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <Sparkles className="w-3 h-3" /> {getTranslation(lang, 'multiAgentVda')}
          </span>
        );
    }
  };

  const patientDistrict = getLocalizedField(patient, 'district', lang);
  const patientState = getLocalizedField(patient, 'state', lang);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Top Header */}
      <header className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-950 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-sm font-bold text-white tracking-tight truncate">{patient.name}</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-medium whitespace-nowrap">
                ABHA Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {patientDistrict}, {patientState} • NCD Care
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Direct Emergency Quick Dial Trigger */}
          <button
            id="emergency-sos-btn"
            onClick={() => setShowEmergencyModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
            title="Emergency Speed Dial (24x7)"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>SOS</span>
          </button>

          {/* Test the same backend SafetyGate path used by a patient message. */}
          <button
            id="trigger-test-safety-btn"
            onClick={() => onTriggerEscalation('Severe chest tightness and left arm numbness')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-semibold transition-colors active:scale-95 whitespace-nowrap"
            title="Test backend SafetyGate clinical escalation"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{getTranslation(lang, 'safetyGateBadge')}</span>
            <span className="sm:hidden">Gate</span>
          </button>
        </div>
      </header>

      {/* Main Chat Messages Container */}
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3.5 space-y-3.5 scroll-smooth min-h-0"
      >
        {/* Medicine Reminders & Light Gamification Card (Prescription-Derived, Penalty-Free) */}
        <section
          className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-3.5 shadow-lg relative overflow-hidden"
          aria-label="Medicine Reminders"
        >
          {/* Header & Gamification Stats */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                <Pill className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  <span>{lang === 'hi' ? 'दवाइयां और रिमाइंडर' : 'Medicine Reminders'}</span>
                  {latestPrescription && (
                    <span className="text-[10px] font-normal text-indigo-300 font-mono">
                      ({latestPrescription.filename})
                    </span>
                  )}
                </h2>
                <p className="text-[10px] text-slate-400">
                  {lang === 'hi'
                    ? 'अपलोड की गई पर्ची के अनुसार समय'
                    : 'Timings derived from your uploaded prescription'}
                </p>
              </div>
            </div>

            {/* Gamification Stats: Streak & Stars (Penalty-Free) */}
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold"
                title={lang === 'hi' ? 'लगातार दवा लेने का नियम' : 'Consistency streak'}
              >
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>{gamification.streakDays} {lang === 'hi' ? 'दिन' : 'd'}</span>
              </div>
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold"
                title={lang === 'hi' ? 'अर्जित सितारे' : 'Stars earned'}
              >
                <Star className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span>{gamification.stars}</span>
              </div>
            </div>
          </div>

          {/* Encouraging Celebration Toast */}
          {celebrationToast && (
            <div className="mt-2.5 p-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/40 flex items-center gap-2 text-xs font-bold text-emerald-200 animate-pulse">
              <span>{celebrationToast.badge ? celebrationToast.badge.icon : '⭐'}</span>
              <span>{celebrationToast.message}</span>
            </div>
          )}

          {/* Reminders List */}
          {localReminders.length > 0 ? (
            <div className="mt-3 space-y-2">
              {localReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    reminder.taken
                      ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-white">
                        {lang === 'hi' && reminder.medicationNameHi
                          ? reminder.medicationNameHi
                          : reminder.medicationName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                        {reminder.dosage}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span className="font-semibold text-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {reminder.time}
                      </span>
                      <span>•</span>
                      <span>{reminder.foodRelation}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleReminderDose(reminder.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1 ${
                      reminder.taken
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-950'
                    }`}
                  >
                    {reminder.taken ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{lang === 'hi' ? 'ली गई' : 'Taken'}</span>
                      </>
                    ) : (
                      <>
                        <Pill className="w-3.5 h-3.5" />
                        <span>{lang === 'hi' ? 'दवा लें' : 'Take Dose'}</span>
                      </>
                    )}
                  </button>
                </div>
              ))}

              {/* Milestone Badges Bar */}
              <div className="pt-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {gamification.badges.map((b) => {
                  const isUnlocked = !!b.unlockedAt;
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border whitespace-nowrap transition-colors ${
                        isUnlocked
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-200 shadow-sm'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-500 opacity-50'
                      }`}
                      title={lang === 'hi' ? b.descriptionHi : b.description}
                    >
                      <span>{b.icon}</span>
                      <span>{lang === 'hi' ? b.nameHi : b.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Upload prescription prompt when no prescription is stored locally */
            <div className="mt-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
              <p className="text-xs text-slate-300 leading-relaxed">
                {lang === 'hi'
                  ? 'अपनी डॉक्टर की पर्ची अपलोड करें ताकि VDA आपकी दवाइयां समझा सके और सही समय पर रिमाइंडर सेट कर सके।'
                  : 'Upload your doctor’s prescription so VDA can explain your medicines in simple words and set timely reminders.'}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md active:scale-95"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>{lang === 'hi' ? 'पर्ची अपलोड करें' : 'Upload Prescription'}</span>
              </button>
            </div>
          )}
        </section>

        {/* Message Bubble Stream */}
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          const isSpeaking = speakingMsgId === msg.id;
          const displayMessageText = getChatMessageText(msg, lang);

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              {/* Agent Badge for AI */}
              {!isUser && (
                <div className="flex items-center gap-2 mb-0.5">
                  {renderAgentBadge(msg.agent)}
                  <span className="text-[10px] text-slate-500 font-mono">{msg.timestamp}</span>
                </div>
              )}

              {/* Message Box */}
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed relative ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-br-none shadow-md shadow-emerald-950'
                    : msg.isEscalationTrigger
                    ? 'bg-red-950/80 border border-red-500/50 text-red-100 rounded-bl-none shadow-lg'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                }`}
              >
                {msg.attachment && (
                  <div className="mb-2 p-2 rounded-xl bg-slate-950/60 border border-slate-700/60 flex items-center gap-2">
                    {msg.attachment.isImage && msg.attachment.url ? (
                      <img src={msg.attachment.url} alt="Prescription" className="w-12 h-12 object-cover rounded-lg border border-slate-700" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-100 truncate">{msg.attachment.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {msg.attachment.type}
                      </span>
                    </div>
                  </div>
                )}

                <p className="whitespace-pre-line font-medium">
                  {displayMessageText}
                </p>

                {/* Read Aloud Button for low-literacy users */}
                {!isUser && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => handleSpeakMessage(msg)}
                      className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg transition-all ${
                        isSpeaking
                          ? 'bg-emerald-500 text-slate-950 animate-pulse'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>{isSpeaking ? getTranslation(lang, 'stopReading') : getTranslation(lang, 'readAloud')}</span>
                    </button>
                    <span className="text-[10px] text-slate-500">FHIR R4 Verified</span>
                  </div>
                )}
              </div>

              {/* Embedded Rich Card Data */}
              {msg.cardData && (
                <div className="w-full max-w-[85%] mt-1">
                  {msg.cardData.type === 'medication_reminder' && (
                    <div className="p-3 rounded-2xl bg-slate-900 border border-blue-500/30 text-xs">
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
                        <span className="font-bold text-blue-400 flex items-center gap-1">
                          <Pill className="w-3.5 h-3.5" /> {getCardTitle(msg.cardData, lang)}
                        </span>
                        <span className="text-[10px] text-slate-400">AIIMS Prescription</span>
                      </div>
                      <div className="space-y-2">
                        {medications.slice(0, 3).map((med) => (
                          <div key={med.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
                            <div>
                              <p className="font-semibold text-white text-xs">{getLocalizedField(med, 'name', lang)}</p>
                              <p className="text-[10px] text-slate-400">{getLocalizedField(med, 'dosage', lang)}</p>
                            </div>
                            <button
                              onClick={() => onToggleMedicationTaken(med.id)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                med.takenToday
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{med.takenToday ? getTranslation(lang, 'takenToday') : getTranslation(lang, 'markTaken')}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.cardData.type === 'lab_highlight' && (
                    <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/30 text-xs">
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5" /> {getCardTitle(msg.cardData, lang)}
                        </span>
                        <span className="text-[10px] text-slate-400">LOINC: 4548-4</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                          <p className="text-[10px] text-slate-400">HbA1c (3 Month Sugar)</p>
                          <p className="text-base font-bold text-emerald-400">7.8 %</p>
                          <p className="text-[9px] text-slate-400">Target &lt; 7.0%</p>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                          <p className="text-[10px] text-slate-400">Blood Pressure</p>
                          <p className="text-base font-bold text-blue-400">132/84</p>
                          <p className="text-[9px] text-slate-400">Telmisartan 40mg</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {msg.cardData.type === 'facility_qr' && (
                    <div className="p-3 rounded-2xl bg-slate-900 border border-amber-500/30 text-xs">
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
                        <span className="font-bold text-amber-400 flex items-center gap-1">
                          <QrCode className="w-3.5 h-3.5" /> {getCardTitle(msg.cardData, lang)}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mb-2">
                        District Hospital Sitapur • OPD Gate No. 2
                      </p>
                      <button
                        onClick={() => onNavigateTab('facilities')}
                        className="w-full py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 flex items-center justify-center gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{getTranslation(lang, 'generateQrToken')}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Action Buttons */}
              {msg.quickActions && msg.quickActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {msg.quickActions.map((qa, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (qa.action === 'show_records_meds' || qa.action === 'show_records_obs') {
                          onNavigateTab('records');
                        } else if (qa.action === 'open_log_vital') {
                          onOpenLogVital();
                        } else if (qa.action === 'show_opd_token' || qa.action === 'show_schemes' || qa.action === 'find_jan_aushadhi') {
                          onNavigateTab('facilities');
                        } else if (qa.action === 'ask_medicines') {
                          onSendMessage(getTranslation(lang, 'myMedicinesChip'));
                        } else if (qa.action === 'ask_sugar_lab') {
                          onSendMessage(getTranslation(lang, 'sugarLabChip'));
                        } else if (qa.action === 'ask_hospital') {
                          onSendMessage(getTranslation(lang, 'nearbyHospitalChip'));
                        } else if (qa.action === 'ask_scheme') {
                          onSendMessage(getTranslation(lang, 'pmjayBenefitsChip'));
                        } else if (qa.action === 'attach_prescription') {
                          fileInputRef.current?.click();
                        }
                      }}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-all active:scale-95"
                    >
                      {getQuickActionLabel(qa, lang)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Backend-mediated audio capture status. No transcript is fabricated. */}
        {voiceState === 'recording' && (
          <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs animate-pulse flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <div className="flex-1">
              <span className="font-semibold">{getTranslation(lang, 'listening')}</span>
              <p className="text-white font-medium mt-0.5">{lang === 'hi' ? 'बोलना समाप्त होने पर माइक्रोफोन दबाएं।' : 'Tap the microphone again when you finish speaking.'}</p>
            </div>
            <button type="button" onClick={() => stopRecording(true)} className="text-[11px] font-semibold text-emerald-100 underline">{lang === 'hi' ? 'रद्द करें' : 'Cancel'}</button>
          </div>
        )}

        {voiceState === 'transcribing' && (
          <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/40 text-emerald-100 text-xs flex items-center gap-2" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin text-emerald-400" />
            <span className="font-semibold">{lang === 'hi' ? 'आवाज़ समझी जा रही है…' : 'Transcribing your voice…'}</span>
          </div>
        )}

        {(voiceState === 'auto_sending' || voiceState === 'waiting_for_vda') && speechTranscript && (
          <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/30 text-emerald-100 text-xs">
            <span className="font-semibold">{lang === 'hi' ? 'आपका प्रश्न भेजा जा रहा है:' : 'Sending your voice question:'}</span>
            <p className="mt-1 text-slate-300">{speechTranscript}</p>
          </div>
        )}

        {voiceState === 'auto_sending' && (
          <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/40 text-emerald-100 text-xs flex items-center gap-2" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin text-emerald-400" />
            <span className="font-semibold">{lang === 'hi' ? 'प्रश्न VDA को भेजा जा रहा है…' : 'Sending your question to VDA…'}</span>
          </div>
        )}

        {voiceState === 'error' && voiceError && (
          <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-100 text-xs" role="status">{voiceError}</div>
        )}

        {isProcessing && (
          <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-bl-none border border-emerald-500/30 bg-slate-900 px-3.5 py-3 text-xs text-emerald-100 shadow-sm" role="status" aria-live="polite">
            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-emerald-400" />
            <div>
              <p className="font-semibold">{lang === 'hi' ? 'VDA आपका प्रश्न समझ रहा है…' : lang === 'en' ? 'VDA is preparing your answer…' : getTranslation(lang, 'processing')}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{lang === 'hi' ? 'कृपया एक क्षण प्रतीक्षा करें' : 'Please wait a moment'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Bottom Voice & Input Deck */}
      <div className="flex-shrink-0 bg-slate-950/95 border-t border-slate-800/80 px-3 py-2.5 space-y-2 backdrop-blur-md z-20 shadow-lg">
        {/* Suggestion Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          <button
            onClick={() => onSendMessage(getTranslation(lang, 'myMedicinesChip'))}
            disabled={isProcessing || voiceInteractionBusy}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
          >
            <Pill className="w-3.5 h-3.5 text-blue-400" />
            <span>{getTranslation(lang, 'myMedicinesChip')}</span>
          </button>
          <button
            onClick={() => onSendMessage(getTranslation(lang, 'sugarLabChip'))}
            disabled={isProcessing || voiceInteractionBusy}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>{getTranslation(lang, 'sugarLabChip')}</span>
          </button>
          <button
            onClick={() => onSendMessage(getTranslation(lang, 'nearbyHospitalChip'))}
            disabled={isProcessing || voiceInteractionBusy}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>{getTranslation(lang, 'nearbyHospitalChip')}</span>
          </button>
          <button
            onClick={() => onSendMessage(getTranslation(lang, 'pmjayBenefitsChip'))}
            disabled={isProcessing || voiceInteractionBusy}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
          >
            <Award className="w-3.5 h-3.5 text-purple-400" />
            <span>{getTranslation(lang, 'pmjayBenefitsChip')}</span>
          </button>
        </div>

        {/* Pending Attachment Preview Badge */}
        {selectedFile && (
          <div className="p-2 rounded-xl bg-slate-900 border border-emerald-500/40 flex items-center justify-between gap-2 shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2.5 min-w-0">
              {filePreviewUrl ? (
                <img src={filePreviewUrl} alt="Preview" className="w-9 h-9 object-cover rounded-lg border border-slate-700" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200 truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-slate-400">
                  {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type.split('/')[1]?.toUpperCase()}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
              title="Remove attachment"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {attachmentError && (
          <div className="px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-300 text-xs flex items-center justify-between">
            <span>{attachmentError}</span>
            <button onClick={() => setAttachmentError(null)} className="text-red-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Row & Hero Mic Button */}
        <div className="flex items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
          />

          {/* Secondary Text Input Box */}
          <form onSubmit={handleSendText} className="flex-1 flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl px-3.5 py-2 focus-within:border-emerald-500/60 transition-all shadow-sm">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || voiceInteractionBusy}
              className="p-1 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all flex-shrink-0"
              title="Attach Prescription (PDF, JPG, PNG)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing || voiceInteractionBusy}
              placeholder={selectedFile ? `Ask about ${selectedFile.name}...` : getTranslation(lang, 'typeMessagePlaceholder')}
              className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
            {(inputText.trim() || selectedFile) && (
              <button
                type="submit"
                disabled={isProcessing || voiceInteractionBusy}
                className="p-1.5 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Hero Thumb-Accessible Voice Microphone Button */}
          <button
            id="vda-hero-mic-btn"
            onClick={handleToggleListening}
            disabled={isProcessing || voiceInteractionBusy}
            className={`relative flex-shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl transition-all shadow-xl active:scale-95 ${
              voiceState === 'recording'
                ? 'bg-red-500 text-white ring-4 ring-red-500/40 shadow-red-950 animate-pulse'
                : 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 hover:from-emerald-400 hover:to-teal-300 shadow-emerald-950/60 ring-2 ring-emerald-400/30'
            }`}
            title="Tap to speak with VDA Voice Assistant"
          >
            {voiceState === 'recording' ? (
              <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <Mic className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            )}

            {/* Pulsing Voice Waves Ring */}
            {voiceState === 'recording' && (
              <span className="absolute -inset-1 rounded-2xl border-2 border-red-400 animate-ping opacity-75 pointer-events-none" />
            )}
          </button>
        </div>
      </div>

      {/* Direct Emergency Action Modal (Ambulance 108, eSanjeevani, Nearby Hospitals) */}
      {showEmergencyModal && (
        <EmergencyActionModal
          lang={lang}
          onClose={() => setShowEmergencyModal(false)}
          onOpenTeleconsultation={async () => {
            window.open('https://esanjeevani.mohfw.gov.in', '_blank');
          }}
        />
      )}
    </div>
  );
};
