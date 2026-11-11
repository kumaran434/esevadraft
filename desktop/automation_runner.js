// =========================================================================
// eSevaDraft Desktop App — Live Automation Runner & Profile Resolver
// =========================================================================
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { syncLatestAutomationEngine, reportOperatorTelemetry } = require('./desktop_services');

function resolveDiskDraftAndGas(customerMobile, draftData) {
    const mobClean = customerMobile.replace(/\D/g, '');
    const localMobUploads = path.join(app.getPath('userData'), 'data', 'uploads', mobClean);
    let localGasFound = null;

    if (mobClean && fs.existsSync(localMobUploads)) {
        const gasNames = ['gas.jpg', 'gas.jpeg', 'gas.png', 'gas.pdf', 'gasBook.jpg', 'gasBook.jpeg', 'gasBook.png', 'gasBook.pdf', 'residenceProof.jpg', 'residenceProof.jpeg', 'residenceProof.pdf'];
        for (const gn of gasNames) {
            const gp = path.join(localMobUploads, gn);
            if (fs.existsSync(gp) && fs.statSync(gp).size > 100) {
                localGasFound = gp;
                break;
            }
        }
    }

    let diskDraft = null;
    if (mobClean) {
        const potentialDraftPaths = [
            path.join(app.getPath('userData'), 'data', 'drafts', `${mobClean}.json`),
            path.join(__dirname, '..', 'data', 'drafts', `${mobClean}.json`),
            path.join(process.cwd(), 'data', 'drafts', `${mobClean}.json`)
        ];
        for (const p of potentialDraftPaths) {
            if (fs.existsSync(p)) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
                    if (parsed && (parsed.citizenProfile || parsed.gasDetails)) {
                        diskDraft = parsed;
                        break;
                    }
                } catch (_) {}
            }
        }
    }

    const diskProfile = diskDraft?.citizenProfile || diskDraft || {};
    const diskGas = diskProfile.gasDetails || {};
    const existingGas = draftData?.gasDetails?.gasBookPath || 
                        draftData?.citizenProfile?.gasDetails?.gasBookPath || 
                        diskGas?.gasBookPath ||
                        draftData?.residenceProof?.docPath || 
                        draftData?.citizenProfile?.residenceProof?.docPath || 
                        diskProfile?.residenceProof?.docPath ||
                        draftData?.documents?.gasBook || 
                        draftData?.documents?.residenceProof || 
                        diskDraft?.documents?.gasBook ||
                        localGasFound;

    const effectiveGasDetails = {
        ...(diskGas || {}),
        ...(draftData?.gasDetails || {}),
        ...(draftData?.citizenProfile?.gasDetails || {})
    };
    if (diskGas.consumerNumber && !effectiveGasDetails.consumerNumber) effectiveGasDetails.consumerNumber = diskGas.consumerNumber;
    if (diskGas.agencyName && !effectiveGasDetails.agencyName) effectiveGasDetails.agencyName = diskGas.agencyName;
    if (diskGas.cylinders && (!effectiveGasDetails.cylinders || effectiveGasDetails.cylinders === '0')) effectiveGasDetails.cylinders = diskGas.cylinders;
    if (diskGas.oilCompany && !effectiveGasDetails.oilCompany) effectiveGasDetails.oilCompany = diskGas.oilCompany;
    if (diskGas.oilCompanyDisplay && !effectiveGasDetails.oilCompanyDisplay) effectiveGasDetails.oilCompanyDisplay = diskGas.oilCompanyDisplay;
    if (existingGas || effectiveGasDetails.consumerNumber) {
        effectiveGasDetails.hasGas = true;
        if (!effectiveGasDetails.gasBookPath && existingGas) effectiveGasDetails.gasBookPath = existingGas;
        if (!effectiveGasDetails.cylinders || effectiveGasDetails.cylinders === '0') effectiveGasDetails.cylinders = '1';
        if (!effectiveGasDetails.oilCompany) effectiveGasDetails.oilCompany = 'IOC';
        if (!effectiveGasDetails.oilCompanyDisplay) effectiveGasDetails.oilCompanyDisplay = 'Indane Gas (IOCL)';
    }

    const effectiveResidence = draftData?.residenceProof || 
                               draftData?.citizenProfile?.residenceProof || 
                               diskProfile.residenceProof || 
                               (existingGas ? { type: 'GAS_BOOK', typeTam: 'எரிவாயு நுகர்வோர் அட்டை', docPath: existingGas } : null);

    return { diskDraft, effectiveGasDetails, effectiveResidence, existingGas, mobClean };
}

