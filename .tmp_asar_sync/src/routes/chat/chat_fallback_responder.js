const storageService = require('../../services/storage_service');
const { 
    MEMBER_COUNT_OPTIONS, 
    SERVICE_OPTIONS, 
    getRelationshipOptions 
} = require('../../core/chat_fsm');

const { persistSessions } = storageService;

function handleFallbackResponse(ctx, req, res) {
    const { sess } = ctx;
    const isDevReq = req.headers['x-dev-mode'] === 'true' || 
                     req.query?.dev === 'true' || 
                     (req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1')));

    let fallbackMsg = '';
    let fallbackOptions = null;
    let fallbackAction = null;
    let fallbackPrompt = null;

    switch (sess.intakeState) {
        case 'DRAFT_RESUME_CHOICE':
            fallbackMsg = `🏛️ **புதிய ரேஷன் கார்டு — வாடிக்கையாளர் விவரங்கள் ஏற்கெனவே உள்ளன!**\n\nகீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும்:`;
            fallbackOptions = [
                { label: "🚀 ஏற்கெனவே உள்ள விவரங்களுடன் விண்ணப்பி (Submit)", value: "CONFIRM_SUBMIT" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" }
            ];
            break;
        case 'MEMBER_COUNT':
            fallbackMsg = `🏛️ **புதிய ரேஷன் கார்டு விண்ணப்பம்:**\n\nஉங்கள் குடும்பத்தில் மொத்தம் எத்தனை நபர்களை (குடும்பத் தலைவர் உட்பட) உறுப்பினர்களாகச் சேர்க்க வேண்டும்?\n\nகீழே உள்ள எண்ணிக்கையைத் தேர்வு செய்யவும் அல்லது தட்டச்சு செய்யவும்:`;
            fallbackOptions = MEMBER_COUNT_OPTIONS;
            break;
        case 'HEAD_PHOTO':
            fallbackMsg = `📸 தயவுசெய்து குடும்பத் தலைவரின் **பாஸ்போர்ட் புகைப்படத்தைப்** பதிவேற்றவும் (அல்லது கேமரா மூலம் செல்ஃபி எடுக்கவும்).`;
            fallbackAction = 'upload';
            fallbackPrompt = 'குடும்பத் தலைவர் புகைப்படம் பதிவேற்றவும்';
            break;
        case 'HEAD_AADHAAR_FRONT':
            fallbackMsg = `🪪 தயவுசெய்து குடும்பத் தலைவரின் **ஆதார் அட்டைப் புகைப்படத்தை (முன்பக்கம் அல்லது முழு ஆதார் அட்டை)** பதிவேற்றவும்.`;
            fallbackAction = 'upload';
            fallbackPrompt = 'ஆதார் அட்டை பதிவேற்றவும்';
            break;
        case 'HEAD_AADHAAR_BACK':
            fallbackMsg = `🔄 தயவுசெய்து குடும்பத் தலைவரின் ஆதார் அட்டையின் **பின்பக்கப் புகைப்படத்தைப்** பதிவேற்றவும்.`;
            fallbackAction = 'upload';
            fallbackPrompt = 'ஆதார் பின்பக்கம் பதிவேற்றவும்';
            break;
        case 'HEAD_DETAILS_VERIFY':
            fallbackMsg = `🔍 குடும்பத் தலைவரின் விவரங்களைச் சரிபார்த்து உறுதிப்படுத்தவும்:`;
            fallbackOptions = [
                { label: "✅ விவரங்கள் அனைத்தும் சரி (All Correct - Continue)", value: "HEAD_DETAILS_CONFIRMED" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review / Edit Details)", value: "TRIGGER_EDIT_MODAL" }
            ];
            break;
        case 'MEMBER_AADHAAR_FRONT':
            fallbackMsg = `👥 தயவுசெய்து குடும்ப உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் **ஆதார் அட்டையைப்** பதிவேற்றவும்.`;
            fallbackAction = 'upload';
            fallbackPrompt = `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார்`;
            break;
        case 'MEMBER_AADHAAR_BACK':
            fallbackMsg = `🔄 தயவுசெய்து குடும்ப உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் ஆதார் அட்டையின் **பின்பக்கத்தைப்** பதிவேற்றவும்.`;
            fallbackAction = 'upload';
            fallbackPrompt = `உறுப்பினர் ${sess.currentMemberIdx + 1} ஆதார் பின்பக்கம்`;
            break;
        case 'MEMBER_RELATIONSHIP':
            fallbackMsg = `🤝 குடும்ப உறுப்பினர் ${sess.currentMemberIdx + 1}-ன் உறவுமுறை என்ன? கீழே உள்ளதில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`;
            fallbackOptions = getRelationshipOptions(sess.citizenProfile?.headGender);
            break;
        case 'READY_TO_APPLY':
            fallbackMsg = `🚀 **அனைத்து விவரங்களும் தயார்!** அரசு TNPDS இணையதளத்தில் விண்ணப்பிக்க கீழே உள்ள **'விண்ணப்பிக்கத் தொடங்கு'** பொத்தானை அழுத்தவும்:`;
            fallbackOptions = [
                { label: "📱 நேரலை TNPDS சமர்ப்பி (Real Govt OTP)", value: "REAL_LIVE_OTP" },
                { label: "🚀 அரசு TNPDS போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு", value: "Start" },
                ...(isDevReq ? [{ label: "🧪 சுயகற்றல் சோதனை முறை (Run Mock Test)", value: "Mock Test" }] : []),
                { label: "👁️ தனி தாவலில் படிவத்தைச் சரிபார் (Review in New Tab)", value: "OPEN_REVIEW_TAB" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Any Details)", value: "TRIGGER_EDIT_MODAL" }
            ];
            break;
        default:
            fallbackMsg = `வணக்கம்! 🙏 புதிய ரேஷன் கார்டு விண்ணப்பத்தைத் தொடங்க கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும்:`;
            fallbackOptions = SERVICE_OPTIONS;
            break;
    }

    const fallbackItem = {
        sender: 'bot',
        text: fallbackMsg
    };
    if (fallbackOptions) fallbackItem.options = fallbackOptions;
    if (fallbackAction) {
        fallbackItem.actionRequired = fallbackAction;
        fallbackItem.uploadPrompt = fallbackPrompt;
    }

    sess.chatHistory.push(fallbackItem);
    persistSessions();

    return res.json({
        chatHistory: sess.chatHistory,
        citizenProfile: sess.citizenProfile,
        step: sess.intakeState || sess.step
    });
}

module.exports = {
    handleFallbackResponse
};
