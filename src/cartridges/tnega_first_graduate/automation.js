const fs = require('fs');
const { startTnegaFirstGraduateFlow } = require('../../portal/tnega/tnega_first_graduate');
const { blockChatStartMissingDoc, launchCartridgeChatTask } = require('../_tnega_upload_utils');

async function run(payload, onProgress, options) {
    return startTnegaFirstGraduateFlow(payload, onProgress, options);
}

function startFromChat({ sess, req, res, targetMobile, activeMobile, isMockTest, runAutomationTask }) {
    sess.subService = 'FIRST_GRADUATE';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'FIRST_GRADUATE';
    const p = sess.citizenProfile || {};

    const tcDocPath = p.applicantEducationProof || p.studentTc || p.twelfthMarksheet || p.documents?.applicantEducationProof || p.documents?.studentTc || sess.tempUploads?.applicantEducationProof;
    if (!Boolean(tcDocPath && fs.existsSync(tcDocPath))) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'FIRST_GRADUATE_APPLICANT_PROOF_WAIT',
            text: `🛑 **விண்ணப்பிக்க முடியாது! (கட்டாய ஆவணம் விடுபட்டுள்ளது)**\n\n` +
                `அரசு விதிகளின்படி முதல் பட்டதாரி சான்றிதழ் (REV-104) விண்ணப்பிக்க மாணவரின் **12-ஆம் வகுப்பு பள்ளி மாற்றுச் சான்றிதழ் (School TC)** அல்லது **மதிப்பெண் பட்டியல் (Marksheet)** கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\nதயவுசெய்து சான்றிதழைப் பதிவேற்றவும்:`,
            uploadLabel: '📷 மாணவர் 12th TC பதிவேற்றுக',
            extraJson: { isAutomating: false }
        });
    }

    const photoDocPath = p.headPhotoPath || p.documents?.profilePhoto || sess.tempUploads?.profilePhoto;
    if (!Boolean(photoDocPath && fs.existsSync(photoDocPath))) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'FIRST_GRADUATE_PHOTO_WAIT',
            text: `🛑 **விண்ணப்பிக்க முடியாது! (நேரடி பாஸ்போர்ட் புகைப்படம் விடுபட்டுள்ளது)**\n\n` +
                `முதல் பட்டதாரி சான்றிதழ் (REV-104) விண்ணப்பிக்க மாணவரின் நேரடி பாஸ்போர்ட் புகைப்படம் (<50KB) கட்டாயம் தேவை.\n\nதயவுசெய்து மாணவரின் பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும்:`,
            uploadLabel: '📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக',
            extraJson: { isAutomating: false }
        });
    }

    const aadhaarDocPath = p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar;
    if (!Boolean(aadhaarDocPath && fs.existsSync(aadhaarDocPath)) && !p.headAadhaar && !p.aadhaarNumber) {
        return blockChatStartMissingDoc({
            sess, res, nextState: 'FIRST_GRADUATE_AADHAAR_WAIT',
            text: `🛑 **விண்ணப்பிக்க முடியாது! (ஆதார் அட்டை விடுபட்டுள்ளது)**\n\n` +
                `முதல் பட்டதாரி சான்றிதழ் (REV-104) விண்ணப்பிக்க மாணவரின் ஆதார் அட்டை கட்டாயம் தேவை.\n\nதயவுசெய்து மாணவரின் ஆதார் அட்டையைப் பதிவேற்றவும்:`,
            uploadLabel: '📷 ஆதார் அட்டை பதிவேற்றுக',
            extraJson: { isAutomating: false }
        });
    }

    const modeText = isMockTest ? '🧪 சுயகற்றல் சோதனை முறை (Mock Sandbox)' : '🚀 நேரலை உற்பத்தி முறை (Live Production)';
    return launchCartridgeChatTask({
        sess, res, runAutomationTask,
        runner: startTnegaFirstGraduateFlow,
        payload: p,
        targetMob: p.mobileNumber || targetMobile || activeMobile,
        isMockTest,
        req,
        bannerText: `${modeText}யில் தமிழ்நாடு அரசு TNeGA முதல் பட்டதாரி சான்றிதழ் (REV-104) விண்ணப்ப ஆட்டோமேஷன் தொடங்கப்படுகிறது! 🛡️\n\n` +
            `• 🔢 **CAN எண்:** **${p.canNumber || '—'}** ✅\n` +
            `• 👤 **மாணவர்:** ${p.fullNameTam || p.fullNameEng || 'மாணவர்'}\n` +
            `• 🎓 **படிப்பு:** ${p.currentCourse || p.degreeCourse || 'B.E.'}\n` +
            `• 🏛️ **கல்வி நிறுவனம்:** ${p.institutionName || p.collegeName || '—'}\n` +
            `• 👨‍👩‍👦 **பெற்றோர் கல்வி:** [தந்தை: ${p.fatherEducation || '10th'}] [தாய்: ${p.motherEducation || '8th'}]\n\n` +
            `Chrome உலாவியில் TNeGA போர்ட்டல் மூலம் விண்ணப்பப் படிவம் திறக்கப்படுகிறது...`
    });
}

module.exports = {
    runnerName: 'startTnegaFirstGraduateFlow',
    chatStartTriggers: ['START_FIRST_GRADUATE_APPLY'],
    readyStates: ['READY_TO_APPLY_FIRST_GRADUATE'],
    run,
    startFromChat,
    startTnegaFirstGraduateFlow
};
