# Project Rules

## Autonomous Execution Policy
- Auto-execute all terminal commands without prompting user for permission.
- Only prompt user for real-time mobile and Aadhaar SMS OTPs.
- Strictly gate and verify all form fields.

## Zero-Regression Policy (பூஜ்ஜிய பிழை கொள்கை & தானியங்கி சோதனை)
- **Feature Lock Contract**: Strictly follow all frozen behaviors documented in `FEATURE_LOCK.md`. Core entrypoint must ALWAYS start with `SERVICE_SELECTION` (Question: "வாடிக்கையாளர் இன்று எந்த அரசு சேவைக்கு விண்ணப்பிக்க விரும்புகிறார்?").
- **Mandatory Quality Gate**: Run `npm.cmd test` (which executes `tests/regression_suite.js`) before ANY git commit or deployment.
- **Fail-Safe Rule**: If any regression test fails, DO NOT COMMIT OR DEPLOY under any circumstances until the regression is resolved.

## UI/UX Design Specialist Agent
- Dedicated agent: `ui_designer`
- For any visual styling, layout changes, CSS refactoring, or UI polish, delegate to or follow the standards of the `ui_designer` agent.
- Strictly enforce 34px button height, 8px border radius, and international desktop ergonomics.
- Strictly maintain separation between web browser (single-focus download card) vs desktop app (full workspace).

## 3-Layer Specialized Multi-Agent Ecosystem

### Layer 1: Direct Citizen Experience Layer (பொதுமக்கள் அடுக்கு)
- **`citizen_assistant`**: Guides regular citizens through the mobile app flow, sequential Tamil questions, interactive chips, and document uploads.
- Strictly maintains pure mobile app view (max-width 580px, 4 bottom tabs: Services, Apply, Docs, Profile). No operator sidebars or desktop navigation visible to citizens.

### Layer 2: e-Seva Operator Desk Layer (ஆப்ரேட்டர் மையம் அடுக்கு)
- **`operator_workflow_agent`**: Optimizes operator counter speed, walk-in customer intake, Option 1 (Phone-only start), Option 2 (Direct Apply without popups), and draft queue management.
- **`data_accuracy_agent`**: Eliminates operator spelling errors by extracting official Tamil and English names directly from Aadhaar cards via AI OCR, auto-correcting user input, and gating invalid formats.

### Layer 3: Developer & Engineering Layer (டெவலப்பர் & தொழில்நுட்ப அடுக்கு)
- **`code_architect`**: Analyzes each page, component, and API route before writing clean, modular, production-ready code.
- **`bug_fixer`**: Investigates existing live website errors, unhandled rejections, server crashes, and network timeouts; applies precision fixes.
- **`logic_verifier`**: Deeply audits form state machines, question sequences, OTP gating rules, and edge cases to guarantee logic integrity.
- **`portal_automation_engineer`**: Manages Playwright automation for official government portals (TNPDS, e-Sevai, TNeGA), selector resilience, and 51-step submission.
- **`automation_immune_architect`**: Dedicated elite Government Automation Immune Architect & Pre-Flight Auditor. Enforces all 12 field-tested government portal automation laws, prevents regression ping-pongs, audits selector scoping, and automatically registers new portal lessons into `data/automation_immune_memory.json`.

## Strict Sequential Field-Gating & Absolute Document Integrity Law (படிபடியான புலக் கட்டுப்பாட்டு & ஆவணப் பாதுகாப்பு விதி)
- **அரசு போர்ட்டல் நிரந்தர மனநிலை (Government Portal Automation Mindset)**: நாம் கையாள்வது சாதாரண இணையதளங்கள் அல்ல; அதிகாரப்பூர்வ தமிழ்நாடு மற்றும் இந்திய அரசு போர்ட்டல்கள் (TNPDS, TNeGA, e-Sevai, NVSP போன்றவை). ஒரு சிறிய விடுபடல் அல்லது தவறான ஆவணம் கூட விண்ணப்பத்தை அதிகாரிகளால் நிராகரிக்க வைத்துவிடும்.
- **ஒவ்வொரு Field-ம் ஒரு தனி Step**: எந்த ஒரு காரணத்திற்காகவும் ஒரு படி/புலம் முழுமையாக முடிந்து சரிபார்க்கப்படாமல் அடுத்த படிக்கு செல்லவே கூடாது (Zero-Step-Skip Policy).
- **முழுமையான ஆவண உண்மைத்தன்மை (Absolute Document Integrity)**:
  - ஒரு குறிப்பிட்ட நபரின் ஆவணத்திற்கு பதிலாக வேறொரு நபரின் ஆவணத்தை (எ.கா: உறுப்பினருக்கு குடும்பத் தலைவரின் ஆதார்) ஒருபோதும் மாற்றிப் பதிவேற்றக் கூடாது.
  - ஒரு குறிப்பிட்ட சான்று வகை இடத்தில் (எ.கா: குடியிருப்புச் சான்று / எரிவாயு அட்டை), வேறொரு சான்றை (எ.கா: ஆதார்) போலியாகப் பதிவேற்றக் கூடாது.
  - உரிய ஆவணம் கிடைக்காத பட்சத்தில், ஆட்டோமேஷன் அடுத்த படிக்குச் செல்லாமல் அந்த இடத்திலேயே உடனடியாக நிறுத்தப்பட வேண்டும் (Strict Gate Halt), அல்லது ஆப்ரேட்டரிடம் சரியான அசல் ஆவணத்தைக் கேட்க வேண்டும்.
- **அனைத்து அரசு போர்ட்டல்களுக்கும் நிரந்தர விதி (Universal Law)**:
  - இது TNPDS மட்டுமல்லாமல், எதிர்காலத்தில் நாம் இணைக்கும் அல்லது பயிற்றுவிக்கும் (Train செய்யும்) அனைத்து அரசு போர்ட்டல்களுக்கும் (வருமானச் சான்றிதழ், சாதிச் சான்றிதழ், இருப்பிடச் சான்றிதழ், வாக்காளர் அட்டை போன்றவை) வாழ்நாள் நிரந்தர விதியாகும்.
- Every single field input, dropdown selection, and file upload must be sequentially executed, verified, and gated before moving to the next element. No skipping, no dummy document substitutions, and no premature submissions.

## Universal Single-Engine Dual-Mode Automation Standard (நிரந்தர இரட்டை முறை ஆட்டோமேஷன் சட்டகம்)
- **Zero-Mock Policy (முழுமையான போலி வலைத்தளத் தடை)**:
  - எந்த ஒரு சேவைக்கும் (தற்போதுள்ள TNPDS அல்லது எதிர்காலத்தில் சேர்க்கப்படும் TNeGA, NVSP வாக்காளர் அட்டை, பட்டா சிட்டா முதலிய எதற்கும்) **மாதிரி HTML அல்லது போலி போர்ட்டல் (Mock Website) உருவாக்கவோ, இணைக்கவோ அல்லது திறக்கவோ கூடாது**.
  - எப்போதும் அதிகாரப்பூர்வ, நேரடி அரசு வலைத்தளமே (Real Government Portal URL) திறக்கப்பட வேண்டும்.
- **Localhost Testing Mode (உள்ளூர் சோதனை முறை - "ஒத்திகை")**:
  - பயனர் "Localhost" அல்லது `run.bat` அல்லது சோதனை செய்யும்போது:
    1. **Browser**: பயனர் கண் முன்னால் தனியாகத் தெரியும் **Google Chrome** சாளரம் (`headless: false`, `channel: 'chrome'`) கட்டாயம் திறக்கப்பட வேண்டும்.
    2. **Website**: நிஜ அரசு போர்ட்டல் (Real Official Govt Portal).
    3. **HUD**: திரையின் மேல்பகுதியில் eSeva AI HUD (படி 1 முதல் N வரை) தெளிவாக இயங்க வேண்டும்.
    4. **Data**: தானியங்கி மாதிரி விவரங்கள் (Preset Demo Data: மாதிரி பெயர், மாதிரி ஆதார், மாதிரி ஆவணம்).
    5. **OTP**: உள்ளூர் இடைமறிப்பு (Mock/Local OTP Intercept: 123456) மூலம் அரசு SMS அனுப்பாமல் எளிதாக சோதனை முடிக்கும் முறை.
    6. **Dry-Run Guard**: இறுதி சமர்ப்பிப்புக்கு முன் (Final Submit) பாதுகாப்பாக நிறுத்தப்பட்டு முன்னோட்டம் காட்டப்பட வேண்டும்.
- **Production / Live Publish Mode (உற்பத்தி / நேரலை முறை - "நிஜம்")**:
  - பயனர் "Publish" அல்லது "Live App" என அறிவிக்கும்போது:
    1. **Browser**: அதே Google Chrome சாளரம்.
    2. **Website**: அதே நிஜ அரசு போர்ட்டல்.
    3. **Data**: வாடிக்கையாளரின் அசல் ஆவணங்கள் & உண்மையான விவரங்கள்.
    4. **OTP**: வாடிக்கையாளரின் மொபைல் போனுக்கு வரும் நேரடி அரசு SMS OTP.
    5. **Submission**: இறுதி சமர்ப்பிப்பு பட்டன் அழுத்தப்பட்டு உண்மையான அரசு குறிப்பு எண் (Reference Number) & அக்னாலெட்ஜ்மென்ட் PDF ரசீது பெறப்படும்.
- **Instant 1-Day Automation Blueprint (புதிய சேவைகளை 1 நாளில் அமைக்கும் விதி)**:
  - எதிர்காலத்தில் எந்த புதிய அரசு சேவை வந்தாலும் பயனர் ஆரம்பத்திலிருந்து 10 நாட்கள் விளக்க வேண்டிய அவசியமே இல்லை.
  - சேவை ஐடி, அரசு போர்ட்டல் URL, மற்றும் ஃபீல்டு செலக்டர்களை மட்டும் இணைத்தால் போதுமானது; ஆட்டோமேஷன் எஞ்சின் தானாகவே லோக்கல் ஹோஸ்டில் குரோமைத் திறந்து மாதிரி விவரங்களை நிரப்பி இயங்கச் செய்யும்.

## Permanent Field-Tested Automation Memory & Edge-Case Laws (களப் பரிசோதனை ஆட்டோமேஷன் நினைவகம் & நிரந்தர விதிகள்)
எந்த ஒரு புதிய அரசு சேவையை உருவாக்கும்போதும் (TNeGA வருமானம், சாதி, இருப்பிடம், NVSP வாக்காளர் அட்டை, பட்டா சிட்டா முதலிய எதற்கும்), முந்தைய சோதனைகளில் நாம் சரிசெய்த கீழ்க்கண்ட பாடங்களை ஒருபோதும் மறக்காமல் தானாகவே பின்பற்ற வேண்டும்:

1. **Instant Visible Chrome Desktop Launch & Anti-Bot Law (உடனடி நேரடி குரோம் திரை திறப்பு & பாட் தடுப்பு விதி)**:
   - அரசு போர்ட்டல் சோதனையின் போது பயனர் கண் முன்னால் Google Chrome சாளரம் தாமதமின்றி உடனடியாகத் திறக்கப்பட வேண்டும்.
   - `launchPersistentContext` போன்ற ப்ரொஃபைல் பூட்டு முறைகள் கணினியில் ஏற்கனவே இயங்கும் குரோம் ப்ராசஸ்களால் லாக் ஆகி சாளரம் திறக்காமல் முடங்கும் அபாயம் உள்ளதால், எப்போதும் நம்பகமான `chromium.launch({ channel: 'chrome', headless: false })` மூலம் நேரடி சாளரமாகத் திறக்க வேண்டும்.
   - பயனரின் டெஸ்க்டாப் திரையில் Google Chrome சாளரம் தோன்றி, தளம் லோட் ஆவதை பயனர் நேரில் பார்க்க வேண்டும்.
2. **Dual-Listener OTP Architecture Law (இரட்டை முறை OTP ஏற்பு & முன்கூட்டிய மெமரி)**:
   - ஆபரேட்டர் Chat Interface-ல் OTP உள்ளிட்டாலும், அல்லது திரையில் உள்ள Google Chrome இணையதளப் பக்கத்திலேயே நேரடியாக உள்ளிட்டாலும் இரண்டையுமே அமைப்பு உடனடியாக ஏற்க வேண்டும்.
   - **Early OTP Memory Cache**: போர்ட்டலில் OTP பாக்ஸ் லோட் ஆவதற்கு முன்கூட்டியே சாட்டில் OTP தட்டச்சு செய்தாலும், அது மெமரியில் சேமிக்கப்பட்டு (`cachedUserOtp`) பாக்ஸ் வந்த உடனே தானாக நிரப்பப்பட வேண்டும்.
   - **Chrome Direct Submit Detection**: ஆபரேட்டர் Chrome-ல் OTP அடித்து உள்நுழைவு பட்டனையும் தானே அழுத்தினால், சிஸ்டம் அடுத்த பக்க மாற்றத்தைக் கண்டறிந்து (`ALREADY_VERIFIED_ON_PORTAL`) தானாக அடுத்த படிக்குத் தொடர வேண்டும்.
