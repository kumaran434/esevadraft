const fs = require('fs');
const { startTnegaResidenceCertificateFlow } = require('../../portal/tnega/tnega_residence_certificate');
const { blockChatStartMissingDoc, launchCartridgeChatTask } = require('../_tnega_upload_utils');

async function run(payload, onProgress, options) {
    return startTnegaResidenceCertificateFlow(payload, onProgress, options);
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'RESIDENCE';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'RESIDENCE';
    const p = sess.citizenProfile || {};

    const resDocPath = p.residenceProof?.docPath || p.residenceProof || p.documents?.residenceProof || p.documents?.gasBook || sess.tempUploads?.residenceProof || sess.tempUploads?.gasBook;
    if (!Boolean(resDocPath && fs.existsSync(resDocPath))) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'RESIDENCE_PROOF_WAIT',
            text: `🛑 **விண்ணப்பிக்க முடியாது! (குடியிருப்புச் சான்று விடுபட்டுள்ளது)**\n\n` +
                `அரசு விதிகளின்படி இருப்பிடச் சான்றிதழ் (REV-102) விண்ணப்பிக்க **எரிவாயு அட்டை (Gas Book), மின் கட்டண ரசீது (EB Bill), அல்லது வீட்டு வரி ரசீது** கட்டாயம் தேவை.\n\nதயவுசெய்து ஆவணத்தைப் பதிவேற்றவும்:`,
            uploadLabel: '📷 குடியிருப்புச் சான்று பதிவேற்றுக',
            formLabel: '✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)'
        });
    }

    const photoDocPath = p.headPhotoPath || p.documents?.profilePhoto || sess.tempUploads?.profilePhoto;
    if (!Boolean(photoDocPath && fs.existsSync(photoDocPath))) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'RESIDENCE_PHOTO_WAIT',
            text: `🛑 **விண்ணப்பிக்க முடியாது! (விண்ணப்பதாரர் புகைப்படம் விடுபட்டுள்ளது)**\n\n` +
                `இருப்பிடச் சான்றிதழ் விண்ணப்பத்திற்கு விண்ணப்பதாரரின் **பாஸ்போர்ட் புகைப்படம்** கட்டாயம் தேவை (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது).\n\nதயவுசெய்து நேரடிப் புகைப்படத்தைப் பதிவேற்றவும்:`,
            uploadLabel: '📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக',
            formLabel: '✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)'
        });
    }

    const aadhaarDocPath = p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar;
    if (!Boolean(aadhaarDocPath && fs.existsSync(aadhaarDocPath)) && !p.headAadhaar) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'RESIDENCE_AADHAAR_WAIT',
            text: `🛑 **விண்ணப்பிக்க முடியாது! (ஆதார் அட்டை விடுபட்டுள்ளது)**\n\n` +
                `இருப்பிடச் சான்றிதழ் முகவரிச் சான்றாக விண்ணப்பதாரரின் **ஆதார் அட்டை** கட்டாயம் தேவை.\n\nதயவுசெய்து ஆதார் அட்டையைப் பதிவேற்றவும்:`,
            uploadLabel: '📷 ஆதார் அட்டை பதிவேற்றுக',
            formLabel: '✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)'
        });
    }

    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
    return launchCartridgeChatTask({
        sess, res, runAutomationTask,
        runner: startTnegaResidenceCertificateFlow,
        payload: p,
        targetMob: p.mobileNumber || targetMobile || activeMobile,
        isMockTest,
        req,
        bannerText: `${modeText}யில் தமிழ்நாடு அரசு TNeGA இருப்பிடச் சான்றிதழ் (REV-102) விண்ணப்ப ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
            `• 🔢 **CAN எண்:** **${p.canNumber || '133370337878397'}** ✅\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 📅 **வசிக்கும் காலம்:** ${p.yearsOfResidence || 'பிறப்பிலிருந்து'} ✅\n` +
            `• 🎯 **நோக்கம்:** ${p.purposeOfCertificate || 'கல்வி / வேலைவாய்ப்பு'}\n` +
            `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
            `Chrome உலாவியில் TNeGA போர்ட்டல் மூலம் இருப்பிடச் சான்றிதழ் படிவம் திறக்கப்படுகிறது...`
    });
}

module.exports = {
    runnerName: 'startTnegaResidenceFlow',
    chatStartTriggers: ['START_RESIDENCE_APPLY', 'APPLY_RESIDENCE_NOW'],
    readyStates: ['READY_TO_APPLY_RESIDENCE'],
    run,
    startFromChat,
    startTnegaResidenceCertificateFlow
};
