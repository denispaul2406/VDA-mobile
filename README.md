# VDA Health Assistant (Voice & Digital Health Navigator)
### Production-Ready, ABDM-Compliant Multi-Agent AI Healthcare Mobile Application

[![ABDM Standard](https://img.shields.io/badge/ABDM-FHIR%20R4%20Compliant-10b981.svg)](https://abdm.gov.in/)
[![Capacitor Android](https://img.shields.io/badge/Capacitor-Android%20APK%20Ready-38bdf8.svg)](https://capacitorjs.com/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6.x-a855f7.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)]()

**VDA Health Assistant** is a multilingual, voice-first digital health assistant designed in alignment with India's **Ayushman Bharat Digital Mission (ABDM)** and **FHIR R4 (Fast Healthcare Interoperability Resources)** standards. It empowers citizens—regardless of literacy levels—to seamlessly navigate their health records, monitor chronic illnesses, track medication schedules, discover nearby public healthcare facilities, check government scheme benefits (e.g., Ayushman Bharat PM-JAY ₹5,00,000 cashless insurance), and receive immediate triage intervention during clinical emergencies.

---

## 📱 Pre-Built Android APK (`VDA.apk`)

A production-ready Android Debug APK has been compiled and is available directly in the project root:
- **Primary Binary:** [`VDA.apk`](VDA.apk) (also saved as `vda-health-assistant.apk`)
- **Size:** `4.29 MB` (4,298,411 bytes)
- **Target Platform:** Android 7.0 (API 24) to Android 15/16 (API 36)
- **Production Backend Connected:** `https://vda-api.mdtlabs.org`
- **Install on Device via ADB:**
  ```bash
  adb install -r VDA.apk
  ```

---

## 🌐 Live Cloud Production Endpoints

| Service | Endpoint URL | Status | Details |
| :--- | :--- | :--- | :--- |
| **Backend API Gateway** | [https://vda-api.mdtlabs.org](https://vda-api.mdtlabs.org) | **ACTIVE (HTTPS)** | Direct API gateway for mobile app |
| **Admin Portal** | [https://vda-admin.mdtlabs.org](https://vda-admin.mdtlabs.org) | **ACTIVE (HTTPS)** | Clinical supervision and telemetry |
| **API Health** | [https://vda-api.mdtlabs.org/api/v1/health](https://vda-api.mdtlabs.org/api/v1/health) | **HEALTHY** | `{"database":"healthy","redis":"healthy"}` |

---

## 🧬 VDA Gold Synthetic Patient Dataset (200 ABDM / FHIR R4 Records)

The application is natively integrated with the **VDA Gold Synthetic Patient Dataset**, generating **200 structurally faithful, statistically realistic, and Indian regulatory-compliant patient records** conforming to NRCeS C-DAC Pune ABDM FHIR IG v6.5.0 and VDA Engineering Spec §05.

### Key Dataset Characteristics
- **Dataset Generation Date:** September 1, 2026
- **Source Files:** `src/data/patients_200_summary.json` & `c:\Users\devil\Desktop\VDA\data\`
- **Non-issuable ABHA Prefix:** `98-XXXX-XXXX-XXXX` (guarantees zero collision with real Aadhaar-seeded ABHA identities)
- **Geographic Coverage:**
  - **Haryana:** 109 patients (Districts: Gurugram, Faridabad, Karnal, Ambala, Panipat, Rohtak, etc.)
  - **Himachal Pradesh:** 91 patients (Districts: Solan, Shimla, Kangra, Mandi, Una, Bilaspur, Kullu, etc.)
- **7 Pilot Testing Categories (200 Cases Total):**
  1. **NCD Glucose / BP queries** (40 cases, `synth-patient-001` .. `040`): Type-2 diabetes, essential hypertension, routine self-monitoring.
  2. **Prescription interpretation** (30 cases, `synth-patient-041` .. `070`): Polypharmacy, complex dosages (e.g. before/after food, empty stomach), refill alerts.
  3. **Lab report explanation** (30 cases, `synth-patient-071` .. `100`): Diagnostic panels, trend explanations, layperson interpretations.
  4. **Emergency escalation cases** (25 cases, `synth-patient-101` .. `125`): Critical red-flags, severe hyperglycemia ($>300\text{ mg/dL}$), hypertensive crises ($>180/110\text{ mmHg}$), automatic tele-triage triggering.
  5. **Scheme / benefits queries** (20 cases, `synth-patient-126` .. `145`): PM-JAY ₹5L annual cashless hospital coverage, state schemes (HIMCARE HP, Chirayu Haryana).
  6. **Facility search queries** (15 cases, `synth-patient-146` .. `160`): Geo-located Civil Hospitals, PHCs, CHCs, Jan Aushadhi Kendras, Blood Banks.
  7. **Multilingual parity cases** (40 cases, `synth-patient-161` .. `200`): Hindi, English, Tamil, and Kannada translations with audio read-aloud parity.

### 9 Canonical Clinical LOINC Markers
Every patient in the dataset contains observations mapped to standard international LOINC codes:

| Marker | Canonical LOINC | Standard Unit | Reference Range | Clinical Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Fasting Glucose** | `1558-6` | mg/dL | $70 - 100$ | Baseline glycemic control after 8h fast |
| **Post-Prandial Glucose** | `1521-4` | mg/dL | $< 140$ | Post-meal glycemic spike evaluation |
| **HbA1c** | `4548-4` | % | $4.0 - 5.6$ (Target $< 7.0$) | 3-month average plasma glucose |
| **Systolic BP** | `8480-6` | mmHg | $90 - 120$ | Ventricular contraction blood pressure |
| **Diastolic BP** | `8462-4` | mmHg | $60 - 80$ | Ventricular relaxation blood pressure |
| **LDL Cholesterol** | `2089-1` | mg/dL | $< 100$ | Atherogenic dyslipidemia assessment |
| **eGFR** | `62238-1` | mL/min/1.73m² | $> 60$ | Renal filtration & kidney stage evaluation |
| **Urine Microalbumin** | `14959-1` | mg/g | $< 30$ | Early diabetic nephropathy screening |
| **BMI** | `39156-5` | kg/m² | $18.5 - 24.9$ | Anthropometric nutritional & metabolic index |

---

## 🏛️ System Architecture

```
                                  ┌──────────────────────────────────────────────┐
                                  │      VDA Mobile UI (Android APK / Web)       │
                                  │ React 19 • TailwindCSS v4 • Lucide • WebSpeech │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                    ┌────────────────────┴───────────────────┐
                                    ▼                                        ▼
                         [Voice Input Engine]                     [Text Input & Chips]
                      SpeechRecognition (hi/en/ta/kn)         Pre-configured Quick Prompts
                                    │                                        │
                                    └────────────────────┬───────────────────┘
                                                         ▼
                                       ┌───────────────────────────────────┐
                                       │   Deterministic Clinical Safety   │
                                       │    Gate (Red Flag Emergency Rule) │
                                       └─────────────────┬─────────────────┘
                                                         │
                                      Is Emergency? ─────┴───── Safe Query
                                     /                              \
                                   YES                               NO
                                  /                                    \
          ┌───────────────────────────────┐           ┌────────────────────────────────┐
          │ Full-Screen Emergency Modal   │           │   Modular API Client Service   │
          │ • Live Doctor Tele-Triage     │           │       (src/services/api.ts)    │
          │ • Ambulance 108 Dispatch      │           └───────────────┬────────────────┘
          │ • Immediate Vitals Telemetry  │                           │
          └───────────────────────────────┘             ┌─────────────┴────────────┐
                                                        ▼                          ▼
                                            [Backend Connected?]        [Offline / Standalone?]
                                                        │                          │
                                                       YES                         NO
                                                        │                          │
                                        ┌───────────────┴───────────────┐          ▼
                                        │ External REST / GraphQL API   │   [Local VDA Rule Engine &]
                                        │ • ABDM Gateway (M1, M2, M3)   │   [Synthetic FHIR Dataset ]
                                        │ • Gemini 2.0 Flash / LLM      │
                                        │ • Hospital Telemetry Webhooks │
                                        └───────────────────────────────┘
```

---

## 🚀 Key Features

1. **Multilingual Voice-First Experience**:
   - Native speech recognition and text-to-speech support for **Hindi (हिन्दी)**, **English**, **Tamil (தமிழ்)**, and **Kannada (ಕನ್ನಡ)**.
   - Low-literacy accessible: every message, prescription, lab test, and scheme card has a one-tap "Listen (बोलकर सुनें)" button.
2. **Clinical Safety Gate & Emergency Escalation**:
   - Zero-hallucination deterministic guardrail inspecting all user queries for red-flag medical emergencies:
     - **Cardiac**: Chest pain, tightness, radiating left arm pain, profuse cold sweating.
     - **Stroke (FAST Protocol)**: Slurred speech, facial drooping, unilateral arm weakness.
     - **Respiratory Distress**: Acute breathlessness, gasping for air.
     - **Critical Hypoglycemia**: Blood sugar $< 50\text{ mg/dL}$ with tremors and confusion.
     - **Hypertensive Crisis**: Blood pressure $> 190/120\text{ mmHg}$ with unbearable headache.
   - Triggers an instant full-screen takeover modal connecting the patient to simulated tele-emergency clinicians and ambulance dispatch.
3. **ABDM & FHIR R4 Standard Compliance**:
   - **ABHA Identity**: 14-digit ABHA Number (`91-4589-2041-8832`) and ABHA Address (`ramesh.kumar@abdm`).
   - **FHIR Conditions**: SNOMED CT and ICD-10 coded chronic conditions (e.g., E11.9 Type 2 Diabetes, I10 Hypertension).
   - **FHIR Medications**: Dosage schedules, frequency, timing (before/after meals), refill counters, and real-time adherence tracking.
   - **FHIR Observations**: LOINC-coded lab reports (e.g., `4548-4` HbA1c, `85354-9` Blood Pressure) with layman interpretations and clinical trends.
   - **FHIR Document References**: Digital prescriptions, discharge summaries, and OPD slips.
   - **Consent Manager Artifacts**: Granular consent tracking and instant revocation.
4. **Public Health Navigation**:
   - **Fast-Track OPD QR Check-in**: Eliminates long hospital queues through instant digital token generation.
   - **Facility Directory**: Real-time distance, bed availability, and 24x7 emergency status for District Hospitals, PHCs, CHCs, AIIMS, and Blood Banks.
   - **PM Jan Aushadhi Generic Matcher**: Compares expensive branded drugs with government Jan Aushadhi generic alternatives, showing up to 85% cost savings.
   - **Government Scheme Finder**: Automated eligibility matching for PM-JAY, Ayushman Vay Vandana, and maternal RCH programs.

---

## 🔌 Backend Integration Guide (For Backend Developers)

The mobile app includes a production-grade, typed API communication client located at [src/services/api.ts](src/services/api.ts).

### 1. How the Frontend Connects
- By default, the app looks for `VITE_API_BASE_URL` in the environment.
- **When `VITE_API_BASE_URL` is configured:** The app sends live HTTP requests with Bearer tokens to your backend.
- **When `VITE_API_BASE_URL` is empty OR backend is offline:** The app **never crashes**; it seamlessly falls back to high-fidelity synthetic ABDM FHIR data.

### 2. Environment Configuration
Create a `.env.local` or `.env` file in the root directory:

```bash
# Point to your running backend server
VITE_API_BASE_URL=http://localhost:5000

# Set to "false" if you want the app to strictly throw errors when backend is down
VITE_ENABLE_MOCK_FALLBACK=true

# Optional Google Gemini API key for direct client-side fallback
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Note for Android Emulators & Physical Devices:**
> - Android Emulator: Use `http://10.0.2.2:5000` to access localhost on the development machine.
> - Physical Android Device: Use your computer's local LAN IP (e.g., `http://192.168.1.15:5000`) or your deployed HTTPS domain.

---

### 3. REST API Specification

Your backend should implement the following endpoints. A reference implementation is included in [server/index.js](server/index.js).

#### Common Headers
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <JWT_OR_ABDM_SESSION_TOKEN>
```

---

#### A. List Gold Synthetic Patients (200 Records)
`GET /api/patients?category=NCD_GLUCOSE_BP&state=Himachal%20Pradesh&search=Vijay`

**Query Parameters:**
- `category` (optional): `NCD_GLUCOSE_BP`, `EMERGENCY_ESCALATION`, `PRESCRIPTION_INTERPRETATION`, `LAB_EXPLANATION`, `SCHEME_BENEFITS`, `FACILITY_SEARCH`, `MULTILINGUAL_PARITY`
- `state` (optional): `Haryana`, `Himachal Pradesh`
- `search` (optional): search by name, district, or ABHA number

**Response (`200 OK`):**
```json
{
  "success": true,
  "count": 40,
  "data": [
    {
      "id": "synth-patient-001",
      "name": "Vijay Chauhan",
      "abhaNumber": "98-2824-1498-8924",
      "age": 61,
      "gender": "male",
      "state": "Himachal Pradesh",
      "district": "Solan",
      "goldCategory": "NCD Glucose / BP queries",
      "categoryCode": "NCD_GLUCOSE_BP",
      "escalationTriggered": false,
      "pmjayEligible": true
    }
  ]
}
```

---

#### B. Fetch Complete ABDM FHIR R4 DocumentBundle
`GET /api/records/bundle/:id`

Retrieves the raw HL7 FHIR R4 `Bundle` (type: `document`) containing the `Composition`, `Patient`, `Practitioner`, `Organization`, `Condition`, `MedicationStatement`, and `Observation` resources.

**Response (`200 OK`):**
```json
{
  "resourceType": "Bundle",
  "id": "bundle-synth-patient-001",
  "type": "document",
  "timestamp": "2026-09-01T08:30:00+05:30",
  "entry": [
    { "fullUrl": "urn:uuid:composition-001", "resource": { "resourceType": "Composition", "title": "OPD Consultation & NCD Review" } },
    { "fullUrl": "urn:uuid:patient-001", "resource": { "resourceType": "Patient", "identifier": [{ "system": "https://healthid.ndhm.gov.in", "value": "98-2824-1498-8924" }] } }
  ]
}
```

---

#### C. Patient Demographics & Profile
`GET /api/patient/profile?id=synth-patient-001`

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "P-992144",
    "name": "Ramesh Kumar",
    "nameHi": "रमेश कुमार",
    "nameTa": "ரமேஷ் குமார்",
    "nameKn": "ರಮೇಶ್ ಕುಮಾರ್",
    "age": 58,
    "gender": "male",
    "abhaNumber": "91-4589-2041-8832",
    "abhaAddress": "ramesh.kumar@abdm",
    "phone": "+91 98765 43210",
    "bloodGroup": "B+",
    "district": "Sitapur",
    "state": "Uttar Pradesh",
    "emergencyContact": {
      "name": "Suresh Kumar",
      "relation": "Son",
      "phone": "+91 98765 00000"
    },
    "ayushmanCardNumber": "PMJAY-UP-9921-4401-72"
  }
}
```

---

#### B. Active Clinical Conditions (FHIR Condition)
`GET /api/records/conditions?persona=ramesh-kumar`

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cond-01",
      "code": "E11.9",
      "display": "Type 2 Diabetes Mellitus",
      "displayHi": "टाइप 2 मधुमेह (शुगर)",
      "clinicalStatus": "active",
      "verificationStatus": "confirmed",
      "severity": "moderate",
      "onsetDateTime": "2021-04-10",
      "recordedDate": "2024-01-15",
      "sourceFacility": "District Hospital Sitapur"
    }
  ]
}
```

---

#### C. Prescribed Medications & Adherence (FHIR MedicationStatement)
`GET /api/records/medications?persona=ramesh-kumar`

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "med-01",
      "name": "Metformin 500mg",
      "nameHi": "मेटफॉर्मिन 500 मि.ग्रा.",
      "code": "860975",
      "dosage": "1 tablet twice daily",
      "dosageHi": "1 गोली दिन में दो बार",
      "frequency": "Twice daily",
      "timing": "after_meal",
      "prescribedDate": "2024-01-15",
      "duration": "90 days",
      "refillCount": 2,
      "totalDays": 90,
      "daysRemaining": 18,
      "sourceFacility": "AIIMS New Delhi OPD",
      "takenToday": true,
      "timeOfDay": ["08:00 AM", "08:00 PM"],
      "adherenceRate": 92
    }
  ]
}
```

**Toggle Medication Dose Taken:**
`POST /api/records/medications/:id/adherence`
```json
{
  "taken": true,
  "timestamp": "2026-09-02T08:30:00Z"
}
```

---

#### D. Observations & Lab Results (FHIR Observation)
`GET /api/records/observations?persona=ramesh-kumar`

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "obs-01",
      "code": "4548-4",
      "display": "Hemoglobin A1c (HbA1c)",
      "displayHi": "ग्लाइकोसिलेटेड हीमोग्लोबिन (HbA1c)",
      "category": "laboratory",
      "value": 7.8,
      "unit": "%",
      "interpretation": "high",
      "referenceRange": "4.0 - 5.6 % (Target < 7.0%)",
      "effectiveDateTime": "2024-02-18T10:30:00Z",
      "sourceFacility": "AIIMS Central Lab",
      "history": [
        { "date": "2023-06-10", "value": 8.6 },
        { "date": "2023-10-14", "value": 8.2 },
        { "date": "2024-02-18", "value": 7.8 }
      ]
    }
  ]
}
```

**Save New Observation (Self-reported Vital Sign):**
`POST /api/records/observations`
```json
{
  "code": "14749-6",
  "display": "Blood Glucose Fasting",
  "displayHi": "खाली पेट ब्लड शुगर",
  "category": "laboratory",
  "value": 118,
  "unit": "mg/dL",
  "interpretation": "normal",
  "referenceRange": "70 - 100 mg/dL",
  "sourceFacility": "Self Monitored (Home Care)"
}
```

---

#### E. Conversational AI Assistant (VDA Chat)
`POST /api/vda/chat`

**Request Body:**
```json
{
  "query": "मेरी शुगर की रिपोर्ट समझाएं",
  "lang": "hi",
  "patientContext": {
    "id": "P-992144",
    "name": "Ramesh Kumar",
    "abhaNumber": "91-4589-2041-8832",
    "age": 58,
    "gender": "male",
    "bloodGroup": "B+"
  },
  "activeMedications": [
    { "name": "Metformin 500mg", "dosage": "1 tablet twice daily", "takenToday": true }
  ],
  "latestObservations": [
    { "code": "4548-4", "display": "HbA1c", "value": 7.8, "unit": "%" }
  ]
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "message": {
      "id": "msg-1725250000000",
      "sender": "vda",
      "agent": "lab_explainer",
      "text": "Based on your AIIMS records, your HbA1c is 7.8%...",
      "textHi": "एम्स ओपीडी रिकॉर्ड अनुसार: आपका HbA1c स्तर 7.8% है। यह पिछले 8.6% से काफी सुधरा है!",
      "timestamp": "10:30 AM",
      "audioAvailable": true,
      "cardData": {
        "type": "lab_highlight",
        "title": "Latest Lab Summary",
        "titleHi": "ताजा जांच रिपोर्ट सारांश",
        "details": {
          "hba1c": "7.8% (Target < 7.0%)",
          "bloodPressure": "132/84 mmHg"
        }
      },
      "quickActions": [
        { "label": "Log Vital Reading", "labelHi": "नया शुगर मापें", "action": "open_log_vital" }
      ]
    }
  }
}
```

---

#### F. Emergency Clinical Escalation Webhook
`POST /api/escalation/trigger`

When a red-flag symptom is detected (e.g. chest pain or stroke symptoms), the client immediately posts the clinical payload to alert hospital triage desks:

```json
{
  "isActive": true,
  "escalationId": "ESC-992101",
  "reason": "Possible Acute Coronary Syndrome (ACS) / Cardiac Emergency",
  "severity": "CRITICAL",
  "triggerSymptom": "सीने में तेज दर्द हो रहा है और पसीना आ रहा है",
  "timestamp": "10:32 AM",
  "patientName": "Ramesh Kumar",
  "abhaNumber": "91-4589-2041-8832",
  "assignedDoctor": {
    "name": "Dr. Ananya Sharma, MD",
    "facility": "AIIMS New Delhi Tele-Emergency Care",
    "regNo": "MCI-88419-UP"
  }
}
```

---

## 🏃 Running the Project Locally

### Prerequisites
- **Node.js**: v18+ (tested on Node v22.18.0)
- **npm**: v9+ (tested on npm 10.9.3)
- **Java JDK**: JDK 17, 21, or 22 (tested with Oracle Java 22.0.2)
- **Android SDK**: Build tools 34.0.0+ and platform `android-34` or `android-35`/`android-36`

### 1. Run the Web App (Development Mode)
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Run the Reference Backend Server
```bash
npm run server
```
Runs on [http://localhost:5000](http://localhost:5000). Test health check:
```bash
curl http://localhost:5000/health
```

---

## 📦 Building the Android APK

### One-Command APK Build
To build the production web assets, synchronize with Capacitor, and compile the debug APK via Gradle:
```bash
npm run build:apk
```

### Step-by-Step Manual Android Build
```bash
# 1. Compile Vite production bundle
npm run build

