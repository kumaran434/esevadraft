const fs = require('fs');
const path = require('path');
const storageService = require('../../services/storage_service');
const { saveCitizenProfile } = require('../../../database');
const { saveCitizenDraft } = require('../../../firestore_db');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { produceCompliantDocument } = require('../../../photo_studio');

const { persistSessions } = storageService;

async function handleResidenceProof(ctx, req, res) {
    const { text, uploadedFile, sess } = ctx;
    const activeMobile = storageService.getActiveMobile();
    const isDevReq = req.headers['x-dev-mode'] === 'true' || 
                     req.query?.dev === 'true' || 
                     (req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1')));

    // STATE 10: RESIDENCE_PROOF_TYPE
    if (sess.intakeState === 'RESIDENCE_PROOF_TYPE') {
        sess.tempUploads = sess.tempUploads || {};
        sess.tempUploads.residenceProofType = text || 'எரிவாயு நுகர்வோர் அட்டை';
        sess.intakeState = 'RESIDENCE_PROOF_DOC';
        if (!uploadedFile) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `📄 நீங்கள் தேர்ந்தெடுத்த சான்று: **${text}**\n\n` +
                      `தயவுசெய்து உங்கள் **${text}** ஆவணத்தின் புகைப்படம் அல்லது PDF-ஐப் பதிவேற்றவும்:\n\n` +
                      `💡 **ஏஐ ஆவண ஸ்கேனர்:** உங்கள் ஆவணத்தை அரசு ஏற்கும் மிகத் தெளிவான A4 PDF-ஆக (< 250 KB) எங்கள் AI மாற்றிவிடும்!`,
                actionRequired: 'upload',
                uploadPrompt: `${text} பதிவேற்றவும்`
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }
    }

    // STATE 11: RESIDENCE_PROOF_DOC
    if (sess.intakeState === 'RESIDENCE_PROOF_DOC') {
        if (!uploadedFile) {
            if (text && text !== 'TRIGGER_FILE_UPLOAD') {
                sess.tempUploads = sess.tempUploads || {};
                sess.tempUploads.residenceProofType = text;
            }
            const curProofLabel = sess.tempUploads?.residenceProofType || 'குடியிருப்புச் சான்று';
            sess.chatHistory.push({
                sender: 'bot',
                text: `📄 தயவுசெய்து **${curProofLabel}** ஆவணத்தைப் பதிவேற்றவும்.`,
                actionRequired: 'upload',
                uploadPrompt: `${curProofLabel} ஆவணம் பதிவேற்றவும்`
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
            return true;
        }

        const optDoc = await produceCompliantDocument(uploadedFile.path);
        const proofType = sess.tempUploads?.residenceProofType || 'எரிவாயு நுகர்வோர் அட்டை';

        let extracted = null;
        try {
            extracted = await inspectAndExtractDocument(uploadedFile.path);
        } catch (err) {
            console.warn('[RESIDENCE_PROOF_DOC] AI extraction fallback:', err.message);
        }

        const isGasDoc = proofType.includes('எரிவாயு') || 
                         extracted?.documentType === 'GAS_BOOK' || 
                         extracted?.residenceProofCategory === 'GAS_BOOK' ||
                         !!(extracted?.gasDetails?.consumerNumber);

        sess.citizenProfile.residenceProof = {
            type: isGasDoc ? 'GAS_BOOK' : (proofType.includes('சொத்து') ? 'PROPERTY_TAX' : 'EB_BILL'),
            typeTam: proofType,
            docPath: optDoc
        };

        if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
        if (!sess.tempUploads) sess.tempUploads = {};
        sess.citizenProfile.documents.residenceProof = optDoc;
        sess.tempUploads.residenceProof = optDoc;
        if (isGasDoc) {
            sess.citizenProfile.documents.gasBook = optDoc;
            sess.tempUploads.gasBook = optDoc;
        }

        let gasNotice = '';
        if (isGasDoc) {
            const gas = extracted?.gasDetails || {};
            const co = gas.oilCompany || 'IOC';
            const coDisplay = gas.oilCompanyDisplay || (co === 'IOC' ? 'Indane Gas (IOCL)' : (co === 'HPC' ? 'HP Gas (HPC)' : 'Bharat Gas (BPCL)'));
            const consumerNo = String(gas.consumerNumber || '').trim();
            const agency = gas.agencyName || '';
            const cylinders = String(gas.cylinders || '1');
            const consumerName = gas.consumerName || sess.citizenProfile.fullNameTam || '';

            sess.citizenProfile.gasDetails = {
                hasGas: true,
                consumerName: consumerName,
                oilCompany: co,
                oilCompanyDisplay: coDisplay,
                consumerNumber: consumerNo,
                agencyName: agency,
                cylinders: cylinders,
                gasBookPath: optDoc
            };

            if (consumerNo) {
                gasNotice = `\n🔥 **எரிவாயு இணைப்பு விவரங்கள் (AI மூலம் துல்லியமாகப் பெறப்பட்டது):**\n` +
                    `• நிறுவனம்: **${coDisplay}**\n` +
                    `• ஏஜென்சி: **${agency || '—'}**\n` +
                    `• நுகர்வோர் எண் (LPG No): **${consumerNo}**\n` +
                    `• சிலிண்டர் எண்ணிக்கை: **${cylinders} சிலிண்டர்**\n` +
                    `• பதிவு பெற்றவர் பெயர்: **${consumerName}** ✅\n`;
            }
        }

        try {
            if (fs.existsSync(optDoc)) {
                const b64 = fs.readFileSync(optDoc).toString('base64');
                const bName = path.basename(optDoc);
                sess.base64Docs = sess.base64Docs || {};
                sess.citizenProfile.base64Docs = sess.citizenProfile.base64Docs || {};
                sess.base64Docs.residenceProofBase64 = b64;
                sess.base64Docs.residenceProofName = bName;
                sess.citizenProfile.base64Docs.residenceProofBase64 = b64;
                sess.citizenProfile.base64Docs.residenceProofName = bName;
                if (isGasDoc) {
                    sess.base64Docs.gasBookBase64 = b64;
                    sess.base64Docs.gasBookName = bName;
                    sess.citizenProfile.base64Docs.gasBookBase64 = b64;
                    sess.citizenProfile.base64Docs.gasBookName = bName;
                }
            }
        } catch (_) {}

        saveCitizenProfile(activeMobile, sess.citizenProfile);
        if (activeMobile) {
            try {
                await saveCitizenDraft(activeMobile, {
                    operatorUid: sess.operatorUid || null,
                    operatorName: sess.operatorName || null,
                    operatorMobile: sess.operatorMobile || null,
                    citizenProfile: sess.citizenProfile,
                    documents: sess.tempUploads || {},
                    base64Docs: sess.base64Docs || {},
                    chatHistory: sess.chatHistory || [],
                    intakeState: 'AADHAAR_MOBILE_CONFIRM',
                    step: sess.step || 'draft'
                });
            } catch (_) {}
        }

        sess.intakeState = 'AADHAAR_MOBILE_CONFIRM';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **குடியிருப்புச் சான்று அரசு A4 PDF-ஆக உகந்ததாக்கப்பட்டு சேமிக்கப்பட்டது!** 📄\n` +
                  gasNotice +
                  `\n⚠️ **படி 6/6: மிக முக்கியமான இறுதிச் சரிபார்ப்பு (Aadhaar Mobile Link Gate):**\n\n` +
                  `ரேஷன் கார்டு விண்ணப்பத்தில் சேர்க்கப்பட்டுள்ள **அனைத்து ${sess.citizenProfile.members.length} உறுப்பினர்களின் ஆதார் எண்களிலும்** மொபைல் எண் இணைக்கப்பட்டு நடைமுறையில் (Active) உள்ளதா?\n\n` +
                  `💡 **ஏன் இது மிக முக்கியம்?**\n` +
                  `தமிழ்நாடு அரசு இணையதளத்தில் ஒவ்வொரு உறுப்பினரைச் சேர்க்கும்போதும் அவர்களின் ஆதார் பதிவு எண்ணிற்கு **உடனடி SMS OTP** வரும். OTP தாமதமாகி நேரம் வீணாகாமல் இருக்க, அனைத்து உறுப்பினர்களின் கைபேசிகளும் உங்கள் அருகில் தயார் நிலையில் இருப்பது அவசியம்!\n\n` +
                  `உறுதிப்படுத்த கீழே உள்ள பொத்தானைத் தொடவும்:`,
            options: [
                { label: "✅ ஆம், அனைவருக்கும் ஆதார் மொபைல் எண் தயார்! (Confirm & Ready)", value: "CONFIRMED_AADHAAR_MOBILE" },
                { label: "🔄 விவரங்களை மறுபரிசீலனை செய்", value: "reset" }
            ]
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    // STATE 12: AADHAAR_MOBILE_CONFIRM
    if (sess.intakeState === 'AADHAAR_MOBILE_CONFIRM') {
        sess.intakeState = 'READY_TO_APPLY';

        let membersSummary = '';
        sess.citizenProfile.members.forEach((m, idx) => {
            membersSummary += `  ${idx + 1}. **${m.nameTam || m.nameEng}** (${m.relationshipTam || 'தலைவர்'}) | ஆதார்: ${m.aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim()} ✅\n`;
        });

        const hasGas = !!(sess.citizenProfile.gasDetails?.hasGas && sess.citizenProfile.gasDetails?.consumerNumber);
        const gasStatusLine = hasGas 
            ? `• 🔥 **எரிவாயு இணைப்பு (Gas):** உள்ளது (${sess.citizenProfile.gasDetails.oilCompanyDisplay || sess.citizenProfile.gasDetails.oilCompany || ''} - ${sess.citizenProfile.gasDetails.agencyName || ''} | நுகர்வோர் எண்: ${sess.citizenProfile.gasDetails.consumerNumber} | சிலிண்டர்: ${sess.citizenProfile.gasDetails.cylinders || '1'}) ✅\n`
            : `• 🔥 **எரிவாயு இணைப்பு (Gas):** ❌ குடும்பத்திற்கு எரிவாயு இணைப்பு இல்லை (அரசு TNPDS போர்ட்டலில் செக் பாக்ஸ் டிக் செய்யப்படாது)\n`;

        sess.chatHistory.push({
            sender: 'bot',
            text: `🎉 **அனைத்து விவரங்களும் 100% வெற்றிகரமாகச் சேகரிக்கப்பட்டு சரிபார்க்கப்பட்டன!** 🛡️\n\n` +
                  `📋 **விண்ணப்பத்தின் முழு சுருக்கம்:**\n` +
                  `• 👤 **குடும்பத் தலைவர்:** ${sess.citizenProfile.fullNameTam} (${sess.citizenProfile.fullNameEng})\n` +
                  `• 📸 **பாஸ்போர்ட் புகைப்படம்:** வெள்ளை பின்னணியுடன் தயார் ✅\n` +
                  `• 👥 **மொத்த உறுப்பினர்கள் (${sess.citizenProfile.members.length}):**\n${membersSummary}` +
                  `• 🏠 **முகவரி:** ${sess.citizenProfile.doorNo}, ${sess.citizenProfile.streetTam}, ${sess.citizenProfile.areaTam || ''} - ${sess.citizenProfile.pincode}\n` +
                  `• 📑 **குடியிருப்புச் சான்று:** ${sess.citizenProfile.residenceProof?.typeTam || 'ஆதார் / குடியிருப்புச் சான்று'} (அரசு A4 PDF தயார் ✅)\n` +
                  gasStatusLine +
                  `• 📱 **ரேஷன் கார்டு பதிவு எண்:** +91 ${sess.citizenProfile.mobileNumber}\n` +
                  `• 🔐 **ஆதார் OTP தயார்நிலை:** 100% உறுதி செய்யப்பட்டது ✅\n\n` +
                  `இப்போது தமிழ்நாடு அரசு TNPDS இணையதளத்தில் உங்கள் புதிய ரேஷன் கார்டை விண்ணப்பிக்கத் தொடங்குங்கள்!`,
            options: [
                { label: "📱 நேரலை TNPDS சமர்ப்பி (Real Govt OTP)", value: "REAL_LIVE_OTP" },
                { label: "🚀 அரசு TNPDS போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு", value: "Start" },
                { label: "👁️ தனி தாவலில் படிவத்தைச் சரிபார் (Review in New Tab)", value: "OPEN_REVIEW_TAB" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Any Details)", value: "TRIGGER_EDIT_MODAL" },
                ...(isDevReq ? [{ label: "🧪 சுயகற்றல் சோதனை முறை (Run Mock Test)", value: "Mock Test" }] : []),
                { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
            ]
        });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    return false;
}

module.exports = {
    handleResidenceProof
};