function purgeAutomationRequireCache() {
    try {
        for (const key of Object.keys(require.cache)) {
            if (key.includes('tnpds_automation') ||
                key.includes('govt_automation_core') ||
                key.includes('photo_studio') ||
                key.includes('tnega') ||
                key.includes(path.join('src', 'portal')) ||
                key.includes(path.join('src', 'services'))) {
                delete require.cache[key];
            }
        }
    } catch (_) {}
}

function loadAutomationModule() {
    purgeAutomationRequireCache();

    const workspacePath = path.join('d:', 'downloads', 'ai assitant 2', 'tnpds_automation.js');
    if (fs.existsSync(workspacePath)) {
        try {
            return require(workspacePath);
        } catch (_) {}
    }

    const userEnginePath = path.join(app.getPath('userData'), 'tnpds_automation.js');
    if (!app.isPackaged) {
        const localPath = path.join(__dirname, '..', 'tnpds_automation.js');
        if (fs.existsSync(localPath)) {
            return require(localPath);
        }
    }
    if (fs.existsSync(userEnginePath)) {
        try {
            return require(userEnginePath);
        } catch (_) {
            try { fs.unlinkSync(userEnginePath); } catch (_) {}
        }
    }
    const bundledCandidates = [
        path.join(process.resourcesPath || '', 'tnpds_automation.js'),
        path.join(process.resourcesPath || '', 'app.asar.unpacked', 'tnpds_automation.js'),
        path.join(__dirname, '..', 'tnpds_automation.js'),
        path.join(__dirname, 'tnpds_automation.js')
    ];
    for (const bc of bundledCandidates) {
        if (fs.existsSync(bc)) {
            try {
                const mod = require(bc);
                if (mod) return mod;
            } catch (_) {}
        }
    }
    return null;
}

function loadTnegaAutomationModule() {
    purgeAutomationRequireCache();
    const candidates = [
        path.join('d:', 'downloads', 'ai assitant 2', 'tnega_can_automation.js'),
        path.join(app.getPath('userData'), 'tnega_can_automation.js'),
        path.join(process.resourcesPath || '', 'tnega_can_automation.js'),
        path.join(process.resourcesPath || '', 'app.asar.unpacked', 'tnega_can_automation.js'),
        path.join(__dirname, '..', 'tnega_can_automation.js'),
        path.join(__dirname, 'tnega_can_automation.js')
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) {
            try {
                const mod = require(c);
                if (mod) return mod;
            } catch (err) {
                console.warn(`[TNeGA Loader] Could not load candidate ${c}:`, err.message);
            }
        }
    }
    return null;
}

function resolveStorageService() {
    const candidates = [
        path.join(process.resourcesPath || '', 'src', 'services', 'storage_service.js'),
        path.join(process.resourcesPath || '', 'src', 'services', 'storage_service'),
        path.join(__dirname, '..', 'src', 'services', 'storage_service.js'),
        path.join('d:', 'downloads', 'ai assitant 2', 'src', 'services', 'storage_service.js')
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) {
            try { return require(c); } catch (_) {}
        }
    }
    try { return require('../src/services/storage_service'); } catch (_) { return null; }
}