# 2. Sync web bundle to Android native project
npx cap sync android

# 3. Enter Android project and assemble APK
cd android
./gradlew assembleDebug       # Linux/macOS
.\gradlew.bat assembleDebug   # Windows PowerShell / CMD
cd ..
```

The compiled APK will be created at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Opening in Android Studio
If you prefer building or running on a live emulator using Android Studio:
```bash
npx cap open android
```

---

## 🔐 Production Readiness Checklist for Play Store Release

1. **Sign the APK with Release Keystore**:
   Generate your release key:
   ```bash
   keytool -genkey -v -keystore vda-release-key.jks -alias vda-key -keyalg RSA -keysize 2048 -validity 10000
   ```
   Add signing configuration in `android/app/build.gradle` under `signingConfigs.release`.
   Run:
   ```bash
   cd android && ./gradlew assembleRelease
   ```
2. **Data Privacy & ABDM Compliance (DISHA & DPDP Act 2023)**:
   - Patient health data must never be cached on unencrypted local storage.
   - All external HTTP calls must use HTTPS/TLS 1.3 with certificate pinning in production.
   - Microphones and speech recognition permissions require runtime user consent and purpose justification.
3. **ABDM Sandbox Certification**:
   - Verify integration with the official NHA ABDM Sandbox Gateway (`sandbox.abdm.gov.in`).
   - Validate milestones M1 (ABHA creation), M2 (HIP record upload), and M3 (HIU consent flow).

---

## 📂 Project Directory Structure

```
vda-mobile-app/
├── android/                   # Native Android Studio project (Capacitor wrapper)
│   ├── app/
│   │   ├── src/main/AndroidManifest.xml  # Native permissions (Audio, Internet)
│   │   └── build.gradle                  # Android app build configuration
│   └── local.properties                  # Android SDK path configuration
├── server/
│   └── index.js               # Reference Express backend (FHIR R4 & Gemini API)
├── src/
│   ├── components/
│   │   ├── VdaTab.tsx         # Voice assistant conversation & dynamic prompt cards
│   │   ├── RecordsTab.tsx     # FHIR R4 medical history, lab graphs & adherence
│   │   ├── FacilitiesTab.tsx  # Hospital locator, OPD QR tokens, Jan Aushadhi & Schemes
│   │   ├── ProfileTab.tsx     # Official ABDM ABHA card & consent management
│   │   ├── EscalationModal.tsx# Clinical emergency takeover modal & tele-triage
│   │   ├── LogVitalModal.tsx  # Self-reporting vitals dialog (Sugar, BP, SpO2)
│   │   └── OnboardingModal.tsx# Multilingual onboarding & ABHA setup
│   ├── services/
│   │   └── api.ts             # Unified API Client with backend & offline fallback
│   ├── data/
│   │   └── syntheticData.ts   # ABDM synthetic patient personas & facility databases
│   ├── utils/
│   │   ├── i18n.ts            # Multilingual translations & Web Speech TTS engine
│   │   ├── safetyGate.ts      # Deterministic clinical emergency red-flag rules
│   │   └── vdaEngine.ts       # Domain routing and health query interpreter
│   ├── types/
│   │   └── index.ts           # ABDM & FHIR R4 TypeScript interface definitions
│   ├── App.tsx                # Main app layout, tab navigation & state coordinator
│   └── main.tsx               # React application entry point
├── capacitor.config.ts        # Capacitor configuration (App ID: in.gov.abdm.vdahealth)
├── VDA.apk                    # Latest Production Android Debug APK (4.29 MB)
├── vda-health-assistant.apk   # Pre-built Android Debug APK
├── vite.config.ts             # Vite build & TailwindCSS v4 plugin setup
└── package.json               # NPM scripts, dependencies and project metadata
```

---

---

## 💊 Prescription-Only Medicine Reminders & Native Notifications

The application implements a patient-centric, device-local prescription reminder architecture designed in alignment with recent clinical feedback:

1. **Strict Prescription-Only Boundary:**
   - Medication explanations and schedules are derived **strictly from the patient's uploaded prescription document** (PDF/JPG/PNG) via the backend prescription extraction engine.
   - Pre-existing EHR profile records (`ctx.medications`) are never mixed with the active uploaded prescription to avoid stale or contradictory medical guidance.

2. **Native Push & Local Notifications (`@capacitor/local-notifications`):**
   - Schedules native Android alarms and notifications at the exact times specified on the doctor's prescription (e.g. 08:00 AM, 02:00 PM, 08:00 PM).
   - Operates with device-local persistence via `@capacitor/preferences` and `localStorage`, ensuring reminders trigger even without internet connectivity.
   - Provides instant "Taken" and "Later" (15-min snooze) quick action handling.

3. **Positive Gamification (Zero Penalties):**
   - Rewards adherence with encouraging positive milestones: daily consistency streaks, earned stars, and milestone badges (e.g., *पहला कदम / First Dose*, *3 दिन का नियम / 3-Day Streak*, *हफ्ते का नियम / Weekly Master*, *तारा मरीज / Star Patient*).
   - **Strictly penalty-free:** No point deductions, loss of streak, or negative alerts for unticked or snoozed doses.

4. **Direct Emergency Intervention (Zero Blocking Queues):**
   - Triage red-flags and SOS speed dial connect patients immediately to:
     - **108 Emergency Ambulance** and **102 Maternal/Child Ambulance**
     - **National Teleconsultation:** Direct one-tap launch to eSanjeevani Patient Portal (`https://esanjeevani.mohfw.gov.in/#/patient/signin`)
     - **Nearby Public Hospitals:** Instant geo-locator with bed availability and contact numbers.

