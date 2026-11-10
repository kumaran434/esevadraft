/**
 * eSevaDraft FSM Non-Ration Service Selection Handlers
 * Handles Income, Residence, Voter ID, and general service fallback dialogs.
 */

const { advanceTnegaIncomeFlow, advanceTnegaResidenceFlow, advanceTnegaCommunityFlow } = require('./tnega_flow_engine');

function handleNonRationServiceSelection(text, sess) {
    if (text.includes('வருமான') || text.toLowerCase().includes('income')) {
        sess.subService = 'INCOME';
        if (sess.citizenProfile) {
            sess.citizenProfile.subService = 'INCOME';
            delete sess.citizenProfile.familyMemberCount;
            delete sess.citizenProfile.annualIncome;
            delete sess.citizenProfile.profession;
            delete sess.citizenProfile.incomeMembers;
        }
        delete sess.annualIncome;
        delete sess.profession;
        delete sess.familyMemberCount;
        delete sess.incomeMembers;
        const flowStep = advanceTnegaIncomeFlow(sess);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        return true;
    } else if (text.includes('இருப்பிட') || text.toLowerCase().includes('residence') || text.includes('பிறப்பிட') || text.toLowerCase().includes('nativity')) {
        sess.subService = 'RESIDENCE';
        if (sess.citizenProfile) {
            sess.citizenProfile.subService = 'RESIDENCE';
            delete sess.citizenProfile.yearsOfResidence;
            delete sess.citizenProfile.purposeOfCertificate;
        }
        delete sess.yearsOfResidence;
        delete sess.purposeOfCertificate;
        const flowStep = advanceTnegaResidenceFlow(sess);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        return true;
    } else if (!text.startsWith('COMMUNITY_') && !text.startsWith('RELIGION_') && (text.includes('சாதி') || text.toLowerCase().includes('community'))) {
        sess.subService = 'COMMUNITY';
        if (sess.citizenProfile) {
            sess.citizenProfile.subService = 'COMMUNITY';
            delete sess.citizenProfile.caste;
            delete sess.citizenProfile.communityProof;
            delete sess.citizenProfile.communityProofSkipped;
        }
        delete sess.caste;
        delete sess.communityProof;
        delete sess.communityProofSkipped;
        const flowStep = advanceTnegaCommunityFlow(sess);
        sess.chatHistory.push({
            sender: 'bot',
            text: flowStep.text,
            options: flowStep.options
        });
        return true;
    } else if (text.includes('வாக்காளர்') || text.toLowerCase().includes('voter')) {
        sess.intakeState = 'VOTER_INTAKE';
        const hasAadhaar = !!(sess.citizenProfile?.headAadhaar || sess.citizenProfile?.aadhaarNumber);
        const aadhDisp = (sess.citizenProfile?.headAadhaar || sess.citizenProfile?.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        const headName = sess.citizenProfile?.fullNameTam || sess.citizenProfile?.fullNameEng || 'விண்ணப்பதாரர்';
        let welcomeText = `🗳️ **புதிய வாக்காளர் அட்டை (New Voter ID) விண்ணப்பத்திற்கு வரவேற்கிறோம்!**\n\n`;
        let options = [];
        if (hasAadhaar) {
            welcomeText += `✅ **விண்ணப்பதாரர் விவரங்கள் ஏற்கெனவே பெறப்பட்டுள்ளன!**\n` +
                           `• 👤 **பெயர்:** ${headName}\n` +
                           (aadhDisp ? `• 🪪 **ஆதார் எண்:** ${aadhDisp} ✅\n` : '') +
                           (sess.citizenProfile?.headDob || sess.citizenProfile?.dob ? `• 🎂 **பிறந்த தேதி:** ${sess.citizenProfile.headDob || sess.citizenProfile.dob} ✅\n\n` : '\n') +
                           `வாக்காளர் அடையாள அட்டை விண்ணப்பிக்க விவரங்கள் தயாராக உள்ளன:`;
            options = [
                { label: "🚀 வாக்காளர் அட்டை விண்ணப்பி (Apply Voter ID)", value: "APPLY_VOTER_NOW" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து", value: "TRIGGER_EDIT_MODAL" }
            ];
        } else {
            welcomeText += `விண்ணப்பதாரரின் ஆதார் அட்டை அல்லது பிறப்புச் சான்றிதழைப் பதிவேற்றவும்:`;
            options = [
                { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" }
            ];
        }
        sess.chatHistory.push({
            sender: 'bot',
            text: welcomeText,
            options
        });
        return true;
    } else if (text === 'CONTINUE_INTAKE' || text === 'CONFIRM_SUBMIT' || text === 'TRIGGER_EDIT_MODAL' || text === 'CHANGE_HEAD_PHOTO') {
        return false;
    } else if (text) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `ℹ️ **${text} சேவை விரைவில் முழுமையாக இணைக்கப்படவுள்ளது!**\n\nதற்போது **புதிய ரேஷன் கார்டு (New Ration Card)** விண்ணப்பம் 100% நேரலையில் பயன்பாட்டில் உள்ளது. அதைத் தொடங்க விரும்புகிறீர்களா?`,
            options: [
                { label: "🏛️ புதிய ரேஷன் கார்டு தொடங்கவும்", value: "புதிய ரேஷன் கார்டு" },
                { label: "🔄 மீண்டும் சேவைகளைத் தேர்ந்தெடு", value: "reset" }
            ]
        });
        return true;
    }
    return false;
}

module.exports = { handleNonRationServiceSelection };
