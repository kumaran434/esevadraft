const storageService = require('../../services/storage_service');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { ensureBilingualPair } = require('../../utils/bilingual_helper');
const { produceCompliantDocument } = require('../../../photo_studio');
const { advanceFlow } = require('./flow');
const { extractDeceasedDeathCertFields } = require('./extractor');
const {
    handleTnegaAadhaarUploadHelper,
    handleTnegaSmartCardUploadHelper,
    handleCanActionsForCartridge,
    handleMemberSelectForCartridge
} = require('../_tnega_upload_utils');

const persistSessions = (...a) => storageService.persistSessions(...a);

async function handleIntake(ctx, req, res) {
    const { text, uploadedFile, sess } = ctx;
    if (!sess) return false;

    if (await handleCanActionsForCartridge({ ctx, req, res, advanceFlowFn: advanceFlow })) return true;

    if (handleMemberSelectForCartridge({
        ctx, req, res,
        resetIntakeState: 'LEGAL_HEIR_INTAKE',
        advanceFlowFn: advanceFlow
    })) return true;

    if (sess.intakeState === 'LEGAL_HEIR_AADHAAR_WAIT' || sess.intakeState === 'LEGAL_HEIR_AADHAAR_BACK_WAIT') {
        const handled = await handleTnegaAadhaarUploadHelper({
            ctx, req, res,
            backWaitState: 'LEGAL_HEIR_AADHAAR_BACK_WAIT',
            advanceFlowFn: advanceFlow
        });
        if (handled !== null) return handled;
    }

    if (sess.intakeState === 'LEGAL_HEIR_SMARTCARD_WAIT' || sess.intakeState === 'LEGAL_HEIR_SMARTCARD_BACK_WAIT') {
        const handled = await handleTnegaSmartCardUploadHelper({
            ctx, req, res,
            backWaitState: 'LEGAL_HEIR_SMARTCARD_BACK_WAIT',
            advanceFlowFn: advanceFlow
        });
        if (handled !== null) return handled;
    }

    if (['LEGAL_HEIR_DEATH_CERT_WAIT', 'LEGAL_HEIR_DECEASED_ADDR_WAIT', 'LEGAL_HEIR_CHILD_PROOF_WAIT', 'LEGAL_HEIR_BIRTH_TC_WAIT'].includes(sess.intakeState)) {
        if (text === 'TRIGGER_FILE_UPLOAD') {
            sess.chatHistory.push({
                sender: 'bot',
                text: `📤 தயவுசெய்து ஆவணத்தை கீழே உள்ள கோப்பு பொத்தானைப் பயன்படுத்திப் பதிவேற்றவும் (<200KB அளவிற்கு தானாகச் சுருக்கப்படும் ✨):`,
                actionRequired: 'upload',
                uploadPrompt: 'ஆவணம் பதிவேற்றவும்'
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
        if (text === 'LH_ADDR_USE_SMARTCARD' && sess.intakeState === 'LEGAL_HEIR_DECEASED_ADDR_WAIT') {
            const p = sess.citizenProfile;
            const scPath = p.smartCard || p.rationCard || p.smartCardDocPath || p.documents?.smartCard || p.documents?.rationCard || sess.tempUploads?.smartCard;
            if (scPath) {
                if (!p.documents) p.documents = {};
                if (!sess.tempUploads) sess.tempUploads = {};
                p.deceasedAddressProof = scPath;
                p.documents.deceasedAddressProof = scPath;
                sess.tempUploads.deceasedAddressProof = scPath;
                persistSessions();
                const flowStep = advanceFlow(sess, `✅ குடும்ப ஸ்மார்ட் கார்டு இறந்தவரின் முகவரிச் சான்றாக இணைக்கப்பட்டது! 🛡️`);
                sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }
        }
        if (uploadedFile) {
            const compFile = await produceCompliantDocument(uploadedFile.path).catch(() => uploadedFile.path);
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            if (!sess.tempUploads) sess.tempUploads = {};
            if (sess.intakeState === 'LEGAL_HEIR_DEATH_CERT_WAIT') {
                sess.citizenProfile.deathCertificate = compFile;
                sess.citizenProfile.documents.deathCertificate = compFile;
                sess.tempUploads.deathCertificate = compFile;
                try {
                    const ext = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }).catch(() => null);
                    extractDeceasedDeathCertFields(sess.citizenProfile, ext);
                } catch (_) {}
            } else if (sess.intakeState === 'LEGAL_HEIR_DECEASED_ADDR_WAIT') {
                sess.citizenProfile.deceasedAddressProof = compFile;
                sess.citizenProfile.documents.deceasedAddressProof = compFile;
                sess.tempUploads.deceasedAddressProof = compFile;
            } else if (sess.intakeState === 'LEGAL_HEIR_CHILD_PROOF_WAIT' || sess.intakeState === 'LEGAL_HEIR_BIRTH_TC_WAIT') {
                sess.citizenProfile.birthCertificate = compFile;
                sess.citizenProfile.documents.birthCertificate = compFile;
                sess.tempUploads.birthCertificate = compFile;
            }
            persistSessions();
            const flowStep = advanceFlow(sess, `✅ ஆவணம் வெற்றிகரமாகப் பெறப்பட்டு சேமிக்கப்பட்டது! 🛡️`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if ((sess.intakeState === 'LEGAL_HEIR_DECEASED_NAME_WAIT' || (text && text.startsWith('LH_DECEASED_NAME:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        if (text.startsWith('LH_DECEASED_NAME:')) {
            const [engPart, tamPart] = text.replace('LH_DECEASED_NAME:', '').split('|');
            const pair = ensureBilingualPair((engPart || '').trim(), (tamPart || engPart || '').trim());
            sess.citizenProfile.deceasedNameEng = pair.eng || (engPart || '').trim();
            sess.citizenProfile.deceasedNameTam = pair.tam || (tamPart || engPart || '').trim();
        } else {
            const pair = ensureBilingualPair(text.trim(), text.trim());
            sess.citizenProfile.deceasedNameEng = pair.eng || text.trim();
            sess.citizenProfile.deceasedNameTam = pair.tam || text.trim();
        }
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ இறந்தவர் பெயர் **${sess.citizenProfile.deceasedNameTam}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'LEGAL_HEIR_DEATH_DATE_WAIT' || (text && text.startsWith('LH_DOD:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const raw = text.startsWith('LH_DOD:') ? text.replace('LH_DOD:', '').trim() : text.trim();
        if (raw.includes('|')) {
            const [d, pl] = raw.split('|');
            sess.citizenProfile.dateOfDeath = d.trim();
            sess.citizenProfile.placeOfDeath = pl.trim();
        } else if (raw.includes(',')) {
            const [d, ...plRest] = raw.split(',');
            sess.citizenProfile.dateOfDeath = d.trim();
            sess.citizenProfile.placeOfDeath = plRest.join(',').trim() || sess.citizenProfile.taluk || '';
        } else {
            sess.citizenProfile.dateOfDeath = raw;
            if (!sess.citizenProfile.placeOfDeath && sess.citizenProfile.taluk) {
                sess.citizenProfile.placeOfDeath = sess.citizenProfile.taluk;
            }
        }
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ இறந்த தேதி **${sess.citizenProfile.dateOfDeath}**${sess.citizenProfile.placeOfDeath ? ` (${sess.citizenProfile.placeOfDeath})` : ''} எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'LEGAL_HEIR_DEATH_CERT_NO_WAIT' || (text && text.startsWith('LH_DCNO:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        sess.citizenProfile.deathCertificateNo = text.replace('LH_DCNO:', '').trim();
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ இறப்புச் சான்றிதழ் எண் **${sess.citizenProfile.deathCertificateNo}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'LEGAL_HEIR_DECEASED_PARENTS_WAIT' || (text && text.startsWith('LH_PARENTS:'))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const raw = text.startsWith('LH_PARENTS:') ? text.replace('LH_PARENTS:', '').trim() : text.trim();
        if (raw.includes('|')) {
            const parts = raw.split('|').map(s => s.trim());
            const fPair = ensureBilingualPair(parts[0] || '', parts[1] || parts[0] || '');
            const mPair = ensureBilingualPair(parts[2] || '', parts[3] || parts[2] || '');
            sess.citizenProfile.deceasedFatherNameEng = fPair.eng || parts[0] || '';
            sess.citizenProfile.deceasedFatherNameTam = fPair.tam || parts[1] || parts[0] || '';
            sess.citizenProfile.deceasedMotherNameEng = mPair.eng || parts[2] || '';
            sess.citizenProfile.deceasedMotherNameTam = mPair.tam || parts[3] || parts[2] || '';
        } else if (raw.includes(',') || raw.includes('/') || raw.includes('&')) {
            const parts = raw.split(/[,/&]+/).map(s => s.trim()).filter(Boolean);
            const fPair = ensureBilingualPair(parts[0] || '', parts[0] || '');
            const mPair = parts[1] ? ensureBilingualPair(parts[1], parts[1]) : { eng: '', tam: '' };
            sess.citizenProfile.deceasedFatherNameEng = fPair.eng || parts[0] || '';
            sess.citizenProfile.deceasedFatherNameTam = fPair.tam || parts[0] || '';
            sess.citizenProfile.deceasedMotherNameEng = mPair.eng || parts[1] || '';
            sess.citizenProfile.deceasedMotherNameTam = mPair.tam || parts[1] || '';
        } else {
            const fPair = ensureBilingualPair(raw, raw);
            sess.citizenProfile.deceasedFatherNameEng = fPair.eng || raw;
            sess.citizenProfile.deceasedFatherNameTam = fPair.tam || raw;
        }
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ இறந்தவரின் பெற்றோர் பெயர்கள் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'LEGAL_HEIR_HEIRS_WAIT' || text === 'LH_HEIRS_FROM_SMARTCARD') && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const p = sess.citizenProfile;
        if (text === 'LH_HEIRS_FROM_SMARTCARD' && Array.isArray(p.smartCardMembers) && p.smartCardMembers.length > 0) {
            p.legalHeirs = p.smartCardMembers.map(m => ({
                nameTam: m.nameTam || m.nameEng || m.name || '',
                nameEng: m.nameEng || m.nameTam || m.name || '',
                relationship: m.relationship || 'Member',
                age: m.age || '',
                status: 'Living'
            }));
            p.heirsList = p.legalHeirs;
            p.legalHeirsConfirmed = true;
        } else {
            const entries = text.split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
            const parsedHeirs = entries.map(entry => {
                const segs = entry.split(/[-–|]+/).map(s => s.trim()).filter(Boolean);
                const rawName = segs[0] || entry;
                const pair = ensureBilingualPair(rawName, rawName);
                const rel = segs[1] || 'வாரிசு';
                const ageMatch = (segs[2] || entry).match(/\b(\d{1,3})\b/);
                return {
                    nameTam: pair.tam || rawName,
                    nameEng: pair.eng || rawName,
                    relationship: rel,
                    age: ageMatch ? ageMatch[1] : '',
                    status: 'Living'
                };
            }).filter(h => h.nameTam || h.nameEng);
            if (parsedHeirs.length > 0) {
                p.legalHeirs = parsedHeirs;
                p.heirsList = parsedHeirs;
                p.legalHeirsConfirmed = true;
            }
        }
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ வாரிசுதாரர்கள் பட்டியல் (${(p.legalHeirs || []).length} நபர்கள்) பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    return false;
}

module.exports = { handleIntake };