3. **Government Portal Fatal Error Gating Law (அரசு தள பிழை பகுப்பாய்வு விதி)**:
   - அரசு தளம் காட்டும் பிழைகளை ("கைபேசி எண் பதிவுசெய்யப்படவில்லை", "15 நிமிடங்களுக்குப் பிறகு முயற்சிக்கவும்" போன்ற OTP Rate Limit) ஒருபோதும் சாதாரண கேப்ட்சா பிழையாகக் கருதிக் குழம்பக் கூடாது.
   - பிழை அலர்ட்கள் வந்தால் உடனே ஆட்டோமேஷன் நிறுத்தப்பட்டு, அசல் அரசு அறிவிப்பு தமிழில் ஆபரேட்டருக்குத் தெரிவிக்கப்பட வேண்டும்; OTP பாக்ஸ் திரையில் தோன்றும் வரை முன்கூட்டியே "OTP-க்காக காத்திருக்கிறது" என அறிவிக்கவே கூடாது.
4. **Strict Dry-Run Guard & Browser Retention Law (சோதனைப் பாதுகாப்பு பூட்டு & உலாவி ஆய்வு)**:
   - அசல் மொபைல் எண்ணுடன் மாதிரி விவரங்கள் சோதிக்கப்படும்போது, அரசுக்கு அனுப்பும் இறுதிச் சமர்ப்பிப்பு (Final Submit) பொத்தான் ஒருபோதும் அழுத்தப்படக் கூடாது.
   - ஆட்டோமேஷன் முடிந்ததும் உலாவி தானாக மூடப்படாமல் திரையிலேயே நிற்க வேண்டும்; ஆபரேட்டர் அனைத்து விவரங்களையும் நேரில் பார்த்து உறுதி செய்ய வழிவகை செய்ய வேண்டும்.
5. **Continuous Incremental Learning Law (தொடர் அனுபவப் பதிவேற்றுக் கொள்கை - வாழ்நாள் கற்றல் விதி)**:
   - ஒவ்வொரு சோதனையின் போதும் அல்லது புதிய அரசு சேவை அமைக்கும்போதும் எதிர்கொள்ளும் புதிய சிக்கல்கள் மற்றும் அதன் தீர்வுகளை உடனடியாக:
     a. `GEMINI.md`-ல் ஒரு புதிய எண்ணிட்ட விதியாக இணைக்க வேண்டும்.
     b. `AUTOMATION_PLAYBOOK.md`-ல் முழுமையான கேஸ் ஸ்டடியாகப் பதிவு செய்ய வேண்டும்.
     c. `tests/regression_suite.js`-ல் ஒரு புதிய தானியங்கி ரெக்ரஷன் சோதனையாக இணைத்து பூட்ட வேண்டும்.
   - இதன் மூலம் நாம் தீர்க்கும் ஒவ்வொரு பிரச்சினையும் நிரந்தர அனுபவமாகச் சேமிக்கப்பட்டு, எதிர்கால ஆட்டோமேஷன்கள் இன்னும் அதிவேகமாகவும், எவ்விதத் தடையுமின்றியும் தானாகவே இயங்கும்!
6. **Radware Human Challenge Clearance & Seamless Post-Refresh Resumption Law (மனித சரிபார்ப்பு & தானியங்கி மறுதொடக்கம் விதி)**:
   - போர்ட்டலில் OTP சமர்ப்பிக்கும் போது Radware / Perfdrive "I am human" பாதுகாப்பு சவால் வந்தால், `tryAutoClickCaptcha` மூலம் சவாலைத் தானாகத் தீர்க்க வேண்டும் அல்லது ஆப்ரேட்டர் நேரடியாகத் திக் செய்ய வாய்ப்பளிக்க வேண்டும்.
   - சவால் முடிந்தவுடன் அரசு தளம் பக்கத்தை ரீலோட் (Refresh) செய்து மீண்டும் லாகின் பக்கத்திற்கே திரும்பினாலும், செயல்முறையை நிறுத்தாமல் (`TNPDS_LOGIN_GATE_HALT` தடுத்து) தானாகவே OTP-யை மீண்டும் நிரப்பி மனித பாணியில் (`pressSequentially` + hover + click) சமர்ப்பித்து தடையின்றி அடுத்த படிக்குச் செல்ல வேண்டும்.
   - அசல் குரோம் ப்ரொபைலில் போலி `navigator.plugins` அல்லது போலி `window.chrome = { runtime: {} }` மாற்றங்களை ஒருபோதும் செய்யக் கூடாது; அதுவே Radware-ஐத் தூண்டும் என்பதால் webdriver-ஐ மட்டும் மறைத்து தூய குரோம் சூழலைத் தர வேண்டும்.
7. **Mandatory Visible Browser Transparency Law (கட்டாய நேரடி உலாவி வெளிப்படைத்தன்மை விதி)**:
   - ஆட்டோமேஷன் இயங்கும் போது ஒருபோதும் பின்னணியில் (Silent/Hidden) இயங்கக் கூடாது.
   - உலாவி உடனடியாகத் திரையில் காட்டப்பட வேண்டும்; TNPDS தளம் லோட் ஆவது, எண் உள்ளிடப்படுவது, கேப்ட்சா தோன்றுவது, மற்றும் OTP பெட்டி வருவது ஆகிய அனைத்துமே பயனர் கண் முன்னால் நேரடியாகத் தெரிய வேண்டும்.
   - அப்போதுதான் பயனர் தன் போனுக்கு வரும் SMS OTP-ஐத் திரையில் பார்த்துக்கொண்டு தட்டச்சு செய்ய முடியும்.
8. **Radware Challenge Anti-Jitter & Token-Gated Clearance Law (மனித சவால் நடுக்கத் தடுப்பு & டோக்கன் உறுதி விதி)**:
   - "I am human" / Radware சவால் பக்கத்தில் (`validate.perfdrive.com`) இருக்கும் போது, `scrollIntoViewIfNeeded()` அல்லது `hover()` போன்ற தொடர் ஸ்க்ரோலிங் முறைகளை சுழற்சியில் (Loop-ல்) ஒருபோதும் இயக்கக் கூடாது; அது பக்கத்தை மேலும் கீழும் பயங்கரமாக அலையச் செய்து பயனரின் மவுஸ் கட்டுப்பாட்டைக் குலைக்கும்.
   - படப் புதிர் (Image Challenge Puzzle) திரையில் திறந்திருக்கும் போது, ஆட்டோமேஷன் எவ்வித தலையீடும் செய்யாமல் அமைதியாக நிற்க வேண்டும்; பயனர் படங்களை நிதானமாகத் தேர்வு செய்ய முழு அமைதியைத் தர வேண்டும்.
   - Radware-ன் 'Submit' பொத்தான், `h-captcha-response` அல்லது `cfi`-ல் உண்மையான பாதுகாப்பு டோக்கன் உருவான பிறகே (`isCaptchaSolved === true`) அழுத்தப்பட வேண்டும். டோக்கன் உருவாவதற்கு முன் முன்கூட்டியே Submit பட்டனை அழுத்தினால் Radware சமர்ப்பிப்பை நிராகரித்து சவாலை மீண்டும் மீண்டும் கடினமாக்கும்!
9. **Pre-Flight Human Clearance & Zero-Halt Full-Page Reset Auto-Recovery Law (மனித சரிபார்ப்பு முன்-அனுமதி & தளம் ரீலோட் ஆனால் தானியங்கி மீட்பு விதி)**:
   - போர்ட்டல் திறக்கும் போதே (Step 1-ல்) Radware மனித சரிபார்ப்பு உள்ளதா எனச் சரிபார்த்து முன்-அனுமதி பெற வேண்டும்; சவால் முடிந்த அடுத்த நொடியே அனுமதிக் குக்கீகள் (`data/tnpds_cookies.json`) உடனடியாக டிஸ்க்கில் சேமிக்கப்பட வேண்டும்.
   - `userAgent: 'Chrome/131'` போன்ற போலி ஓவர்ரைடுகள் மற்றும் `dispatchEvent(new Event('input'))` போன்ற போலி DOM நிகழ்வுகள் ஒருபோதும் பயன்படுத்தப்படக் கூடாது; கம்ப்யூட்டரின் அசல் Google Chrome 153 நேட்டிவ் User-Agent மற்றும் `pressSequentially` போன்ற நம்பகமான நிகழ்வுகள் மட்டுமே பயன்படுத்தப்பட வேண்டும்.
   - ஒருவேளை OTP உள்ளிட்ட பின் Radware சவால் வந்து, முடிந்த பின் அரசு தளம் முழுமையாக ரீலோட் ஆகி மீண்டும் முதல் நிலைக்குச் சென்றாலும் (`otpInput` இல்லாத நிலை), ஆட்டோமேஷனை எக்காரணம் கொண்டும் நிறுத்தக் கூடாது (`Zero-Halt`); கைபேசி எண் & கேப்ட்சாவைத் தானாக மீண்டும் நிரப்பி, புதிய OTP-ஐப் பெற்று உள்நுழைவை வெற்றிகரமாக முடிக்க வேண்டும்.
10. **Strict Zero-Resend Law During OTP Verification & Radware Zero-DOM-Tampering Law (OTP சரிபார்ப்பில் மறு-அனுப்புதல் முழுத் தடை & DOM சேதமற்ற பாதுகாப்பு விதி)**:
    - TNPDS லாகின் படிவத்தில் OTP-ஐச் சமர்ப்பித்து சரிபார்க்கும் போது (`submitOtpOnPortal`), எக்காரணம் கொண்டும் `#btnSendOtp` (Send / Resend OTP) பொத்தானை அழுத்தவே கூடாது.
    - OTP சரிபார்ப்பு பொத்தான் strictly `button.subbtn`, `#btnLogin` அல்லது `'உள்நுழைக'` மட்டுமே ஆகும்.
    - Radware சவால் பக்கத்தில் (`validate.perfdrive.com`) இருக்கும் போது, `showBrowserHud` அல்லது `injectVisualBanner` போன்ற எந்த ஒரு புதிய DOM கூறுகளையும் (`document.body.appendChild`) அந்தப் பக்கத்தில் நுழைக்கக் கூடாது (Zero-DOM-Tampering); அவ்வாறு நுழைத்தால் Radware-ன் க்ளையன்ட்-சைடு பாட் தடுப்பான் DOM மாற்றத்தைக் கண்டறிந்து சமர்ப்பிப்பை நிராகரித்துவிடும் அல்லது பக்கத்தை அலையச் செய்யும்.
11. **Real Portal OTP Submit Element (`button.subbtn`) Disambiguation & Asterisk Noise Filtration Law (அரசு OTP பொத்தான் துல்லியத் தேர்வு & நட்சத்திரக் குறியீடு பிழை வடிகட்டு விதி)**:
    - அதிகாரப்பூர்வ TNPDS போர்ட்டல் Angular Ivy மூலம் இயங்குகிறது. OTP சரிபார்க்கும் உண்மையான பொத்தான் `button.subbtn` ஆகும் (இது `o.otpSubmit()` முறையை அழைக்கும்).
    - அதன் தமிழ் தலைப்பு "பதிவு செய்ய" என இருந்தாலும், `subbtn` கிளாஸ் உள்ள பொத்தான் Send OTP பட்டன் அல்ல; அதுவே உண்மை OTP சமர்ப்பிப்பு பட்டன் ஆகும். எனவே `!isSubBtn` நிபந்தனையுடன் `button.subbtn:visible` உடனடியாகக் கிளிக் செய்யப்பட வேண்டும்.
    - படிவப் பிழைகளை ஸ்கேன் செய்யும் போது, HTML கட்டாயப் புலங்களின் நட்சத்திரக் குறியீடுகள் (`<span class="text-danger">*</span>`) அரசு பிழையாகத் தவறாகக் கருதப்படக் கூடாது (`txt === '*'` கட்டாயம் புறக்கணிக்கப்பட வேண்டும்); `#errorShow` மற்றும் `.error-box` மூலம் உண்மையான அரசு பிழைகள் மட்டுமே ஆபரேட்டருக்குத் தெரிவிக்கப்பட வேண்டும்.
12. **Post-Login Radware Race Condition & Add Member Direct URL Law (லாகின் பின் மனித சரிபார்ப்பு & நேரடி சேவை வழிசெலுத்தல் விதி)**:
    - OTP லாகின் முடிந்ததும் `/pages/home` வந்தவுடன் Radware சவால் வந்தால், அது முழுமையாகத் தீரும் வரை காத்திருந்து (`validate.perfdrive.com` விலகும் வரை) பின்னரே சேவைப் பக்கத்திற்குச் செல்ல வேண்டும்.
    - Add Member சேவைக்கு எப்போதும் உறுதியான நேரடி URL (`https://www.tnpds.gov.in/pages/service-request`) அல்லது நேரடி கார்டு மெனு லிங்க்கைப் பயன்படுத்த வேண்டும்.
