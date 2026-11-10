/**
 * eSevaDraft FSM Subservice Menu Prompts
 * Handles initial prompts for Remove Member, Change Head, Card Type, Mobile Update, and LPG.
 */

function handleRationSubserviceMenuPrompts(text, sess, isAlreadyInRationMenu) {
    if (text.includes('உறுப்பினர் நீக்க') || text === 'குடும்ப உறுப்பினர் நீக்க' || text.startsWith('3.') || (isAlreadyInRationMenu && text === '3')) {
        sess.intakeState = 'RATION_REMOVE_MEMBER_REASON';
        sess.subService = 'REMOVE_MEMBER';
        sess.chatHistory.push({
            sender: 'bot',
            text: `➖ **குடும்ப உறுப்பினர் நீக்கம் (Remove Family Member)**\n\n` +
                  `குடும்ப அட்டையிலிருந்து உறுப்பினரை நீக்குவதற்கான காரணம் என்ன?\n\n` +
                  `கீழே உள்ள காரணங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: [
                { label: "🕊️ இறப்பு காரணமாக (Death of Member)", value: "REMOVE_REASON_DEATH" },
                { label: "💍 திருமணம் காரணமாக (Marriage)", value: "REMOVE_REASON_MARRIAGE" },
                { label: "📄 தனி அட்டை பிரிப்பு (Separate Card)", value: "REMOVE_REASON_SPLIT" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    } else if (text.includes('தலைவர் மாற்றம்') || text === 'குடும்பத் தலைவர் மாற்றம்' || text === 'RATION_CHANGE_HEAD' || text === 'CHANGE_HEAD' || text.startsWith('4.') || (isAlreadyInRationMenu && text === '4')) {
        sess.intakeState = 'RATION_CHANGE_HEAD_REASON';
        sess.subService = 'CHANGE_HEAD';
        sess.chatHistory.push({
            sender: 'bot',
            text: `👤 **குடும்பத் தலைவர் மாற்றம் (Change Family Head)**\n\n` +
                  `தலைவர் மாற்றத்திற்கான காரணம் என்ன?\n\n` +
                  `கீழே உள்ள காரணங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: [
                { label: "🕊️ முந்தைய தலைவர் இறந்துவிட்டார் (Death of Head)", value: "HEAD_REASON_DEATH" },
                { label: "👴 முதியவர் / குடும்ப விருப்ப மாற்றம் (Mutual Consent / Age)", value: "HEAD_REASON_CONSENT" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    } else if (text.includes('அட்டை வகை') || text === 'குடும்ப அட்டை வகை மாற்றம்' || text.startsWith('6.') || (isAlreadyInRationMenu && text === '6')) {
        sess.intakeState = 'RATION_CHANGE_CARD_TYPE';
        sess.subService = 'CHANGE_CARD_TYPE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `📇 **குடும்ப அட்டை வகை மாற்றம் (Change Card Type)**\n\n` +
                  `சர்க்கரை அட்டை (Sugar Card) ➡️ அரிசி அட்டை (Rice Card) அல்லது பண்டமில்லா அட்டை ➡️ பண்டம் உள்ள அட்டையாக மாற்றலாம்.\n\n` +
                  `நீங்கள் எந்த வகை அட்டைக்கு மாற்ற விரும்புகிறீர்கள்?`,
            options: [
                { label: "🌾 அரிசி அட்டை (Rice Card - PHH/NPHH)", value: "CARD_TYPE_RICE" },
                { label: "🍬 சர்க்கரை அட்டை (Sugar Card - NPHHS)", value: "CARD_TYPE_SUGAR" },
                { label: "🚫 பண்டமில்லா அட்டை (No Commodity - NC)", value: "CARD_TYPE_NO_COMMODITY" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    } else if (text.includes('கைபேசி') || text === 'கைபேசி எண் மாற்றம்' || text === 'RATION_CHANGE_MOBILE' || text === 'UPDATE_MOBILE' || text.startsWith('7.') || (isAlreadyInRationMenu && text === '7')) {
        sess.intakeState = 'RATION_CHANGE_MOBILE';
        sess.subService = 'UPDATE_MOBILE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `📱 **கைபேசி எண் மாற்றம் / பதிவு (Update Registered Mobile Number)**\n\n` +
                  `ரேஷன் கார்டில் பதிவு செய்யப்பட்டுள்ள பழைய எண்ணை மாற்றி புதிய மொபைல் எண்ணைப் பதிவு செய்யலாம்.\n\n` +
                  `குடும்பத் தலைவரின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது புதிய மொபைல் எண்ணைத் தட்டச்சு செய்யவும்):`,
            options: [
                { label: "📷 தலைவர் ஆதார் அட்டை", value: "TRIGGER_FILE_UPLOAD" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    } else if (text.includes('எரிவாயு') || text === 'எரிவாயு விவரங்கள் திருத்தம்' || text.startsWith('8.') || (isAlreadyInRationMenu && text === '8')) {
        sess.intakeState = 'RATION_LPG_UPDATE';
        sess.subService = 'LPG_UPDATE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `⛽ **எரிவாயு (LPG) சிலிண்டர் விவரங்கள் திருத்தம் (LPG Details Update)**\n\n` +
                  `குடும்ப அட்டையில் உள்ள சிலிண்டர் எண்ணிக்கை (0, 1, 2) அல்லது எரிவாயு நிறுவன இணைப்பு விவரங்களைப் பதிவு/திருத்தம் செய்யலாம்.\n\n` +
                  `வீட்டில் உள்ள சிலிண்டர் எண்ணிக்கை எத்தனை?`,
            options: [
                { label: "0️⃣ சிலிண்டர் இல்லை (No Cylinder)", value: "LPG_CYL_0" },
                { label: "1️⃣ ஒரு சிலிண்டர் (Single Cylinder)", value: "LPG_CYL_1" },
                { label: "2️⃣ இரண்டு சிலிண்டர்கள் (Double Cylinders)", value: "LPG_CYL_2" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }
    return false;
}

module.exports = { handleRationSubserviceMenuPrompts };