async function executeLiveDesktopAutomation(draftData, mainWindow, getActiveModule, setActiveModule) {
    const runTimestamp = Date.now();
    const customerMobile = (draftData?.mobileNumber || draftData?.citizenProfile?.mobileNumber || 'run').toString().replace(/\D/g, '') || 'run';
    const logFileName = `live_desktop_${customerMobile}_${runTimestamp}.log`;
    const appDataLogsDir = path.join(app.getPath('userData'), 'logs');
    const wsLogsDir = path.join('d:', 'downloads', 'ai assitant 2', 'public', 'logs');
    try { if (!fs.existsSync(appDataLogsDir)) fs.mkdirSync(appDataLogsDir, { recursive: true }); } catch (_) {}
    try { if (!fs.existsSync(wsLogsDir)) fs.mkdirSync(wsLogsDir, { recursive: true }); } catch (_) {}
    const appDataLogPath = path.join(appDataLogsDir, logFileName);
    const wsLogPath = path.join(wsLogsDir, logFileName);
    const appDataLatestLog = path.join(appDataLogsDir, 'latest_run.log');
    const wsLatestLog = path.join(wsLogsDir, 'latest_run.log');

    const writeLogEntry = (line) => {
        const formatted = `[${new Date().toISOString()}] ${line}\n`;
        for (const t of [appDataLogPath, wsLogPath, appDataLatestLog, wsLatestLog]) {
            try { fs.appendFileSync(t, formatted, 'utf8'); } catch (_) {}
        }
    };

    const explicitSub = draftData?.subService || draftData?.citizenProfile?.subService;
    const isCanRegister = explicitSub === 'CAN_REGISTER' ||
                          draftData?.subService === 'CAN_REGISTER' ||
                          draftData?.serviceId === 'TNEGA_CAN_REGISTER' ||
                          (draftData?.intakeState && draftData.intakeState.startsWith('READY_TO_APPLY_CAN')) ||
                          (draftData?.intakeState && draftData.intakeState.startsWith('CAN_REGISTER_INTAKE')) ||
                          (draftData?.citizenProfile?.intakeState && draftData.citizenProfile.intakeState.startsWith('READY_TO_APPLY_CAN'));
    const isCanSearch = !isCanRegister && (
                          explicitSub === 'CAN_SEARCH' ||
                          draftData?.subService === 'CAN_SEARCH' ||
                          draftData?.serviceId === 'TNEGA_CAN_SEARCH' ||
                          (draftData?.intakeState && draftData.intakeState.startsWith('CAN_SEARCH_INTAKE')) ||
                          (draftData?.citizenProfile?.intakeState && draftData.citizenProfile.intakeState.startsWith('CAN_SEARCH_INTAKE'))
                        );
    const isIncome = !isCanRegister && !isCanSearch && (
                          explicitSub === 'INCOME' ||
                          explicitSub === 'INCOME_CERTIFICATE' ||
                          draftData?.subService === 'INCOME' ||
                          draftData?.subService === 'INCOME_CERTIFICATE' ||
                          draftData?.serviceId === 'INCOME_CERTIFICATE' ||
                          (draftData?.intakeState && draftData.intakeState.startsWith('READY_TO_APPLY_INCOME')) ||
                          (draftData?.citizenProfile?.intakeState && draftData.citizenProfile.intakeState.startsWith('READY_TO_APPLY_INCOME'))
                        );

    const isResidence = !isCanRegister && !isCanSearch && !isIncome && (
                          explicitSub === 'RESIDENCE' ||
                          explicitSub === 'RESIDENCE_CERTIFICATE' ||
                          explicitSub === 'NATIVITY' ||
                          explicitSub === 'NATIVITY_CERTIFICATE' ||
                          draftData?.subService === 'RESIDENCE' ||
                          draftData?.subService === 'RESIDENCE_CERTIFICATE' ||
                          draftData?.subService === 'NATIVITY' ||
                          draftData?.subService === 'NATIVITY_CERTIFICATE' ||
                          draftData?.serviceId === 'RESIDENCE_CERTIFICATE' ||
                          draftData?.serviceId === 'NATIVITY_CERTIFICATE' ||
                          (draftData?.intakeState && (draftData.intakeState.includes('RESIDENCE') || draftData.intakeState.includes('NATIVITY'))) ||
                          (draftData?.citizenProfile?.intakeState && (draftData.citizenProfile.intakeState.includes('RESIDENCE') || draftData.citizenProfile.intakeState.includes('NATIVITY')))
                        );

    const isCommunity = !isCanRegister && !isCanSearch && !isIncome && !isResidence && (
                          explicitSub === 'COMMUNITY' ||
                          explicitSub === 'COMMUNITY_CERTIFICATE' ||
                          draftData?.subService === 'COMMUNITY' ||
                          draftData?.subService === 'COMMUNITY_CERTIFICATE' ||
                          draftData?.serviceId === 'COMMUNITY_CERTIFICATE' ||
                          (draftData?.intakeState && draftData.intakeState.includes('COMMUNITY')) ||
                          (draftData?.citizenProfile?.intakeState && draftData.citizenProfile.intakeState.includes('COMMUNITY'))
                        );

    const isChangeAddress = !isCanRegister && !isCanSearch && !isIncome && !isResidence && !isCommunity && (
                            explicitSub === 'CHANGE_ADDRESS' ||
                            (!explicitSub && (
                                (draftData?.intakeState && draftData.intakeState.startsWith('RATION_CHANGE_ADDRESS')) ||
                                Boolean(draftData?.subServiceData?.doorNo) ||
                                Boolean(draftData?.citizenProfile?.subServiceData?.doorNo)
                            )));
    const isRemoveMember = !isCanRegister && !isCanSearch && !isChangeAddress && explicitSub !== 'CHANGE_HEAD' && (
                                explicitSub === 'REMOVE_MEMBER' ||
                                (draftData?.intakeState && draftData.intakeState.startsWith('RATION_REMOVE_MEMBER')) ||
                                (Boolean(draftData?.subServiceData?.memberName) && Boolean(draftData?.subServiceData?.reason)) ||
                                (Boolean(draftData?.citizenProfile?.subServiceData?.memberName) && Boolean(draftData?.citizenProfile?.subServiceData?.reason))
                            );
    const isAddMember = !isCanRegister && !isCanSearch && !isChangeAddress && !isRemoveMember && (
                            explicitSub === 'ADD_MEMBER' ||
                            (draftData?.intakeState && draftData.intakeState.startsWith('RATION_ADD_MEMBER')) ||
                            Boolean(draftData?.subServiceData?.memberName) ||
                            Boolean(draftData?.citizenProfile?.subServiceData?.memberName)
                        );
    const isChangeMobile = !isCanRegister && !isCanSearch && !isChangeAddress && !isRemoveMember && !isAddMember && (
                            explicitSub === 'UPDATE_MOBILE' ||
                            explicitSub === 'CHANGE_MOBILE' ||
                            explicitSub === 'CHANGE_OF_MOBILE_NUMBER' ||
                            (draftData?.intakeState && draftData.intakeState.startsWith('RATION_CHANGE_MOBILE')) ||
                            Boolean(draftData?.subServiceData?.newMobile) ||
                            Boolean(draftData?.citizenProfile?.subServiceData?.newMobile)
                        );
    const isChangeHead = !isCanRegister && !isCanSearch && !isChangeAddress && !isRemoveMember && !isAddMember && !isChangeMobile && (
                            explicitSub === 'CHANGE_HEAD' ||
                            explicitSub === 'FAMILY_HEAD_MEMBER_CHANGE' ||
                            (draftData?.intakeState && draftData.intakeState.startsWith('RATION_CHANGE_HEAD')) ||
                            Boolean(draftData?.subServiceData?.newHeadName) ||
                            Boolean(draftData?.citizenProfile?.subServiceData?.newHeadName)
                        );

    const serviceName = isCommunity ? 'COMMUNITY_CERTIFICATE (சாதிச் சான்றிதழ் - REV-101)' :
                       (isResidence ? 'RESIDENCE_CERTIFICATE (இருப்பிடச் சான்றிதழ் - REV-102)' :
                       (isIncome ? 'INCOME_CERTIFICATE (வருமானச் சான்றிதழ் - REV-103)' :
                       (isChangeAddress ? 'CHANGE_ADDRESS (முகவரி மாற்றம்)' : 
                       (isRemoveMember ? 'REMOVE_MEMBER (குடும்ப உறுப்பினர் நீக்கம்)' : 
                       (isAddMember ? 'ADD_MEMBER (உறுப்பினர் சேர்க்கை)' : 
                       (isChangeMobile ? 'UPDATE_MOBILE (கைபேசி எண் மாற்றம்)' : 
                       (isChangeHead ? 'CHANGE_HEAD (குடும்பத் தலைவர் மாற்றம்)' : 
                       (isCanRegister ? 'TNEGA_CAN_REGISTER (புதிய CAN பதிவு)' :
                       (isCanSearch ? 'TNEGA_CAN_SEARCH (CAN எண் தேடல்)' :
                       'NEW_RATION_CARD (புதிய குடும்ப அட்டை)')))))))));

    const startHeader = [
        '================================================================================',
        `eSeva LIVE DESKTOP RUN STARTED: Mobile=${customerMobile} Mode=${draftData?.isDryRun ? 'DRY_RUN' : 'LIVE'} Operator=${draftData?.operatorName || 'admin'}`,
        `SERVICE     : ${serviceName}`,
        `STARTED AT  : ${new Date().toISOString()}`,
        '================================================================================\n'
    ].join('\n');
    for (const t of [appDataLatestLog, wsLatestLog, appDataLogPath, wsLogPath]) {
        try { fs.writeFileSync(t, startHeader, 'utf8'); } catch (_) {}
    }

    const onProgress = (msg) => {
        writeLogEntry(msg);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('automation-step-update', msg);
        }
        try {
            const storageService = resolveStorageService();
            if (storageService && customerMobile) {
                const sess = storageService.getOrCreateSession(customerMobile);
                if (sess) {
                    const stepMatch = msg.match(/(?:\[\s*(?:படி|படிகள்|Step)\s*|(?:படி|படிகள்|Step)\s+)(\d+)(?:\s*-\s*\d+)?\s*\/\s*(\d+)\]?/i);
                    if (stepMatch) {
                        sess.automationStep = parseInt(stepMatch[1], 10);
                        sess.automationTotal = parseInt(stepMatch[2], 10) || 51;
                    }
                    sess.automationCurrentStepMsg = msg;
                    sess.isAutomating = true;
                    sess.isAutomationRunning = true;
                    if (sess.automationStep === 21) {
                        sess.isWaitingForOtp = true;
                        sess.otpType = 'mobile';
                    } else if (sess.automationStep === 35) {
                        sess.isWaitingForOtp = true;
                        sess.otpType = 'aadhaar';
                    } else if (sess.automationStep > 21 && sess.automationStep !== 35) {
                        sess.isWaitingForOtp = false;
                    }
                }
            }
        } catch (_) {}
    };

    await syncLatestAutomationEngine().catch(() => {});
    let playwrightChromium = null;
    try {
        playwrightChromium = require('playwright-core').chromium;
    } catch (_) {
        try {
            const unpacked = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules', 'playwright-core');
            if (fs.existsSync(unpacked)) playwrightChromium = require(unpacked).chromium;
        } catch (_) {}
    }
    if (!playwrightChromium) {
        try {
            const wsPlaywright = path.join('d:', 'downloads', 'ai assitant 2', 'node_modules', 'playwright');
            if (fs.existsSync(wsPlaywright)) playwrightChromium = require(wsPlaywright).chromium;
        } catch (_) {}
    }


    let automationModule = loadAutomationModule();
    setActiveModule(automationModule);
    if (automationModule?.setChromiumInstance && playwrightChromium) {
        automationModule.setChromiumInstance(playwrightChromium);
    }

    if (!automationModule) {
        const err = 'tnpds_automation தொகுதி கிடைக்கவில்லை';
        writeLogEntry(`❌ ${err}`);
        return { success: false, error: err };
    }

    const resolved = resolveDiskDraftAndGas(customerMobile, draftData);
    let tnegaModule = loadTnegaAutomationModule();
    if (tnegaModule?.setTnegaChromiumInstance && playwrightChromium) {
        tnegaModule.setTnegaChromiumInstance(playwrightChromium);
    }

    let runner = null;
    if (isRemoveMember && automationModule.startTnpdsRemoveMemberFlow) runner = automationModule.startTnpdsRemoveMemberFlow;
    else if (isAddMember && automationModule.startTnpdsAddMemberFlow) runner = automationModule.startTnpdsAddMemberFlow;
    else if (isChangeAddress && automationModule.startTnpdsAddressChangeFlow) runner = automationModule.startTnpdsAddressChangeFlow;
    else if (isChangeMobile && automationModule.startTnpdsMobileChangeFlow) runner = automationModule.startTnpdsMobileChangeFlow;
    else if (isChangeHead && automationModule.startTnpdsChangeHeadFlow) runner = automationModule.startTnpdsChangeHeadFlow;
    else if (isCanRegister) {
        if (tnegaModule?.startTnegaCanRegisterFlow) {
            runner = tnegaModule.startTnegaCanRegisterFlow;
        } else {
            const err = 'TNeGA CAN Registration தொகுதி (tnega_can_automation) கிடைக்கவில்லை';
            writeLogEntry(`❌ ${err}`);
            return { success: false, error: err };
        }
    } else if (isCanSearch) {
        if (tnegaModule?.startTnegaCanSearchFlow) {
            runner = tnegaModule.startTnegaCanSearchFlow;
        } else {
            const err = 'TNeGA CAN Search தொகுதி கிடைக்கவில்லை';
            writeLogEntry(`❌ ${err}`);
            return { success: false, error: err };
        }
    } else if (isIncome) {
        if (tnegaModule?.startTnegaIncomeFlow) {
            runner = tnegaModule.startTnegaIncomeFlow;
        } else if (tnegaModule?.startTnegaCanRegisterFlow) {
            runner = tnegaModule.startTnegaCanRegisterFlow;
        } else {
            const err = 'TNeGA Income Certificate தொகுதி (tnega_can_automation) கிடைக்கவில்லை';
            writeLogEntry(`❌ ${err}`);
            return { success: false, error: err };
        }
    } else if (isResidence) {
        if (tnegaModule?.startTnegaResidenceFlow) {
            runner = tnegaModule.startTnegaResidenceFlow;
        } else {
            const err = 'TNeGA Residence Certificate தொகுதி (tnega_can_automation) கிடைக்கவில்லை';
            writeLogEntry(`❌ ${err}`);
            return { success: false, error: err };
        }
    } else if (isCommunity) {
        if (tnegaModule?.startTnegaCommunityFlow) {
            runner = tnegaModule.startTnegaCommunityFlow;
        } else {
            const err = 'TNeGA Community Certificate தொகுதி (tnega_can_automation) கிடைக்கவில்லை';
            writeLogEntry(`❌ ${err}`);
            return { success: false, error: err };
        }
    } else {
        runner = automationModule.startTnpdsRationCardFlow;
    }

    const targetProfile = {
        ...(draftData || {}),
        ...(draftData?.citizenProfile || {}),
        mobileNumber: draftData?.mobileNumber || resolved.mobClean,
        subService: isRemoveMember ? 'REMOVE_MEMBER' : (isAddMember ? 'ADD_MEMBER' : (isChangeAddress ? 'CHANGE_ADDRESS' : (isChangeMobile ? 'UPDATE_MOBILE' : (isChangeHead ? 'CHANGE_HEAD' : draftData?.subService)))),
        subServiceData: draftData?.subServiceData || draftData?.citizenProfile?.subServiceData || {},
        intakeState: draftData?.intakeState || '',
        residenceProof: resolved.effectiveResidence,
        documents: {
            ...(draftData?.documents || {}),
            ...(draftData?.citizenProfile?.documents || {}),
            ...(resolved.diskDraft?.documents || {}),
            ...(resolved.existingGas ? { gasBook: resolved.existingGas, residenceProof: resolved.existingGas } : {})
        },
        gasDetails: resolved.effectiveGasDetails
    };

    const base64Docs = Object.assign({}, draftData?.base64Docs || {}, draftData?.citizenProfile?.base64Docs || {});

    runner(targetProfile, onProgress, { 
        isMockSandbox: false, 
        mockSandbox: false,
        isMockSandboxMode: false,
        headless: false,
        chromium: playwrightChromium,
        draftData,
        subServiceData: targetProfile.subServiceData,
        operatorMobile: draftData?.operatorMobile || '',
        operatorName: draftData?.operatorName || 'admin',
        isDryRun: draftData?.isDryRun !== false,
        enableFinalSubmit: draftData?.enableSubmit === true,
        base64Docs,
        geminiApiKey: process.env.GEMINI_API_KEY || Buffer.from('QVEuQWI4Uk42S29EYklVZUlJbnMwNGFZLXdxQ2VTTkZidFhXTWxHdzRnY3lqeUVjRnBqdHc=', 'base64').toString('utf8'),
        serverUrl: process.env.ESEVA_DEV_URL || 'https://esevadraft.in'
    }).then(res => {
        writeLogEntry(`[முடிவு நிலை] ஆட்டோமேஷன் நிறைவுற்றது: Success=${res?.success}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('automation-finished', res);
        }
    }).catch(err => {
        writeLogEntry(`[விபத்து பிழை] ${err.message}\n${err.stack}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('automation-step-update', `⚠️ ஆட்டோமேஷன் பிழை: ${err.message}`);
        }
    });

    const portalName = (isCanRegister || isCanSearch || isIncome) ? 'TNeGA' : 'TNPDS';
    return { success: true, message: `${portalName} Chrome திறக்கப்பட்டது — படிவம் தானாக நிரப்பப்படுகிறது!` };
}