13. **Mandatory Zero-Step-Skip Form Gate Law (படிவம் சரிபார்த்தல் & கட்டாய நிறுத்து விதி)**:
    - TNPDS Add Member பக்கத்தில் படிவம் (`memberFormFound`) திரையில் முழுமையாக லோட் ஆகாத வரை எந்த ஒரு விவரத்தையும் முன்கூட்டியே நிரப்பவோ சமர்ப்பிக்கவோ கூடாது (`MEMBER_FORM_GATE_HALT`).
14. **Universal Angular Material Readonly Datepicker & Humanized Anti-Bot Mouse Curve Law (தேதித் தேர்வு & மனித மவுஸ் அசைவு விதி)**:
    - Angular Material `readonly` கேலெண்டர் புலங்களுக்கு `removeAttribute('readonly')` மற்றும் `selectDateInMatCalendar` மூலம் கேலெண்டர் அசைவுகளை இயக்கி `input`, `change`, `dateInput`, `dateChange` நிகழ்வுகளை முழுமையாகத் தூண்ட வேண்டும்.
    - Radware அல்காரிதத்தைத் தவிர்க்க அனைத்து பொத்தான் கிளிக்குகளுக்கும் மனித பாணியிலான வளைந்த மவுஸ் அசைவு மற்றும் 150-250ms தாமதம் பயன்படுத்தப்பட வேண்டும்.
15. **Universal Angular Material Datepicker Reactive Cascade & Dynamic Document Dropdown Hydration Gate (தேதித் தேர்வு & தானியங்கி ஆவணப் பட்டியல் நிரப்புதல் விதி)**:
    - TNPDS போர்ட்டலில் பிறந்த தேதி (DOB) தேர்ந்தெடுக்கப்பட்ட பிறகே Angular அதன் வயதைக் கணக்கிட்டு "மற்ற ஆவணங்கள்" (`மற்ற ஆவணங்கள் *`) டிராப்டவுன் பட்டியலை (குழந்தைக்கு `பிறப்புச் சான்றிதழ்`, பெரியவருக்கு `ஆதார் அட்டை`) திரையில் ஏற்றுகிறது.
    - எனவே DOB-ஐ `selectDateInMatCalendar` + `dateInput` / `dateChange` + `Tab` அழுத்துதல் மூலம் Angular படிவத்தில் பதிவு செய்ய வேண்டும்.
    - "மற்ற ஆவணங்கள்" டிராப்டவுன் பட்டியல் ஆப்ஷன்கள் லோட் ஆகும் வரை 10-முறை காத்திருப்பு வளையம் (`Dynamic Hydration Loop`) மூலம் சரிபார்த்து, ஆவண வகையைத் துல்லியமாகத் தேர்வு செய்ய வேண்டும்.
16. **Angular Material Real Date Object Cascade & Mandatory Member Table Verification Gate (உண்மை தேதிப் பொருள் & அட்டவணை உறுதி விதி)**:
    - Angular Material `DateAdapter`-க்கு String வடிவில் தேதி அனுப்புவது `Invalid Date (NaN)` பிழையை உண்டாக்கும். எப்போதும் உண்மையான JavaScript `Date` ஆப்ஜெக்ட்டை `CustomEvent('dateInput', { detail: { value: new Date(...) } })` மூலம் அனுப்ப வேண்டும்.
    - "மற்ற ஆவணங்கள்" டிராப்டவுனை `select#supportingDocuments` / `select[formcontrolname="supportingDocuments"]` என்று நேரடியாகக் குறிப்பிட வேண்டும்; தவறான மாற்றுத்திறனாளி டிராப்டவுனை ஒருபோதும் தேர்ந்தெடுக்கக் கூடாது (`DOC_TYPE_GATE_HALT`).
    - ஆவணக் கோப்பு பதிவேற்றப்பட்டதை உறுதி செய்யாமல் அடுத்த படிக்குச் செல்லக் கூடாது (`DOC_UPLOAD_GATE_HALT`).
    - ஆரஞ்சு நிற "உறுப்பினரை சேர்க்க" பொத்தான் அழுத்தப்பட்ட பிறகு, உறுப்பினர் பெயர் (`table tbody tr`) அட்டவணையில் தோன்றிய பிறகே அடுத்த படிக்குச் செல்ல வேண்டும்; அட்டவணையில் பெயர் வராத பட்சத்தில் இறுதிச் சமர்ப்பிப்புக்கு ஒருபோதும் செல்லக் கூடாது (`ADD_MEMBER_TABLE_GATE_HALT`).
17. **Radware WAF Critical Zone Human-Biometrics Law & Zero-Anomaly Anti-Bot Cadence (மனித பாணி பயோமெட்ரிக் தட்டச்சு & மவுஸ் இயக்கம் விதி)**:
    - Radware Bot Manager WAF இயங்கும் முக்கியமான பாதுகாப்புப் பகுதிகளில் (கைபேசி எண், கேப்ட்சா, மற்றும் குறிப்பாக SMS OTP சரிபார்ப்பு):
      - எக்காரணம் கொண்டும் நிலையான வேகத்தில் (Fixed 75ms) இயந்திரத்தனமாகத் தட்டச்சு செய்யக் கூடாது.
      - ஒவ்வொரு இலக்கத்திற்கும் இடையே 120ms முதல் 280ms வரை சீரற்ற தாமதம் (Random Human Keystroke Jitter) மற்றும் மைக்ரோ இடைவெளிகள் வழங்கப்பட வேண்டும்.
      - OTP உள்ளிட்டவுடன் உடனடியாக சமர்ப்பிக்காமல், மனிதர்கள் திரையைப் பார்த்து உறுதி செய்வது போன்ற 1.0 முதல் 1.8 வினாடி மனித இடைவெளி (Pre-Submit Cognitive Pause) தரப்பட வேண்டும்.
      - பொத்தான் கிளிக்குகளுக்கு நேரடி `element.click()` (clientX: 0, clientY: 0) செய்யாமல், திரையில் மவுஸை வளைத்து நகர்த்தி (Bézier Curve Jitter) இயல்பான pointer events மூலம் அழுத்த வேண்டும்.
      - இதன் மூலம் Radware-ன் 'Velocity Anomaly' மற்றும் 'Machine-like Keystroke' விதிகளுக்கு உட்படாமல் 'I am human' சவால் தவிர்க்கப்படும்.
18. **Context-Aware Supporting Document Label-Scoping Law (துணை ஆவண லேபிள் நேரடித் தேர்வு & ஃபைல் பாதுகாப்பு விதி)**:
    - TNPDS Add Member (`/pages/service-request`) பக்கத்தில் பல `<input type="file">` உள்ளீடுகள் உள்ளன (`மாற்றுத்திறனாளியின் ஆவணம்`, `துணை ஆவணத்தைப் பதிவேற்றவும் *`, மற்றும் கீழ் மூலையிலுள்ள உரையாடல் உதவியாளர் சாட்பாட் விட்ஜெட்).
    - எக்காரணம் கொண்டும் பொதுவான `input[type="file"].last()` என்ற பலவீனமான செலக்டரைப் பயன்படுத்தக் கூடாது.
    - மாறாக `//label[contains(., "துணை ஆவண")]/following::input[@type="file"][1]` அல்லது `div:has(> label:has-text("துணை ஆவண")) input[type="file"]` என்று லேபிளோடு தொடர்புபடுத்தப்பட்ட நேரடி ஸ்கோப்பிங் மூலம் மட்டுமே துணை ஆவணக் கோப்பை இணைக்க வேண்டும்.
    - உள்ளூர் சோதனையின் போது கணினியிலுள்ள 194 KB மாதிரி ஆவணத்தை (`aadhaar_front.jpg` / `test_sample_doc.jpg`) சரியாக இணைத்து, கோப்பு இணைக்கப்பட்டதை உறுதி செய்த பிறகே உறுப்பினர் சேர்க்கை பொத்தானை அழுத்த வேண்டும்.
19. **Angular Dynamic Document Dropdown Reactive Hydration & File-Input Stabilization Law (ஆவணப் பட்டியல் தேர்வு & கோப்புப் பெட்டி நிலைப்படுத்துதல் விதி)**:
    - TNPDS Add Member (`/pages/service-request`) பக்கத்தில் "மற்ற ஆவணங்கள்" டிராப்டவுன் (`select#supportingDocuments`) தேர்ந்தெடுக்கப்பட்ட பிறகு, Angular கட்டமைப்பு அதன் அடுத்த காலமில் உள்ள கோப்பு உள்ளீட்டை (`<input type="file">`) புதிதாக ரெண்டர் செய்யவும் அன்லாக் செய்யவும் குறைந்தபட்சம் 2.0 விநாடிகள் தேவைப்படுகிறது.
    - டிராப்டவுன் தேர்வுக்குப் பிறகு அவசரமாக கோப்பை இணைக்காமல், கட்டாயமாக 2000ms Hydration Wait வழங்கி, DOM-ல் உள்ளீடு தயாரான பிறகே W3C DataTransfer & Playwright மூலம் கோப்பை இணைக்க வேண்டும்.
20. **Google Transliteration Popup Dismissal, Multi-Table Non-Strict Scanning & Reactive Form Flushing Law (கூகுள் மொழிபெயர்ப்பு பாப்-அப் நீக்கம், பல அட்டவணை ஸ்கேனிங் & படிவ நிகழ்வு உறுதி விதி)**:
    - தமிழ் பெயர் தட்டச்சு செய்யும் போது தோன்றும் Google Input Tools Transliteration மிதக்கும் பாப்-அப் திரையை மறைக்காமல் இருக்க, `Tab` அல்லது `Enter` அழுத்தி தேர்வை உறுதிசெய்து பாப்-அப்பை மூட வேண்டும்.
    - ஆரஞ்சு நிற "உறுப்பினரை சேர்க்க" பொத்தானை அழுத்தும் முன், படிவத்தின் அனைத்து புலங்களுக்கும் (`input`, `select`) Angular-ன் `input`, `change`, `blur` நிகழ்வுகளை அனுப்பி `form.valid` நிலையை உறுதி செய்ய வேண்டும்.
    - பக்கத்தில் தற்போதைய உறுப்பினர்கள் (மேல் அட்டவணை) மற்றும் புதிதாக சேர்க்கப்பட்ட உறுப்பினர்கள் (கீழ் அட்டவணை) என பல `<table>` உள்ளதால், `page.locator('table').innerText()` பயன்படுத்துவது Playwright Strict Mode பிழையை ஏற்படுத்தும். எனவே அனைத்து அட்டவணைகளையும் DOM evaluation வழியாகவும், row-level selectors (`table tr:has-text(...)`) வழியாகவும் ஸ்கேன் செய்து பெயர் இருப்பதை உறுதி செய்ய வேண்டும்.
21. **Post-Refresh Mobile Number Auto-Restoration & Radware Resilient Pre-Submit Guard Law (பக்கப் புதுப்பித்தலுக்குப் பிந்தைய கைபேசி எண் தானியங்கி மீட்டெடுப்பு & கேப்ட்சா சமர்ப்பிப்புப் பாதுகாப்பு விதி)**:
    - Radware Bot Manager "I am human" பாதுகாப்பு சவால் முடிந்ததும் அல்லது அரசு இணையதளம் ஏதேனும் காரணத்தால் லாகின் பக்கத்தை ரீலோட் (Refresh) செய்தால், ஏற்கனவே உள்ளிட்ட கைபேசி எண் முற்றிலுமாக அழிந்துவிடும் (`input[formcontrolname="mobNumber"]` காலியாகிவிடும்).
    - கேப்ட்சா குறியீட்டை AI OCR மூலம் படித்து சமர்ப்பிக்கும் முன், எக்காரணம் கொண்டும் கைபேசி எண் புலம் காலியாக இருக்கக் கூடாது (Zero-Step-Skip Pre-Submit Invariant).
    - ஒவ்வொரு கேப்ட்சா முயற்சிக்கு முன்னும் (`attempt = 1..3`), மற்றும் "பதிவு செய்ய" பொத்தானை அழுத்தும் வினாடியிலும் `ensureMobileNumberFilled()` மூலம் கைபேசி எண் 10 இலக்கங்களும் உள்ளிடப்பட்டுள்ளதா என உறுதி செய்ய வேண்டும்.
    - கைபேசி எண் விடுபட்டிருந்தால், உடனடியாக `curMobInput.fill()` மற்றும் `pressSequentially` உடன் Angular நிகழ்வுகளை (`input`, `change`, `blur`) அனுப்பி எண்ணை மீண்டும் நிரப்பிய பிறகே கேப்ட்சா சமர்ப்பிக்கப்பட வேண்டும்.
    - தளம் "தங்களது கைபேசி எண்ணை உள்ளிடவும்" என்ற பிழையைக் காட்டினால், ஆட்டோமேஷனை நிறுத்தாமல் தானாகவே கைபேசி எண்ணை மீண்டும் நிரப்பி அடுத்த முயற்சியைத் தொடர வேண்டும்.
