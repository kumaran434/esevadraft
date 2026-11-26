const storageService = require('../../services/storage_service');
const { saveCitizenDraft } = require('../../../firestore_db');
const { handleServiceSelection, handleRationSubserviceWorkflow } = require('../../core/chat_fsm');
const { resolveCartridge, getCartridgeById } = require('../../cartridges');
const { generateUniqueDraftId, setActiveDraftIdForMobile, extractMobileFromDraftKey } = require('../../services/db/firestore_client');

const { persistSessions } = storageService;

async function syncSelectedServiceDraft(ctx, sess) {
    const mob = (ctx?.targetMobile || sess?.mobileNumber || sess?.citizenProfile?.mobileNumber || '').trim();
    if (!mob || /^walkin_/i.test(mob)) return;
    if (!sess?.citizenProfile || (!sess.citizenProfile.fullNameEng && !sess.citizenProfile.fullNameTam && !sess.citizenProfile.headAadhaar)) return;
    try {
        const mergedCleanDocs = {};
        for (const [k, v] of Object.entries({ ...(sess.citizenProfile?.documents || {}), ...(sess.tempUploads || {}) })) {
            if (v !== null && v !== undefined && v !== '') mergedCleanDocs[k] = v;
        }
        const saveKey = sess.draftId || mob;
        await saveCitizenDraft(saveKey, {
            draftId: saveKey,
            mobileNumber: mob,
            subService: sess.subService ?? null,
            subServiceData: sess.subServiceData ?? null,
            pluginId: sess.pluginId ?? null,
            targetService: sess.targetService ?? null,
            serviceId: sess.serviceId ?? null,
            intakeState: sess.intakeState,
            step: sess.intakeState || sess.step,
            citizenProfile: sess.citizenProfile,
            documents: mergedCleanDocs,
            tempUploads: mergedCleanDocs,
            chatHistory: Array.isArray(sess.chatHistory) ? sess.chatHistory : []
        });
    } catch (_) {}
}

const CAN_ACTION_TOKENS = new Set([
    'CAN_REGISTER_PROMPT', 'CAN_SEARCH_PROMPT', 'CAN_DIRECT_INPUT',
    'START_CAN_SEARCH', 'START_CAN_REGISTER', 'LAUNCH_CAN_AUTOMATION',
    'START_INCOME_APPLY', 'START_RESIDENCE_APPLY', 'START_COMMUNITY_APPLY',
    'START_FIRST_GRADUATE_APPLY', 'START_OBC_APPLY', 'START_LEGAL_HEIR_APPLY',
    'START_WIDOW_APPLY', 'FIRST_GRADUATE_CONFIRMED', 'FIRST_GRADUATE_INELIGIBLE',
    'CAN_SEARCH_OTHER', 'என்னிடம் CAN உள்ளது', 'CAN_DIRECT'
]);

const CAN_ACTION_PREFIXES = [
    'FIRST_GRADUATE_', 'OBC_', 'LH_', 'LEGAL_HEIR_', 'WD_', 'WIDOW_',
    'INC_', 'INCOME_', 'RESIDENCE_', 'SKIP_', 'SELECT_MEMBER_', 'COMMUNITY_', 'RELIGION_'
];