async function stopActiveAutomation() {
    try {
        const mod = getActiveModule() || loadAutomationModule();
        if (mod && mod.stopTnpdsAutomation) {
            await mod.stopTnpdsAutomation();
        }
    } catch (_) {}

    try {
        const tnegaModule = require('../tnega_can_automation');
        if (tnegaModule && tnegaModule.stopTnegaAutomation) {
            await tnegaModule.stopTnegaAutomation();
        }
    } catch (_) {}

    try {
        const storageService = resolveStorageService();
        if (storageService) {
            const allSessions = storageService.getAllSessions ? storageService.getAllSessions() : [];
            for (const s of allSessions) {
                if (s) {
                    s.isAutomationRunning = false;
                    s.isAutomating = false;
                    s.automationStep = 0;
                    s.automationCurrentStepMsg = '';
                }
            }
            const sess = storageService.getSessionState ? storageService.getSessionState() : null;
            if (sess) {
                sess.isAutomationRunning = false;
                sess.isAutomating = false;
                sess.automationStep = 0;
                sess.automationCurrentStepMsg = '';
            }
        }
    } catch (_) {}

    try {
        const logPath = path.join(app.getPath('userData'), 'logs', 'latest_run.log');
        if (fs.existsSync(logPath)) {
            fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] 🛑 [ஆட்டோமேஷன் நிறுத்தப்பட்டது] செயல்முறை நிறுத்தப்பட்டு உலாவி சாளரம் பாதுகாப்பாக மூடப்பட்டது.\n`);
        }
    } catch (_) {}
}

module.exports = {
    executeLiveDesktopAutomation,
    resolveDiskDraftAndGas,
    loadAutomationModule,
    resolveStorageService,
    stopActiveAutomation
};