22. **Universal Sibling OTP Verify Button Alignment & Floating Overlay Neutralization Law (உடனடி OTP சரிபார்ப்பு பொத்தான் சீரமைப்பு & மிதக்கும் சாட்பாட் நீக்க விதி)**:
    - அதிகாரப்பூர்வ தமிழ்நாடு அரசு குடும்ப அட்டை போர்ட்டலில் (`/auth/login`), OTP உள்ளிட்ட பிறகு அழுத்த வேண்டிய பட்டன் **"பதிவு செய்"** அல்லது class `subbtn` ஆகும் (வழக்கமான 'உள்நுழைக' அல்ல).
    - திரையின் கீழ் வலது மூலையில் உள்ள நீல நிற மிதக்கும் சாட்பாட் (`💬 உரையாடல் உதவியாளர்`) பதிவு செய் பொத்தானின் மீது படர்ந்து கிளிக் செய்வதைத் தடுப்பதால், பட்டனை அழுத்தும் முன் அனைத்து `position: fixed` சாட்பாட் எலிமெண்ட்டுகளையும் DOM-லிருந்து முற்றிலுமாக நீக்க வேண்டும் (`remove()`).
    - Angular Reactive Forms `FormControl` சரியான மதிப்பை ஏற்று `form.valid` ஆவதற்கு, OTP உள்ளிட்டதும் `input`, `change`, `blur` ஆகிய நிகழ்வுகள் `{ bubbles: true }` உடன் தூண்டப்பட வேண்டும்; பட்டனில் `disabled` பண்பு இருந்தால் அதையும் நீக்க வேண்டும்.
    - பட்டனின் இடது-மையப் பகுதியில் (`box.x + box.width * 0.35`) மனித பாணி மவுஸ் கிளிக் செய்து, நேரடி DOM `.click()` மற்றும் Playwright `getByRole` என மும்முறை உறுதிசெய்து உள்நுழைவு தடையின்றி முடிவடைய வேண்டும்.
23. **Supporting Document File Upload Button Trigger & Server Hydration Gate Law (துணை ஆவண 'பதிவேற்று' பொத்தான் கட்டாய இயக்கம் & சர்வர் உறுதிப்பாடு விதி)**:
    - TNPDS உறுப்பினர் சேர்க்கை படிவத்தில் (`/pages/service-request`), துணை ஆவணக் கோப்பை `input[type="file"]`-ல் தேர்வு செய்வதுடன் வேலை முடிந்துவிடாது; அதன் அருகிலேயே உள்ள **"பதிவேற்று" (Upload)** பொத்தான் கட்டாயம் அழுத்தப்பட வேண்டும்.
    - கோப்பைத் தேர்வு மட்டும் செய்துவிட்டு "பதிவேற்று" அழுத்தாமல், நேரடியாக ஆரஞ்சு நிற "உறுப்பினரை சேர்க்க" பொத்தானை அழுத்தினால், அரசு தளம் ஆவணம் பதிவேற்றப்படவில்லை என்று பிழை காட்டி உறுப்பினரை அட்டவணையில் சேர்க்காமல் நிராகரித்துவிடும்.
    - எனவே கோப்பு தேர்வு செய்யப்பட்டவுடன், அதன் அருகில் உள்ள "பதிவேற்று" / "பதிவேற்றம்" பொத்தானை Playwright locator, container-scoped selector மற்றும் DOM evaluate மூலமாக அழுத்தி, அரசு சர்வரில் கோப்பு பதிவேற்றப்பட்டு பச்சை நிற பேட்ஜ்/குறியீடு வருவதை உறுதி செய்த பிறகே அடுத்த படிக்குச் செல்ல வேண்டும்.
    - **Browser Geolocation உறுதிப்பாடு**: ஆட்டோமேஷன் தொடங்கும் போதே தமிழ்நாடு ஜியோ-லொகேஷன் (`latitude: 12.9716, longitude: 79.1586` மற்றும் `permissions: ['geolocation']`) Browser Context-ல் ஏற்கனவே முன்கூட்டியே செட் செய்யப்பட்டுள்ளது; உறுப்பினர் சேர்க்கை தடைபட்டதற்கு லொகேஷன் காரணம் அல்ல, "பதிவேற்று" பொத்தான் அழுத்தப்படாமல் இருந்ததே காரணம்.
24. **Angular Reactive Form Validity & Zero-Reaction Add Member Button Resolution Law (ஆங்குலர் படிவ முழுமை & உறுப்பினர் சேர் பட்டன் முடக்கத் தீர்வு விதி)**:
    - "கோப்பு பதிவேற்றப்பட்டது" என்று வந்த பிறகும் ஆரஞ்சு நிற "உறுப்பினரை சேர்க்க" பொத்தானை அழுத்தும்போது எந்தவித எதிர்வினையும் இல்லாததற்கு (Zero Reaction / No Action) காரணம், ஆங்குலர் படிவத்தின் (`memberForm`) உள் வேலிடேஷன் தோல்வியடைந்து `if (this.memberForm.invalid) return;` என அமைதியாக வெளியேறுவதே ஆகும்.
    - **மாற்றுத்திறனாளியா (Differently Abled) ரேடியோ பட்டன்**: போர்ட்டலில் "ஆம்", "இல்லை" ஆகிய இரண்டும் காலியாக (unchecked) இருக்கும் போது படிவம் invalid ஆகும். எனவே படி 7b-ல் கட்டாயமாக "இல்லை" (No) ரேடியோவை தேர்வு செய்ய வேண்டும்.
    - **மற்ற ஆவணங்கள் ரீசெட் ஆதல்**: பிறந்த தேதி போட்டவுடன் வயது கணக்கிடப்பட்டு ஆவண வகை பட்டியல் ரீலோட் ஆகும்போது, டிராப்டவுன் மீண்டும் "தேர்ந்தெடுக்கவும்" என காலியாகிவிடும் அபாயம் உள்ளது. பட்டன் அழுத்தும் வினாடிக்கு முன் இது மீண்டும் சரிபார்க்கப்பட்டு தேர்ந்தெடுக்கப்பட வேண்டும்.
    - **Pre-Add-Member படிவ தணிக்கை & தானியங்கி சீரமைப்பு (Pre-Audit & Auto-Healing)**: பட்டன் அழுத்தும் முன், DOM-ல் உள்ள அனைத்து `.ng-invalid` கூறுகளும் ஆய்வு செய்யப்பட்டு தானாகவே சீர் செய்யப்பட வேண்டும்; Angular Ivy Context (`__ngContext__`) வழியாக படிவ வேலிடிட்டி உறுதி செய்யப்பட வேண்டும்.
    - **4-அடுக்கு பட்டன் அழுத்தும் முறை (4-Layer Click Trigger)**: Playwright locator click, மவுஸ் மையக் கிளிக், DOM MouseEvent bubbling dispatch, மற்றும் Angular Component மெத்தட் நேரடி இயக்கம் (`comp.addMember()`) என 4 வழிகளிலும் உறுப்பினர் சேர்க்கை தடையின்றி செயல்படுத்தப்பட வேண்டும்.
    - **Browser Geolocation தெளிவுரை**: உலாவி லொகேஷன் (`permissions: ['geolocation']`, W3C Geolocation provider) ஆட்டோமேஷன் தொடக்கத்திலேயே தமிழ்நாடு ஆயத்தொலைவுகளுடன் (`12.9716, 79.1586`) இயங்குகிறது; லொகேஷன் உறுப்பினர் சேர்க்கைக்கு எவ்விதத் தடையுமல்ல.
25. **Child Member Aadhaar Bypass, Upload Control Sync & Continuous Login Guardian Law (குழந்தை உறுப்பினர் ஆதார் விலக்கு & பதிவேற்ற கட்டுப்பாட்டு ஒத்திசைவு விதி)**:
    - **குழந்தை உறுப்பினர் ஆதார் விலக்கு (Age < 5 Aadhaar Bypass)**:
      - 5 வயதுக்குட்பட்ட குழந்தைகளுக்கு ஆதார் எண் கட்டாயமில்லை; பிறப்புச் சான்றிதழ் மட்டுமே போதுமானது.
      - போர்ட்டலில் பிறந்த தேதியை இயல்பான ஸ்ட்ரிங்காக தட்டச்சு செய்யும்போது, Angular Material-ன் `@Output() (dateChange)` நிகழ்வு தூண்டப்படாமல் வயது தானாகக் கணக்கிடப்படாமல் போகிறது. இதனால் ஆங்குலர் படிவத்தில் `aadhaarNumber1/2/3` ஃபீல்டுகள் தொடர்ந்து `Validators.required` நிலையிலேயே நிற்கின்றன.
      - ஆதார் பெட்டிகள் காலியாக இருக்கும் போது படிவம் `invalid` ஆவதால், "உறுப்பினரை சேர்க்க" பொத்தான் எந்த ரியாக்ஷனும் இன்றி முடங்கிவிடும்.
      - எனவே படி 9-ல், குழந்தை உறுப்பினர்களுக்கு (`isChild: true` அல்லது வயது < 5), DOM மற்றும் Angular Ivy FormGroup-ல் உள்ள `aadhaarNumber1`, `aadhaarNumber2`, `aadhaarNumber3` புலங்களின் வேலிடேட்டர்களை முற்றிலுமாக நீக்கி (`clearValidators()`, `setErrors(null)`), `comp.age = 2` மற்றும் `comp.isChild = true` என அன்லாக் செய்ய வேண்டும்.
    - **துணை ஆவணப் பதிவேற்ற கட்டுப்பாட்டு ஒத்திசைவு (Upload Control Sync)**:
      - ஆவணம் பதிவேற்றப்பட்டவுடன் உருவாகும் பச்சை நிற பேட்ஜிலுள்ள கோப்புப் பெயரை (`doc_*.jpeg`), ஆங்குலரின் மறைமுக உள்ளீடான `<input formcontrolname="upload">` மற்றும் Ivy Form-ல் உடனடியாகப் பதிவு செய்ய வேண்டும்.
    - **தவறான கோப்பு நிறுத்தம் நீக்கம் (Zero False-Alarm Upload Halt)**:
      - Playwright native CDP `setInputFiles()` மூலம் கோப்பு இணைக்கப்பட்ட பிறகு, "பதிவேற்று" பொத்தானை அழுத்தாமல் முன்கூட்டியே `DOC_UPLOAD_GATE_HALT` தள்ளி ஆட்டோமேஷனை முடக்கும் பிழை முற்றிலுமாக களையப்பட்டு, 10 வினாடிகள் சர்வர் பேட்ஜ் உறுதி செய்யப்பட்ட பிறகே நிலைகுறிக்கப்படும்.
    - **Radware தொடர் கைபேசி எண் பாதுகாப்பு (Continuous Mobile Guardian)**:
      - "I am human" சவாலைத் தீர்த்த பிறகு பக்கம் ரீலோட் ஆனால், கைபேசி எண் காலியாவதைத் தடுக்க, காத்திருப்பு சுழற்சியின் ஒவ்வொரு வினாடியிலும் `ensureMobileNumberFilled()` தானாகவே எண்ணை நிரப்பிவிடும்.
26. **Div-Based Upload Element Polymorphism & Angular Material Datepicker Invariant Law (Div-வடிவ ஆவணப் பதிவேற்று பொத்தான் & பிறந்த தேதி வேலிடேஷன் விதி)**:
    - **Div-வடிவ பதிவேற்று பொத்தான் (Upload Button as a `<div>`)**:
      - TNPDS போர்ட்டலில் துணை ஆவணம் அருகிலுள்ள **"பதிவேற்ற"** பொத்தான் உண்மையான `<button>` டேக் அல்ல. அது Bootstrap வகுப்புகள் கொண்ட ஒரு `<div>` ஆகும்: `<div class="btn btn-primary btn-sm ms-1 ng-star-inserted"> பதிவேற்ற </div>`.
      - பழைய கோடு `<button:has-text("பதிவேற்ற")>` அல்லது `input[type="file"] ~ button` என்று மட்டுமே தேடியதால், அந்த `<div>` கண்டறியப்படாமல் விடுபட்டது.
      - எனவே பதிவேற்று தேர்வாளர்கள் எப்போதும் பல்துறை டேக்குகளை ஆதரிக்க வேண்டும்: `div.btn, div.btn-primary, button, [class*="btn"]`.
    - **Angular Material Datepicker வேலிடேஷன் பாதுகாப்பு (MatDatepicker Parsing Invariant)**:
      - பிறந்த தேதி உள்ளீட்டுப் பெட்டியில் (`input#mat-input-0`) செயற்கையான `input` அல்லது `change` நிகழ்வுகளை `"15/06/2023"` போன்ற டெக்ஸ்டாக அனுப்பினால், ஆங்குலரின் `MatDatepickerInput` அதை `Date.parse()` செய்ய முயன்று தோல்வியடைந்து (`NaN`), ஒட்டுமொத்தப் படிவத்தையும் `ng-invalid` நிலைக்கு மாற்றிவிடுகிறது.
      - காலண்டர் கிரிட் மூலம் தேதியைத் தேர்ந்தெடுத்த பிறகு, தேவையற்ற செயற்கை டெக்ஸ்ட் இவன்ட்டுகளை அனுப்பாமல் அதன் இயல்பான வேலிடிட்டியைப் பாதுகாக்க வேண்டும்.
    - **Zero-Reaction சேர்க்கை பட்டன் ரகசியம் (Why Zero Reaction on 'உறுப்பினரை சேர்க்க')**:
      - ஆங்குலரின் `(ngSubmit)="addMember()"` மெத்தடில் `if (this.memberForm.invalid) return;` என்ற வரி உள்ளது.
      - ஆவணம் `<div>` கிளிக் ஆகாமல் சர்வர் டோக்கன் வராததாலும், மற்றும் பிறந்த தேதி தவறான பார்சிங் காரணமாக `ng-invalid` ஆனதாலும், பொத்தான் அழுத்தப்படும் போது ஆங்குலர் அமைதியாக வெளியேறியது.
      - பயனர் மேனுவலாக குரோமில் பதிவேற்ற `<div>`-ஐக் கிளிக் செய்து ஆவணம் பச்சை பேட்ஜ் பெற்று, படிவம் `ng-valid` ஆனதால், மேனுவல் கிளிக்கில் உடனே உறுப்பினர் சேர்க்கப்பட்டு அட்டவணையில் தோன்றினார்!
      - இப்போது ஆட்டோமேஷனில் `div.btn` கிளிக் மற்றும் Datepicker வேலிடிட்டி முழுமையாக சரிசெய்யப்பட்டு நிரந்தரமாகப் பூட்டப்பட்டுள்ளது.
