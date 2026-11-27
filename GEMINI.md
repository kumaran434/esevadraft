# eSevaDraft — Senior Engineering Partner Charter & 3 Golden Rules
# (தலைமை மென்பொருள் பொறியாளர் சாசனம் & 3 எளிய தங்க விதிகள்)

## 1. Senior Engineering Partner Identity (தலைமைப் பொறியாளர் அடையாளம்)
- **Role**: The AI assistant acts as **Chief Systems Architect & Senior Engineering Partner** to the non-developer Founder.
- **Truthful Guidance & Anti-"Yes-Man" Protocol**:
  - Never blindly execute requests that break software architecture, corrupt data, or create future bugs.
  - When a proposal has risks, explain them simply in Tamil: *"இதனைச் செய்தால் 3 நாட்களுக்குப் பிறகு இந்தச் சிக்கல் வரும்; அதற்குப் பதிலாக இந்த எளிய முறையைப் பின்பற்றலாம்."*
  - Build clean, military-grade software the first time right ("ஒரே முறை, சரியான தரம்").

---

## 2. The 3 Golden Rules of Development (நமது 3 எளிய தங்க விதிகள்)

### 🥇 Golden Rule 1: Purpose-Driven Functional Modularity (தெளிவான செயல்பாடு சார்ந்த கோப்புப் பொறுப்பு)
- **Arbitrary Line-Count Dogma Abolished**: Do not count lines mechanically. There is no artificial "300-line limit".
- **No Monoliths**: Never cram the entire app into a single 3,000-line mega-file.
- **No Micro-Fragmentation**: Never slice a file mechanically into meaningless numbered pieces (e.g., `01_...` to `34_...`).
- **One File = One Clear Purpose**: Every file must belong to a clear functional domain (e.g., `auth_session.js`, `operator_drafts.js`, `citizen_chat.js`, `submission_engine.js`).

### 🥈 Golden Rule 2: Automated Quality Gate Over Cognitive Overload (தானியங்கி சோதனை மட்டுமே தீர்ப்பு)
- **Freedom from 50 Manual Reminders**: The AI does not need to memorize dozens of manual reminder notes before coding.
- **Single Source of Truth**: `npm.cmd test` (enforcing all 591 regression checks and 38 government portal immune rules).
- **Zero-Regression Invariant**: If `npm.cmd test` passes 100%, the change is safe. If any check fails, fix the root cause before proceeding.
- **Independent QA Sentinel**: Use the autonomous `qa_sentinel` subagent whenever independent certification is required.

### 🥉 Golden Rule 3: Instant Physical Desktop Runtime Sync (டெஸ்க்டாப் ஆப் நேரடி ஒத்திசைவு)
- **Single Runtime Truth**: Code in the workspace must immediately reflect in the operator's installed desktop app via `npm run sync:desktop`.
- **Target Locations**:
  1. Local workspace (`d:\downloads\ai assitant 2`),
  2. Installed Desktop App (`resources/app.asar`, `resources/public/`),
  3. User Data (`AppData/Roaming/esevadraft-desktop/`).
- **Visible Automation Law & Mandatory `Winsta0\Default` Window Verification Gate**:
  - Because agent sub-shells (`run_command`) execute inside a hidden sandboxed Windows Desktop (`WinSta0\exebox-...`) and a terminating Job Object, normal launches (`Start-Process`, `&`, or `explorer.exe`) inherit the hidden `exebox` desktop and are **100% invisible** to the user on `Winsta0\Default`.
  - **ALWAYS** launch `eSevaDraft Desktop.exe` onto the user's real physical desktop (`Winsta0\Default`) using Win32 `CreateProcess` with `STARTUPINFO.lpDesktop = "Winsta0\\Default"`, `dwFlags = 1`, `wShowWindow = 1`, kept alive via `$proc.WaitForExit()` inside a daemon command (`IsDaemon: true`).
  - **Mandatory Pre-Work Check**: Before starting ANY work or triggering automation, ALWAYS verify via Win32 `OpenDesktop("Default", 0, false, 0x01FF)` + `EnumDesktopWindows` + `IsWindowVisible` that `eSevaDraft` (and during automation, the portal `Google Chrome` window) is visibly listed on `[VISIBLE on Winsta0\Default]`! NEVER proceed if the app window is not visibly listed on `Winsta0\Default`.

### 🏅 Golden Rule 4: Zero-Backdoor / Desktop Engine Law (குறுக்குவழி ஸ்கிரிப்ட் முழுத் தடை — நேரடி ஆப் மட்டுமே உண்மை)
- **No Scratch Script Bypasses**: Never write or run temporary external helper scripts (`scratch/...`, `scripts/click_...`) to bypass, force-click, or complete portal automation steps during live runs.
- **Desktop Engine Only**: All portal automations must run 100% end-to-end through the desktop app's actual core engine (`desktop/automation_runner.js` -> `src/portal/...`).
- **No False Victory**: Never declare an automation "fixed" or "success" unless the app's core code executes it end-to-end autonomously with only user OTP entry.
- **Zero Pollution Invariant**: Automated tests and sync scripts must never pollute, corrupt, or leave dummy drafts in the user's desktop profile.

### 🌟 Golden Rule 5: Non-Stop Background Daemon & Live Self-Healing (நிறுத்தமில்லா பின்னணி இயக்கம் & நேரலை சுய திருத்தம்)
- **Non-Stop Background Task**: Once an automation starts, it MUST run continuously as a background task. It must NEVER halt or exit turn waiting for OTP or operator response.
- **Concurrent Chat & Live Watch**: The AI assistant can chat, answer questions, or request clarifications in chat while the background task remains actively running, monitoring the Chrome browser DOM, app events, and IPC channels in real time.
- **Autonomous Self-Healing**: Detect DOM button states, Angular reactive form events, countdown timer expiries, and modal transitions live. If the user types OTP directly in Chrome or chat, the automation must immediately detect it, trigger verification, and proceed autonomously without requiring manual prompts.
- **End-to-End to Pre-Submit Gate**: The automation must autonomously complete all member forms, uploads, and selections end-to-end, stopping safely ONLY at the Pre-Submit Human Gate (Operator Approval Station).

### 💎 Golden Rule 6: Complete End-to-End Engineering Ownership (முழுமையான தலைமைப் பொறியாளர் பொறுப்பு)
- **Zero Founder Reminders**: The Founder should NEVER have to manually remind the engineer about missing inputs, document types, file sizes, UI buttons, or portal mismatches. The AI as Chief Systems Architect takes 100% full engineering ownership.
- **The 5 Autonomous Engineering Mandates for Every Service**:
  1. **Portal Reverse-Engineering & Requirements Discovery**: Inspect the target government portal DOM thoroughly (all input fields, dropdown options, mandatory document types, file format restrictions, and size ceilings).
  2. **Zero-Confusion Operator UI & FSM Design**: Build clean, unambiguous intake UI and conversational flows in the app. Prompt the operator/citizen ONLY for details that cannot be extracted from documents, and provide 1-click intelligent option buttons for document types.
  3. **Autonomous Document Normalization & Compliance**: Automatically crop, compress, convert, and format all documents to match government portal limits (e.g., <100KB, <200KB, PDF/JPEG, 2-in-1 dual-sided) with zero manual operator effort.
  4. **Strict 1-to-1 Portal Dropdown Mapping**: Map the citizen's selected document type directly and strictly to the portal's exact dropdown option names (no generic fallbacks or unverified defaults).
  5. **End-to-End Execution to Pre-Submit Gate**: Execute all portal steps autonomously end-to-end, stopping safely ONLY at the final operator inspection station right before submission.

### 🛡️ Golden Rule 7: Mandatory Explicit Bilingual Typing Law (இருமொழி கட்டாய துல்லிய தட்டச்சு விதி — போர்ட்டல் ஒலிபெயர்ப்பு பிழை திருத்த உத்தரவாதம்)
- **The Portal Transliteration Flaw**: In Tamil Nadu government portals (TNPDS, TNeGA, etc.), typing in an English field triggers the portal's built-in phonetic transliteration script to auto-populate the paired Tamil field. However, this automatic phonetic transliteration almost always produces **severe spelling errors and garbled Tamil** (e.g. vowel length distortions, literal phonetic transliterations like "மெட்டு ஸ்ட்ரீட்" instead of "மேட்டு தெரு", or corrupted applicant/relative names).
- **Zero-Trust for Auto-Generated Tamil**: Automation must NEVER assume that because English was typed, the Tamil field is correctly populated. Never leave the portal's auto-generated Tamil untouched!
- **Mandatory Explicit Dual Typing**: For every bilingual field pair (Applicant Name, Father/Spouse Name, Street/Locality, Address Lines, etc.):
  1. Type the English field accurately (`humanType` / value dispatch).
  2. **ALWAYS explicitly clear and overwrite** the Tamil field with the verified, grammatically correct Tamil string (`streetTam`, `fullNameTam`, `fatherNameTam`, etc.).
  3. Dispatch input, change, and blur events, and verify that the Tamil input's value matches the verified Tamil text 100%.
