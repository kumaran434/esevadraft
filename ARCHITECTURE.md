# 🏛️ eSevaDraft — Production Architecture Blueprint (முழுமையான உற்பத்தி கட்டமைப்பு)

## 🌟 வழிகாட்டும் கொள்கை (Guiding Philosophy)
> **"எளிமை, வேகம், குழப்பமின்மை & பூஜ்ஜியப் பிழை" (Simplicity, Speed, Zero-Confusion & Zero-Regression)**
> மென்பொருள் கட்டமைப்பு என்பது ஆயிரக்கணக்கான வரிகள் கொண்ட மலையும் அல்ல, அர்த்தமில்லாத 34 சில்லறைகளும் அல்ல.
> ஒவ்வொரு பொறுப்பும் ஒரு தெளிவான, பெயர் கொண்ட **செயல்பாட்டு மாடியூலாக (Cohesive Domain Module)** மட்டுமே இயங்கும்!

---

## 🏗️ 5-அடுக்கு முழுமையான கட்டமைப்பு (5-Tier Full-Stack Architecture)

```mermaid
graph TD
    subgraph Layer 1: Client Experience (Frontend)
        HTML[public/index.html]
        CSS[public/css/*.css]
        MODS[public/js/modules/ - 10 Domain Modules]
    end

    subgraph Layer 2: Desktop Local Engine (Electron & OTA)
        LSERVER[desktop/local_server.js - Port 3000]
        OTASYNC[desktop/asset_sync_service.js - Silent Updater]
        WINMGR[desktop/window_manager.js - Anti-Tamper Shield]
    end

    subgraph Layer 3: API & Cloud Orchestration
        SERVER[server.js - Express Orchestrator]
        ROUTES[src/routes/*.js - Modular REST API]
        CLOUD[Cloud AI OCR & Firestore Sync]
    end

    subgraph Layer 4: Portal Automation Pipeline
        CORE[src/core/portal_automation_standard.js]
        TNPDS[src/portal/tnpds/flows/*.js]
        TNEGA[src/portal/tnega/*.js]
        IMMUNE[data/automation_immune_memory.json - 38 Rules]
    end

    subgraph Layer 5: Quality Gate & Security
        TESTS[tests/regression_suite.js - 591 Checks]
        BYTECODE[V8 Machine Bytecode - main.jsc / preload.jsc]
    end

    HTML --> LSERVER
    MODS --> LSERVER
    LSERVER --> SERVER
    LSERVER --> CLOUD
    OTASYNC --> CLOUD
    SERVER --> ROUTES
    ROUTES --> CORE
    CORE --> TNPDS
    CORE --> TNEGA
    TNPDS --> IMMUNE
    TESTS --> LSERVER
    TESTS --> TNPDS
```

---

## 📂 பிரண்ட்-எண்ட் மாடியூல் வரைபடம் (Frontend Modules Map)

| மாடியூல் | கோப்புப் பாதை | பொறுப்பு (Single Responsibility) |
| :--- | :--- | :--- |
| **Auth & Session** | `public/js/modules/auth_session.js` | உள்நுழைவு, சைன்-அப், அமர்வு சரிபார்ப்பு, கடவுச்சொல், ரோல் சுவிட்சிங். |
| **Operator Drafts** | `public/js/modules/operator_drafts.js` | வரைவுகள் (Drafts) பட்டியல், தேடல், வடிகட்டிகள், ட்ராஷ், நிரந்தர நீக்கம். |
| **Operator Intake** | `public/js/modules/operator_intake.js` | Walk-in வாடிக்கையாளர் சேர்க்கை, நேரடி சேவை குறுக்குவழிகள். |
| **Citizen View** | `public/js/modules/citizen_view.js` | பொதுமக்கள் மொபைல் பார்வை, கீழ் டேப்கள் (Services, Apply, Docs, Profile). |
| **Chat Workflow** | `public/js/modules/chat_workflow.js` | வாடிக்கையாளர் உரையாடல் (Chat FSM), அரசு வினாக்கள், விருப்ப சிப்கள். |
| **Submission Engine** | `public/js/modules/submission_engine.js` | விண்ணப்ப உறுதிப்படுத்தல், ஆவண அப்லோட், படிவ நிலை மேலாண்மை. |
| **Document Viewer** | `public/js/modules/document_viewer.js` | ஆவணங்கள் முன்னோட்டம், பட பெரிதாக்கம் (Zoom), HITL ஆய்வு சாளரம். |
| **Automation HUD** | `public/js/modules/automation_hud.js` | நேரலை அரசு போர்ட்டல் முன்னேற்றப் பட்டை, நிகழ்நேர லாக் குறிப்புகள். |
| **TNeGA & Forms** | `public/js/modules/tnega_and_forms.js` | TNeGA CAN எண் தேடல் மற்றும் பதிவு, அரசு PDF ரசீது டவுன்லோட். |
| **Edit Modal** | `public/js/modules/edit_modal_manager.js` | விவரங்கள் திருத்தும் சாளரம், உடனடி டோஸ்ட் அறிவிப்புகள். |

---

## 🔄 டெஸ்க்டாப் லோக்கல் UI & தானியங்கி OTA அப்டேட் கொள்கை

1. **உடனடி திறப்பு (<100ms)**:
   - டெஸ்க்டாப் ஆப் திறக்கும் போது இணையத்தில் இருந்து லோட் செய்யாமல், உள்ளூர் ஹார்ட் டிரைவில் இருந்து (`127.0.0.1:3000`) கோப்புகளை உடனடியாகத் தருகிறது.
2. **பின்னணி OTA ஒத்திசைவு (Silent Background Sync)**:
   - ஆப் இயங்கியதும் `https://esevadraft.in/api/desktop/asset_manifest` மூலம் புதிய மாற்றங்களைச் சரிபார்த்து, புதிய ஃபைல்களை மட்டும் பின்னணியில் பதிவிறக்கம் செய்து லோக்கல் ஃபோல்டரில் மாற்றிவிடுகிறது.
   - தமிழகத்தில் உள்ள ஆப்ரேட்டர்கள் மீண்டும் `.exe` டவுன்லோட் செய்ய வேண்டிய அவசியமே இல்லை!

---

## 🛡️ ஜீரோ-ரெக்ரஷன் தர உத்தரவாதம் (Zero-Regression Quality Gate)

* **`npm.cmd test`**: 591 சோதனைகளும் (Immune Guard + Feature Locks + OTA Engine) 100% தேறினால் மட்டுமே ஆப்ரேட்டர் பயன்பாட்டிற்கு செல்லும்.
* **`npm run sync:desktop`**: சோதனைகள் முடிந்ததும், லோக்கல் கோப்புகள் அனைத்தும் வினாடியில் டெஸ்க்டாப் ஆப்பின் நேரடி கோப்புகளில் (`app.asar`, `resources/`, `AppData/Roaming`) அப்ளை செய்யப்படும்.