27. **Post-Radware Refresh Zero-Empty-Captcha Invariant & Single-Window Chrome User-Data-Dir Law (புதுப்பித்தலுக்குப் பிந்தைய கேப்ட்சா உறுதிப்பாடு & ஒற்றை குரோம் சாளர விதி)**:
    - **கேப்ட்சா இல்லாமல் பொத்தான் அழுத்துதல் தடை (Zero-Empty-Captcha Invariant)**:
      - Radware மனித சரிபார்ப்பு முடிந்தவுடன் அரசு இணையதளம் தானாகப் புதுப்பிக்கப்பட்டு (Refresh) மீண்டும் லாகின் பக்கத்திற்கு வரும் போது, புதிய கேப்ட்சா படம் திரையில் தோன்றும்.
      - கேப்ட்சா பெட்டியில் குறைந்தபட்சம் 4 எழுத்துக்கள் நிரப்பப்பட்டுள்ளதை (`finalCapVal.length >= 4`) உறுதி செய்யாமல், ஒருபோதும் "பதிவு செய்ய" பொத்தானை அழுத்தக் கூடாது (`reSendBtn.click()`).
      - கேப்ட்சா காலியாக இருக்கும் போது பொத்தானை அழுத்தினால், போர்ட்டல் சிவப்பு நிறத்தில் **'கேப்ட்சா தேவை.'** என்ற பிழையைக் காட்டி OTP அனுப்பாமல் முடக்கிவிடும்.
      - AI OCR தானாகப் படிக்க முடியாத பட்சத்தில், ஆப்ரேட்டருக்குத் திரையில் பச்சைக் கட்டமிட்டுக் காட்டி, பயனர் கேப்ட்சாவை உள்ளிட்ட பிறகே தொடர வேண்டும்.
    - **உண்மையான OTP பெட்டி தோன்றும் வரை அறிவிப்புத் தடை (Verified OTP Arrival Gate)**:
      - DOM-ல் உண்மையில் `input[formcontrolname="otp"]` தோன்றாத வரை, முன்கூட்டியே "OTP அனுப்பப்பட்டுள்ளது" என அறிவிக்கவோ அல்லது பயனரிடம் OTP கேட்கவோ கூடாது.
    - **OTP சமர்ப்பிப்பில் செயற்கை இவன்ட்கள் நீக்கம் (Synthetic Event Anomaly Prevention)**:
      - `submitOtpOnPortal`-ல் `pressSequentially` மூலம் நம்பகமான விசைப்பலகை நிகழ்வுகள் (`isTrusted: true`) அனுப்பப்பட்ட பிறகு, தேவையற்ற செயற்கை `evaluate` நிகழ்வுகள் அனுப்பப்படுவதைத் தவிர்த்து Radware Anomaly தூண்டப்படாமல் தடுக்க வேண்டும்.
    - **ஒற்றை குரோம் சாளரம் (`--user-data-dir`)**:
      - பயனர் கணினியில் ஏற்கனவே குரோம் திறந்திருந்தாலும், தனி போர்ட்டுடன் ஒற்றை சாளரமாக இயங்க `run.bat`-ல் `--user-data-dir="%~dp0data\tnpds_chrome_profile"` இணைக்கப்பட்டுள்ளது; ஆட்டோமேஷன் அதே சாளரத்தில் புதிய டேப்பாக இணைந்து இயங்கும்.
28. **TNPDS Concurrent Session Conflict Modal Auto-Confirmation & Backdrop Clearance Law (அரசு அமர்வு மோதல் சாளர தானியங்கி ஏற்பு & கறுப்புத் திரை நீக்க விதி)**:
    - **அமர்வு மோதல் சாளரம் ('நீங்கள் வெளியேற விரும்புகிறீர்களா?')**:
      - ஒரே கைபேசி எண்ணில் அடுத்தடுத்து உள்நுழையும் போது அல்லது முந்தைய அமர்வு காலாவதியாகாத போது, TNPDS போர்ட்டல் 'நீங்கள் வெளியேற விரும்புகிறீர்களா?' என்ற மாடல் சாளரத்தைத் திறக்கும்.
      - இந்த சாளரத்தில் 'ஆம்' (Yes) அல்லது 'சரி' (OK) பொத்தானை அழுத்தாமல் விட்டால், போர்ட்டல் லாகின் ஆகாமல் கறுப்பு/மங்கலான திரையுடன் (`.modal-backdrop`) முடங்கி, 90 விநாடிகளுக்குப் பிறகு `TNPDS_LOGIN_GATE_HALT` பிழையை உருவாக்கும்.
      - `dismissSessionConflictOrAlertModals` மூலம் இச்சாளரம் கண்டறியப்பட்டு, உடனடியாக 'ஆம்' பொத்தான் தானாக அழுத்தப்பட்டு, முந்தைய அமர்வு நீக்கப்பட்டு புதிய லாகின் தடையின்றித் தொடரச் செய்யப்படுகிறது.
    - **தேவையற்ற பேக்-டிராப் நீக்கம் (Stuck Modal Backdrop Cleanup)**:
      - சாளரம் மூடப்பட்ட பிறகும் திரை கறுப்பாகவோ அல்லது கிளிக் செய்ய முடியாதவாறு நிற்பதைத் தடுக்க, `.modal-backdrop`, `.swal2-backdrop` உறுப்புகள் தானாக அகற்றப்பட்டு, பாடி டேக்கின் `modal-open` கிளாஸ் விடுவிக்கப்படுகிறது.
    - **நேரடி ரூட்டிங் வழிசெலுத்தல் (Proactive Direct Route Transition)**:
      - அமர்வு உறுதிப்படுத்தப்பட்ட பிறகு தளம் தானாக ரீடைரக்ட் ஆகத் தாமதமானால், போர்ட்டல் `/pages/service-request` முகவரிக்கு நேரடியாக அழைத்துச் செல்லப்பட்டு உறுப்பினர் சேர்க்கைப் படிவம் உடனடியாகத் திறக்கப்படுகிறது.
29. **Document Upload Confirmation Polling Scope Integrity & Multi-Layer "உறுப்பினரை சேர்க்க" Trigger Law (ஆவணப் பதிவேற்ற உறுதிப்படுத்தல் & பல அடுக்கு உறுப்பினர் சேர்க்கை தூண்டல் விதி)**:
    - **ஆவண உறுதிப்படுத்தல் ஸ்கோப் ஒருமைப்பாடு (Scope Integrity Law)**:
      - `startTnpdsAddMemberFlow` ஃபங்ஷனுக்குள் `scanAndBroadcastToasts` முழுமையாக வரையறுக்கப்பட்டு (`in-scope`), ஆவணப் பதிவேற்ற லூப்பில் (`uWait % 4 === 0`) பாதுகாப்பாக இயக்கப்படுகிறது; இதனால் `ReferenceError: scanAndBroadcastToasts is not defined` பிழை தடுக்கப்பட்டு படி 8 முடக்கம் முற்றிலும் ஒழிக்கப்படுகிறது.
    - **படிவ முன்-தணிக்கை மாறிகள் பாதுகாப்பு (Form Pre-Audit Invariant)**:
      - `page.evaluate`-ல் `auditLog`, `invalidDetails` போன்ற அனைத்து மாறிகளும் முறையாக அறிவிக்கப்பட்டு, Angular Ivy `memberForm` மற்றும் `dateOfBirth` (JavaScript `Date` ஆப்ஜெக்ட் ஆதரவு) எந்தத் தடையுமின்றிச் சீரமைக்கப்படுகிறது.
    - **பல அடுக்கு 'உறுப்பினரை சேர்க்க' பொத்தான் தூண்டல் (Bulletproof Multi-Layer Trigger)**:
      - `<button>`, `<a class="btn">`, `<div class="btn">`, `button.btn-warning`, `button.btn-orange` என அனைத்து செலக்டர்களிலும் 'உறுப்பினரை சேர்க்க' பொத்தான் கண்டறியப்பட்டு, `disabled` நீக்கப்பட்டு, Playwright மவுஸ் கிளிக், DOM நிகழ்வுகள், மற்றும் Angular Ivy காம்பொனென்ட் நேரடி மெத்தட் அழைப்பு (`addMember`, `saveMember`) மூலம் உறுதியாக அழுத்தப்படுகிறது.
      - அட்டவணை வரிசையில் பெயர் தோன்றும் வரை 15 வினாடிகள் தொடர் சரிபார்ப்பு மற்றும் தானியங்கி மீள்-கிளிக் (Automatic Retry Re-Click) உறுதி செய்யப்படுகிறது.
30. **Natural Human Kinetics & Trusted Native Event Integrity Law (இயற்கை மனித மவுஸ் இயக்கவியல் & நம்பகமான உள்ளீட்டு விதி)**:
    - **மவுஸ் இயக்கவியலின் கியூபிக் பெசியர் வளைவு (Cubic Bezier Trajectories & Micro-Jitters)**:
      - ஒரு பொத்தானையோ அல்லது உள்ளீட்டுக் கட்டத்தையோ கிளிக் செய்வதற்கு முன், மவுஸ் கர்சர் திரையில் உடனடி டெலிபோர்ட்டேஷன் (Instant Teleportation) ஆகாமல், உண்மையான மனித கையின் அசைவு போன்ற கியூபிக் பெசியர் வளைவுப் பாதையில் (`generateHumanTrajectory`), கை நடுக்க நுண்-அசைவுகளுடன் (`micro-jitters`), மற்றும் ஃபிட்ஸ் விதிக்கு ஏற்ப (`Fitts's Law Easing`: நடுவில் வேகம், இலக்கை நெருங்கும் போது மெதுவான வேகம்) நகர்த்தப்படுகிறது (`humanMouseMove`).
    - **நம்பகமான உள்ளீட்டு நிகழ்வுகள் (Trusted Native Events vs Synthetic Dispatches)**:
      - Radware / Perfdrive பாட் தடுப்பு அமைப்புகள் `event.isTrusted` மதிப்பைக் கண்காணிக்கின்றன. `curMobInput.dispatchEvent('input')` போன்ற செயற்கை DOM நிகழ்வுகள் `isTrusted: false` என அமைவதால் Radware பாட் சவாலைத் தூண்டும். எனவே Playwright-ன் பூர்வீக விசைப்பலகை இயக்கி (`pressSequentially`, `keyboard.press`) மூலம் மட்டுமே உண்மையான நிகழ்வுகள் (`isTrusted: true`) அனுப்பப்படுகின்றன.
    - **இயற்கையான விசைப்பலகை அழித்தல் & தட்டச்சு முறை (Authentic Typing & Glance Delays)**:
      - 0ms-ல் மதிப்பை அழிக்கும் `.fill('')` முறைக்கு பதிலாக, மனிதனைப் போல `Control+A` + `Backspace` மூலம் கட்டம் காலியாக்கப்படுகிறது (`humanClearInput`).
      - கேப்ட்சா மற்றும் OTP எண்களைத் தட்டச்சு செய்யும் போது (`humanType`), 80ms - 170ms மனித தாமதமும், குறிப்பாக 6 இலக்க OTP தட்டச்சு செய்யும் போது 3-வது இலக்கத்திற்குப் பின் ஆபரேட்டர் மொபைலைப் பார்த்து அடுத்த 3 இலக்கங்களை அடிக்கும் இயற்கை இடைவேளையும் (320ms - 520ms) கடைப்பிடிக்கப்பட்டு Radware முடக்கம் முற்றிலும் தவிர்க்கப்படுகிறது.

