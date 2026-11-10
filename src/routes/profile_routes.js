const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { getCitizenDraft, saveCitizenDraft, deleteCitizenDraft, migrateCustomerUploads } = require('../../firestore_db');
const { saveCitizenProfile, deleteCitizenProfile } = require('../../database');
const storageService = require('../services/storage_service');
const { 
    sessions, 
    createFreshProfile, 
    getOrCreateSession, 
    getActiveMobile, 
    setActiveMobile, 
    setSessionState, 
    persistSessions 
} = storageService;

const { syncFatherOrHusband } = require('../services/profile_helpers');
const { resolveTnDistrict } = require('../../tn_district_mapper');
const { applyProfileUpdates } = require('../services/profile_update_service');

// POST /api/profile/update
router.post('/api/profile/update', async (req, res) => {
    try {
        const updated = req.body;
        const rawNewMobile = updated.mobileNumber || updated.mobile || '';
        let cleanNewMobile = String(rawNewMobile).replace(/\D/g, '');
        if (cleanNewMobile.length === 12 && cleanNewMobile.startsWith('91')) {
            cleanNewMobile = cleanNewMobile.slice(2);
        }

        const rawOldMobile = updated.oldMobileNumber || updated.oldMobile || req.headers['x-old-session-mobile'] || '';
        let cleanOldMobile = String(rawOldMobile).replace(/\D/g, '');
        if (cleanOldMobile.length === 12 && cleanOldMobile.startsWith('91')) {
            cleanOldMobile = cleanOldMobile.slice(2);
        }

        const activeMob = getActiveMobile();
        const headerMob = req.headers['x-session-mobile'] || '';
        let cleanHeaderMob = String(headerMob).replace(/\D/g, '');
        if (cleanHeaderMob.length === 12 && cleanHeaderMob.startsWith('91')) {
            cleanHeaderMob = cleanHeaderMob.slice(2);
        }

        // If old mobile not explicitly sent in body, but header was different from new mobile:
        if (!cleanOldMobile && cleanHeaderMob && cleanNewMobile && cleanHeaderMob !== cleanNewMobile) {
            cleanOldMobile = cleanHeaderMob;
        }

        // Preserve walk-in keys if applicable
        if (!cleanOldMobile && headerMob && headerMob.startsWith('walkin_')) {
            cleanOldMobile = headerMob;
        }

        const currentTarget = cleanOldMobile || cleanNewMobile || activeMob || '';
        const sess = (currentTarget && typeof getOrCreateSession === 'function') 
            ? getOrCreateSession(currentTarget) 
            : (storageService.getSessionState() || createFreshProfile(currentTarget || ''));

        if (!sess.citizenProfile) {
            sess.citizenProfile = createFreshProfile(currentTarget || '');
        }

        // Check if existing draft exists for currentTarget to inherit all details and documents
        if (currentTarget && (!sess.citizenProfile.fullNameEng || (sess.citizenProfile.gasDetails && !sess.citizenProfile.gasDetails.consumerNumber))) {
            try {
                const existingDraft = await getCitizenDraft(currentTarget);
                if (existingDraft && existingDraft.citizenProfile) {
                    sess.citizenProfile = {
                        ...createFreshProfile(currentTarget),
                        ...existingDraft.citizenProfile,
                        ...sess.citizenProfile
                    };
                    if (existingDraft.citizenProfile.gasDetails) {
                        sess.citizenProfile.gasDetails = {
                            ...(existingDraft.citizenProfile.gasDetails || {}),
                            ...(sess.citizenProfile.gasDetails || {})
                        };
                        if (existingDraft.citizenProfile.gasDetails.consumerNumber && !sess.citizenProfile.gasDetails.consumerNumber) {
                            sess.citizenProfile.gasDetails.consumerNumber = existingDraft.citizenProfile.gasDetails.consumerNumber;
                        }
                        if (existingDraft.citizenProfile.gasDetails.agencyName && !sess.citizenProfile.gasDetails.agencyName) {
                            sess.citizenProfile.gasDetails.agencyName = existingDraft.citizenProfile.gasDetails.agencyName;
                        }
                    }
                    if (existingDraft.documents) {
                        sess.tempUploads = { ...(existingDraft.documents || {}), ...(sess.tempUploads || {}) };
                    }
                    if (existingDraft.base64Docs) {
                        sess.base64Docs = { ...(existingDraft.base64Docs || {}), ...(sess.base64Docs || {}) };
                    }
                }
            } catch (_) {}
        }

        applyProfileUpdates(sess, updated);

        const is10Digit = cleanNewMobile.length === 10 && ['6', '7', '8', '9'].includes(cleanNewMobile[0]);
        let activeCustKey = is10Digit ? cleanNewMobile : currentTarget;

        if (is10Digit) {
            sess.citizenProfile.mobileNumber = cleanNewMobile;
            sessions.set(cleanNewMobile, sess);

            if (cleanOldMobile && cleanOldMobile !== cleanNewMobile) {
                // Phone number has changed!
                if (sessions.has(cleanOldMobile)) {
                    sessions.delete(cleanOldMobile);
                }
                if (getActiveMobile() === cleanOldMobile) {
                    setActiveMobile(cleanNewMobile);
                }

                // Migrate physical upload folders from oldMobile to newMobile
                try {
                    if (typeof migrateCustomerUploads === 'function') {
                        migrateCustomerUploads(cleanOldMobile, cleanNewMobile);
                    }
                } catch (_) {}

                // Migrate document paths containing cleanOldMobile
                try {
                    const rewriteDocPath = (p) => {
                        if (typeof p === 'string' && (p.includes(`/${cleanOldMobile}/`) || p.includes(`\\${cleanOldMobile}\\`) || p.includes(`_${cleanOldMobile}_`))) {
                            const newP = p
                                .replace(new RegExp(`([/\\\\])${cleanOldMobile}([/\\\\])`, 'g'), `$1${cleanNewMobile}$2`)
                                .replace(new RegExp(`_${cleanOldMobile}_`, 'g'), `_${cleanNewMobile}_`);
                            return fs.existsSync(newP) ? newP : p;
                        }
                        return p;
                    };
                    if (sess.citizenProfile.documents) {
                        for (const k of Object.keys(sess.citizenProfile.documents)) {
                            sess.citizenProfile.documents[k] = rewriteDocPath(sess.citizenProfile.documents[k]);
                        }
                    }
                    if (sess.tempUploads) {
                        for (const k of Object.keys(sess.tempUploads)) {
                            sess.tempUploads[k] = rewriteDocPath(sess.tempUploads[k]);
                        }
                    }
                } catch (_) {}

                // Purge / delete old citizen draft and profile so duplicate profile is NEVER created!
                await deleteCitizenDraft(cleanOldMobile, { preserveUploads: true }).catch(() => {});
                try { deleteCitizenProfile(cleanOldMobile); } catch (_) {}
                if (typeof storageService.purgeSession === 'function') {
                    storageService.purgeSession(cleanOldMobile);
                }
            }
        }

        if (sess === storageService.getSessionState() || getActiveMobile() === activeCustKey) {
            setSessionState(sess);
        }

        if (activeCustKey) {
            saveCitizenProfile(activeCustKey, sess.citizenProfile);
            try {
                const existingDraft = await getCitizenDraft(activeCustKey).catch(() => null);
                const docsToSave = {
                    ...(existingDraft?.documents || {}),
                    ...(sess.tempUploads || {}),
                    ...(sess.citizenProfile?.documents || {})
                };
                if (sess.citizenProfile?.gasDetails?.gasBookPath) docsToSave.gasBook = sess.citizenProfile.gasDetails.gasBookPath;
                if (sess.citizenProfile?.residenceProof?.docPath) docsToSave.residenceProof = sess.citizenProfile.residenceProof.docPath;
                if (docsToSave.gasBook && !docsToSave.residenceProof) docsToSave.residenceProof = docsToSave.gasBook;
                if (docsToSave.residenceProof && !docsToSave.gasBook) docsToSave.gasBook = docsToSave.residenceProof;
                if (sess.citizenProfile) {
                    if (docsToSave.gasBook && (!sess.citizenProfile.gasDetails || !sess.citizenProfile.gasDetails.gasBookPath)) {
                        sess.citizenProfile.gasDetails = sess.citizenProfile.gasDetails || {};
                        sess.citizenProfile.gasDetails.gasBookPath = docsToSave.gasBook;
                        sess.citizenProfile.gasDetails.hasGas = true;
                    }
                    if (docsToSave.residenceProof && (!sess.citizenProfile.residenceProof || !sess.citizenProfile.residenceProof.docPath)) {
                        sess.citizenProfile.residenceProof = sess.citizenProfile.residenceProof || {};
                        sess.citizenProfile.residenceProof.docPath = docsToSave.residenceProof;
                        sess.citizenProfile.residenceProof.type = sess.citizenProfile.residenceProof.type || 'GAS_BOOK';
                        sess.citizenProfile.residenceProof.typeTam = sess.citizenProfile.residenceProof.typeTam || 'எரிவாயு நுகர்வோர் அட்டை';
                    }
                }
                if (sess.citizenProfile?.headPhotoPath) docsToSave.profilePhoto = sess.citizenProfile.headPhotoPath;
                if (sess.citizenProfile?.headAadhaarDocPath) docsToSave.headAadhaar = sess.citizenProfile.headAadhaarDocPath;

                const base64Docs = Object.assign({}, existingDraft?.base64Docs || {}, sess.base64Docs || {}, sess.citizenProfile?.base64Docs || {});
                for (const [dk, dp] of Object.entries(docsToSave)) {
                    if (dp && typeof dp === 'string' && fs.existsSync(dp) && !base64Docs[`${dk}Base64`]) {
                        try {
                            base64Docs[`${dk}Base64`] = fs.readFileSync(dp).toString('base64');
                            base64Docs[`${dk}Name`] = path.basename(dp);
                        } catch (_) {}
                    }
                }
                if (docsToSave.gasBook && fs.existsSync(docsToSave.gasBook)) {
                    try {
                        const gb64 = fs.readFileSync(docsToSave.gasBook).toString('base64');
                        const gbName = path.basename(docsToSave.gasBook);
                        base64Docs.gasBookBase64 = gb64;
                        base64Docs.gasBookName = gbName;
                        base64Docs.residenceProofBase64 = gb64;
                        base64Docs.residenceProofName = gbName;
                    } catch (_) {}
                }
                sess.base64Docs = base64Docs;
                if (sess.citizenProfile) sess.citizenProfile.base64Docs = base64Docs;

                await saveCitizenDraft(activeCustKey, {
                    operatorUid: sess.operatorUid || null,
                    operatorName: sess.operatorName || null,
                    operatorMobile: sess.operatorMobile || null,
                    citizenProfile: sess.citizenProfile,
                    documents: docsToSave,
                    base64Docs: base64Docs,
                    chatHistory: sess.chatHistory,
                    intakeState: sess.intakeState,
                    step: sess.step || 'draft',
                    status: sess.applicationNumber ? 'SUBMITTED' : 'DRAFT_SAVED'
                });
            } catch (e) {
                console.warn('Draft sync on profile update error:', e.message);
            }
            persistSessions();
        }

        setSessionState(sess);

        const isFromEditModal = req.body.fromEditModal === true || req.body.silent === true;
        const isIntakeFinished = ['READY_TO_APPLY', 'CONFIRM_SUBMIT', 'WAITING_FOR_OTP', 'COMPLETED'].includes(sess.intakeState);

        if (!isFromEditModal && !isIntakeFinished) {
            const confirmValue = (sess.intakeState === 'HEAD_DETAILS_VERIFY' ? 'HEAD_DETAILS_CONFIRMED' : (sess.intakeState === 'MEMBER_DETAILS_VERIFY' ? 'MEMBER_DETAILS_CONFIRMED' : 'Start'));
            const phoneLine = is10Digit ? `• 📱 **கைபேசி எண்:** +91 ${cleanNewMobile}\n` : '';
            const msgObj = {
                sender: 'bot',
                text: `✏️ **விவரங்கள் வெற்றிகரமாகத் திருத்தப்பட்டு சேமிக்கப்பட்டன!** 💾\n\n` +
                      `• 👤 **பெயர்:** ${sess.citizenProfile.fullNameTam} (${sess.citizenProfile.fullNameEng})\n` +
                      phoneLine +
                      `• 🎂 **பிறந்த தேதி:** ${sess.citizenProfile.headDob || '—'}\n` +
                      `• 🏠 **முகவரி:** ${sess.citizenProfile.doorNo ? sess.citizenProfile.doorNo + ', ' : ''}${sess.citizenProfile.streetTam || sess.citizenProfile.streetEng || '—'}, ${sess.citizenProfile.pincode || ''}\n\n` +
                      `விவரங்கள் அனைத்தும் சரியாக உள்ளதா என உறுதிப்படுத்தவும்:`,
                options: [
                    { label: "✅ விவரங்கள் அனைத்தும் சரி (Confirmed - Continue)", value: confirmValue },
                    { label: "✏️ மீண்டும் திருத்து (Edit Again)", value: "TRIGGER_EDIT_MODAL" }
                ]
            };
            const lastMsg = sess.chatHistory[sess.chatHistory.length - 1];
            if (lastMsg && lastMsg.text && lastMsg.text.includes('விவரங்கள் வெற்றிகரமாகத் திருத்தப்பட்டு')) {
                sess.chatHistory[sess.chatHistory.length - 1] = msgObj;
            } else {
                sess.chatHistory.push(msgObj);
            }
        }

        if (Array.isArray(sess.chatHistory) && sess.chatHistory.length > 1) {
            sess.chatHistory = sess.chatHistory.filter((msg, idx, arr) => {
                if (!msg || !msg.text || !msg.text.includes('விவரங்கள் வெற்றிகரமாகத் திருத்தப்பட்டு')) return true;
                const nextEditIdx = arr.findIndex((m, i) => i > idx && m && m.text && m.text.includes('விவரங்கள் வெற்றிகரமாகத் திருத்தப்பட்டு'));
                return nextEditIdx === -1;
            });
        }

        res.json({
            success: true,
            updatedMobile: is10Digit ? cleanNewMobile : null,
            chatHistory: sess.chatHistory,
            citizenProfile: sess.citizenProfile,
            step: sess.intakeState
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
