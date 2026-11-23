const fs = require('fs');
const { startTnegaObcCertificateFlow } = require('../../portal/tnega/tnega_obc_certificate');
const { blockChatStartMissingDoc, launchCartridgeChatTask } = require('../_tnega_upload_utils');

async function run(payload, onProgress, options) {
    return startTnegaObcCertificateFlow(payload, onProgress, options);
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'OBC';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'OBC';
    const p = sess.citizenProfile || {};

    const photoDoc = p.headPhotoPath || p.documents?.profilePhoto || sess.tempUploads?.profilePhoto;
    if (!((photoDoc && fs.existsSync(photoDoc)) || sess.draftData?.base64Docs?.profilePhotoBase64)) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'OBC_PHOTO_WAIT',
            text: `📸 **OBC சான்றிதழ் (REV-115) — புகைப்படம் தேவை:**\n\nதயவுசெய்து விண்ணப்பதாரரின் பாஸ்போர்ட் புகைப்படத்தை (<250x250px, <50KB) பதிவேற்றவும்:`,
            uploadLabel: '📸 புகைப்படம் பதிவேற்றுக',
            extraJson: {}
        });
    }

    const commDoc = p.communityCertificate || p.communityCertificatePath || p.communityProof || p.documents?.communityCertificate || p.documents?.communityProof || sess.tempUploads?.communityProof;
    if (!((commDoc && fs.existsSync(commDoc)) || sess.draftData?.base64Docs?.communityProofBase64 || sess.draftData?.base64Docs?.communityCertificateBase64)) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'OBC_COMMUNITY_PROOF_WAIT',
            text: `📜 **OBC சான்றிதழ் (REV-115) — சாதிச் சான்றிதழ் தேவை:**\n\nதயவுசெய்து சாதிச் சான்றிதழை (Community Certificate) பதிவேற்றவும்:`,
            uploadLabel: '📜 சாதிச் சான்றிதழ் பதிவேற்றுக',
            extraJson: {}
        });
    }

    const incDoc = p.incomeTaxReturn || p.incomeProof || p.salarySlip || p.documents?.incomeTaxReturn || p.documents?.incomeProof || sess.tempUploads?.incomeTaxReturn || sess.tempUploads?.incomeProof;
    if (!((incDoc && fs.existsSync(incDoc)) || sess.draftData?.base64Docs?.incomeTaxReturnBase64 || sess.draftData?.base64Docs?.incomeProofBase64)) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'OBC_INCOME_PROOF_WAIT',
            text: `💰 **OBC சான்றிதழ் (REV-115) — வருமான / ITR சான்று தேவை:**\n\nதயவுசெய்து வருமான வரி (ITR) அல்லது வருமானச் சான்றைப் பதிவேற்றவும்:`,
            uploadLabel: '💰 வருமான / ITR சான்று பதிவேற்றுக',
            extraJson: {}
        });
    }

    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
    return launchCartridgeChatTask({
        sess, res, runAutomationTask,
        runner: startTnegaObcCertificateFlow,
        payload: p,
        targetMob: p.mobileNumber || targetMobile || activeMobile,
        isMockTest,
        req,
        bannerText: `${modeText}யில் தமிழ்நாடு அரசு **TNeGA OBC சான்றிதழ் (REV-115)** ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
            `• 🔢 **CAN எண்:** **${p.canNumber || 'தேடப்படும்'}** ✅\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 🏷️ **OBC சாதி:** ${p.caste || p.subCaste || '—'}\n` +
            `• 💰 **ஆண்டு வருமானம்:** ₹${p.annualIncome || '72000'}\n\n` +
            `Chrome உலாவியில் TNeGA REV-115 படிவம் திறக்கப்பட்டு, அனைத்து 5 ஆவணங்களும் பதிவேற்றப்பட்டு **Pre-Submit Gate** வரை தானாக இயங்கும்...`,
        extraJson: { subService: 'OBC', serviceId: 'OBC_CERTIFICATE', targetService: 'OBC' }
    });
}

module.exports = {
    runnerName: 'startTnegaObcFlow',
    chatStartTriggers: ['START_OBC_APPLY'],
    readyStates: ['READY_TO_SUBMIT_OBC', 'READY_TO_APPLY_OBC'],
    run,
    startFromChat,
    startTnegaObcCertificateFlow
};
