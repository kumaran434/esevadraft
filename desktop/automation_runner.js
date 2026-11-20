// =========================================================================
// eSevaDraft Desktop App — Live Automation Runner & Profile Resolver
// =========================================================================
let app = null;
try { ({ app } = require('electron')); } catch (_) {}
const path = require('path');
const fs = require('fs');
const {
    syncLatestAutomationEngine,
    reportOperatorTelemetry,
    writeActiveRunFlight,
    clearActiveRunFlight,
    isPreSubmitReached
} = require('./desktop_services');

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

let activeAutomationAborted = false;
let lastMainWindowRef = null;
let lastActiveTnpdsModule = null;
let lastActiveTnegaModule = null;
let activeRunContext = null;

function finalizeMidRunTelemetryIfNeeded(ctx, { errorType, errorMessage, step, allowEvenIfAborted = true } = {}) {
    if (!ctx) return null;
    try {
        if (ctx.stuckWatchdogTimer) {
            clearInterval(ctx.stuckWatchdogTimer);
            ctx.stuckWatchdogTimer = null;
        }
    } catch (_) {}
    clearActiveRunFlight();
    if (activeRunContext && activeRunContext.runId === ctx.runId) {
        activeRunContext = null;
    }
    const isRealFailure = errorType === 'AUTOMATION_FAILED' || errorType === 'AUTOMATION_CRASH';
    if (ctx.reachedPreSubmit && !isRealFailure) {
        return { promptFaultReason: false, runId: ctx.runId, serviceName: ctx.serviceName, lastStep: ctx.lastProgressMsg };
    }
    if (!ctx.midRunTelemetrySent && (allowEvenIfAborted || !activeAutomationAborted)) {
        ctx.midRunTelemetrySent = true;
        reportOperatorTelemetry({
            runId: ctx.runId,
            operatorUid: ctx.operatorUid || '',
            operatorMobile: ctx.operatorMobile || '',
            operatorName: ctx.operatorName || '',
            customerMobile: ctx.customerMobile || '',
            serviceName: ctx.serviceName || '',
            step: step || ctx.lastProgressMsg || 'MID_RUN_DROP',
            errorType: errorType || 'AUTOMATION_ABANDONED_MID_RUN',
            errorMessage: errorMessage || 'Automation stopped before reaching Pre-Submit Gate',
            startedAt: ctx.startedAt,
            lastProgressAt: ctx.lastProgressAt
        });
    }
    return {
        promptFaultReason: true,
        runId: ctx.runId,
        serviceName: ctx.serviceName,
        lastStep: ctx.lastProgressMsg
    };
}

function reportMidRunStopIfNeeded({ silent = false, reason = 'Operator stopped automation mid-run before Pre-Submit Gate' } = {}) {
    const ctx = activeRunContext;
    if (!ctx) return null;
    if (silent) {
        try {
            if (ctx.stuckWatchdogTimer) clearInterval(ctx.stuckWatchdogTimer);
        } catch (_) {}
        clearActiveRunFlight();
        activeRunContext = null;
        return null;
    }
    return finalizeMidRunTelemetryIfNeeded(ctx, {
        errorType: 'AUTOMATION_ABANDONED_MID_RUN',
        errorMessage: reason
    });
}