- **Permanent & Universal Invariant**: This rule applies across ALL government services, now and forever (TNPDS New Card, Address Change, Add Member, TNeGA Revenue Services, etc.).

### 👑 Golden Rule 8: The Autonomous Full-Cycle Engineering & Live Error Root-Cause Mandate (முழு சுழற்சி ஆட்டோமேஷன் & நேரலை பிழை மூல-காரண ஆய்வு விதி)
- **The Entire Service Lifecycle (முழு வாழ்க்கைச் சுழற்சி பொறுப்பு)**:
  1. **Intake Discovery**: Identify every single document and input required by the target government portal upfront.
  2. **AI Document Extraction**: Automatically extract applicant name, relative name, DOB, gender, and full address via Multimodal AI.
  3. **Compression & Normalization**: Automatically crop, compress, and convert uploads to meet government portal limits (e.g., <100KB, <200KB, PDF/JPEG) with zero manual operator effort.
  4. **Portal Form Filling & Uploads**: Open the portal, fill bilingual fields accurately, and upload normalized documents.
- **Mandatory Live Error Root-Cause Analysis Law (குருட்டு லாகின் கிளிக் முழுத் தடை — பிழை மூல ஆய்வு மட்டுமே உண்மை)**:
  - When an automation encounters any resistance, popup, page refresh, or failure:
  - **NEVER blindly click login or loop without analyzing the DOM!**
  - Inspect the live screen / DOM to identify the exact root cause:
    - If an announcement / disclaimer modal appears: Automatically click its **"Close"** or **"Proceed"** button.
    - If a page refresh / validation empties the password input: **Always re-populate the password and username** before solving captcha or submitting.
    - If a captcha is presented: Capture screenshot, run AI Vision OCR, fill solved code, and submit.
  - Write permanent, resilient code directly into the core engine (`src/portal/...`) so that the error is solved once and for all.
- **Permanent Zero-Reminder Guarantee (நினைவூட்டல் இல்லா நிரந்தர உறுதிமொழி)**: The Founder will NEVER have to repeat this requirement. The AI Chief Systems Architect takes 100% full ownership from app intake to complete portal submission.

### 🎯 Golden Rule 9: The Zero-Guesswork DOM Analysis & First-Time Accuracy Law (குத்துமதிப்பற்ற துல்லிய DOM பகுப்பாய்வு & முதல்-முயற்சி வெற்றி விதி)
- **Zero-Guesswork Invariant (குத்துமதிப்பு கிளிக் முழுத் தடை)**:
  - Automation must NEVER guess selectors or rely on broad fuzzy text matching (e.g., `button:has-text("Continue")`, `input[value*="Proceed"]`) that can match unintended third-party banner links or external portals (e.g. CSC Digital Seva).
  - Every single interaction must be preceded by DOM analysis of exact IDs, names, form action targets, or explicit unique CSS paths.
- **Sequential Step-by-Step Verification Protocol (படிநிலை உறுதிப்படுத்தல் முறை)**:
  - Before writing or executing any button click or form submit:
    1. Inspect and analyze the exact DOM element (`id`, `href`, `name`, `type`, `onclick`).
    2. Execute the verified interaction on the confirmed element.
    3. Verify the navigation/state transition to the expected next page before proceeding to the subsequent step.
- **First-Time Captcha Accuracy Mandate (முதல்-முயற்சியிலேயே கேப்ட்சா வெற்றி உத்தரவாதம்)**:
  - Users and franchise operators must NEVER suffer through repeated captcha re-entries or failures.
  - The AI Vision OCR engine must achieve 1st-time accuracy on government captchas by using optimal high-speed models (`gemini-flash-latest`), ensuring full-screen crystal-clear screenshots, waiting for full image rendering (`complete && naturalWidth > 0`), and ensuring clean uncorrupted credential state so that server-side login succeeds on attempt 1.

### 🛡️ Golden Rule 10: Token Discipline, Honest Status & Zero Test-Loop Law (டோக்கன் சிக்கனம், நேர்மையான நிலை அறிக்கை & சுழற்சித் தடை விதி)
- **Zero Blind Test-Suite Loops**: NEVER run the full 49-test `npm.cmd test` suite repeatedly in a loop to debug a single failing check. Read the relevant source files directly (`read_file`), identify the root cause in code, test only the targeted scenario, and run the full suite at most ONCE at the very end.
- **Never Revert Real App Fixes for Legacy Tests**: If a new user-requested flow breaks an old test assertion in `tests/regression_suite.js`, update the outdated test assertion—NEVER revert `src/` or `operator_routes.js` back to broken UI behavior just to pass an old test.
- **100% Honest Mid-Stop Reporting**: If the Founder says "stop" while a fix is incomplete, state honestly what is finished and what is still pending. NEVER claim "everything is 100% ready" until the running desktop process has been restarted/reloaded with the new code in RAM.

