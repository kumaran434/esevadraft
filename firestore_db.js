// =========================================================================
// eSevaDraft Database & Document Storage Orchestrator (Facade)
// Universal Cloud & Local Dual-Store Adapter
// =========================================================================
const { STORAGE_BUCKET, downloadDocFromStorage, fileToBase64 } = require('./src/services/db/firestore_client');
const { saveCitizenDraft } = require('./src/services/db/draft_save');
const { getCitizenDraft } = require('./src/services/db/draft_get');
const { listAllDrafts, trashCitizenDraft, restoreCitizenDraft, deleteCitizenDraft, migrateCustomerUploads } = require('./src/services/db/draft_manage');
const { saveUserProfile, getUserProfile, deleteUserProfile, lookupUserByMobile, saveActiveOperatorSession, getActiveOperatorSession, clearActiveOperatorSession } = require('./src/services/db/user_profile_store');
const { logOperatorCorrection, logOperatorError, listOperatorErrors } = require('./src/services/db/telemetry_store');

module.exports = {
    saveCitizenDraft,
    getCitizenDraft,
    listAllDrafts,
    trashCitizenDraft,
    restoreCitizenDraft,
    deleteCitizenDraft,
    migrateCustomerUploads,
    saveUserProfile,
    getUserProfile,
    deleteUserProfile,
    lookupUserByMobile,
    saveActiveOperatorSession,
    getActiveOperatorSession,
    clearActiveOperatorSession,
    logOperatorCorrection,
    logOperatorError,
    listOperatorErrors,
    downloadDocFromStorage,
    fileToBase64,
    STORAGE_BUCKET
};
