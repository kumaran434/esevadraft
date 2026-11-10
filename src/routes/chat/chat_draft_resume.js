const storageService = require('../../services/storage_service');
const { renderSubserviceReadySummary } = require('../../core/chat_fsm');
const { isProfileDataComplete } = require('../../services/profile_helpers');

const { persistSessions } = storageService;

async function handleDraftResume(ctx, req, res) {
    const { text, sess } = ctx;

    const shouldHandle = sess.intakeState === 'DRAFT_RESUME_CHOICE' || 
                         sess.intakeState === 'READY_TO_APPLY' || 
                         /^ADD_MEMBER_\d+$/.test(text) || 
                         (text === 'CONFIRM_SUBMIT' && (sess.subService || isProfileDataComplete(sess.citizenProfile, sess.tempUploads)));

    if (!shouldHandle) return false;

    const existingMembers = Array.isArray(sess.citizenProfile?.members) ? sess.citizenProfile.members : [];
    const existingCount = existingMembers.length;
    const headName = sess.citizenProfile?.fullNameTam || sess.citizenProfile?.fullNameEng || 'குடும்பத் தலைவர்';

    if (text === 'CONFIRM_SUBMIT' || text.toLowerCase() === 'start' || text.includes('விண்ணப்பி') || text.includes('சரி')) {
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';

        if (sess.subService) {
            const subSummary = renderSubserviceReadySummary(sess);
            sess.chatHistory.push(subSummary);
            persistSessions();
            res.json({
                chatHistory: sess.chatHistory,
                citizenProfile: sess.citizenProfile,
                step: sess.intakeState,
                intakeState: sess.intakeState,
                subService: sess.subService,
                subServiceData: sess.subServiceData,
                documents: sess.tempUploads || {},
                botResponse: subSummary.text
            });
            return true;
        }

        sess.targetMemberCount = existingCount;
        let membersSummary = '';
        existingMembers.forEach((m, idx) => {
            membersSummary += `  ${idx + 1}. **${m.nameTam || m.nameEng}** (${m.relationshipTam || (idx === 0 ? 'தலைவர்' : 'உறுப்பினர்')}) | ஆதார்: ${(m.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim()} ✅\n`;
        });

        sess.chatHistory.push({
            sender: 'bot',
            text: `🎉 **வாடிக்கையாளர் (${headName}) விவரங்கள் உறுதி செய்யப்பட்டன!** 🛡️\n\n` +
                  `• 👤 **குடும்பத் தலைவர்:** ${headName}\n` +
                  `• 👥 **பதிவு செய்யப்பட்ட உறுப்பினர்கள் (${existingCount}):**\n${membersSummary}` +
                  (sess.citizenProfile?.doorNo ? `• 🏠 **முகவரி:** ${sess.citizenProfile.doorNo}, ${sess.citizenProfile.streetTam || sess.citizenProfile.streetEng || ''} - ${sess.citizenProfile.pincode || ''}\n` : '') +
                  `\nஇப்போது அரசு TNPDS போர்ட்டலில் உங்கள் ரேஷன் கார்டு விண்ணப்பத்தைத் தொடங்கலாம்:`,
            options: [
                { label: "🚀 TNPDS போர்ட்டலில் விண்ணப்பி (Submit to Portal)", value: "CONFIRM_SUBMIT" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        persistSessions();
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    if (/^ADD_MEMBER_\d+$/.test(text) || (text.includes('கூடுதல்') && /^\d+$/.test(text.trim()))) {
        let targetNum = existingCount + 1;
        if (text.startsWith('ADD_MEMBER_')) {
            const parsed = parseInt(text.replace('ADD_MEMBER_', ''), 10);
            if (!isNaN(parsed) && parsed > existingCount) targetNum = parsed;
        } else if (/^\d+$/.test(text.trim())) {
            const parsed = parseInt(text.trim(), 10);
            if (parsed > existingCount) targetNum = parsed;
        }

        sess.targetMemberCount = targetNum;
        sess.currentMemberIdx = existingCount;
        sess.tempUploads = sess.tempUploads || {};
        sess.tempUploads.currentMemberFront = null;
        sess.tempUploads.currentMemberBack = null;
        sess.tempMember = null;
        sess.intakeState = 'MEMBER_AADHAAR_FRONT';

        const prevNames = existingMembers.map(m => m.nameTam || m.nameEng).filter(Boolean).join(', ');
        sess.chatHistory.push({
            sender: 'bot',
            text: `👥 **படி 3/6: கூடுதல் குடும்ப உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டை**\n\n` +
                  `ஏற்கெனவே பதிவு செய்யப்பட்ட ${existingCount} உறுப்பினர்களின் (${prevNames}) விவரங்கள் பாதுகாக்கப்பட்டுள்ளன. ✅\n\n` +
                  `கூடுதல் உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டையைப் (முன்பக்கம் அல்லது முழு ஆதார் அட்டை) பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார்`
        });
        persistSessions();
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    if (text === 'TRIGGER_EDIT_MODAL' || text.includes('திருத்து') || text.toLowerCase().includes('edit')) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `✏️ **விவரங்களைத் திருத்தும் சாளரம் (Edit Window) திறக்கப்பட்டுள்ளது!**\n\nதிரையில் தோன்றும் படிவத்தில் சரியான எழுத்துக் கூட்டலை உள்ளிட்டு **'சேமி & உறுதிப்படுத்து'** பட்டனை அழுத்தவும்.`,
            actionRequired: 'open_edit_modal',
            options: [
                { label: "🚀 விவரங்கள் சரி - TNPDS-ல் விண்ணப்பி", value: "CONFIRM_SUBMIT" }
            ]
        });
        persistSessions();
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
        return true;
    }

    return false;
}

module.exports = {
    handleDraftResume
};