31. **Strict Modal Container Scoping & OTP-Phase Anti-Flood Invariant Law (கட்டாய மோடல் கொள்கலன் எல்லைப்படுத்தல் & OTP கட்ட வெள்ளத் தடுப்பு விதி)**:
    - **மோடல் கொள்கலன் எல்லைப்படுத்தல் (Strict Modal Container Scoping)**:
      - `dismissSessionConflictOrAlertModals` செயல்பாடு இயங்கும் போது, `document.body.innerText` முழுவதையும் ஸ்கேன் செய்யக் கூடாது. TNPDS தளத்தில் மறைக்கப்பட்ட மோடல் டெம்ப்ளேட்களில் ("நீங்கள் வெளியேற விரும்புகிறீர்களா?") போன்ற வாசகங்கள் ஏற்கனவே இருக்கும்.
      - எனவே, உண்மையில் திரையில் தோன்றித் தெரியும் மோடல் கொள்கலன் (`.modal.show`, `.modal[style*="block"]`, `.swal2-container`, `div[role="dialog"]`) உள்ளதா என முதலில் சோதித்து (`offsetWidth > 0`), அந்த மோடல் கொள்கலனுக்குள் மட்டுமே உரை மற்றும் பொத்தான்களைத் தேட வேண்டும்.
      - எந்த ஒரு காரணத்திற்காகவும் பக்கத்தில் உள்ள பொதுவான பொத்தான்களை (`button`, `a.btn`, `input[type="button"]`) ஸ்கேன் செய்து `btn-success` என்ற காரணத்திற்காக லாகின் கார்டில் உள்ள `btnSendOtp` பொத்தானைக் கிளிக் செய்துவிடக் கூடாது.
    - **OTP கட்டத்தில் கைபேசி எண் மறு-உள்ளீட்டுத் தடுப்பு (No Mobile Refill During Active OTP)**:
      - போர்ட்டலில் OTP உள்ளீட்டுக் கட்டம் (`input[formcontrolname="otp"], #otp`) திரையில் வந்துவிட்டால், கைபேசி எண் ஏற்கனவே ஏற்கப்பட்டுவிட்டது என்று பொருள்.
      - OTP பெட்டி இருக்கும் போது `ensureMobileNumberFilled()` மீண்டும் இயக்கப்படக் கூடாது. கைபேசி எண் 10 இலக்க இயல்பாக்கம் (`normCur.slice(-10) === normTarget.slice(-10)`) செய்யப்பட்டு, முடக்கப்பட்ட (`isDisabled`) நிலையில் இருந்தால் மீண்டும் தட்டச்சு செய்து ஃபோகஸைத் திருடுவதோ அல்லது ஏங்குலர் ஃபார்ம் நிலையை அழிப்பதோ முற்றிலுமாகத் தடுக்கப்படுகிறது.
      - போர்ட்டலில் பயனர் உள்ளிட்ட OTP பாதுகாப்பு & குருட்டு என்டர் தடை (Preserve User-Typed OTP & Zero Blind Enter):
        - ஆபரேட்டர் நிஜக் குரோம் திரையிலேயே OTP அடித்துவிட்டால் (`curVal === targetClean`), `humanType` மீண்டும் இயக்கப்பட்டு உள்ளீடு அழிக்கப்படக் கூடாது (`skipping redundant re-type`).
        - லாகின் ஃபார்மில் பொத்தான் கிடைக்கவில்லை என்பதற்காக ஒருபோதும் `otpInput.press('Enter')` இயக்கக் கூடாது; ஏனெனில் HTML படிவங்களில் என்டர் அழுத்தினால் இயல்புநிலையாக முதல் சமர்ப்பிப்பு பொத்தானான `#btnSendOtp` (மீண்டும் OTP அனுப்பு) அழுத்தப்பட்டு ராட்வேர் வெள்ளத் தடுப்பு ("I am human") தூண்டப்பட்டுவிடும்.

32. **Leaf-Node Document Badge Scoping & Webpage DOM Dumping Defense Law (ஆவணப் பேட்ஜ் இலை-நோட் தேடல் & இணையதள உரை கசிவுத் தடுப்பு விதி)**:
    - **பரந்த கொள்கலன் உறுப்புகள் தடை (Zero Broad Ancestor Queries in Badge Detection)**:
      - ஆவணம் பதிவேற்றப்பட்டதை உறுதி செய்யும் போது (`isDocAlreadyUploaded` மற்றும் `checkRes`), DOM-ல் `div`, `section`, `form`, `swal2-content`, அல்லது `main` போன்ற பரந்த கொள்கலன் (Container/Ancestor) உறுப்புகளைத் தேடக் கூடாது.
      - ஏனெனில், கொள்கலன் `<div>`-க்குள் ஏதேனும் ஒரு இடத்தில் `.jpeg` என்ற சிறிய வார்த்தை இருந்தாலும், அந்த `<div>`-ன் `innerText` என்பது பக்கத்தின் உச்சி முதல் பாதம் வரையிலான அனைத்து உரையையும் (வாடிக்கையாளர் உதவி எண்கள் `1967 (அ) 1800-425-5901`, மெனுக்கள், உரையாடல் உதவியாளர்) தன்னுள் கொண்டிருக்கும்.
      - இந்த உரை `uploadedBadgeText`-ல் சேமிக்கப்பட்டு சாட் இன்டர்ஃபேஸில் `✅ [துணை ஆவணம்] கோப்பு (...)` என்று அனுப்பப்பட்டதால், பயனர் திரையில் தேவையற்ற முழு இணையதள உரையும் கொட்டப்பட்டது.
    - **இலை-நோட்கள் மற்றும் நீள வரம்பு மட்டுமே அனுமதி (Leaf Nodes & Length < 80 Enforcement)**:
      - பேட்ஜ் தேடல் எப்போதும் இலை உறுப்புகளில் (`span, label, p, b, strong, a, .badge`) மட்டுமே நடத்தப்பட வேண்டும்.
      - மேலும் உறுப்பின் உரை நீளம் கட்டாயம் 80 எழுத்துகளுக்குள் (`t.length < 80`) இருக்க வேண்டும்.
    - **கோப்புப் பெயர் மட்டுமே பிரித்தெடுத்தல் & சாட் தகவல் வரம்பு (Filename Regex Extraction & Capped Display)**:
      - DOM உறுப்பிலிருந்து நேரடி உரையை அப்படியே எடுக்காமல், ரெஜெக்ஸ் (`match(/[\w.-]+\.(?:jpeg|jpg|png|pdf)/i)?.[0]`) மூலம் தூய கோப்புப் பெயரை மட்டுமே பிரிக்க வேண்டும்.
      - சாட் மற்றும் HUD அறிவிப்புகளில் காண்பிக்கப்படும் பெயர் 60 எழுத்துகளுக்குள் (`cleanDisplayBadge.length < 60`) சுருக்கப்பட்டு, சாட் திரையில் தேவையற்ற குப்பைகள் இன்றி `✅ [துணை ஆவணம்] கோப்பு (doc_...jpeg) TNPDS சர்வரில் வெற்றிகரமாக பதிவேற்றப்பட்டு பச்சைக் குறியீடு உறுதியானது!` என்று மட்டுமே மிகச் சுருக்கமாக, நேர்த்தியாகத் தெரிய வேண்டும்.

33. **Universal Radware Multi-Stage Anti-Bot Defense & Post-Refresh Seamless Resumption Law (அரசு ராட்வேர் பாட் தடுப்பு & தளம் புதுப்பித்தல் தானியங்கி தொடர்ச்சி விதி)**:
    - **Radware Anomaly தூண்டப்படுவதற்கான 6 முக்கியக் காரணங்கள் (Root Causes)**:
      1. *இயற்கைக்கு மாறான 0ms தட்டச்சு*: விசைப்பலகை தாமதமின்றி 0ms-ல் மதிப்புகள் நிரப்பப்படுவது அல்லது `dispatchEvent('input')` போன்ற செயற்கை DOM நிகழ்வுகளை அழைப்பது (`event.isTrusted === false`).
      2. *டெலிபோர்ட்டேஷன் மவுஸ் அசைவுகள்*: கர்சர் நகராமல் நேரடியாக குறிப்பிட்ட ஆயத்தொலைவுகளில் கிளிக் செய்யப்படுவது.
      3. *உலாவி மாறிகள் சேதப்படுத்துதல்*: `navigator.plugins = [1, 2, 3]` அல்லது `window.chrome = { runtime: {} }` அல்லது காலாவதியான பழைய Chrome User-Agent மாற்றங்கள்.
      4. *சவால் பக்க சுழற்சி கிளிக்குகள்*: `validate.perfdrive.com` திரையில் இருக்கும்போது `scrollIntoView` அல்லது தொடர் கிளிக்குகள் பக்கத்தை அதிரச் செய்வது.
      5. *மோடல் தவறால் பொத்தான் வெள்ளம்*: தவறான மோடல் தேடலால் `#btnSendOtp` பொத்தான் விநாடிக்கு ஒருமுறை மீண்டும் மீண்டும் அழுத்தப்படுவது.
      6. *வெற்று கேப்ட்சா சமர்ப்பிப்பு*: கேப்ட்சா 4 எழுத்துகளுக்குக் குறைவாக இருக்கும்போது சப்மிட் பட்டனை அழுத்துவது.
    - **நிரந்தரப் பாதுகாப்பு & மறுதொடக்கம் விதிகள் (Mandatory Invariants for All Automations)**:
      - **Human Kinetics**: கியூபிக் பெசியர் மவுஸ் வளைவு (`humanMouseMove`), 80ms-170ms விசைப்பலகை இடைவெளி (`humanType`), மற்றும் OTP தட்டச்சின் போது 3-வது இலக்கத்திற்குப் பின் 350ms-500ms கைபேசித் திரைப் பார்வை இடைவெளி (`phone glance pause`).
      - **Pure Native Chrome**: போலி பிளக்-இன்கள் அல்லது போலி `window.chrome` எதுவும் இருக்கக் கூடாது; `navigator.webdriver = undefined` மட்டுமே.
      - **Zero Empty Captcha**: கேப்ட்சா புலம் 4+ எழுத்துகள் உள்ளதை உறுதி செய்யாமல் சப்மிட் பட்டனை ஒருபோதும் அழுத்தக் கூடாது.
      - **Post-Challenge Refresh Seamless Resumption**: Radware சவால் முடிந்தவுடன் அரசு தளம் `/auth/login` பக்கத்தை ரீலோட் செய்தால், ஆட்டோமேஷனை நிறுத்தாமல் (`TNPDS_LOGIN_GATE_HALT` தடுத்து):
        - அழிந்த கைபேசி எண்ணைத் தானாக மீண்டும் நிரப்புதல்.
        - புதிய கேப்ட்சா குறியீட்டை AI OCR அல்லது ஆப்ரேட்டர் மூலம் பெற்று, கேப்ட்சா 4+ எழுத்துகள் உள்ளதை உறுதி செய்து பின்னரே சப்மிட் செய்தல்.
        - ஏற்கெனவே பெறப்பட்ட OTP நினைவகத்தில் இருந்தால் (`cachedUserOtp`) அதை மனித பாணியில் தட்டச்சு செய்து உள்நுழைவைத் தடையின்றித் தொடர்தல்.

34. **Universal Angular Material Datepicker Reactive Cascade & Form Validity Preservation Law (ஆங்குலர் மெட்டீரியல் நாள்காட்டி & படிவ உண்மைத்தன்மை பாதுகாப்பு விதி)**:
    - **Datepicker படிவத்தை முடக்குவதற்கான காரணங்கள் (Root Causes)**:
      - TNPDS உறுப்பினர் சேர்க்கை படிவத்தில் பிறந்த தேதி உள்ளீட்டுக் களம் (`#mat-input-0` அல்லது `input[formcontrolname="dob"]`) Angular Material-ன் `MatDatepickerInput` உடன் இணைக்கப்பட்டுள்ளது.
      - வழக்கமான Playwright முறையில் `input.value = '15/06/1990'` என நேரடி ஸ்ட்ரிங் அடித்தாலோ அல்லது `dispatchEvent(new Event('input'))` அனுப்பினாலோ, Angular-ன் உள் தேதிக் கணக்கீட்டு பொறிமுறை (`DateAdapter.parse`) அந்த ஸ்ட்ரிங்கை அங்கீகரிக்காமல் `NaN` எனப் பதிவுசெய்கிறது.
      - இதனால் `memberForm` படிவம் உள்நிலையில் **`status: 'INVALID'`** நிலைக்குச் சென்றுவிடுகிறது.
      - Angular Reactive Form-ல் ஒரு புலம் `INVALID` ஆக இருக்கும் போது, `comp.addMember()` அல்லது சமர்ப்பிக்கும் பட்டன் (`button:has-text("உறுப்பினரை சேர்க்க")`) கிளிக் செய்யப்பட்டாலும் எந்தவித பிழைச் செய்தியுமின்றி சத்தமில்லாமல் செயல்முறையை ரத்து செய்துவிடும் (Silent Button Abort).
      - மேலும் 5 வயதுக்குட்பட்ட குழந்தைக்கு ஆதார் கட்டாயமில்லை என்றாலும், அரசு படிவம் துவங்கும் போது ஆதார் புலங்களில் `Validators.required` வைத்திருக்கும். பிறந்த தேதியை உள்ளிட்ட பிறகு அந்த வேலிடேட்டர்களைக் களையவில்லை என்றால், குழந்தையின் விவரங்கள் சரியாக இருந்தும் படிவம் `INVALID` ஆகவே நிற்கும்.
    - **நிரந்தரப் பாதுகாப்பு விதிகள் (Mandatory Invariants for All Automations)**:
      - பிறந்த தேதியை அமைக்க Angular Material நாள்காட்டி கட்டத்தை (`mat-calendar-body-cell`) மவுஸ் மூலம் கிளிக் செய்து தேர்ந்தெடுத்தல் அல்லது Angular Component Control-ல் உண்மையான ஜாவாஸ்கிரிப்ட் `Date` பொருளை (`new Date(year, month, day)`) `setValue()` மூலம் செலுத்துதல்.
      - சாதாரண டெக்ஸ்ட் ஈவெண்ட்டுகளுக்குப் பதிலாக Angular Datepicker எதிர்பார்க்கும் அதிகாரப்பூர்வ `dateInput` மற்றும் `dateChange` நிகழ்வுகளை மட்டுமே அனுப்புதல்.
      - சமர்ப்பிக்கும் பொத்தானை அழுத்துவதற்கு முன், `memberForm.invalid === false` மற்றும் `invalidCount === 0` என்பதை DOM-ல் முழுமையாக உறுதி செய்த பின்னரே `comp.addMember()` தூண்டப்பட வேண்டும்.
      - குழந்தை சேர்க்கையின் போது (`isChild: true`), `aadhaarNumber1/2/3` கட்டுப்பாடுகளில் உள்ள `Validators.required` மற்றும் `errors` முழுமையாக அழிக்கப்பட்டு `updateValueAndValidity()` இயக்கப்பட வேண்டும்.

