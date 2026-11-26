const fs = require('fs');
const { startTnegaCommunityCertificateFlow } = require('../../portal/tnega/tnega_community_certificate');
const { blockChatStartMissingDoc, launchCartridgeChatTask } = require('../_tnega_upload_utils');

async function run(payload, onProgress, options) {
    return startTnegaCommunityCertificateFlow(payload, onProgress, options);
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'COMMUNITY';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'COMMUNITY';
    const p = sess.citizenProfile || {};

    const commDocPath = p.communityProof || p.communityCertificatePath || p.familyCommunityProofPath || p.documents?.communityProof || sess.tempUploads?.communityProof;
    if (!Boolean(commDocPath && fs.existsSync(commDocPath))) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'COMMUNITY_PROOF_WAIT',
            text: `🛑 **விண்ணப்பிக்க முடியாது! (கட்டாய ஆவணம் விடுபட்டுள்ளது)**\n\n` +
                `அரசு விதிகளின்படி சாதிச் சான்றிதழ் (REV-101) விண்ணப்பிக்க **தந்தை / தாய் / உடன்பிறந்தோரின் சாதிச் சான்றிதழ்** அல்லது விண்ணப்பதாரரின் **பள்ளி மாற்றுச் சான்றிதழ் (School TC)** கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
                `⚠️ *இந்த ஆவணம் இல்லாமல் போர்ட்டலில் விண்ணப்பம் சமர்ப்பிக்கப்பட முடியாது.*\n\nதயவுசெய்து சான்றிதழைப் பதிவேற்றவும்:`,
            uploadLabel: '📷 சாதிச் சான்றிதழ் / பள்ளி TC பதிவேற்றுக',
            formLabel: '✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)'
        });
    }

    const photoDocPath = p.headPhotoPath || p.documents?.profilePhoto || sess.tempUploads?.profilePhoto;
    if (!Boolean(photoDocPath && fs.existsSync(photoDocPath))) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'COMMUNITY_PHOTO_WAIT',
            text: `🛑 **விண்ணப்பிக்க முடியாது! (விண்ணப்பதாரர் புகைப்படம் விடுபட்டுள்ளது)**\n\n` +
                `சாதிச் சான்றிதழ் விண்ணப்பத்திற்கு விண்ணப்பதாரரின் **பாஸ்போர்ட் புகைப்படம்** கட்டாயம் தேவை (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது).\n\nதயவுசெய்து நேரடிப் புகைப்படத்தைப் பதிவேற்றவும்:`,
            uploadLabel: '📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக',
            formLabel: '✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)'
        });
    }

    const aadhaarDocPath = p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar;
    if (!Boolean(aadhaarDocPath && fs.existsSync(aadhaarDocPath)) && !p.headAadhaar) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'COMMUNITY_AADHAAR_WAIT',
            text: `🛑 **விண்ணப்பிக்க முடியாது! (ஆதார் அட்டை விடுபட்டுள்ளது)**\n\n` +
                `சாதிச் சான்றிதழ் முகவரிச் சான்றாக விண்ணப்பதாரரின் **ஆதார் அட்டை** கட்டாயம் தேவை.\n\nதயவுசெய்து ஆதார் அட்டையைப் பதிவேற்றவும்:`,
            uploadLabel: '📷 ஆதார் அட்டை பதிவேற்றுக',
            formLabel: '✏️ விவரங்களைச் சரிபார் / திருத்து (Open Form)'
        });
    }

    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
    return launchCartridgeChatTask({
        sess, res, runAutomationTask,
        runner: startTnegaCommunityCertificateFlow,
        payload: p,
        targetMob: p.mobileNumber || targetMobile || activeMobile,
        isMockTest,
        req,
        bannerText: `${modeText}யில் தமிழ்நாடு அரசு TNeGA சாதிச் சான்றிதழ் (REV-101) விண்ணப்ப ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
            `• 🔢 **CAN எண்:** **${p.canNumber || 'தேடப்படும்'}** ✅\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng || '—'}\n` +
            `• 🕉️ **மதம்:** ${p.religion || 'Hindu'}\n` +
            `• 🏛️ **வகுப்பு:** ${p.community || '—'} ✅\n` +
            `• 🏷️ **சாதி உட்பிரிவு:** ${p.caste || p.subCaste || '—'} ✅\n` +
            `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
            `Chrome உலாவியில் TNeGA போர்ட்டல் மூலம் சாதிச் சான்றிதழ் படிவம் திறக்கப்படுகிறது...`
    });
}

module.exports = {
    runnerName: 'startTnegaCommunityFlow',
    chatStartTriggers: ['START_COMMUNITY_APPLY', 'APPLY_COMMUNITY_NOW'],
    readyStates: ['READY_TO_APPLY_COMMUNITY'],
    run,
    startFromChat,
    startTnegaCommunityCertificateFlow
};
