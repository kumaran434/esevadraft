/**
 * eSevaDraft FSM Subservice Menu Prompts Switchboard
 * Active TNPDS subservices delegate cleanly to their own isolated Cartridges.
 * Placeholder menu items (Change Card Type, LPG Update) live safely below.
 */

function handleRationSubserviceMenuPrompts(text, sess, isAlreadyInRationMenu) {
    const { resolveCartridgeForSelection } = require('../../cartridges');
    const matched = resolveCartridgeForSelection(text, sess);
    if (matched && matched.portal === 'TNPDS' && matched.flow && typeof matched.flow.enterService === 'function') {
        return matched.flow.enterService(sess);
    }

    if (text.includes('அட்டை வகை') || text === 'குடும்ப அட்டை வகை மாற்றம்' || text.startsWith('6.') || (isAlreadyInRationMenu && text === '6')) {
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