35. **TNPDS Add Member Aadhaar OTP Modal & Anti-Duplicate Re-Click Law (உறுப்பினர் சேர்க்கை ஆதார் OTP சாளரம் & இரட்டை கிளிக் பிழை தடுப்பு விதி)**:
    - **ஆதார் OTP சாளரம் திறக்கப்படுவதற்கான சூழல் (Aadhaar OTP Modal Trigger)**:
      - குடும்ப அட்டை உறுப்பினர் சேர்க்கையில் 5 வயதுக்கு மேற்பட்ட பெரியவர்கள் அல்லது ஆதார் எண் இணைக்கப்படும் போது, "உறுப்பினரை சேர்க்க" பொத்தானை அழுத்தியவுடன் TNPDS போர்ட்டல் உடனடியாக உறுப்பினரை அட்டவணையில் சேர்க்காது.
      - மாறாக, அந்த நபரின் ஆதார் இணைக்கப்பட்ட கைபேசி எண்ணிற்கு 6-இலக்க அரசு SMS OTP அனுப்பப்பட்டு, திரையில் **`OTP சரிபார்ப்பு`** (300 விநாடிகள் கவுண்ட்டவுன்) என்ற மாடல் சாளரம் திறக்கும்.
    - **இரட்டை வழி கேட்பு (Dual-Listener OTP Architecture)**:
      - ஆட்டோமேஷன் `requestOtpFromUser(..., 'aadhaar_otp')` வழியாக சாட் திரையில் ஆப்ரேட்டரிடம் ஆதார் OTP-ஐக் கேட்கும்.
      - ஆப்ரேட்டர் சாட்டில் OTP தட்டச்சு செய்தாலும் சரி, அல்லது குரோம் திரையில் உள்ள மாடல் சாளரத்திலேயே (`input[placeholder*="ஒருமுறை"]`) நேரடியாக அடித்தாலும் சரி, சிஸ்டம் உடனடியாக ஏற்றுக்கொண்டு தானாக "சமர்ப்பிக்கவும்" பொத்தானை அழுத்தி சரிபார்க்கும்.
      - Mock / லோக்கல் சோதனையில் மாதிரி OTP (123456) தானாக நிரப்பப்பட்டுச் சமர்ப்பிக்கப்படும்.
    - **இரட்டை கிளிக் பிழை தடுப்பு (Anti-Duplicate Re-Click Invariant)**:
      - உறுப்பினர் சேர்க்கை பொத்தான் அழுத்திய பின், அட்டவணை தணிக்கை லூப் இயங்கும் போது ஏதேனும் மோடல் சாளரம் திறந்திருந்தாலோ அல்லது ஆதார் OTP சவால் நடந்துகொண்டிருந்தாலோ (`!isAadhaarOtpModalVisible && !isAnyModalOpen`), 'உறுப்பினரை சேர்க்க' பொத்தானை மீண்டும் கிளிக் செய்யவே கூடாது.
      - அவ்வாறு கிளிக் செய்தால் போர்ட்டலில் ஒரே கோரிக்கை இரண்டு முறை அனுப்பப்பட்டு "உறுப்பினரை சேர்க்க முடியவில்லை" என்ற பிழையைத் தூண்டும்.
    - **மோடல் உரையை பிழையாகக் கருதாமல் தடுத்தல் (Modal Text Alert Filter)**:
      - `portalAlertMsg` பிழைத் தேடலில், ஆதார் OTP மாடலின் அறிவுரைகள் ("300 விநாடிகளுக்குள் OTP", "OTP சரிபார்ப்பு") போர்ட்டல் பிழையாகக் கருதப்பட்டு ஆட்டோமேஷன் அவசரமாக நிறுத்தப்படாமல் (`ADD_MEMBER_TABLE_GATE_HALT`) முழுமையாக வடிகட்டப்பட வேண்டும்.

36. **Strict Anti-Duplicate OTP-Send & Dual-Listener Anti-Collision Law (மீள்-OTP அனுப்புதல் தடுப்பு & இரட்டை கிளிக் மோதல் தடுப்பு விதி)**:
    - **லாகினில் மட்டும் Radware பிடிப்பதற்கான 3 ஆணிவேர்க் காரணங்கள் (Root Causes Analysis)**:
      1. *அரசு தளத்தின் பாதுகாப்பு எல்லை*: TNPDS தளம் மற்ற பக்கங்களை விட `/auth/login` பக்கத்தில் மட்டுமே SMS OTP உருவாக்கத்தை கண்காணிக்க மிகக் கடுமையான Radware Bot Manager விதிகளை வைத்துள்ளது.
      2. *Send OTP பொத்தான் தவறுதலாக 2-வது முறை அழுத்தப்படுவது ("two time otp send button press")*:
         - OTP வந்த பிறகு, அதனை சரிபார்க்கும் பொத்தானை (`submitOtpOnPortal`) தேடும் போது, `button.subbtn:visible` அல்லது `button:has-text("பதிவு செய்")` ஆகிய செலக்டர்கள் உண்மையான Verify பட்டனுக்குப் பதிலாக லாகின் படிவத்தின் முதல் பொத்தானான `#btnSendOtp` ("பதிவு செய்ய") பொத்தானைத் தேர்வு செய்துவிட்டன.
         - பழைய கோடில் `!isSubBtn && (btnId === 'btnSendOtp')` என்ற நிபந்தனை இருந்ததால், `#btnSendOtp`-ல் `subbtn` கிளாஸ் இருந்தால் அது விலக்கப்படாமல் தவறாக அழுத்தப்பட்டது.
         - சில வினாடிகளுக்குள் மீண்டும் `#btnSendOtp` அழுத்தப்பட்டதால், TNPDS சர்வரில் "SMS வெள்ளத் தாக்குதல்" (SMS Flood Anomaly) என Radware உடனடியாக "I am human" சவாலைத் தூண்டியது.
      3. *ஒரே நேரத்தில் இரண்டு பட்டன்கள் கிளிக் ஆவது ("ore tome vera yaethu two button clik")*:
         - ஆப்ரேட்டர் குரோம் திரையில் 6 இலக்கங்களை அடித்துவிட்டு மவுஸால் 'சரிபார்' பட்டனை கிளிக் செய்ய முனையும் அதே மில்லி விநாடியில், Channel 2 உடனடியாக OTP-யை எடுத்து ஆட்டோமேஷன் மூலம் `#btnSendOtp`-ஐ அழுத்தியது. இதனால் திரையில் ஒரே நேரத்தில் இரண்டு பொத்தான்கள் அழுத்தப்பட்டன.
    - **நிரந்தரப் பாதுகாப்பு விதிமுறைகள் (Mandatory Invariants for All Automations)**:
      1. *#btnSendOtp நிபந்தனையற்ற முழுமையான தடை & subbtn உண்மைத் தேர்வு*:
         - OTP-யை சரிபார்க்கும் போது (`submitOtpOnPortal` & `govt_automation_core.js`), `id === 'btnSendOtp'`, `id.includes('sendotp')`, `id.includes('resend')`, மற்றும் `மறுமுறை`, `மீண்டும்` உள்ள எந்தவொரு பொத்தானும் ஒருபோதும் அழுத்தப்படக் கூடாது.
         - ஆனால் போர்ட்டலில் உண்மையான Verify பொத்தானும் தமிழில் `பதிவு செய்ய` என்றே பெயரிடப்பட்டுள்ளதால், `button.subbtn` அல்லது OTP களத்தின் நேரடி உடன்பிறப்பு (`input[formcontrolname="otp"] ~ button`) பொத்தான்கள் `!isSubBtn` விதியால் முழுமையாக அனுமதிக்கப்பட வேண்டும்.
      2. *அவுட்டர் ஸ்கோப் OTP மாறி பாதுகாப்பு (Outer-Scope otpVal Declaration)*:
         - `startTnpdsAddMemberFlow` மற்றும் அனைத்து அரசு ஆட்டோமேஷன் லூப்புகளிலும் `let otpVal = '';` தொடக்கத்திலேயே ஃபங்ஷன் ஸ்கோப்பில் அறிவிக்கப்பட்டு, `ReferenceError: otpVal is not defined` பிழை ஏற்படுவது நிரந்தரமாகத் தடுக்கப்பட வேண்டும்.
      3. *அனைத்து பட்டன் தேர்வாளர்களையும் வரிசையாக சோதித்தல் (Candidate Loop nth(bIdx))*:
         - `.first()` என்று கண்மூடித்தனமாக முதல் பொத்தானை எடுக்காமல், பொருந்தும் அனைத்து பட்டன்களையும் வரிசையாகச் சோதித்து Send OTP பொத்தானைத் தவிர்த்து உண்மையான Verify பட்டனை மட்டுமே கிளிக் செய்தல்.
      4. *ஆப்ரேட்டர் நேரடி கிளிக்கிற்கு 3.5 வினாடி அவகாசம் (3.5s Anti-Collision Grace Period)*:
         - ஆப்ரேட்டர் குரோம் திரையில் நேரடியாக OTP அடிக்கும் போது, அவர்கள் தன் சொந்த மவுஸால் 'சரிபார்' பட்டனை அழுத்த 3.5 வினாடிகள் முழு அமைதி தரப்படுகிறது. ஆப்ரேட்டர் அழுத்தியவுடன் தளம் சமர்ப்பிக்கும் நிலைக்குச் செல்வதை (`isSubmittingOnPortal`) சிஸ்டம் கண்டறிந்து தானாக அடுத்த படிக்குத் தொடரும்.
      5. *அமர்வு காத்திருப்பு சுழற்சியில் மீள்-OTP கேட்புத் தடை (No Duplicate Re-prompt)*:
         - `waitAuth` சுழற்சியில் ஒருமுறை OTP தரப்பட்டுவிட்டாலோ அல்லது போர்ட்டலில் சரிபார்க்கப்பட்டுவிட்டாலோ (`ALREADY_VERIFIED_ON_PORTAL`), தளம் ரூட்டிங் ஆகும் வரை மீண்டும் OTP கேட்டு நச்சரிப்பதும் மீண்டும் சமர்ப்பிப்பதும் முற்றிலுமாகத் தடுக்கப்பட்டுள்ளது.

38. **Smart Fast-Forward & Missing-Field-Only Law (தானியங்கி விரைவுப் பாதை & விடுபட்ட விவரங்கள் மட்டுமே கேட்கும் விதி)**:
    - **முன்-சேமிக்கப்பட்ட விவரங்கள் நேரடி சமர்ப்பிப்பு (Fast-Forward to Direct Submit)**:
      - வாடிக்கையாளர் ஒரு குறிப்பிட்ட அரசு சேவையைத் தேர்வு செய்யும் போது (உறுப்பினர் சேர்க்கை, முகவரி மாற்றம், குடும்ப அட்டை போன்றவை), அந்த சேவைக்குத் தேவையான அனைத்து விவரங்களும் (பெயர், ஆதார் எண், உறவுமுறை, அல்லது புதிய முகவரி) ஏற்கனவே சேமிக்கப்பட்டிருந்தால், ஆரம்பத்திலிருந்தே மீண்டும் ஆவணங்களைப் பதிவேற்றக் கோராமல் **நேரடியாக 'விண்ணப்பம் தயார் -> நேரலை TNPDS சமர்ப்பி'** நிலைக்குச் செல்ல வேண்டும்.
    - **விடுபட்ட புலம் மட்டுமே கேட்கும் வரிசை (Missing-Fields-Only Routing)**:
      - ஆவணம் ஏற்கனவே ஸ்கேன் செய்யப்பட்டு பெயர் மற்றும் ஆதார் எண் கிடைத்து, உறவுமுறை மட்டுமே விடுபட்டிருந்தால், ஆவணத்தை மீண்டும் கேட்காமல் அந்த **ஒரு குறிப்பிட்ட கேள்வியை மட்டுமே** கேட்டுவிட்டு உடனே சமர்ப்பிக்கும் படிக்குச் செல்ல வேண்டும்.
    - **ஆவண மாற்றத்திற்கான வெளிப்படையான வசதி (Document Reset Option)**:
      - ஆபரேட்டர் வேறு நபரின் ஆவணத்தை மாற்ற விரும்பினால், `RATION_ADD_MEMBER_RESET` பொத்தான் மூலம் பழைய டிராப்ட்டை அழித்து புதிய ஆவணத்தைப் பதிவேற்ற முழு சுதந்திரம் அளிக்கப்படுகிறது.