async function executeLiveDesktopAutomation(draftData, mainWindow, getActiveModule, setActiveModule) {
    activeAutomationAborted = false;
    lastMainWindowRef = mainWindow;
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
    const targetServiceHint = String(draftData?.targetService || draftData?.citizenProfile?.targetService || '').toUpperCase();
    const serviceHint = String(draftData?.service || draftData?.citizenProfile?.service || '').toUpperCase();
    const serviceIdHint = String(draftData?.serviceId || draftData?.citizenProfile?.serviceId || '').toUpperCase();
    const intakeStateHint = String(draftData?.intakeState || draftData?.citizenProfile?.intakeState || '').toUpperCase();

    const hasCan = Boolean(
        (draftData?.canNumber && /^\d{11,15}$/.test(String(draftData.canNumber).trim())) ||
        (draftData?.citizenProfile?.canNumber && /^\d{11,15}$/.test(String(draftData.citizenProfile.canNumber).trim()))
    );

    // 1. High-Priority Certificate Service Detection (Golden Rule 6 & 11)
    const isWidow = Boolean(
        explicitSub === 'WIDOW' ||
        explicitSub === 'WIDOW_CERTIFICATE' ||
        explicitSub === 'TNEGA_WIDOW' ||
        explicitSub === 'TNEGA_WIDOW_CERTIFICATE' ||
        targetServiceHint === 'WIDOW' ||
        targetServiceHint.includes('WIDOW') ||
        serviceIdHint === 'WIDOW_CERTIFICATE' ||
        serviceIdHint === 'TNEGA_WIDOW' ||
        serviceIdHint === 'REV-109' ||
        serviceHint.includes('விதவை') ||
        serviceHint.includes('WIDOW') ||
        intakeStateHint.includes('WIDOW')
    );

    const isLegalHeir = !isWidow && Boolean(
        explicitSub === 'LEGAL_HEIR' ||
        explicitSub === 'LEGAL_HEIR_CERTIFICATE' ||
        explicitSub === 'TNEGA_LEGAL_HEIR' ||
        targetServiceHint === 'LEGAL_HEIR' ||
        targetServiceHint.includes('LEGAL_HEIR') ||
        serviceIdHint === 'LEGAL_HEIR_CERTIFICATE' ||
        serviceIdHint === 'REV-114' ||
        serviceHint.includes('வாரிசு') ||
        serviceHint.includes('LEGAL HEIR') ||
        intakeStateHint.includes('LEGAL_HEIR')
    );

    const isObc = !isWidow && !isLegalHeir && Boolean(
        explicitSub === 'OBC' ||
        explicitSub === 'OBC_CERTIFICATE' ||
        explicitSub === 'TNEGA_OBC' ||
        explicitSub === 'TNEGA_OBC_CERTIFICATE' ||
        targetServiceHint === 'OBC' ||
        targetServiceHint.includes('OBC') ||
        serviceIdHint === 'OBC_CERTIFICATE' ||
        serviceIdHint === 'TNEGA_OBC' ||
        serviceIdHint === 'REV-115' ||
        serviceHint.includes('OBC') ||
        serviceHint.includes('இதர பிற்படுத்தப்பட்டோர்') ||
        intakeStateHint.includes('OBC')
    );

    const isCommunity = !isWidow && !isLegalHeir && !isObc && Boolean(
        explicitSub === 'COMMUNITY' ||
        explicitSub === 'COMMUNITY_CERTIFICATE' ||
        targetServiceHint === 'COMMUNITY' ||
        targetServiceHint.includes('COMMUNITY') ||
        serviceIdHint === 'COMMUNITY_CERTIFICATE' ||
        serviceIdHint === 'TNEGA_COMMUNITY' ||
        serviceHint.includes('சாதி') ||
        serviceHint.includes('COMMUNITY') ||
        intakeStateHint.includes('COMMUNITY') ||
        Boolean(draftData?.citizenProfile?.caste || draftData?.caste)
    );

    const isResidence = !isWidow && !isLegalHeir && !isObc && !isCommunity && Boolean(
        explicitSub === 'RESIDENCE' ||
        explicitSub === 'RESIDENCE_CERTIFICATE' ||
        explicitSub === 'NATIVITY' ||
        explicitSub === 'NATIVITY_CERTIFICATE' ||
        targetServiceHint === 'RESIDENCE' ||
        targetServiceHint.includes('RESIDENCE') ||
        serviceIdHint === 'RESIDENCE_CERTIFICATE' ||
        serviceIdHint === 'NATIVITY_CERTIFICATE' ||
        serviceIdHint === 'TNEGA_RESIDENCE' ||
        serviceHint.includes('இருப்பிடம்') ||
        serviceHint.includes('RESIDENCE') ||
        intakeStateHint.includes('RESIDENCE') ||
        intakeStateHint.includes('NATIVITY')
    );

    const isIncome = !isWidow && !isLegalHeir && !isObc && !isCommunity && !isResidence && Boolean(
        explicitSub === 'INCOME' ||
        explicitSub === 'INCOME_CERTIFICATE' ||
        targetServiceHint === 'INCOME' ||
        targetServiceHint.includes('INCOME') ||
        serviceIdHint === 'INCOME_CERTIFICATE' ||
        serviceIdHint === 'TNEGA_INCOME' ||
        serviceHint.includes('வருமானம்') ||
        serviceHint.includes('INCOME') ||
        intakeStateHint.includes('INCOME') ||
        Boolean(draftData?.citizenProfile?.annualIncome || draftData?.annualIncome)
    );

    const isFirstGraduate = !isWidow && !isLegalHeir && !isObc && !isCommunity && !isResidence && !isIncome && Boolean(
        explicitSub === 'FIRST_GRADUATE' ||
        explicitSub === 'FIRST_GRADUATE_CERTIFICATE' ||
        targetServiceHint === 'FIRST_GRADUATE' ||
        targetServiceHint.includes('FIRST_GRADUATE') ||
        serviceIdHint === 'FIRST_GRADUATE_CERTIFICATE' ||
        serviceIdHint === 'TNEGA_FIRST_GRADUATE' ||
        serviceHint.includes('முதல் பட்டதாரி') ||
        serviceHint.includes('FIRST_GRADUATE') ||
        intakeStateHint.includes('FIRST_GRADUATE') ||
        Boolean(draftData?.citizenProfile?.currentCourse || draftData?.currentCourse)
    );

    // 2. CAN Operations Detection (ONLY if no target certificate goal is active, and NOT already having a CAN)
    const isCanRegister = !isWidow && !isLegalHeir && !isObc && !isCommunity && !isResidence && !isIncome && !isFirstGraduate && !hasCan && Boolean(
        explicitSub === 'CAN_REGISTER' ||
        draftData?.subService === 'CAN_REGISTER' ||
        serviceIdHint === 'TNEGA_CAN_REGISTER' ||
        intakeStateHint.startsWith('READY_TO_APPLY_CAN') ||
        intakeStateHint.startsWith('CAN_REGISTER_INTAKE')
    );

    const isCanSearch = !isWidow && !isLegalHeir && !isObc && !isCommunity && !isResidence && !isIncome && !isFirstGraduate && !isCanRegister && Boolean(
        explicitSub === 'CAN_SEARCH' ||
        draftData?.subService === 'CAN_SEARCH' ||
        serviceIdHint === 'TNEGA_CAN_SEARCH' ||
        intakeStateHint.startsWith('CAN_SEARCH_INTAKE')
    );

    const isExplicitNewCard = !isWidow && !isLegalHeir && !isObc && !isCommunity && !isResidence && !isIncome && !isFirstGraduate && !isCanRegister && !isCanSearch && (
                          explicitSub === 'NEW_CARD' ||
                          explicitSub === 'NEW_RATION_CARD' ||
                          explicitSub === 'new_smart_card' ||
                          explicitSub === 'புதிய ரேஷன் கார்டு' ||
                          explicitSub === 'ration' ||
                          explicitSub === 'NEW_CARD_REGISTER' ||
                          explicitSub === 'NEW_SMART_CARD'
                        );

    const isChangeAddress = !isExplicitNewCard && !isCanRegister && !isCanSearch && !isWidow && !isLegalHeir && !isObc && !isIncome && !isResidence && !isCommunity && !isFirstGraduate && (
                            explicitSub === 'CHANGE_ADDRESS' ||
                            (!explicitSub && (
                                (draftData?.intakeState && draftData.intakeState.startsWith('RATION_CHANGE_ADDRESS')) ||
                                Boolean(draftData?.subServiceData?.doorNo) ||
                                Boolean(draftData?.citizenProfile?.subServiceData?.doorNo)
                            )));
    const isRemoveMember = !isExplicitNewCard && !isCanRegister && !isCanSearch && !isWidow && !isLegalHeir && !isObc && !isIncome && !isResidence && !isCommunity && !isFirstGraduate && !isChangeAddress && explicitSub !== 'CHANGE_HEAD' && (
                                explicitSub === 'REMOVE_MEMBER' ||
                                (draftData?.intakeState && draftData.intakeState.startsWith('RATION_REMOVE_MEMBER')) ||
                                (!explicitSub && (
                                    (Boolean(draftData?.subServiceData?.memberName) && Boolean(draftData?.subServiceData?.reason)) ||
                                    (Boolean(draftData?.citizenProfile?.subServiceData?.memberName) && Boolean(draftData?.citizenProfile?.subServiceData?.reason))
                                ))
                            );
    const isAddMember = !isExplicitNewCard && !isCanRegister && !isCanSearch && !isWidow && !isLegalHeir && !isObc && !isIncome && !isResidence && !isCommunity && !isFirstGraduate && !isChangeAddress && !isRemoveMember && (
                            explicitSub === 'ADD_MEMBER' ||
                            (draftData?.intakeState && draftData.intakeState.startsWith('RATION_ADD_MEMBER')) ||
                            (!explicitSub && (
                                Boolean(draftData?.subServiceData?.memberName) ||
                                Boolean(draftData?.citizenProfile?.subServiceData?.memberName)
                            ))
                        );
    const isChangeMobile = !isExplicitNewCard && !isCanRegister && !isCanSearch && !isWidow && !isLegalHeir && !isObc && !isIncome && !isResidence && !isCommunity && !isFirstGraduate && !isChangeAddress && !isRemoveMember && !isAddMember && (
                            explicitSub === 'UPDATE_MOBILE' ||
                            explicitSub === 'CHANGE_MOBILE' ||
                            explicitSub === 'CHANGE_OF_MOBILE_NUMBER' ||
                            (draftData?.intakeState && draftData.intakeState.startsWith('RATION_CHANGE_MOBILE')) ||
                            (!explicitSub && (
                                Boolean(draftData?.subServiceData?.newMobile) ||
                                Boolean(draftData?.citizenProfile?.subServiceData?.newMobile)
                            ))
                        );
    const isChangeHead = !isExplicitNewCard && !isCanRegister && !isCanSearch && !isWidow && !isLegalHeir && !isObc && !isIncome && !isResidence && !isCommunity && !isFirstGraduate && !isChangeAddress && !isRemoveMember && !isAddMember && !isChangeMobile && (
                            explicitSub === 'CHANGE_HEAD' ||
                            explicitSub === 'FAMILY_HEAD_MEMBER_CHANGE' ||
                            (draftData?.intakeState && draftData.intakeState.startsWith('RATION_CHANGE_HEAD')) ||
                            (!explicitSub && (
                                Boolean(draftData?.subServiceData?.newHeadName) ||
                                Boolean(draftData?.citizenProfile?.subServiceData?.newHeadName)
                            ))
                        );

    const isNewCard = !isCanRegister && !isCanSearch && !isWidow && !isLegalHeir && !isObc && !isIncome && !isResidence && !isCommunity && !isFirstGraduate &&
                      !isChangeAddress && !isRemoveMember && !isAddMember && !isChangeMobile && !isChangeHead;

    const serviceName = isNewCard ? 'NEW_RATION_CARD (புதிய குடும்ப அட்டை)' :
                       (isWidow ? 'WIDOW_CERTIFICATE (விதவைச் சான்றிதழ் - REV-109)' :
                       (isLegalHeir ? 'LEGAL_HEIR_CERTIFICATE (வாரிசு சான்றிதழ் - REV-114)' :
                       (isObc ? 'OBC_CERTIFICATE (OBC சான்றிதழ் - REV-115)' :
                       (isCommunity ? 'COMMUNITY_CERTIFICATE (சாதிச் சான்றிதழ் - REV-101)' :
                       (isResidence ? 'RESIDENCE_CERTIFICATE (இருப்பிடச் சான்றிதழ் - REV-102)' :
                       (isIncome ? 'INCOME_CERTIFICATE (வருமானச் சான்றிதழ் - REV-103)' :
                       (isFirstGraduate ? 'FIRST_GRADUATE_CERTIFICATE (முதல் பட்டதாரி சான்றிதழ் - REV-104)' :
                       (isChangeAddress ? 'CHANGE_ADDRESS (முகவரி மாற்றம்)' : 
                       (isRemoveMember ? 'REMOVE_MEMBER (குடும்ப உறுப்பினர் நீக்கம்)' : 
                       (isAddMember ? 'ADD_MEMBER (உறுப்பினர் சேர்க்கை)' : 
                       (isChangeMobile ? 'UPDATE_MOBILE (கைபேசி எண் மாற்றம்)' : 
                       (isChangeHead ? 'CHANGE_HEAD (குடும்பத் தலைவர் மாற்றம்)' : 
                       (isCanRegister ? 'TNEGA_CAN_REGISTER (புதிய CAN பதிவு)' :
                       (isCanSearch ? 'TNEGA_CAN_SEARCH (CAN எண் தேடல்)' :
                       'NEW_RATION_CARD (புதிய குடும்ப அட்டை)'))))))))))))));

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

    const runId = `run_${runTimestamp}_${Math.random().toString(36).slice(2, 7)}`;
    const runStartedAtIso = new Date(runTimestamp).toISOString();
    const runCtx = {
        runId,
        operatorUid: draftData?.operatorUid || draftData?.citizenProfile?.operatorUid || '',
        operatorMobile: draftData?.operatorMobile || '',
        operatorName: draftData?.operatorName || 'admin',
        customerMobile,
        serviceName,
        startedAt: runStartedAtIso,
        lastProgressAt: runStartedAtIso,
        lastProgressMs: Date.now(),
        lastProgressMsg: `${serviceName} தொடங்கப்படுகிறது...`,
        lastDiskWriteMs: 0,
        reachedPreSubmit: false,
        midRunTelemetrySent: false,
        stuckWarningSent: false,
        stuckWatchdogTimer: null
    };
    activeRunContext = runCtx;
    writeActiveRunFlight({
        runId: runCtx.runId,
        operatorUid: runCtx.operatorUid,
        operatorMobile: runCtx.operatorMobile,
        operatorName: runCtx.operatorName,
        customerMobile: runCtx.customerMobile,
        serviceName: runCtx.serviceName,
        startedAt: runCtx.startedAt,
        lastProgressAt: runCtx.lastProgressAt,
        lastProgressMsg: runCtx.lastProgressMsg,
        reachedPreSubmit: false
    });

    global.__esevaHudFaultHandler = async (faultPayload = {}) => {
        const reason = faultPayload.reason || faultPayload.note || 'ஆபரேட்டர் பிழை அறிவிப்பு (Chrome HUD)';
        writeLogEntry(`🚨 [ஆபரேட்டர் HUD புகார்] ${reason} (Step: ${faultPayload.hudStepTitle || runCtx.lastProgressMsg})`);
        reportOperatorTelemetry({
            runId: runCtx.runId,
            operatorUid: runCtx.operatorUid,
            operatorMobile: runCtx.operatorMobile,
            operatorName: runCtx.operatorName,
            customerMobile: runCtx.customerMobile,
            serviceName: runCtx.serviceName,
            step: faultPayload.hudStepTitle || runCtx.lastProgressMsg,
            portalUrl: faultPayload.portalUrl || faultPayload.url || '',
            errorType: 'OPERATOR_HUD_FAULT_REPORT',
            errorMessage: reason,
            lastProgressMsg: runCtx.lastProgressMsg
        });
    };

    runCtx.stuckWatchdogTimer = setInterval(() => {
        try {
            if (activeAutomationAborted || runCtx.reachedPreSubmit || runCtx.stuckWarningSent) return;
            if (Date.now() - runCtx.lastProgressMs >= 120000) {
                runCtx.stuckWarningSent = true;
                writeLogEntry(`⏰ [120s Stuck Watchdog] ${runCtx.lastProgressMsg}`);
                reportOperatorTelemetry({
                    runId: runCtx.runId,
                    operatorUid: runCtx.operatorUid,
                    operatorMobile: runCtx.operatorMobile,
                    operatorName: runCtx.operatorName,
                    customerMobile: runCtx.customerMobile,
                    serviceName: runCtx.serviceName,
                    step: runCtx.lastProgressMsg,
                    errorType: 'AUTOMATION_STUCK_WARNING',
                    errorMessage: 'No automation progress for 120s before Pre-Submit Gate',
                    startedAt: runCtx.startedAt,
                    lastProgressAt: runCtx.lastProgressAt
                });
            }
        } catch (_) {}
    }, 15000);
    if (typeof runCtx.stuckWatchdogTimer.unref === 'function') runCtx.stuckWatchdogTimer.unref();

    const clearRunningSessionState = () => {
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
                if (customerMobile && storageService.getOrCreateSession) {
                    const cSess = storageService.getOrCreateSession(customerMobile);
                    if (cSess) {
                        cSess.isAutomationRunning = false;
                        cSess.isAutomating = false;
                        cSess.automationStep = 0;
                        cSess.automationCurrentStepMsg = '';
                    }
                }
            }
        } catch (_) {}
    };

    const onProgress = (msg) => {
        writeLogEntry(msg);
        if (activeAutomationAborted) return;

        const cleanMsg = String(msg || '').slice(0, 300);
        const nowMs = Date.now();
        runCtx.lastProgressMsg = cleanMsg || runCtx.lastProgressMsg;
        runCtx.lastProgressAt = new Date(nowMs).toISOString();
        runCtx.lastProgressMs = nowMs;
        if (!runCtx.reachedPreSubmit && isPreSubmitReached(cleanMsg)) {
            runCtx.reachedPreSubmit = true;
            writeActiveRunFlight({
                runId: runCtx.runId,
                operatorUid: runCtx.operatorUid,
                operatorMobile: runCtx.operatorMobile,
                operatorName: runCtx.operatorName,
                customerMobile: runCtx.customerMobile,
                serviceName: runCtx.serviceName,
                startedAt: runCtx.startedAt,
                lastProgressAt: runCtx.lastProgressAt,
                lastProgressMsg: runCtx.lastProgressMsg,
                reachedPreSubmit: true
            });
            runCtx.lastDiskWriteMs = nowMs;
        } else if (nowMs - runCtx.lastDiskWriteMs >= 1500) {
            runCtx.lastDiskWriteMs = nowMs;
            writeActiveRunFlight({
                runId: runCtx.runId,
                operatorUid: runCtx.operatorUid,
                operatorMobile: runCtx.operatorMobile,
                operatorName: runCtx.operatorName,
                customerMobile: runCtx.customerMobile,
                serviceName: runCtx.serviceName,
                startedAt: runCtx.startedAt,
                lastProgressAt: runCtx.lastProgressAt,
                lastProgressMsg: runCtx.lastProgressMsg,
                reachedPreSubmit: runCtx.reachedPreSubmit
            });
        }

        if (/பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன்|Target page, context or browser has been closed|Target closed|Browser has been closed/i.test(String(msg || ''))) {
            activeAutomationAborted = true;
            clearRunningSessionState();
            const midMeta = finalizeMidRunTelemetryIfNeeded(runCtx, {
                errorType: 'AUTOMATION_ABANDONED_MID_RUN',
                errorMessage: 'Chrome window closed before reaching Pre-Submit Gate'
            });
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('automation-finished', {
                    success: false,
                    stopped: true,
                    browserClosed: true,
                    wasRunning: true,
                    ...(midMeta || {}),
                    message: 'பிரவுசர் மூடப்பட்டதால் ஆட்டோமேஷன் தானாக நிறுத்தப்பட்டது.'
                });
            }
            return;
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('automation-step-update', msg);
        }
        try {
            const storageService = resolveStorageService();
            if (storageService && customerMobile && !activeAutomationAborted) {
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
    lastActiveTnpdsModule = automationModule;
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
    lastActiveTnegaModule = tnegaModule;
    if (tnegaModule?.setTnegaChromiumInstance && playwrightChromium) {
        tnegaModule.setTnegaChromiumInstance(playwrightChromium);
    }

    let runner = null;
    if (isWidow) {
        if (tnegaModule?.startTnegaWidowFlow) {
            runner = tnegaModule.startTnegaWidowFlow;
        } else {
            const err = 'TNeGA Widow Certificate தொகுதி (tnega_can_automation) கிடைக்கவில்லை';
            writeLogEntry(`❌ ${err}`);
            return { success: false, error: err };
        }
    } else if (isLegalHeir) {
        if (tnegaModule?.startTnegaLegalHeirFlow) {
            runner = tnegaModule.startTnegaLegalHeirFlow;
        } else {
            const err = 'TNeGA Legal Heir Certificate தொகுதி (tnega_can_automation) கிடைக்கவில்லை';
            writeLogEntry(`❌ ${err}`);
            return { success: false, error: err };
        }
    } else if (isObc) {
        if (tnegaModule?.startTnegaObcFlow) {
            runner = tnegaModule.startTnegaObcFlow;
        } else {
            const err = 'TNeGA OBC Certificate தொகுதி (tnega_can_automation) கிடைக்கவில்லை';
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
    } else if (isResidence) {
        if (tnegaModule?.startTnegaResidenceFlow) {
            runner = tnegaModule.startTnegaResidenceFlow;
        } else {
            const err = 'TNeGA Residence Certificate தொகுதி (tnega_can_automation) கிடைக்கவில்லை';
            writeLogEntry(`❌ ${err}`);
            return { success: false, error: err };
        }
    } else if (isIncome) {
        if (tnegaModule?.startTnegaIncomeFlow) {
            runner = tnegaModule.startTnegaIncomeFlow;
        } else {
            const err = 'TNeGA Income Certificate தொகுதி (tnega_can_automation) கிடைக்கவில்லை';
            writeLogEntry(`❌ ${err}`);
            return { success: false, error: err };
        }
    } else if (isFirstGraduate) {
        if (tnegaModule?.startTnegaFirstGraduateFlow) {
            runner = tnegaModule.startTnegaFirstGraduateFlow;
        } else {
            const err = 'TNeGA First Graduate Certificate தொகுதி (tnega_can_automation) கிடைக்கவில்லை';
            writeLogEntry(`❌ ${err}`);
            return { success: false, error: err };
        }
    } else if (isCanRegister) {
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
    } else if (isRemoveMember && automationModule.startTnpdsRemoveMemberFlow) {
        runner = automationModule.startTnpdsRemoveMemberFlow;
    } else if (isAddMember && automationModule.startTnpdsAddMemberFlow) {
        runner = automationModule.startTnpdsAddMemberFlow;
    } else if (isChangeAddress && automationModule.startTnpdsAddressChangeFlow) {
        runner = automationModule.startTnpdsAddressChangeFlow;
    } else if (isChangeMobile && automationModule.startTnpdsMobileChangeFlow) {
        runner = automationModule.startTnpdsMobileChangeFlow;
    } else if (isChangeHead && automationModule.startTnpdsChangeHeadFlow) {
        runner = automationModule.startTnpdsChangeHeadFlow;
    } else {
        runner = automationModule.startTnpdsRationCardFlow;
    }

    const detectedTargetService = isWidow ? 'WIDOW' :
                                  (isLegalHeir ? 'LEGAL_HEIR' :
                                  (isObc ? 'OBC' :
                                  (isCommunity ? 'COMMUNITY' :
                                  (isResidence ? 'RESIDENCE' :
                                  (isIncome ? 'INCOME' :
                                  (isFirstGraduate ? 'FIRST_GRADUATE' :
                                  (draftData?.targetService || 
                                   draftData?.citizenProfile?.targetService || 
                                   draftData?.parentService || 
                                   draftData?.citizenProfile?.parentService ||
                                   (draftData?.service === 'விதவைச் சான்றிதழ்' || draftData?.serviceId === 'WIDOW_CERTIFICATE' ? 'WIDOW' :
                                   (draftData?.service === 'வாரிசு சான்றிதழ்' || draftData?.serviceId === 'LEGAL_HEIR_CERTIFICATE' ? 'LEGAL_HEIR' :
                                   (draftData?.service === 'OBC சான்றிதழ்' || draftData?.serviceId === 'OBC_CERTIFICATE' ? 'OBC' :
                                   (draftData?.service === 'முதல் பட்டதாரி சான்றிதழ்' || draftData?.serviceId === 'FIRST_GRADUATE_CERTIFICATE' ? 'FIRST_GRADUATE' :
                                   (draftData?.service === 'சாதிச் சான்றிதழ்' || draftData?.serviceId === 'COMMUNITY_CERTIFICATE' ? 'COMMUNITY' :
                                   (draftData?.service === 'இருப்பிடச் சான்றிதழ்' || draftData?.serviceId === 'RESIDENCE_CERTIFICATE' ? 'RESIDENCE' :
                                   (draftData?.service === 'வருமானச் சான்றிதழ்' || draftData?.serviceId === 'INCOME_CERTIFICATE' ? 'INCOME' : ''))))))))))))));

    const targetProfile = {
        ...(draftData || {}),
        ...(draftData?.citizenProfile || {}),
        mobileNumber: draftData?.mobileNumber || resolved.mobClean,
        canNumber: String(draftData?.canNumber || draftData?.citizenProfile?.canNumber || resolved.diskDraft?.canNumber || resolved.diskDraft?.citizenProfile?.canNumber || '').replace(/\D+/g, ''),
        subService: isWidow ? 'WIDOW' :
                    (isLegalHeir ? 'LEGAL_HEIR' :
                    (isObc ? 'OBC' :
                    (isCommunity ? 'COMMUNITY' :
                    (isResidence ? 'RESIDENCE' :
                    (isIncome ? 'INCOME' :
                    (isFirstGraduate ? 'FIRST_GRADUATE' :
                    (isCanRegister ? 'CAN_REGISTER' :
                    (isCanSearch ? 'CAN_SEARCH' :
                    (isRemoveMember ? 'REMOVE_MEMBER' :
                    (isAddMember ? 'ADD_MEMBER' :
                    (isChangeAddress ? 'CHANGE_ADDRESS' :
                    (isChangeMobile ? 'UPDATE_MOBILE' :
                    (isChangeHead ? 'CHANGE_HEAD' : 'NEW_CARD'))))))))))))),
        targetService: detectedTargetService || targetProfile?.targetService,
        subServiceData: isNewCard ? {} : (draftData?.subServiceData || draftData?.citizenProfile?.subServiceData || {}),
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
    const isRevenueCert = Boolean(isIncome || isResidence || isCommunity || isFirstGraduate || isObc || isLegalHeir || isWidow);

    const runOptions = {
        isMockSandbox: false,
        mockSandbox: false,
        isMockSandboxMode: false,
        headless: false,
        chromium: playwrightChromium,
        targetService: detectedTargetService || targetProfile.targetService,
        canNumber: targetProfile.canNumber,
        draftData,
        subServiceData: targetProfile.subServiceData,
        operatorUid: draftData?.operatorUid || draftData?.citizenProfile?.operatorUid || '',
        operatorMobile: draftData?.operatorMobile || '',
        operatorName: draftData?.operatorName || 'admin',
        isDryRun: draftData?.isDryRun !== false,
        enableFinalSubmit: draftData?.enableSubmit === true,
        base64Docs,
        geminiApiKey: process.env.GEMINI_API_KEY || Buffer.from('QVEuQWI4Uk42S29EYklVZUlJbnMwNGFZLXdxQ2VTTkZidFhXTWxHdzRnY3lqeUVjRnBqdHc=', 'base64').toString('utf8'),
        serverUrl: process.env.ESEVA_DEV_URL || 'https://esevadraft.in'
    };

    runRevenueServiceWithAutoCan({
        isRevenueCert,
        tnegaModule,
        runner,
        targetProfile,
        onProgress,
        runOptions,
        writeLogEntry
    }).then(res => {
        clearRunningSessionState();
        writeLogEntry(`[முடிவு நிலை] ஆட்டோமேஷன் நிறைவுற்றது: Success=${res?.success}`);
        if (res && (res.success || isPreSubmitReached(res))) {
            runCtx.reachedPreSubmit = true;
        }
        const isAbandoned = Boolean(res?.stopped || res?.browserClosed);
        const midMeta = finalizeMidRunTelemetryIfNeeded(runCtx, {
            step: res?.step || runCtx.lastProgressMsg,
            errorType: isAbandoned ? 'AUTOMATION_ABANDONED_MID_RUN' : 'AUTOMATION_FAILED',
            errorMessage: res?.error || res?.message || (isAbandoned ? 'Stopped mid-run before reaching Pre-Submit Gate' : 'Automation finished with failure')
        });
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('automation-finished', {
                ...(res || {}),
                ...(midMeta || {})
            });
        }
    }).catch(err => {
        clearRunningSessionState();
        writeLogEntry(`[விபத்து பிழை] ${err.message}\n${err.stack}`);
        const midMeta = finalizeMidRunTelemetryIfNeeded(runCtx, {
            step: 'AUTOMATION_CRASH',
            errorType: 'AUTOMATION_CRASH',
            errorMessage: err.message || 'Automation crashed unexpectedly'
        });
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('automation-finished', {
                success: false,
                stopped: true,
                error: err.message,
                ...(midMeta || {}),
                message: `ஆட்டோமேஷன் நிறுத்தப்பட்டது: ${err.message}`
            });
        }
    });

    const portalName = (isCanRegister || isCanSearch || isRevenueCert) ? 'TNeGA' : 'TNPDS';
    return { success: true, message: `${portalName} Chrome திறக்கப்பட்டது — படிவம் தானாக நிரப்பப்படுகிறது!` };
}

/**
 * Universal Revenue Department Pre-CAN + Certificate Chaining Guard.
 * Works across ALL 7 TNeGA Revenue Certificates without modifying frozen certificate files:
 *  - If CAN is missing before launch -> searches portal -> auto-registers CAN if not found -> continues straight to Certificate.
 *  - If certificate still returns { needCanRegister: true } -> auto-registers CAN -> re-enters Certificate up to Pre-Submit Gate.
 */
async function runRevenueServiceWithAutoCan({ isRevenueCert, tnegaModule, runner, targetProfile, onProgress, runOptions, writeLogEntry }) {
    const canRegFn = tnegaModule && (tnegaModule.startTnegaCanRegisterFlow || tnegaModule.registerNewCan);

    if (isRevenueCert && !targetProfile.canNumber && typeof canRegFn === 'function') {
        const msgStart = '🔍 [தானியங்கி CAN + சான்றிதழ் சங்கிலி] சுயவிவரத்தில் CAN எண் இல்லை — போர்ட்டலில் CAN தேடி, இல்லாவிட்டால் உடனடியாக புதிய CAN பதிவு செய்து தொடர்ந்து சான்றிதழ் விண்ணப்பத்தை நிரப்புகிறது...';
        onProgress(msgStart);
        if (typeof writeLogEntry === 'function') writeLogEntry(msgStart);

        const canRes = await canRegFn(targetProfile, onProgress, {
            ...runOptions,
            returnAfterCanResolved: true
        });
        if (!canRes || !canRes.success || !canRes.canNumber) {
            return canRes || { success: false, needCanRegister: true, error: 'CAN resolution halted before certificate stage' };
        }

        const resolvedCan = String(canRes.canNumber).replace(/\D+/g, '');
        targetProfile.canNumber = resolvedCan;
        runOptions.canNumber = resolvedCan;
        if (runOptions.draftData) {
            runOptions.draftData.canNumber = resolvedCan;
            if (runOptions.draftData.citizenProfile) runOptions.draftData.citizenProfile.canNumber = resolvedCan;
        }
        const msgHandover = `✅ CAN எண் (${resolvedCan}) உறுதி செய்யப்பட்டது — இப்போது ${runOptions.targetService || targetProfile.subService} சான்றிதழ் படிவத்திற்குத் தானாகத் தொடர்கிறது!`;
        onProgress(msgHandover);
        if (typeof writeLogEntry === 'function') writeLogEntry(msgHandover);
    }

    let certRes = await runner(targetProfile, onProgress, runOptions);

    if (isRevenueCert && certRes && certRes.needCanRegister === true && typeof canRegFn === 'function') {
        const msgFallback = '🔄 [தானியங்கி மீட்பு] போர்ட்டலில் CAN எண் இல்லாததால் தானாகவே "Register Can" பக்கம் சென்று புதிய CAN பதிவு செய்து சான்றிதழைத் தொடர்கிறது...';
        onProgress(msgFallback);
        if (typeof writeLogEntry === 'function') writeLogEntry(msgFallback);

        targetProfile.canNumber = '';
        runOptions.canNumber = '';
        const canRes = await canRegFn(targetProfile, onProgress, {
            ...runOptions,
            canNumber: '',
            returnAfterCanResolved: true,
            forceNewCanRegister: true
        });
        if (!canRes || !canRes.success || !canRes.canNumber) {
            return canRes || certRes;
        }

        const resolvedCan = String(canRes.canNumber).replace(/\D+/g, '');
        targetProfile.canNumber = resolvedCan;
        runOptions.canNumber = resolvedCan;
        if (runOptions.draftData) {
            runOptions.draftData.canNumber = resolvedCan;
            if (runOptions.draftData.citizenProfile) runOptions.draftData.citizenProfile.canNumber = resolvedCan;
        }
        onProgress(`✅ புதிய CAN எண் (${resolvedCan}) பதிவு செய்யப்பட்டது — சான்றிதழ் படிவம் தொடர்கிறது!`);
        certRes = await runner(targetProfile, onProgress, runOptions);
    }

    return certRes;
}

async function stopActiveAutomation() {
    activeAutomationAborted = true;

    try {
        const mod = lastActiveTnpdsModule || loadAutomationModule();
        if (mod && mod.stopTnpdsAutomation) {
            await mod.stopTnpdsAutomation();
        }
    } catch (_) {}

    try {
        const tnegaMod1 = lastActiveTnegaModule || loadTnegaAutomationModule();
        if (tnegaMod1 && tnegaMod1.stopTnegaAutomation) {
            await tnegaMod1.stopTnegaAutomation();
        }
    } catch (_) {}

    try {
        const tnegaMod2 = require('../tnega_can_automation');
        if (tnegaMod2 && tnegaMod2.stopTnegaAutomation) {
            await tnegaMod2.stopTnegaAutomation();
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

    const midMeta = reportMidRunStopIfNeeded({
        silent: false,
        reason: 'Operator stopped automation via stopActiveAutomation before Pre-Submit Gate'
    });
    try {
        if (lastMainWindowRef && !lastMainWindowRef.isDestroyed()) {
            lastMainWindowRef.webContents.send('automation-finished', {
                success: false,
                stopped: true,
                wasRunning: true,
                ...(midMeta || {}),
                message: 'ஆட்டோமேஷன் நிறுத்தப்பட்டது.'
            });
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
    runRevenueServiceWithAutoCan,
    resolveDiskDraftAndGas,
    loadAutomationModule,
    resolveStorageService,
    stopActiveAutomation,
    finalizeMidRunTelemetryIfNeeded,
    reportMidRunStopIfNeeded
};
