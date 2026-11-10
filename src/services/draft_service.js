/**
 * eSevaDraft Draft Management Service (Modular Architecture)
 * 
 * Handles:
 * 1. Draft retrieval, normalization, and listing.
 * 2. Saving citizen drafts with base64 docs and metadata.
 * 3. Soft-delete / Trash and restore lifecycle.
 * 4. Permanent deletion and disk cleanup.
 */

const fs = require('fs');
const path = require('path');
const {
    saveCitizenDraft,
    getCitizenDraft,
    listAllDrafts,
    trashCitizenDraft,
    restoreCitizenDraft,
    deleteCitizenDraft
} = require('../../firestore_db');

/**
 * Lists drafts for an operator or all drafts.
 */
async function fetchDraftsList(operatorUid = null) {
    try {
        const drafts = await listAllDrafts(operatorUid);
        return { success: true, drafts: drafts || [] };
    } catch (err) {
        console.error('Failed to list drafts:', err.message);
        return { success: false, drafts: [], error: err.message };
    }
}

/**
 * Retrieves a single draft by mobile number.
 */
async function fetchDraftByMobile(mobileNumber) {
    try {
        const cleanMobile = String(mobileNumber).replace(/\D/g, '');
        const draft = await getCitizenDraft(cleanMobile);
        return { success: true, draft };
    } catch (err) {
        console.error(`Failed to fetch draft for ${mobileNumber}:`, err.message);
        return { success: false, draft: null, error: err.message };
    }
}

/**
 * Saves or updates a draft.
 */
async function persistDraft(mobileNumber, draftData) {
    try {
        const cleanMobile = String(mobileNumber).replace(/\D/g, '');
        await saveCitizenDraft(cleanMobile, draftData);
        return { success: true };
    } catch (err) {
        console.error(`Failed to save draft for ${mobileNumber}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Trashes a draft.
 */
async function trashDraft(mobileNumber) {
    try {
        const cleanMobile = String(mobileNumber).replace(/\D/g, '');
        await trashCitizenDraft(cleanMobile);
        return { success: true };
    } catch (err) {
        console.error(`Failed to trash draft for ${mobileNumber}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Restores a trashed draft.
 */
async function restoreDraft(mobileNumber) {
    try {
        const cleanMobile = String(mobileNumber).replace(/\D/g, '');
        await restoreCitizenDraft(cleanMobile);
        return { success: true };
    } catch (err) {
        console.error(`Failed to restore draft for ${mobileNumber}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Permanently deletes a draft.
 */
async function permanentlyDeleteDraft(mobileNumber) {
    try {
        const cleanMobile = String(mobileNumber).replace(/\D/g, '');
        await deleteCitizenDraft(cleanMobile);
        return { success: true };
    } catch (err) {
        console.error(`Failed to permanently delete draft for ${mobileNumber}:`, err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    fetchDraftsList,
    fetchDraftByMobile,
    persistDraft,
    trashDraft,
    restoreDraft,
    permanentlyDeleteDraft
};