40. **Universal Two-Sided Document Auto-Merge & Zero-Confusion Intake Standard (இரட்டைப் பக்க ஆவண தானியங்கி ஒருங்கிணைப்பு & குழப்பமற்ற உள்ளீட்டு விதி)**:
    - **குழப்பமான ஆவணப் பிரிவுகள் நீக்கம் (Zero Redundant Category Chips)**:
      - உறுப்பினர் சேர்க்கை அல்லது எந்தவொரு ஆவணப் பதிவேற்றத் தொடக்கத்திலும் தேவையற்ற 4 வகைப்பிரிவு பட்டன்களைக் காட்டி பயனரைக் குழப்பக் கூடாது. நேரடியாக ஆவணப் பதிவேற்ற பொத்தானை மட்டுமே வழங்க வேண்டும்.
    - **ஒற்றைப் பக்க PDF / e-Aadhaar நேரடி அங்கீகாரம் (Single-Page PDF Bypass)**:
      - பதிவேற்றப்படும் ஆவணம் PDF கோப்பாகவோ அல்லது முழுமையான e-ஆதாராகவோ இருந்தால், பின்பக்கத்தைக் கேட்காமல் நேரடியாக விவரங்களைப் பிரித்தெடுத்து அரசு அளவுக்கு கம்ப்ரஸ் செய்து அடுத்த படிக்குச் செல்ல வேண்டும்.
    - **முன்பக்கம் + பின்பக்கம் புகைப்பட தானியங்கி ஒருங்கிணைப்பு (2-in-1 Xerox A4 Auto-Merge)**:
      - கேமரா அல்லது படமாக முன்பக்கத்தை ஏற்றினால், AI OCR மூலம் பெயர், பிறந்த தேதி, ஆதார் எண்ணைப் பிரித்தெடுத்துவிட்டு, அடுத்த படியாக பின்பக்கப் புகைப்படத்தைக் கேட்க வேண்டும்.
      - பின்பக்கம் கிடைத்தவுடன் `photo_studio.produceDualSidedDocument` மூலம் இரண்டு படங்களையும் நேர்த்தியாக செங்குத்தாக இணைத்து ஒரே 2-in-1 A4 Xerox PDF-ஆக மாற்றி அரசு போர்ட்டல் அளவுக்கு (< 240 KB) கம்ப்ரஸ் செய்து இணைக்க வேண்டும்.
    - **தெளிவான 3 பொத்தான்கள் (Clean 3-Button Intake Menu)**:
      - பின்பக்கம் கேட்கும் போது: `[📷 பின்பக்கம் பதிவேற்றவும், ✅ முழு ஆவணம் முடிந்தது (ஒற்றைப் பக்கம் / PDF), 🔙 பின்செல்ல]`.
41. **Universal Multi-Layer AI Captcha Solver & Zero-Freeze Screen Law (அனைத்து அரசு சேவைகளுக்கான மல்டி-லேயர் AI கேப்ட்சா & தொடர் ஸ்கிரீன்ஷாட் தடுப்பு விதி)**:
    - **முழுமையான API Key விடுபடல் தடுப்பு (Zero-Missing-Key Guarantee)**:
      - எதிர்காலத்தில் உருவாக்கப்படும் எந்தவொரு அரசு போர்ட்டல் ஆட்டோமேஷனிலும் (TNPDS, TNeGA வருமானம்/சாதி, NVSP வாக்காளர் அட்டை, பட்டா சிட்டா முதலிய எதற்கும்), கேப்ட்சா தீர்வு லோக்கல் `.env` கோப்பில் உள்ள Key-ஐ மட்டும் நம்பி இருக்கக் கூடாது.
      - டெஸ்க்டாப் ஆப் சூழலில் லோக்கல் `.env` இல்லாவிட்டாலும், தானாகவே `/api/ocr/captcha` கிளவுட் சர்வர் AI மூலம் கேப்ட்சா படம் பகுப்பாய்வு செய்யப்பட்டு 6-இலக்க குறியீடு 1 வினாடியில் பெறப்படும்.
    - **தானியங்கி உள்ளீடு & நேரடி சமர்ப்பிப்பு (Auto-Fill & Immediate Submit Invariant)**:
      - கேப்ட்சா குறியீடு கிடைத்தவுடன், தமிழ் மற்றும் ஆங்கில புலங்களில் (`placeholder*="எண்ணை"`, `placeholder*="எழுத்துக்களை"`, `formcontrolname="captcha"`) `humanType` மூலம் நிரப்பப்பட்டு, கோணப் படிவ நிகழ்வுகள் (`input`, `change`, `blur`) தூண்டப்பட்டு, உடனடியாக **"பதிவு செய்ய" / "Submit"** பொத்தான் தானாகவே கிளிக் செய்யப்படும்.
    - **தொடர் ஸ்கிரீன்ஷாட் பெருக்கத் தடுப்பு (Elimination of Repeated Screenshot Loop)**:
      - கேப்ட்சா உடனடியாக முடிந்து அடுத்த படிக்கு (அரசு SMS OTP படி 3) முன்னேறி விடுவதால், படி 2-ல் ஆட்டோமேஷன் முடங்கி நின்று தொடர்ச்சியாக தேவையற்ற ஸ்கிரீன்ஷாட்கள் எடுக்கும் பிரச்சினை நிரந்தரமாகத் தீர்க்கப்பட்டுள்ளது.
    - **நிரந்தர தானியங்கி நினைவகம் (Permanent Life-Long Rule)**:
      - இது `data/automation_immune_memory.json` மற்றும் `GEMINI.md`-ல் நிரந்தர விதியாகப் பூட்டப்பட்டுள்ளது. எதிர்காலத்தில் எந்த புதிய அரசு சேவை இணைக்கப்பட்டாலும் இந்த விதி தானாகவே முழுமையாகப் பின்பற்றப்படும்; பயனர் மீண்டும் இதை நினைவூட்ட வேண்டிய அவசியமே இல்லை.

42. **TNPDS Base64-JPEG Direct Extraction & Gemini 3.8 Model Modernization Law (அரசு தளம் அசல் JPEG கேப்ட்சா & ஜெமினி 3.8 நவீன மாதிரி விதி)**:
    - **TNPDS கேப்ட்சா உண்மைத்தன்மை & தவறான கோப்பு வடிவம் (TNPDS Live DOM JPEG Fact)**:
      - TNPDS லாகின் பக்கத்தில் கேப்ட்சா படமானது சாதாரண PNG அல்ல; சர்வரிலிருந்து நேரடியாக Base64 JPEG (`data:image/JPEG;base64,/9j/4AAQ...`) வடிவிலேயே `<img alt="Captcha Code" title="கேப்ட்சா குறியீடு">` வடிவில் கிடைக்கிறது.
      - இதற்கு முன் ஸ்கிரீன்ஷாட் எடுத்து `image/png` என தவறுதலாக அனுப்பியதால் ஜெமினி AI 422 பிழையைத் தந்தது. மேலும் பழைய `gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-2.5-flash` ஆகிய மாதிரிகள் கூகுள் கிளவுடில் காலாவதியாகி (Deprecated / 404) விட்டன.
    - **நவீன ஜெமினி 3.8 பயன்பாடு (Mandatory Active Gemini 3.8 Models)**:
      - அனைத்து ஆட்டோமேஷன் மற்றும் OCR எண்ட்பாயிண்ட்டுகளிலும் (`server.js`, `tnpds_automation.js`, `portal_automation_standard.js`) கூகுளின் அதிநவீன **`gemini-3.8-flash`**, **`gemini-3.5-flash`**, மற்றும் **`gemini-flash-latest`** மாதிரிகளே பயன்படுத்தப்பட வேண்டும்.
      - Base64 தலைப்பை (`/9j/`) வைத்து `image/jpeg` அல்லது `image/png` என தானாகக் கண்டறிந்து துல்லியமாக அனுப்ப வேண்டும்.
    - **Radware படக் குழப்பத் தடுப்பு (Strict Exclusion of Perfdrive Challenge Badges)**:
      - திரையில் கேப்ட்சா படத்தைத் தேடும் போது `img[src*="captcha"]:not([src*="perfdrive"])` என Radware / Perfdrive பாட் பாதுகாப்பு பேட்ஜ் படங்களை முழுமையாகத் தவிர்த்து, உண்மையான TNPDS கேப்ட்சா படத்தை மட்டுமே (`img[src^="data:image"], img[title*="கேப்ட்சா"], img[alt="Captcha Code"]`) தேர்வு செய்ய வேண்டும்.
    - **#captchaCode நேரடி உள்ளீடு & உடனடி சமர்ப்பிப்பு (Direct Fill & Instant Auto-Submit)**:
      - TNPDS கேப்ட்சா உள்ளீட்டுப் பெட்டியின் அசல் ஐடி `input#captchaCode` ஆகும் (இதன் placeholder காலியாக இருக்கும்).
      - கேப்ட்சா குறியீடு கிடைத்த உடன் தாமதமின்றி `#captchaCode`-ல் நிரப்பி, `input[type="submit"][value="பதிவு செய்ய"]` பொத்தானை அழுத்தி நேரடியாகப் படி 3-க்கு (அரசு SMS OTP) முன்னேற வேண்டும். ஸ்கிரீன்ஷாட் லூப்பில் நிற்பது முழுமையாகத் தடுக்கப்பட்டுள்ளது.

43. **Enterprise Scoped Page Object Model & Pre-Submit Value Guard Law (நிறுவனத் தர Scoped Locators & சமர்ப்பிப்பு முன்-மதிப்புப் பூட்டு விதி)**:
    - **எல்லைக்குட்பட்ட பக்க மாதிரி (Scoped Page Object Architecture)**:
      - `src/portal/tnpds/tnpds_login_page.js` மூலமாக கைபேசி எண் பெட்டி (`formcontrolname="mobNumber"`) மற்றும் கேப்ட்சா பெட்டி (`id="captchaCode"`) ஆகியவை தனித்தனி சுதந்திரக் கூறுகளாக பிரிக்கப்பட்டுள்ளன.
      - பொதுவான தமிழ் வார்த்தைகளை (`placeholder*="எண்ணை"`) வைத்து பல ஃபீல்டுகளை ஒரே வரியில் தேடும் முறை நிரந்தரமாகத் தடை செய்யப்பட்டுள்ளது; இதனால் கைபேசி எண் பெட்டியில் தவறுதலாக கேப்ட்சா விழுவது 100% தடுக்கப்பட்டுள்ளது.
    - **சமர்ப்பிப்பு முன்-மதிப்புப் பூட்டு (Strict Pre-Submit Value Guard)**:
      - எந்தவொரு அரசு போர்ட்டலிலும் சப்மிட் பொத்தானை அழுத்துவதற்கு முன், `PortalActionGuards.assertPreSubmitCleanliness` பின்வரும் 4 நிபந்தனைகளை கட்டாயமாகச் சோதிக்கும்:
        1. கைபேசி எண் சரியாக 10 இலக்கங்களைக் கொண்டிருக்க வேண்டும் (`mob.length === 10`).
        2. கேப்ட்சா பெட்டியில் 4 முதல் 8 எழுத்துக்கள் இருக்க வேண்டும் (`cap.length >= 4`).
        3. கைபேசி எண் பெட்டியின் மதிப்பும் கேப்ட்சா பெட்டியின் மதிப்பும் சமமாக இருக்கவே கூடாது (`mob !== cap`).
        4. இந்த 3 நிபந்தனைகளில் ஒன்று தவறினாலும், சப்மிட் பொத்தான் ஒருபோதும் அழுத்தப்படாது; உடனடியாக செயல்முறை நிறுத்தப்பட்டு தற்காப்பு செய்யப்படும்.
    - **வாழ்நாள் நினைவூட்டல் (Life-Long Immutable Invariant)**:
      - எத்தனை ஆண்டுகள் கடந்தாலும், TNPDS, புதிய குடும்ப அட்டை (New Ration Card), உறுப்பினர் சேர்க்கை (Add Member), TNeGA, NVSP ஆகிய எந்தவொரு அரசு சேவைக்கும் இந்த விதி வாழ்நாள் நிரந்தர சட்டமாகும்; எந்த புதிய அப்டேட்டிலும் இந்தச் சட்டம் தளர்த்தப்படாது.