async function handleServiceSelector(ctx, req, res) {
    const { text, uploadedFile } = ctx;
    let sess = ctx.sess;

    const isCanAction = CAN_ACTION_TOKENS.has(text) || (text && CAN_ACTION_PREFIXES.some(p => text.startsWith(p)));
    if (isCanAction) return false;

    // 1. Service Selection or Category Navigation -> Pure Cartridge Switchboard
    const isCategorySwitch = text === 'வருவாய்த் துறை' ||
                             text === 'வருவாய்த் துறை சான்றிதழ்கள்' ||
                             text === 'வருவாய் துறை' ||
                             text === 'REVENUE_DEPARTMENT' ||
                             text === 'REVENUE_DEPARTMENT_SERVICES' ||
                             text === 'MAIN_MENU' ||
                             text === 'முதன்மைப் பட்டியல்' ||
                             (text && text.includes('முதன்மைப் பட்டியல்')) ||
                             text === 'ரேஷன் கார்டு' ||
                             text === 'VOTER_ID' ||
                             text === 'புதிய வாக்காளர் அட்டை' ||
                             text === 'குடும்ப அட்டை வகை மாற்றம்' ||
                             text === 'எரிவாயு விவரங்கள் திருத்தம்' ||
                             (text && /^[1-8]\./.test(text));

    const matchedSelection = require('../../cartridges').resolveCartridgeForSelection(text, sess);
    if (
        sess.intakeState === 'SERVICE_SELECTION' ||
        sess.intakeState === 'RATION_CARD_SERVICES' ||
        sess.intakeState === 'REVENUE_DEPARTMENT_SERVICES' ||
        isCategorySwitch ||
        matchedSelection
    ) {
        // Protect previously saved draft: if this non-fresh session already holds real saved application data
        // and the operator navigates back to service menus / starts another service, fork a fresh isolated session object
        // so the previously saved draft in RAM, disk, and cloud is NEVER mutated, overwritten, or wiped!
        const hasSavedSubPayload = Boolean(
            !sess._isPureFreshSession && (
                sess.applicationNumber ||
                (sess.subService && sess.subServiceData && Object.keys(sess.subServiceData).some(k => k !== '_savedCandidates' && Boolean(sess.subServiceData[k])))
            )
        );
        const isLeavingToMenuOrNewService = Boolean(isCategorySwitch || matchedSelection) &&
            sess.intakeState !== 'SERVICE_SELECTION' &&
            sess.intakeState !== 'RATION_CARD_SERVICES' &&
            sess.intakeState !== 'REVENUE_DEPARTMENT_SERVICES';
        if (hasSavedSubPayload && isLeavingToMenuOrNewService) {
            const forkMob = extractMobileFromDraftKey(ctx?.targetMobile || sess.mobileNumber || sess.citizenProfile?.mobileNumber || sess.draftId || '');
            if (forkMob && !/^walkin_/i.test(forkMob) && /^[6-9]\d{9}$/.test(forkMob)) {
                const newDraftId = generateUniqueDraftId(forkMob);
                const freshProf = storageService.createFreshProfile(forkMob);
                const clonedVaultDocs = Array.isArray(sess.citizenProfile?.savedVaultDocs) ? [...sess.citizenProfile.savedVaultDocs] : undefined;
                const clonedSavedMembers = Array.isArray(sess.citizenProfile?.savedFamilyMembers) ? [...sess.citizenProfile.savedFamilyMembers] : undefined;
                if (clonedVaultDocs) freshProf.savedVaultDocs = clonedVaultDocs;
                if (clonedSavedMembers) freshProf.savedFamilyMembers = clonedSavedMembers;
                const forkedSess = {
                    draftId: newDraftId,
                    mobileNumber: forkMob,
                    operatorUid: sess.operatorUid || ctx?.reqOpUid || null,
                    operatorName: sess.operatorName || null,
                    operatorMobile: sess.operatorMobile || null,
                    role: sess.role || 'citizen',
                    citizenProfile: freshProf,
                    subService: null,
                    subServiceData: null,
                    applicationNumber: null,
                    applicationPdfUrl: null,
                    targetMemberCount: 1,
                    currentMemberIdx: 1,
                    step: 'intake',
                    intakeState: 'SERVICE_SELECTION',
                    chatHistory: [],
                    _draftChecked: true,
                    _isPureFreshSession: true,
                    tempUploads: {},
                    documents: {},
                    base64Docs: {},
                    tempMember: null
                };
                sess = forkedSess;
                ctx.sess = forkedSess;
                setActiveDraftIdForMobile(forkMob, newDraftId, forkedSess.operatorUid);
                storageService.sessions.set(newDraftId, forkedSess);
                if (forkedSess.operatorUid) {
                    storageService.sessions.set(`${forkedSess.operatorUid}::${forkMob}`, forkedSess);
                }
                storageService.setSessionState(forkedSess);
            }
        }
        handleServiceSelection(text, sess);
        try {
            const matchedCartridge = resolveCartridge({
                subService: sess.subService,
                intakeState: sess.intakeState,
                targetService: sess.citizenProfile?.targetService,
                service: sess.citizenProfile?.service
            });
            if (matchedCartridge) {
                sess.pluginId = matchedCartridge.id;
                if (sess.citizenProfile) sess.citizenProfile.pluginId = matchedCartridge.id;
            }
        } catch (_) {}
        persistSessions();
        await syncSelectedServiceDraft(ctx, sess);
        const lastBotMsg = sess.chatHistory[sess.chatHistory.length - 1];
        const isWalkinMenuOnly = (!ctx.targetMobile || /^walkin_/i.test(String(ctx.targetMobile))) &&
            (sess.intakeState === 'SERVICE_SELECTION' || sess.intakeState === 'RATION_CARD_SERVICES' || sess.intakeState === 'REVENUE_DEPARTMENT_SERVICES');
        res.json({
            chatHistory: sess.chatHistory,
            citizenProfile: isWalkinMenuOnly ? null : sess.citizenProfile,
            draftId: sess.draftId || null,
            step: sess.intakeState,
            intakeState: sess.intakeState,
            pluginId: sess.pluginId ?? null,
            subService: sess.subService !== undefined ? sess.subService : (sess.citizenProfile?.subService ?? null),
            subServiceData: sess.subServiceData !== undefined ? sess.subServiceData : (sess.citizenProfile?.subServiceData ?? null),
            botResponse: lastBotMsg ? lastBotMsg.text : ''
        });
        return true;
    }

    // 2. TNPDS Subservice Active Turn -> Route strictly to owning TNPDS Cartridge intake.js
    const isHeadChangeCmd = Boolean(text && text.startsWith('HEAD_') && text !== 'HEAD_DETAILS_CONFIRMED' && text !== 'HEAD_PHOTO');
    const isSubserviceTurn = (sess.intakeState && sess.intakeState.startsWith('RATION_') && sess.intakeState !== 'RATION_CARD_SERVICES') ||
        (text && (text.startsWith('ADD_MEMBER_') || text.startsWith('REMOVE_') || isHeadChangeCmd || text.startsWith('ADDR_') || text === 'CHILD_UNDER_5' || text === 'ADULT_ABOVE_5' || text === 'RATION_ADD_MEMBER_RESET' || text === 'RATION_CHANGE_ADDRESS_RESET' || text === 'RATION_REMOVE_MEMBER_RESET'));

    if (isSubserviceTurn) {
        let targetCartridge = null;
        if (text === 'RATION_ADD_MEMBER_RESET' || (text && text.startsWith('ADD_MEMBER_')) || text === 'CHILD_UNDER_5' || text === 'ADULT_ABOVE_5') {
            targetCartridge = getCartridgeById('TNPDS_ADD_MEMBER');
        } else if (text === 'RATION_REMOVE_MEMBER_RESET' || (text && text.startsWith('REMOVE_'))) {
            targetCartridge = getCartridgeById('TNPDS_REMOVE_MEMBER');
        } else if (text === 'RATION_CHANGE_ADDRESS_RESET' || (text && text.startsWith('ADDR_'))) {
            targetCartridge = getCartridgeById('TNPDS_CHANGE_ADDRESS');
        } else if (isHeadChangeCmd) {
            targetCartridge = getCartridgeById('TNPDS_CHANGE_HEAD');
        } else {
            targetCartridge = resolveCartridge({ subService: sess.subService, intakeState: sess.intakeState });
        }

        if (targetCartridge && targetCartridge.portal === 'TNPDS' && targetCartridge.id !== 'TNPDS_NEW_CARD' && targetCartridge.intake && typeof targetCartridge.intake.handleIntake === 'function') {
            if (await targetCartridge.intake.handleIntake(ctx, req, res)) return true;
        }

        // Placeholder fallback (CHANGE_CARD_TYPE / LPG_UPDATE)
        const handled = await handleRationSubserviceWorkflow(text, sess, uploadedFile, null);
        if (handled) {
            persistSessions();
            await syncSelectedServiceDraft(ctx, sess);
            const lastBotMsg = sess.chatHistory[sess.chatHistory.length - 1];
            res.json({
                chatHistory: sess.chatHistory,
                citizenProfile: sess.citizenProfile,
                step: sess.intakeState,
                intakeState: sess.intakeState,
                subService: sess.subService,
                subServiceData: sess.subServiceData,
                documents: sess.tempUploads || {},
                botResponse: lastBotMsg ? lastBotMsg.text : ''
            });
            return true;
        }
    }

    return false;
}

module.exports = { handleServiceSelector };
