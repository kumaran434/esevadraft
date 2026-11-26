const fs = require('fs');
const { startTnegaIncomeCertificateFlow } = require('../../portal/tnega/tnega_income_certificate');
const { blockChatStartMissingDoc, launchCartridgeChatTask } = require('../_tnega_upload_utils');

async function run(payload, onProgress, options) {
    return startTnegaIncomeCertificateFlow(payload, onProgress, options);
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'INCOME';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'INCOME';
    const p = sess.citizenProfile || {};

    const incomeDocPath = p.incomeProof || p.salaryCertificatePath || p.salaryCertificate || p.documents?.incomeProof || p.documents?.salaryCertificate || sess.tempUploads?.incomeProof;
    if (!Boolean(incomeDocPath === 'SELF_DECLARATION' || (incomeDocPath && fs.existsSync(incomeDocPath)))) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'INCOME_PROOF_WAIT',
            text: `🛑 **விண்ணப்பிக்க முடியாது! (வருமான ஆதாரம் விடுபட்டுள்ளது)**\n\n` +
                `அரசு விதிகளின்படி வருமானச் சான்றிதழ் (REV-103) விண்ணப்பிக்க **சம்பளச் சான்று (Salary Certificate), ஊதிய ரசீது (Pay Slip / Bank Statement), அல்லது சுய அறிவிப்புப் படிவம் (Self-Declaration)** கட்டாயம் தேவை.\n\nதயவுசெய்து ஆவணத்தைப் பதிவேற்றவும்:`,
            uploadLabel: '📷 வருமான ஆதாரம் பதிவேற்றுக',
            formLabel: '✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)'
        });
    }

    const photoDocPath = p.headPhotoPath || p.documents?.profilePhoto || sess.tempUploads?.profilePhoto;
    if (!Boolean(photoDocPath && fs.existsSync(photoDocPath))) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'INCOME_PHOTO_WAIT',
            text: `🛑 **விண்ணப்பிக்க முடியாது! (விண்ணப்பதாரர் புகைப்படம் விடுபட்டுள்ளது)**\n\n` +
                `வருமானச் சான்றிதழ் விண்ணப்பத்திற்கு விண்ணப்பதாரரின் **பாஸ்போர்ட் புகைப்படம்** கட்டாயம் தேவை (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது).\n\nதயவுசெய்து நேரடிப் புகைப்படத்தைப் பதிவேற்றவும்:`,
            uploadLabel: '📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக',
            formLabel: '✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)'
        });
    }

    const aadhaarDocPath = p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar;
    if (!Boolean(aadhaarDocPath && fs.existsSync(aadhaarDocPath)) && !p.headAadhaar) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'INCOME_AADHAAR_WAIT',
            text: `🛑 **விண்ணப்பிக்க முடியாது! (ஆதார் அட்டை விடுபட்டுள்ளது)**\n\n` +
                `வருமானச் சான்றிதழ் முகவரிச் சான்றாக விண்ணப்பதாரரின் **ஆதார் அட்டை** கட்டாயம் தேவை.\n\nதயவுசெய்து ஆதார் அட்டையைப் பதிவேற்றவும்:`,
            uploadLabel: '📷 ஆதார் அட்டை பதிவேற்றுக',
            formLabel: '✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)'
        });
    }

    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
    return launchCartridgeChatTask({
        sess, res, runAutomationTask,
        runner: startTnegaIncomeCertificateFlow,
        payload: p,
        targetMob: p.mobileNumber || targetMobile || activeMobile,
        isMockTest,
        req,
        bannerText: `${modeText}யில் தமிழ்நாடு அரசு TNeGA வருமானச் சான்றிதழ் (REV-103) விண்ணப்ப ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
            `• 🔢 **CAN எண்:** **${p.canNumber || '—'}** ✅\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng || '—'}\n` +
            `• 🏛️ **வகுப்பு:** ${p.community || '—'}\n` +
            `• 💰 **ஆண்டு வருமானம்:** ₹${Number(p.annualIncome || 60000).toLocaleString('en-IN')}\n` +
            `• 💼 **தொழில்:** ${p.profession || 'கூலி வேலை'}\n\n` +
            `Chrome உலாவியில் TNeGA போர்ட்டல் மூலம் விண்ணப்பப் படிவம் திறக்கப்படுகிறது...`
    });
}

module.exports = {
    runnerName: 'startTnegaIncomeFlow',
    chatStartTriggers: ['START_INCOME_APPLY'],
    readyStates: ['READY_TO_APPLY_INCOME'],
    run,
    startFromChat,
    startTnegaIncomeCertificateFlow
};