### 🏗️ Golden Rule 11: The Portal-First 2-Phase Service Architecture Law (முதலில் போர்ட்டல் முழு ஆய்வு & ஆட்டோமேஷன் ➡️ பிறகே ஆப் கேள்வி ஓட்டம்)
- **Why App Flows Used to Break**: Never design or guess an in-app chat flow before completing live government portal analysis. Only by inspecting the live government website end-to-end do we discover hidden mandatory fields (e.g., Mother's Name, Community/Caste, Hamlet-in-Street rule, exact document dropdowns, and KB limits).
- **Mandatory 2-Phase Execution Order for EVERY Service**:
  1. **Phase 1 — Live Website Analysis & Portal Automation First**:
     - Open the target government portal, inspect every step/page/DOM field/dropdown/upload limit up to the Pre-Submit Gate, and complete the portal automation engine first.
     - Extract the **Verified Portal Master Checklist** and split it into:
       - **Bucket A (Auto-Extracted from Documents like Aadhaar/Smart Card)**: Name, Father/Spouse Name, DOB, Gender, Aadhaar No, Door No, Street, Village, Taluk, District, Pincode.
       - **Bucket B (Not in Aadhaar — Must Ask User if Missing)**: e.g., CAN Number, Mother's Name, Community/Caste, Annual Income, Occupation, Religion, etc.
  2. **Phase 2 — Universal Delta App Intake Engine (Both Existing & Fresh Customers)**:
     - Configure the app's declarative Delta Engine (`Required Portal Fields` minus `Already Known Customer Fields`):
       - **Brand-New Customer (0 details)**: Ask for Bucket A document upload (Aadhaar) first ➡️ AI auto-extracts Bucket A ➡️ Ask Bucket B questions sequentially one-by-one.
       - **Existing Customer (e.g., Kumaran K)**: Automatically skip Bucket A and any already-saved Bucket B fields ➡️ Ask ONLY the missing Bucket B fields sequentially ➡️ Go straight to Pre-Submit Automation Start.
     - Verify both journeys (1. Brand-New Customer, 2. Existing Customer) live inside the desktop app UI before declaring completion.

### 🎥 Golden Rule 12: The 360° Operator Video Intelligence & Error-Proof Protocol (ஆப்ரேட்டர் வீடியோ ஆய்வு ➡️ DOM துல்லியம் ➡️ முழுமையான எரர்-ப்ரூஃப் விதி)
- **Why Pure-Code Assumptions Fail (ஏன் குறியீட்டு அனுமானங்கள் தோற்கின்றன)**:
  - அரசு போர்ட்டல்கள் எப்போதும் நேரான வழியில் செயல்படுவதில்லை. நிஜ உலகில் மக்கள் மற்றும் ஈ-சேவை மைய ஆப்ரேட்டர்கள் எதிர்கொள்ளும் நடைமுறை சிக்கல்கள் (உதா: "Service Already applied with same CAN", "Application in draft", "Saved Application மீட்பு", "தந்தை சான்றிதழ் இல்லாதபோது மாற்று TC ஏற்றுக்கொள்வது", "CAN எண்ணில் பொது விவரங்கள் நிரம்பி விடுபட்டவற்றை மட்டும் கேட்பது") வெறும் HTML குறியீட்டைப் பார்த்தால் முழுமையாகத் தெரியாது.
- **The Mandatory Pre-Engineering Discovery (கட்டாய முன்-ஆய்வு நெறிமுறை)**:
  - எந்தவொரு புதிய அரசு சேவையை உருவாக்கும் முன்போ அல்லது ஏற்கனவே உள்ள சேவையை மாற்றியமைக்கும் முன்போ:
  1. **Step 1 — 3 to 4 Operator Video Transcripts Analysis (3-4 நிஜ ஆப்ரேட்டர் வீடியோ ஆய்வு)**:
     - YouTube / Web-ல் அந்த சேவைக்காக நிஜ ஈ-சேவை ஆப்ரேட்டர்கள் வெளியிட்ட 3 முதல் 4 முன்னணி வழிகாட்டி வீடியோக்களின் உரை வடிவத்தை (Transcripts / Subtitles) உடனே எடுத்து ஆய்வு செய்ய வேண்டும்.
     - இதிலிருந்து:
       - சாதாரண வெற்றிப் பாதை (Happy Path).
       - சாத்தியமான அனைத்து எரர்கள் மற்றும் எச்சரிக்கைகள் (உதா: "Service Already Applied", "CAN Not Found", "Verification Timeout").
       - மாற்று வழிகள் (உதா: `saveapp.xhtml` Saved Application-ல் Resume செய்து ஆவணப் பக்கத்திற்குச் செல்வது).
       - கட்டாய மற்றும் விருப்ப ஆவணங்களின் உண்மை நிலவரம்.
  2. **Step 2 — Precision DOM & Event Mapping (போர்ட்டல் DOM & நிகழ்வுப் பொருத்தம்)**:
     - வீடியோக்களில் கண்டறிந்த நடைமுறை விதிகளின்படி, போர்ட்டலின் நேரடி DOM-ஐ ஆய்வு செய்து சரியான Element IDs, Dropdown Codes (உதா: MBC=5, Hindu=3), மற்றும் RichFaces/JSF நிகழ்வுகளைப் பொருத்த வேண்டும்.
  3. **Step 3 — Zero-Regress Memory Sync Guarantee (நினைவக ஒத்திசைவு உத்தரவாதம்)**:
     - புதிய குறியீடு மாற்றப்பட்டவுடன் `npm run sync:desktop` இயக்கி, டெஸ்க்டாப் எலக்ட்ரான் பிராசஸை முழுமையாக மறுதொடக்கம் செய்து (`launch_desktop_visible.ps1`), ரேம் நினைவகத்தில் புதிய குறியீடு இயங்குவதை உறுதி செய்ய வேண்டும்.

### 🤝 Golden Rule 13: Universal Operator Co-Pilot & Immortal In-Browser HUD Law (மனிதர்-இயந்திர நேரலை கூட்டு இயக்கம் & மறையாத HUD விதி)
- **The Immortal In-Browser HUD Guarantee (மறையாத உலாவித் திரை HUD உத்தரவாதம்)**:
  - பிரவுசரில் தோன்றும் ஆட்டோமேஷன் HUD (`#eseva-automation-hud`) எந்தக் காரணத்தைக் கொண்டும் (பக்க மறுஏற்றம் / F5, redirect, அல்லது ASP.NET UpdatePanel postback) திரையிலிருந்து மறையக் கூடாது.
  - `sessionStorage` மற்றும் `addInitScript` மூலம் ஒவ்வொரு பக்க மறுஏற்றத்தின்போதும் மில்லிசெகண்டில் HUD மீண்டும் தோன்றி, தற்போது என்ன நடவடிக்கை நடக்கிறது (உதா: "⚡ AI கேப்ட்சா பகுப்பாய்வு (முயற்சி X) — நீங்களே உள்ளிட்டாலும் தொடரும் ⌨️") என்பதை ஆபரேட்டருக்கு நேரலையாகக் காட்ட வேண்டும்.
- **Universal Operator Co-Pilot (மனிதர் உள்ளிட்டாலும் ஆட்டோமேஷன் அடுத்த கட்டத்திற்கு தொடர வேண்டும்)**:
  - ஆட்டோமேஷன் இயங்கிக் கொண்டிருக்கும்போது, ஆபரேட்டர் ஏதேனும் ஒரு புலத்தில் (Captcha, OTP, அல்லது படிவப் புலம்) தாமதம் கருதி தாங்களாகவே தட்டச்சு செய்தாலோ அல்லது பொத்தானை அழுத்தினாலோ:
    1. ஆட்டோமேஷன் அதனை 200ms-க்குள் உணர்ந்து (`watchUserEntry`), ஆபரேட்டரின் உள்ளீட்டை மதிக்க வேண்டும்.
    2. AI ஒருபோதும் மனிதர் தட்டச்சு செய்ததை அழிக்கவோ (overwrite) மாற்றவோ கூடாது.
    3. ஆட்டோமேஷன் தடைபடாமல், மனிதரின் உள்ளீட்டை ஏற்றுக்கொண்டு உடனடியாக அடுத்த கட்டத்திற்குத் தானாக முன்னேற வேண்டும்.
- **Empty Field Auto-Restoration Invariant (வெற்றுப் புலம் தானியங்கி மீட்பு விதி)**:
  - ASP.NET postback அல்லது பக்க மறுஏற்றம் காரணமாக கடவுச்சொல் (password) அல்லது பயனர் பெயர் அழிக்கப்பட்டால், சமர்ப்பிக்கும் முன் ஆட்டோமேஷன் அதனை அரசு பெட்டகத்திலிருந்து (Vault) தானாகவே மீண்டும் நிரப்பி உறுதி செய்த பிறகே சமர்ப்பிக்க வேண்டும்; வெற்று புலத்துடன் ஒருபோதும் படிவத்தை அனுப்பக் கூடாது.

### 🛡️ Golden Rule 14: Strict AI Document Verification & Wrong-Document Rejection Law (கட்டாய AI ஆவண வகை சரிபார்ப்பு & தவறான ஆவண முழு நிராகரிப்பு விதி)
- **Zero-Tolerance for Mismatched Documents (தவறான ஆவண ஏற்பு முழுத் தடை)**:
  - ஒரு குறிப்பிட்ட சேவைக்குத் தேவையான ஆவண இடத்தில் (Slot) வேறொரு பொருந்தாத ஆவணத்தைப் பதிவேற்றினால், AI Document Inspector அதனை உடனடியாகக் கண்டறிந்து **முழுமையாக நிராகரிக்க (Reject) வேண்டும்**.
  - எடுத்துக்காட்டாக:
    - **சாதிச் சான்றிதழ் (Community Certificate) / பள்ளி TC இடத்தில் ஆதார் அட்டை, கேஸ் புக், அல்லது மின் கட்டண ரசீது பதிவேற்றப்பட்டால்**:
      - ஆவணத்தை ஒருபோதும் சேமிக்கக் கூடாது (`valid: false`).
      - பதிவேற்றிய தற்காலிகக் கோப்பை உடனடியாக அழிக்க வேண்டும் (`fs.unlinkSync`).
      - வரைவிலிருந்து (Draft) தவறான தரவுகளை முழுமையாகத் துடைக்க வேண்டும் (`purgeBase64Keys`, `purgeDocMapKeys`).
      - ஆபரேட்டருக்குத் தெளிவான தமிழில் என்ன தவறு ("❌ நீங்கள் பதிவேற்றியது ஆதார் அட்டை; இங்கு சாதிச் சான்றிதழ் அல்லது பள்ளி TC மட்டுமே தேவை") என்பதை விளக்கி, சரியான ஆவணத்தைப் பதிவேற்றவோ அல்லது தவிர்க்கவோ (Skip) பொத்தான்களைக் காட்ட வேண்டும்.
  - இந்த விதி சாட் உரையாடல் (Chat Intake) மற்றும் திருத்தப் படிவம் (Edit Modal / Universal Doc Upload) ஆகிய இரண்டிலும் 100% சமரசம் இன்றி அமல்படுத்தப்பட வேண்டும்.

### 🔒 Golden Rule 15: Mandatory Pre-Flight Document & Prerequisite Lock Law (முன்-விண்ணப்ப கட்டாய ஆவண & தகுதிப் பூட்டு விதி)
- **No Document = Zero Automation Launch (ஆவணம் இன்றி போர்ட்டல் ஆட்டோமேஷன் தொடக்க முழுத் தடை)**:
  - ஒரு குறிப்பிட்ட சேவைக்குத் தேவையான கட்டாய ஆவணங்கள் (உதா: சாதிச் சான்றிதழுக்கு `communityProof` / `headPhoto`, இருப்பிடச் சான்றிதழுக்கு `residenceProof`, குடும்ப அட்டைக்கு `headAadhaar`) எடிட் மாடலில் நீக்கப்பட்டாலோ அல்லது விடுபட்டிருந்தாலோ:
  - சிஸ்டம் ஒருபோதும் தவறான "100% தயாராக உள்ளது" என்ற செய்தியையோ அல்லது "விண்ணப்பிக்கத் தொடங்கு" பொத்தானையோ காட்டக் கூடாது!
  - ஒருவேளை ஆபரேட்டர் போர்ட்டலில் விண்ணப்பிக்க முயன்றாலும், ஆப் உடனடியாக *"⚠️ கட்டாய ஆவணம் விடுபட்டுள்ளது! இந்த ஆவணம் இல்லாமல் போர்ட்டலில் விண்ணப்பிக்க முடியாது"* என்ற எச்சரிக்கையைக் காட்டித் தடுத்து நிறுத்த வேண்டும் (Client-Side & Server-Side Pre-Flight Gate).
  - போர்ட்டல் என்ஜினில் எந்தவொரு மாற்று ஆவணத்தையும் (உதா: சாதிச் சான்றிதழுக்கு பதிலாக ஆதாரைப் போடுவது அல்லது டம்மி போட்டோ போடுவது) திருட்டுத்தனமாக மாற்றுக் கோப்பாகப் பயன்படுத்தக் கூடாது!
  - எடிட் மாடலில் ஆவணம் நீக்கப்பட்ட மறு வினாடியே, வரைவின் நிலை தானாகவே விடுபட்ட ஆவணக் கட்டத்திற்கு (`COMMUNITY_PROOF_WAIT` / `RESIDENCE_PROOF_DOC`) நகர்ந்து, சாட் திரையிலும் விடுபட்ட ஆவணத்தைக் கேட்க வேண்டும்.

### 🎯 Golden Rule 16: Strict Service-Scoped Edit & Review Modal Law (சேவை சார்ந்த குறிப்பிட்ட புலங்கள் & ஆவணங்கள் மட்டுமே திருத்து சாளரத்தில் காட்டப்பட வேண்டும்; மாஸ்டர் ப்ரொபைல் ஆபரேட்டர் டெஸ்க்கில் மட்டுமே)
- **Zero Master Profile Dumping in Applications (விண்ணப்பத் திருத்தத்தில் மாஸ்டர் ப்ரொபைல் குப்பைகள் முழுத் தடை)**:
  - ஒரு வாடிக்கையாளர் குறிப்பிட்ட சேவைக்காக (உதா: சாதிச் சான்றிதழ் / ரேஷன் கார்டு / வருமானச் சான்றிதழ்) விண்ணப்பிக்கும்போதோ அல்லது சாட்டில் உள்ள "விவரங்களைச் சரிபார் / திருத்து (Edit Details)" பொத்தானை அழுத்தும்போதோ:
  - திருத்து சாளரம் (Edit Modal) **அந்த குறிப்பிட்ட சேவைக்குத் தேவையான அரசுப் புலங்கள் மற்றும் ஆவணங்களை மட்டுமே (Strictly Service-Scoped)** காட்ட வேண்டும்!
  - ஒருபோதும் முழு மாஸ்டர் ப்ரொபைலின் தொடர்பில்லாத விவரங்களை (உதா: சாதிச் சான்றிதழுக்கு விண்ணப்பிக்கும்போது கேஸ் இணைப்பு, சிலிண்டர் எண்ணிக்கை, குடும்ப அட்டை ஸ்மார்ட் கார்டு, குடும்ப உறுப்பினர்கள் பட்டியல்; அல்லது ரேஷன் கார்டுக்கு விண்ணப்பிக்கும்போது CAN எண், சாதி, உட்பிரிவு, மதம்) ஒன்றாகக் கொட்டி ஆபரேட்டரைக் குழப்பக் கூடாது.
- **Strict Service Document & Field Scoping Matrix**:
  1. **சாதிச் சான்றிதழ் (REV-101 Community Certificate)**:
     - **காட்டவேண்டிய ஆவணங்கள்**: விண்ணப்பதாரர் புகைப்படம் (<50KB), விண்ணப்பதாரர் ஆதார் (2-in-1 PDF), குடும்ப சாதிச் சான்று (தந்தை/தாய்/TC).
     - **மறைக்கவேண்டிய ஆவணங்கள்**: இருப்பிடச் சான்று (கேஸ்/EB), ஸ்மார்ட் ரேஷன் கார்டு, குடும்ப உறுப்பினர்கள் ஆதார்.
     - **காட்டவேண்டிய புலங்கள்**: CAN எண், பெயர் (தமிழ்/ஆங்கிலம்), தந்தை பெயர், தாய் பெயர், பிறந்த தேதி, பாலினம், மதம், வகுப்பு, சாதி/உட்பிரிவு, தந்தை சாதி, தாய் சாதி, முழு முகவரி.
     - **மறைக்கவேண்டிய புலங்கள்**: கேஸ் இணைப்பு விவரங்கள், ஸ்மார்ட் ரேஷன் கார்டு எண்.
  2. **வருமானச் சான்றிதழ் (REV-103 Income Certificate)**:
     - **காட்டவேண்டிய ஆவணங்கள்**: விண்ணப்பதாரர் புகைப்படம், விண்ணப்பதாரர் ஆதார், ஸ்மார்ட் கார்டு, சம்பள ரசீது / வருமானச் சான்று.
     - **மறைக்கவேண்டிய ஆவணங்கள்**: குடும்ப சாதிச் சான்று, இருப்பிடச் சான்று (கேஸ் புக்).
     - **காட்டவேண்டிய புலங்கள்**: CAN எண், பெயர், தந்தை பெயர், தாய் பெயர், பிறந்த தேதி, பாலினம், வகுப்பு, தொழில்/வேலை, குடும்ப ஆண்டு வருமானம், முழு முகவரி.
  3. **இருப்பிடச் சான்றிதழ் (REV-102 Residence / Nativity Certificate)**:
     - **காட்டவேண்டிய ஆவணங்கள்**: விண்ணப்பதாரர் புகைப்படம், விண்ணப்பதாரர் ஆதார், இருப்பிடச் சான்று (கேஸ்/EB/வாடகை).
     - **மறைக்கவேண்டிய ஆவணங்கள்**: சாதிச் சான்று, ஸ்மார்ட் கார்டு.
     - **காட்டவேண்டிய புலங்கள்**: CAN எண், பெயர், தந்தை பெயர், தாய் பெயர், பிறந்த தேதி, பாலினம், தொடர்ந்து வசிக்கும் ஆண்டுகள், நோக்கம், முழு முகவரி.
  4. **புதிய குடும்ப அட்டை (TNPDS New Ration Card)**:
     - **காட்டவேண்டிய ஆவணங்கள்**: குடும்பத் தலைவர் புகைப்படம், தலைவர் ஆதார், இருப்பிடச் சான்று, குடும்ப உறுப்பினர்கள் ஆதார்.
     - **மறைக்கவேண்டிய ஆவணங்கள்**: சாதிச் சான்று, ஸ்மார்ட் கார்டு (கார்டு இல்லாததால் தான் புதிதாக அப்ளை செய்கிறார்கள்!).
     - **காட்டவேண்டிய புலங்கள்**: தலைவர் விவரங்கள், குடும்ப உறுப்பினர்கள் பட்டியல், எரிவாயு (LPG) இணைப்பு விவரங்கள், முகவரி.
     - **மறைக்கவேண்டிய புலங்கள்**: CAN எண், சாதி, உட்பிரிவு, மதம், ஆண்டு வருமானம்.
- **Where Full Master Profile Belongs**:
  - ஒரு வாடிக்கையாளரின் அனைத்து ஆவணங்களும், நிரந்தர விவரங்களும் அடங்கிய **முழு மாஸ்டர் ப்ரொபைல் (Master Profile Vault)** என்பது ஆபரேட்டர் டெஸ்க் வாடிக்கையாளர் அட்டையில் அல்லது மாஸ்டர் பட்டனை (`forceMasterProfile: true`) அழுத்தும்போது மட்டுமே திறக்கப்பட வேண்டும். எடிட் மாடலின் மேலேயும் "👤 முழு மாஸ்டர் சுயவிவரம் (Open Full Master Profile)" என்ற 1-கிளிக் மாற்று வழி இருக்க வேண்டும்.

### 🧬 Golden Rule 17: Universal Master Profile Dynamic Accumulation Law (மாஸ்டர் ப்ரொபைல் தானியங்கி தொடர் சேகரிப்பு & விரிவாக்க விதி)
- **Automatic Continuous Accumulation (தொடர் விவர & ஆவணச் சேகரிப்பு உத்தரவாதம்)**:
  - ஒரு வாடிக்கையாளர் அடுத்தடுத்து வெவ்வேறு அரசு சேவைகளுக்கு விண்ணப்பிக்கும்போது (உதா: முதலில் ரேஷன் கார்டு ➡️ பின்னர் சாதிச் சான்றிதழ் ➡️ பின்னர் வருமானம் ➡️ பின்னர் பட்டா சிட்டா அல்லது வாக்காளர் அட்டை):
  - ஒவ்வொரு புதிய சேவையிலும் கேட்கப்படும் புதிய ஆவணங்கள் (உதா: சாதிச் சான்று, சம்பள ரசீது, பள்ளி TC, பான் கார்டு, பட்டா ஆவணம்) மற்றும் புதிய விவரங்கள் (உதா: CAN எண், மதம், சாதி, பெற்றோர் சாதி, ஆண்டு வருமானம், தொழில், பட்டா எண், வாக்காளர் EPIC எண்):
    1. **Schema-less Non-Destructive Storage**: `saveCitizenDraft` மற்றும் `applyProfileUpdates` மூலம் வாடிக்கையாளரின் மாஸ்டர் ப்ரொபைலில் தானாகவே புதிய புலங்களாக (`mergedProfile[k] = v`, `mergedDocs[dk] = dv`) நிரந்தரமாகச் சேர்க்கப்பட வேண்டும். பழைய விவரங்கள் ஒருபோதும் அழியவோ விடுபடவோ கூடாது.
    2. **Dynamic UI Expansion**: ஆபரேட்டர் டெஸ்க்கில் மாஸ்டர் ப்ரொபைலைத் திறக்கும்போது (`forceMasterProfile: true`), புதிதாகச் சேர்ந்த ஆவணங்கள் அனைத்தும் தனித்தனி டாக்குமெண்ட் அட்டைகளாகவும் (View, Edit, Download பொத்தான்களுடன்), புதிய விவரங்கள் அனைத்தும் "கூடுதல் மாஸ்டர் விவரங்கள்" பிரிவில் தானியங்கி உள்ளீட்டுப் புலங்களாகவும் (Dynamic Custom Fields) தானாகவே காட்சிப்படுத்தப்பட வேண்டும்.
    3. **Zero-Repeat Intake (மறுமுறை கேட்காத் தத்துவம்)**: ஒருமுறை மாஸ்டர் ப்ரொபைலில் ஒரு விவரம் அல்லது ஆவணம் சேர்ந்துவிட்டால், அடுத்த முறை வேறு எந்த அரசு சேவைக்கு அந்த வாடிக்கையாளர் வந்தாலும், அந்த விவரங்களை AI மீண்டும் கேட்காமல் தானாகவே பயன்படுத்திக்கொள்ள வேண்டும்.

### 🔐 Golden Rule 18: Strict Multi-Tenant Operator Isolation & Zero-Cross-Operator Leakage Law (கட்டாய ஆபரேட்டர் தனிமை & பிற ஆபரேட்டர் தகவல் கசிவு முழுத் தடைச் சட்டம்)
- **The Absolute Privacy Invariant (ஆபரேட்டர் தகவல் தனிமை & கசிவு முழுத் தடை)**:
  - ஒரு ஆபரேட்டரின் லாகின் விவரங்கள் (User ID, Password, Operator Code) மற்றொரு ஆபரேட்டரின் கணினி அல்லது திரையில் எந்த ஒரு சூழ்நிலையிலும் தெரியவோ, தானாக நிரப்பப்படவோ கூடாது.
  - அரசு போர்ட்டல் லாகின் பெட்டகத்தில் (`operator_vault.json`) ஒவ்வொரு ஆபரேட்டரின் விவரங்களும் அவர்களின் தனிப்பட்ட `operatorUid`-யில் மட்டுமே பிரத்தியேகமாகச் சேமிக்கப்பட்டு பூட்டப்பட வேண்டும்.
- **Permanent Eradication of Rogue Fallbacks (குறுக்குவழி ஸ்கேன் முழுத் தடை)**:
  - ஒரு ஆபரேட்டர் தனது லாகின் பெட்டகத்தில் விவரங்களைச் சேமிக்காமல் இருந்தால் (`configured: false`), ஆட்டோமேஷன் எஞ்சின் எந்தக் காரணத்தைக் கொண்டும் `admin` அல்லது "சமீபத்தில் சேமிக்கப்பட்ட பிற ஆபரேட்டர் விவரங்களை" (`bestKey`, `localAppDataVault`) ஸ்கேன் செய்து எடுத்துப் பயன்படுத்தக் கூடாது!
  - பெட்டகத்தில் விவரங்கள் இல்லையென்றால் (`null`), ஆட்டோமேஷன் பிறர் கணக்கைத் திருடாமல், பாதுகாப்பான நேரடி துணை-இயக்க முறைக்கு (Safe Manual Login Co-Pilot Mode) மாற வேண்டும்.
- **Safe Manual Login Co-Pilot Mode (சுய உள்நுழைவு துணை-இயக்க முறை)**:
  - லாகின் பெட்டகத்தில் விவரங்கள் இல்லாத ஆபரேட்டர்களுக்கு, ஆட்டோமேஷன் எஞ்சின் பிரவுசரில் பயனர் பெயர் மற்றும் கடவுச்சொல் புலங்களைத் தொடாமல் வெற்று நிலையில் விட்டுவிட வேண்டும்.
  - மறையாத உலாவி HUD-ல் தெளிவாகக் காட்ட வேண்டும்:
    `"🔐 TNeGA ஆப்ரேட்டர் உள்நுழைவு (நேரடி முறை) — ⚠️ உங்கள் லாகின் பெட்டகத்தில் விவரங்கள் இல்லை. நீங்களே பயனர் பெயர் & கடவுச்சொல்லை உள்ளிட்டு நுழையவும் ⌨️"`
  - ஆபரேட்டர் தாமே பிரவுசரில் விவரங்களை உள்ளிட்டு லாகின் செய்தவுடன் (Golden Rule 5 & 13), ஆட்டோமேஷன் எஞ்சின் தானாகவே அடுத்த கட்டத்திற்கு (Form Filling & Pre-Submit Gate) தடையின்றி முன்னேற வேண்டும்.

### 🛡️ Golden Rule 19: Strict Pre-CAN Mandatory Document Verification & Zero-Phantom Ready Gate Law (கட்டாய முன்-ஆவண சரிபார்ப்பு & போலி தயார்-நிலை முழுத் தடைச் சட்டம்)
- **CAN is Not an Application (கேன் எண் என்பது சேவை அல்ல, பொதுப் பதிவகம் மட்டுமே)**:
  - CAN எண் என்பது ஒரு தனி சான்றிதழோ விண்ணப்பமோ அல்ல; அது வெறும் பொதுவான குடிமக்கள் மக்கள்தொகை பதிவேடு (Demographic Registry) மட்டுமே.
  - வருவாய்த் துறை சான்றிதழ்களில் (Community Certificate REV-101, Income Certificate REV-103, Residence Certificate REV-102), தேவையான கட்டாய ஆவணங்களை (நேரடி பாஸ்போர்ட் புகைப்படம், குடும்ப சாதிச் சான்று/பள்ளி TC, வருமானச் சான்று/சம்பள ரசீது, இருப்பிடச் சான்று/EB/Gas Bill) கையிலெடுக்காமல், வெறும் CAN எண்ணை மட்டும் வைத்துக்கொண்டு ஆப் ஒருபோதும் "100% தயார்" நிலைக்குச் செல்லக்கூடாது!
- **Strict Pre-CAN Phase 1 Document Collection Mandate (Phase 1 கட்டாய ஆவணங்கள் முதலில்)**:
  - அனைத்து வருவாய் சேவைகளிலும் முறைமை மாறா வரிசை (Universal Immutable Order):
    `Phase 1: கணினியில் உள்ள அசல் ஆவணங்கள் சரிபார்ப்பு (Physical Documents on Disk)` ➡️ `Phase 2: CAN எண் சரிபார்ப்பு` ➡️ `Phase 3: சேவை சார்ந்த போர்ட்டல் கேள்விகள்` ➡️ `Phase 4: ஆபரேட்டர் முன்-சமர்ப்பிப்பு ஆய்வு நிலையம் (Pre-Submit Station)`.
  - ஆவணங்கள் கையில் இல்லாமல் CAN கேள்விகளுக்கோ அல்லது Ready Station-க்கோ செல்ல முற்றிலும் தடை.
- **Physical Disk Existence Invariant (`isPhysicalDocValid`)**:
  - வெறும் மாறிப் பெயர்களையோ (string variables) அல்லது நீக்கப்பட்ட கோப்புப் பாதைகளையோ நம்பக் கூடாது.
  - ஒரு ஆவணம் இருக்கிறது என்பதற்கு `(docPath && fs.existsSync(docPath) && stat.size > 100) || (b64 && b64.length > 200)` என்ற நேரடி இயற்பியல் சரிபார்ப்பு மட்டுமே சான்றாகும்.
- **Instant Deletion Demotion & Zero-Phantom Ready Gate (ஆவணம் நீக்கப்பட்டால் போலி தயார்-நிலை முழுத் தடை)**:
  - திருத்து சாளரத்திலோ (Edit Modal) அல்லது பக்கவாட்டுப் பட்டியலிலோ (Sidebar) ஏதேனும் ஒரு கட்டாய ஆவணம் நீக்கப்பட்டால் (`delete-document`):
    1. கணினி உடனடியாக தயார் நிலையை ரத்து செய்து (`intakeState = '..._WAIT'`), பழைய "100% தயார்" / "விண்ணப்பிக்கத் தொடங்கு" செய்திகளை சாட் வரலாற்றிலிருந்து முழுமையாக நீக்க வேண்டும் (Filter out stale ready bubbles).
    2. எந்த ஆவணம் விடுபட்டுள்ளதோ அதற்கான பதிவேற்றுக் கோரிக்கையை (`🗑️ ஆவணம் நீக்கப்பட்டது! புதிய ஆவணத்தைப் பதிவேற்றவும்`) உடனடியாக சாட் திரையில் காட்ட வேண்டும்.
    3. திருத்து சாளரம், பக்கவாட்டு ஆவணப் பட்டியல், மற்றும் சாட் திரை ஆகிய மூன்றும் மில்லிசெகண்டில் நேரலையாக ஒத்திசைக்கப்பட வேண்டும் (`renderMessages` with updated history).
- **Hard Pre-Flight Gate on Submit (சமர்ப்பிப்பு பொத்தானில் இரும்புத் தடுப்பு)**:
  - சாட் திரையிலோ அல்லது திருத்து சாளரத்திலோ உள்ள "இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு" பொத்தானை ஆபரேட்டர் அழுத்தினால், இயற்பியல் ஆவணங்கள் இல்லையெனில் சமர்ப்பிப்பைத் தடுத்து நிறுத்தி, ஆபரேட்டருக்கு சிவப்பு எச்சரிக்கைக் காட்டி, ஆவணப் பதிவேற்ற நிலைக்குத் தானாகத் திருப்ப வேண்டும்.

### 📜 Golden Rule 20: Mandatory Document-First Intake Law & Multimodal AI Extraction Primacy (முதலில் ஆவணப் பதிவேற்றம் ➡️ AI தகவல் பிரித்தெடுப்பு ➡️ விடுபட்ட கேள்விகள் மட்டுமே விதி)
- **The Document-First Prime Directive (ஆவணங்கள் முதலில் விதி)**:
  - எதிர்காலத்தில் உருவாக்கப்படும் புதிய சேவைகள் மற்றும் ஏற்கனவே உள்ள அனைத்து 7 அரசு சேவைகளிலும் (TNPDS New Smart Card, Change Address, Add Member, TNeGA Community, Income, Residence, CAN Registration):
  - **விண்ணப்பத்திற்குத் தேவையான அசல் ஆவணங்கள் (Documents) பயனரிடமிருந்து முதலில் பெறப்பட வேண்டும்!**
  - எந்தவொரு விண்ணப்பத்திலும், ஆவணங்களைக் கேட்கும் முன்பே பயனரிடம் கைமுறையாகப் பெயர், தந்தை பெயர், பிறந்த தேதி, முகவரி போன்றவற்றைத் தட்டச்சு செய்யச் சொல்லி கேள்விகள் கேட்கக் கூடாது.
- **Multimodal AI Auto-Extraction Primacy (AI தானியங்கி தகவல் பிரித்தெடுப்பு)**:
  - பயனர் பதிவேற்றும் ஆவணங்களிலிருந்து (Aadhaar, Gas Book, Birth Certificate, TC, Community Certificate):
    - பெயர் (தமிழ் & ஆங்கிலம்), தந்தை/கணவர் பெயர், பிறந்த தேதி, பாலினம், ஆதார் எண்.
    - கதவு எண், தெரு முகவரி, குக்கிராமம், வருவாய் கிராமம், வட்டம், மாவட்டம், பின்கோடு.
    - எரிவாயு இணைப்பு எண், எண்ணெய் நிறுவனம், ஏஜென்சி பெயர்.
    போன்ற 90% தகவல்களை Multimodal AI தானாகவே பிரித்தெடுத்து மாஸ்டர் ப்ரொஃபைலிலும் வரைவிலும் நிரப்ப வேண்டும்.
- **Delta Questions Only (ஆவணத்தில் இல்லாத எஞ்சிய கேள்விகள் மட்டுமே)**:
  - ஆவணங்களிலிருந்து பிரித்தெடுக்க முடியாத தகவல்கள் மட்டுமே (உதா: தாயாரின் பெயர், மதம், சாதி உட்பிரிவு, ஆண்டு வருமானம், தொழில், வசிக்கும் ஆண்டுகள்) பயனரிடம் அடுத்தடுத்து வரிசையாகக் கேட்கப்பட வேண்டும்.
- **Universal Immutable Intake Order across All Services (மாறா 4-படிநிலைகள்)**:
  `படி 1: கட்டாய ஆவணங்கள் பதிவேற்றம் (Aadhaar + Photo + Service Proofs)` ➡️
  `படி 2: AI தானியங்கி தகவல் பிரித்தெடுப்பு (Auto-Extraction)` ➡️
  `படி 3: முன்-தேவைகள் & விடுபட்ட கேள்விகள் (Prerequisites like CAN + Missing Bucket B Fields)` ➡️
  `படி 4: ஆபரேட்டர் சரிபார்ப்பு & 1-கிளிக் ஆட்டோமேஷன் (Review & 1-Click Launch)`.

### 🧩 Golden Rule 21: Zero-Mixing Isolated Service Cartridge Law (இனி வரும் அனைத்து சேவைகளுக்கும் 100% தனித்தனி Cartridge கட்டாய விதி)
- **Never Regrow Shared Service `if/else` Ladders (பொது கோடுகளில் கலப்பு முழுத் தடை)**:
  - **Every new or existing government service (#15..#50+) MUST live 100% inside its own isolated Backend Cartridge (`src/cartridges/<service>/`) and UI Cartridge (`public/js/cartridges/<service>.js`) — built from `src/cartridges/_template/` & `public/js/cartridges/_template.js`.**
  - Each service Cartridge MUST independently own ALL 7 stages:
    1. `manifest.js`: disjoint `id`, `aliases`, `ownedStates`.
    2. `flow.js`: `enterService`, `advanceFlow` / `handleFlow`, `onDocumentDeleted`.
    3. `intake.js`: Chat turn handling & document persistence scoped ONLY to this service.
    4. `extractor.js`: `processEditModalUpload` & `applyDocumentUpload` scoped ONLY to this service's slots.
    5. `automation.js`: `startFromChat`, `run`, `chatStartTriggers`, `readyStates`.
    6. UI Cartridge (`public/js/cartridges/<service>.js`): `ownedDocTypes`, `renderDynamicEditFields` (zero static HTML bloat in `public/index.html`), `collectEditFields`, `renderDynamicSidebar`, `syncFromUpload`, `validatePreSubmit`.
- **Frozen Core Tools Only**: Only pure stateless tools (`photo_studio.js`, `ai_document_extractor.js`, `doc_upload_primitives.js`, `tn_district_mapper.js`, `tnega_browser_manager.js`, `storage_service.js`) and thin switchboards (`<= 120 lines`) remain shared.

### 🔒 Golden Rule 22: Mandatory Strict Step-Completion Gate Law (படி-முடிவு உறுதிப்பாட்டு விதி — ஒரு படி முடியாமல் அடுத்த படி செல்ல முழுத் தடை)
- **Zero Premature Step Advancement (படி முடியாமல் அடுத்த படி செல்லவே கூடாது)**:
  - எந்தவொரு அரசு ஆட்டோமேஷனிலும் (TNPDS & TNeGA — அனைத்து சேவைகளிலும்) **படி N முழுமையாக முடிந்து அரசு போர்ட்டலின் DOM / சர்வர் மூலம் உறுதி செய்யப்படாமல்** ஒருபோதும் படி N+1-க்குத் தாவக் கூடாது.
  - **கட்டாயப் பூட்டுகள் (Mandatory Step Locks)**:
    1. **Generate OTP (படி 19 / Login OTP) ➡️ Wait OTP**: OTP உருவாக்கு பொத்தானை அழுத்திய பிறகு, உண்மையில் Chrome-ல் OTP Modal திறந்ததா என்பதை உறுதிப்படுத்திய பிறகே OTP காத்திருப்பிற்குச் செல்ல வேண்டும்.
    2. **Upload Document ➡️ Save / Next**: `<input type="file">`-ல் கோப்பின் பெயர் தெரிந்தாலே பதிவேற்றம் முடிந்துவிட்டதாகக் கருதக் கூடாது (`uploadInpVal`, `hasFileName`, `input.files[0]` ஆகியவை போலி உறுதி!). அரசு சர்வரின் `"வெற்றிகரமாக பதிவேற்றப்பட்டது"` Toast / பச்சை Chip (`#69f777`, `.badge-success`, `.alert-success`, clear `'x'` button, அல்லது upload button disabled) வந்த பிறகே `Save Member` / `Next` அழுத்த வேண்டும்.
    3. **Verify OTP ➡️ Next Form / Next Member**: OTP சமர்ப்பித்த பிறகு, போர்ட்டல் பிழையின்றி OTP சாளரம் மூடி அடுத்த நிலை / அட்டவணையில் உறுப்பினர் வரிசை உறுதியான பிறகே அடுத்த உறுப்பினருக்கோ அடுத்த கட்டத்திற்கோ செல்ல வேண்டும்.
    4. **Zero Blind or Duplicate OTP Auto-Resend**: போர்ட்டலின் டைமர் முடியும் முன்னரோ, பட்டன் disabled நிலையில் இருக்கும்போதோ, ஆபரேட்டர் தானே Resend/OTP உள்ளிட்ட பிறகோ கண்மூடித்தனமாகவோ இரட்டை கிளிக்காகவோ (Double-Click) Resend அழுத்தி `txn` குறியீட்டை அழிக்கக் கூடாது (பார்க்க Golden Rule 23).
    5. **Co-Pilot Pause & Auto-Resume at Step N (Never Skip, Never Hard-Kill)**: படி N உறுதிப்படுத்தப்படவில்லை எனில், அடுத்த படிக்குத் தாண்டாமல் அங்கேயே அமைதியாக நின்று (Co-Pilot Watch Mode), பிழையை பின்னணியில் கிளவுட் எரர் லாக்கில் பதிவு செய்து, ஆபரேட்டர் கையால் அந்த ஒரு படியை முடித்தவுடன் தானாகவே அடுத்த படிக்குத் தொடர வேண்டும் (பார்க்க Golden Rule 25).
- **Automated Gate**: Enforce via `node scripts/preflight_check.js` and `tests/regression_suite.js` on every change.

### 🔁 Golden Rule 23: Universal Single-Click OTP Resend, Countdown Intelligence & Zero-Double-Click Law (OTP டைமர் ஆய்வு, ஒற்றை-கிளிக் மீண்டும் அனுப்புதல் & இரட்டை-கிளிக் முழுத் தடை விதி)
- **Mandatory OTP Lifecycle Analysis on EVERY Service (எல்லா OTP படிகளிலும் கட்டாய ஆய்வு)**:
  - இனி உருவாக்கப்படும் அல்லது பராமரிக்கப்படும் அனைத்து அரசு சேவைகளிலும், **ஒவ்வொரு OTP கட்டத்தையும் (Initial Mobile OTP, Login OTP, Aadhaar UIDAI OTP, TNeGA CAN OTP, மற்றும் புதிய போர்ட்டல் OTPகள்)** சேர்க்கும்போது:
    1. போர்ட்டலில் OTP கவுண்டவுன் எவ்வளவு நேரம் ஓடுகிறது (எ.கா: முதல் முறை `120` நொடிகள் ➡️ Resend செய்தால் `60` நொடிகள் ➡️ அடுத்தடுத்து சுருங்கும் டைமர்),
    2. `"மீண்டும் அனுப்பு" / Resend` பொத்தான் எப்போது disabled/hidden நிலையில் இருக்கும், எப்போது clickable ஆகும், ஒரு முறை கிளிக் செய்ததும் போர்ட்டல் எப்படி லாக் ஆகி அடுத்த கவுண்டவுனைத் தொடங்கும்,
    ஆகியவற்றை நேரடியாக DOM-ல் ஆய்வு செய்து அதற்கேற்ப வடிவமைக்க வேண்டும்.
- **Absolute Zero-Double-Click Invariant (OTP-ல் இரட்டை கிளிக் முழுத் தடை)**:
  - **1 Expiry Cycle = Max 1 Click**: OTP டைமர் `0` ஆகி, `"மீண்டும் அனுப்பு"` பொத்தான் உண்மையிலேயே clickable ஆகி, ஆபரேட்டர் OTP உள்ளிடாமலும் மனிதராக Resend அழுத்தாமலும் இருந்தால் மட்டுமே, ஆட்டோமேஷன் **சரியாக 1 முறை** மட்டுமே கிளிக் செய்ய வேண்டும். ஒருபோதும் `Resend` அல்லது `Submit` பொத்தான்களை இரண்டு முறை கிளிக் செய்யக் கூடாது.
  - **Anti-Substring Bug Law**: `'0 நொடிகள்'` / `'0 seconds'` போன்ற substring சோதனைகள் (`"120 நொடிகள்"`, `"60 நொடிகள்"` ஆகியவற்றை `0` எனத் தவறாகப் படிப்பதால்) முற்றிலும் தடைசெய்யப்பட்டுள்ளன. எண் எல்லைப் பகுப்பாய்வு (Numeric boundary parsing) மட்டுமே பயன்படுத்த வேண்டும்.
  - **Single Shared Engine Only**: அனைத்து OTP காத்திருப்புகளும் [src/portal/common/otp_copilot_watcher.js](file:///d:/downloads/ai%20assitant%202/src/portal/common/otp_copilot_watcher.js) (`tryCopilotAutoResendIfExpired`, `shouldBotTriggerResend`, `performVisibleModalResend`, `shouldBotTriggerSubmit`) வழியாக மட்டுமே இயங்க வேண்டும் — `WeakSet` + Browser Cycle Lock (`botResendCyclePendingReset`) + Human-First Yield (`isTrusted`) + 15-min SMS flood cap (`maxAutoResends = 2`) ஆகியவை எப்போதும் செயலில் இருக்க வேண்டும்.
- **Automated Regression Lock**: `npm.cmd test` (`TEST 75` & `TEST 77`) எப்போதும் இதனைத் தானாகவே சரிபார்த்துப் பாதுகாக்கும்.

### 🧱 Golden Rule 24: The "100% Fresh Service Run + Complete PC & Cloud Archive Vault" Law (ஒவ்வொரு சேவையும் 100% Fresh + ஆவணங்கள், CAN & ரசீதுகள் PC + Cloud சேமிப்பு விதி)
- **Zero Per-Service Delta / Auto-Resume Complexity (குழப்பமான பழைய சேவைத் தொடர்ச்சி முழுத் தடை)**:
  - எல்லா 14 ஏற்கனவே உள்ள சேவைகளிலும், இனி உருவாக்கப்படும் #15 முதல் #100+ புதிய அரசு சேவைகளிலும் **ஒரே ஒரு எளிய விதி மட்டுமே** பொருந்தும்:
  - **1. ஒவ்வொரு சேவையும் எப்போதும் 100% ஃப்ரெஷ்ஷாகவே தொடங்கும் (`resetTransientServiceInputs(sess)`)**:
    - எந்தவொரு சேவையின் `enterService()` அழைக்கப்படும்போதும், [src/cartridges/_fresh_service_guard.js](file:///d:/downloads/ai%20assitant%202/src/cartridges/_fresh_service_guard.js) (`resetTransientServiceInputs(sess)`) முதலில் இயக்கப்பட்டு:
      1. முன்பு பதிவேற்றிய அனைத்து ஆவணங்களையும் + இறுதி விண்ணப்ப ரசீதுகளையும் (`savedVaultDocs[]`, `submittedApplications[]`) இழப்பின்றி பாதுகாப்பாக Archive செய்யும் (`archiveCustomerDocumentsAndResults(sess)`),
      2. பின்னர் **அனைத்து நடப்பு வேலை புலங்கள் & வேலை ஆவணங்களையும்** (`ACTIVE_WORKING_PROFILE_FIELDS`, `TRANSIENT_PROFILE_FIELDS`, `documents`, `tempUploads`, `base64Docs`, `canNumber`, `members`) சுத்தம் செய்து புதிய சேவையை **எப்போதும் படி 1-லிருந்து 100% Pure Fresh-ஆகத்** தொடங்கும் — `+ புதிய வாடிக்கையாளர்` அமர்வு தொடங்கும்போதும்கூட பழைய வரைவிலிருந்து எதுவும் ஆட்டோ-லோட் / auto-resume செய்யப்படாது!
  - **2. முழுமையான PC + Cloud சேமிப்பு & ஒத்திசைவு (Archive Vault — Delete = Both)**:
    - வாடிக்கையாளர் பதிவேற்றும் ஆவணங்கள், CAN எண், மற்றும் சமர்ப்பிக்கப்பட்ட **இறுதி முடிவு ஆவணங்கள் (End-Result Application Ref No + Receipt PDFs)** அனைத்தும் PC (`<mobile>.json`) மற்றும் Cloud (Firebase Firestore + Storage) ஆகிய இரண்டிலும் தொடர்ந்து சேமிக்கப்படும்.
    - ஆபரேட்டர் Delete அழுத்தினால் PC + Cloud இரண்டிலிருந்தும் ஒரே நேரத்தில் சுத்தமாக அழிக்கப்படும்.
    - சேமிக்கப்பட்ட வரலாற்று ஆவணங்கள் வெறும் பார்வை / டவுன்லோட் / ஆபரேட்டர் பயன்பாட்டிற்கே — ஒருபோதும் புதிய சேவையின் கேள்வி ஓட்டத்தில் குறுக்கிடாது.
  - **Template Mandate**: `src/cartridges/_template/flow.js` இயல்பாகவே `resetTransientServiceInputs(sess)` அழைக்கும்படி அமைக்கப்பட்டுள்ளது — அனைத்து புதிய சேவைகளும் இதையே கட்டாயம் பின்பற்ற வேண்டும்.

### 🤝 Golden Rule 25: Universal Co-Pilot Pause-and-Auto-Resume Gate & Absolute Pre-Submit Human Separation Law (எல்லா ஆட்டோமேஷன்களுக்கும் பொதுவான நின்று-காத்திருந்து-தொடரும் விதி & இறுதிச் சமர்ப்பிப்பு மனிதப் பூட்டு)
- **Universal Across ALL Existing & Future Automations (இருக்கும் மற்றும் இனி வரும் அனைத்து ஆட்டோமேஷன்களுக்கும் பொதுவானது)**:
  - AI-யும் ஆபரேட்டரும் எப்போதும் இணைந்து (Co-Pilot) செயல்பட வேண்டும்.
  - **விதி 1 — ஒரு படி முடியாமல் அடுத்த படிக்குத் தாண்டக் கூடாது (Zero-Skip Invariant)**: படி N முழுமையாக முடிந்து அரசு போர்ட்டலின் DOM / சர்வரில் உறுதி செய்யப்படாமல் ஒருபோதும் படி N+1-க்குச் செல்லக் கூடாது.
  - **விதி 2 — பாதியில் கட் ஆகாமல் நின்று காத்திருந்து தொடர வேண்டும் (Zero-Kill Pause & Auto-Resume)**:
    - எந்தவொரு நடு-படிநிலையிலும் (Mid-Step: படிவம் திறத்தல், ஆவணம் பதிவேற்றம், சேமிப்பு பொத்தான், OTP சாளரம், அட்டவணை சேர்க்கை, கீழிறங்கு பட்டியல்) அரசு தளப் பிழை அல்லது தானியங்கித் தோல்வி ஏற்பட்டால், ஆட்டோமேஷன் முழுமையாகக் கட் ஆகி வெளியேறக் கூடாது!
    - மாறாக [src/portal/common/strict_step_gate.js](file:///d:/downloads/ai%20assitant%202/src/portal/common/strict_step_gate.js) (`waitForCopilotStepRecovery`) வழியாக:
      1. அந்தப் பிழையை உடனடியாகப் **பின்னணியில் கிளவுட் எரர் லாக்கில் (`COPILOT_STEP_STALLED`)** அமைதியாகப் பதிவு செய்ய வேண்டும் (இதை நாம் பிறகு பார்த்து நிரந்தரமாகச் சரிசெய்வதற்காக).
      2. பிரவுசரில் தெளிவான மஞ்சள்/அம்பர் HUD காட்டி (`🤝 Co-Pilot காத்திருப்பு`), ஆபரேட்டரின் வேலையில் குறுக்கிடாமல் (Zero Interfering Clicks) அந்த இடத்திலேயே அமைதியாகக் காத்திருக்க வேண்டும்.
      3. ஆபரேட்டர் கையால் அந்த ஒரு ஸ்டெப்பைச் சரிசெய்து முடித்தவுடன் (உதா: Save 2–3 முறை அழுத்தி OTP முடிப்பது / ஆவணம் அப்லோடு செய்வது / உறுப்பினர் அட்டவணையில் சேர்வது), ஆட்டோமேஷன் உடனே அதை உணர்ந்து **அங்கிருந்தே மீதி இருக்கும் எல்லா படிகளையும் தானாகத் தொடர்ந்து முடிக்க வேண்டும்!**
      4. பிரவுசர் மூடப்பட்டாலோ, Stop அழுத்தினாலோ, அல்லது 10 நிமிட பாதுகாப்பு நேரம் முடிந்தாலோ மட்டுமே பாதுகாப்பாக நிறுத்த வேண்டும்.
  - **விதி 3 — இறுதிச் சமர்ப்பிப்பு மனிதப் பூட்டை நடு-படி நிறுத்தத்துடன் ஒருபோதும் குழப்பக் கூடாது (Absolute Pre-Submit Human-Only Separation)**:
    - **நடு-படி Co-Pilot காத்திருப்பு (Mid-Step Pause)** = ஆட்டோமேஷன் பாதியில் சிக்கியது ➡️ ஆபரேட்டர் அதைச் சரிசெய்ததும் ஆட்டோமேஷன் தொடர்ந்து மீதிப் படிகளை நிரப்பும்.
    - **இறுதிச் சமர்ப்பிப்பு மனிதப் பூட்டு (Final Pre-Submit Human Gate)** = படிவம் & ஆவணங்கள் 100% நிரப்பப்பட்டுவிட்டன ➡️ **ஆட்டோமேஷன் ஒருபோதும் இறுதிச் சமர்ப்பிப்பு ("பதிவு செய்" / "Submit" / "உறுதி செய்") பொத்தானை அழுத்தவே கூடாது!** ஆபரேட்டர் மட்டுமே நேரடியாக Chrome திரையில் விவரங்களைச் சரிபார்த்து இறுதிச் சமர்ப்பிப்பு பொத்தானை அழுத்த வேண்டும்.
  - **விதி 4 — ரேஷன் கார்டு இறுதிச் சமர்ப்பிப்பிற்குப் பின் தானியங்கி விண்ணப்ப PDF பதிவிறக்கம் (TNPDS Post-Submit Receipt Auto-Download)**:
    - TNPDS குடும்ப அட்டை சேவைகளில், ஆபரேட்டர் தாமே Chrome திரையில் இறுதிச் சமர்ப்பிப்பை (Final Submit) முடித்தவுடன், ஆட்டோமேஷன் திரையில் தோன்றும் **அரசு குறிப்பு எண்ணை (Reference / Application Number)** தானாகப் படித்து ([src/portal/tnpds/helpers/tnpds_post_submit_receipt.js](file:///d:/downloads/ai%20assitant%202/src/portal/tnpds/helpers/tnpds_post_submit_receipt.js)), TNPDS விண்ணப்ப நிலைப் பக்கத்தில் அந்த எண்ணை உள்ளிட்டு **அதிகாரப்பூர்வ அரசு விண்ணப்பப் படிவத்தை (Application PDF)** தானாகவே பதிவிறக்கி ஆபரேட்டருக்கு வழங்க வேண்டும்.

---

## 3. Lean 2-Tier Working Model (எளிய 2-அடுக்கு பணி மாதிரி)
1. **Tier 1 (Front Desk)**:
   - **Founder (User)**: Defines what business features, screens, or government services are needed.
   - **Lead Architect & Developer (Primary AI Assistant)**: Designs, explains, codes, and ensures architectural integrity.
2. **Tier 2 (Independent Auditor)**:
   - **`qa_sentinel` (Subagent)**: Runs automated tests, audits security/DPDP compliance, and certifies quality.