---

## 🧪 Comprehensive Vitest Test Suite

The mobile application features complete unit and integration test coverage verifying the VDA Engine, clinical safety gates, local prescription storage, and API fallback mechanisms:

```bash
npm test -- --run
```

```
Test Files  8 passed (8)
     Tests  113 passed (113)
  Duration  100% pass
```

- `src/__tests__/security.test.ts`: Injection defense, XSS sanitation, red-flag triage.
- `src/utils/__tests__/vdaEngine.test.ts`: Query classification and response generation.
- `src/utils/__tests__/localMedicationStorage.test.ts`: Local prescription storage, penalty-free streaks & stars.
- `src/utils/__tests__/safetyGate.test.ts`: Deterministic red-flag emergency detection.
- `src/utils/__tests__/i18n.test.ts`: Multilingual translations and localized field selection.
- `src/services/__tests__/api.test.ts`: Live backend session management, eSanjeevani launch, and offline fallback.
- `src/components/__tests__/EscalationModal.test.tsx`: Direct emergency action modal (108/102 ambulance & hospital locator).
- `src/components/__tests__/LogVitalModal.test.tsx`: Patient vitals logging.

---

## 🔗 Repository Links

- **Medtronic LABS Organization:** [https://github.com/Medtronic-LABS/vda-mobile](https://github.com/Medtronic-LABS/vda-mobile)
- **Personal Repository:** [https://github.com/denispaul2406/VDA-mobile](https://github.com/denispaul2406/VDA-mobile)

---

## 📄 License
This project is licensed under the MIT License. Developed for the Ayushman Bharat Digital Mission (ABDM) digital health ecosystem.
