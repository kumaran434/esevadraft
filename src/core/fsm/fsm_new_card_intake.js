/**
 * eSevaDraft FSM New Ration Card Initial Intake Handler
 */

const { MEMBER_COUNT_OPTIONS, RESIDENCE_PROOF_OPTIONS } = require('./fsm_options_registry');
const { getVerifiedRationCardDocs } = require('../../services/profile_helpers');

function handleNewRationCardIntake(sess) {
    sess.service = 'ரேஷன் கார்டு';
    sess.subService = 'NEW_CARD';
    if (sess.citizenProfile) sess.citizenProfile.subService = 'NEW_CARD';
    const prof = sess.citizenProfile || {};
    const existingMembers = Array.isArray(prof.members) ? prof.members : [];
    const existingCount = existingMembers.length || 1;
    const headName = prof.fullNameTam || prof.fullNameEng || '';
    const { hasPhotoDoc, hasAadhaarDoc, hasResidenceDoc } = getVerifiedRationCardDocs(prof, sess.tempUploads);

    // 1. All 3 mandatory documents (Photo + Aadhaar + Gas Book/Residence Proof) exist on disk -> READY_TO_APPLY
    if (headName && hasPhotoDoc && hasAadhaarDoc && hasResidenceDoc) {
        const memberNames = existingMembers.map(m => m.nameTam || m.nameEng).filter(Boolean).join(', ');
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.targetMemberCount = existingCount;
        sess.chatHistory.push({
            sender: 'bot',
            text: `🎉 **வாடிக்கையாளர் (${headName}) ரேஷன் கார்டு விவரங்கள் ஏற்கெனவே முழுமையாகச் சேமிக்கப்பட்டுள்ளன!** 💾\n\n` +
                  `• 👤 **குடும்பத் தலைவர்:** ${headName}\n` +
                  `• 👥 **பதிவு செய்யப்பட்ட உறுப்பினர்கள் (${existingCount}):** ${memberNames || headName}\n` +
                  (prof.doorNo ? `• 🏠 **முகவரி:** ${prof.doorNo}, ${prof.streetTam || prof.streetEng || ''}\n` : '') +
                  `• 📄 **ஆவணங்கள்:** புகைப்படம், ஆதார் அட்டை & குடியிருப்புச் சான்று (Gas Book) அனைத்தும் தயார்! ✅\n` +
                  `\nநேரடியாக TNPDS போர்ட்டலில் விண்ணப்பிக்கலாம்:\n*(வேறு புதிய நபருக்கு விண்ணப்பிக்க, மேலே உள்ள 🧹 துடை (Clear) பொத்தானைப் பயன்படுத்தவும்)*`,
            options: [
                { label: "🚀 TNPDS போர்ட்டலில் விண்ணப்பி (Submit to Portal)", value: "CONFIRM_SUBMIT" },
                { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" },
                { label: "➕ புதிய வாடிக்கையாளர் விண்ணப்பம்", value: "START_NEW_CUSTOMER" }
            ]
        });
        return true;
    }

    // 2. Delta Prompt: Photo exists, ONLY Aadhaar Card is missing (e.g., Aadhaar was deleted)
    if (hasPhotoDoc && !hasAadhaarDoc) {
        sess.targetMemberCount = existingCount;
        sess.intakeState = 'HEAD_AADHAAR_FRONT';
        sess.step = 'HEAD_AADHAAR_FRONT';
        sess.chatHistory.push({
            sender: 'bot',
            text: `🏛️ **புதிய ரேஷன் கார்டு (New Ration Card)**\n\n` +
                  `✅ **குடும்பத் தலைவர் புகைப்படம்${hasResidenceDoc ? ' மற்றும் எரிவாயு புத்தகம் / குடியிருப்புச் சான்று' : ''} ஏற்கெனவே சுயவிவரத்தில் உள்ளன!**\n\n` +
                  `🪪 விடுபட்டுள்ள **குடும்பத் தலைவர் ஆதார் அட்டையை (முன்பக்கம் அல்லது முழு ஆதார் அட்டை)** மட்டும் பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'ஆதார் அட்டை பதிவேற்றவும்',
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    // 3. Delta Prompt: Photo & Aadhaar exist, ONLY Gas Book / Residence Proof is missing (e.g., Gas Book was deleted)
    if (hasPhotoDoc && hasAadhaarDoc && !hasResidenceDoc) {
        sess.targetMemberCount = existingCount;
        sess.tempUploads = sess.tempUploads || {};
        sess.tempUploads.residenceProofType = 'எரிவாயு நுகர்வோர் அட்டை';
        sess.intakeState = 'RESIDENCE_PROOF_DOC';
        sess.step = 'RESIDENCE_PROOF_DOC';
        sess.chatHistory.push({
            sender: 'bot',
            text: `🏛️ **புதிய ரேஷன் கார்டு (New Ration Card)**\n\n` +
                  `✅ **குடும்பத் தலைவர் புகைப்படம் மற்றும் ஆதார் அட்டை ஏற்கெனவே சுயவிவரத்தில் உள்ளன!**\n\n` +
                  `🏠 விடுபட்டுள்ள **குடியிருப்புச் சான்று / எரிவாயு புத்தகம் (Gas Book / Residence Proof)** ஆவணத்தை மட்டும் பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'கேஸ் புக் / குடியிருப்புச் சான்று பதிவேற்றவும்',
            options: [
                { label: "📷 கேஸ் புக் / குடியிருப்புச் சான்று பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                ...RESIDENCE_PROOF_OPTIONS
            ]
        });
        return true;
    }

    // 4. Delta Prompt: Aadhaar or Residence Proof exists, ONLY Photo is missing (e.g., Photo was deleted)
    if (!hasPhotoDoc && (hasAadhaarDoc || hasResidenceDoc)) {
        sess.targetMemberCount = existingCount;
        sess.intakeState = 'HEAD_PHOTO';
        sess.step = 'HEAD_PHOTO';
        sess.chatHistory.push({
            sender: 'bot',
            text: `🏛️ **புதிய ரேஷன் கார்டு (New Ration Card)**\n\n` +
                  `✅ **${hasAadhaarDoc ? 'ஆதார் அட்டை' : ''}${hasAadhaarDoc && hasResidenceDoc ? ' மற்றும் ' : ''}${hasResidenceDoc ? 'குடியிருப்புச் சான்று (Gas Book)' : ''} ஏற்கெனவே சுயவிவரத்தில் உள்ளன!**\n\n` +
                  `📸 விடுபட்டுள்ள **குடும்பத் தலைவர் பாஸ்போர்ட் புகைப்படத்தை** மட்டும் பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'குடும்பத் தலைவர் புகைப்படம்',
            options: [
                { label: "📷 புகைப்படம் பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    sess.intakeState = 'MEMBER_COUNT';
    sess.chatHistory.push({
        sender: 'bot',
        text: `🏛️ **புதிய ரேஷன் கார்டு (New Ration Card) விண்ணப்பத்திற்கு வரவேற்கிறோம்!**\n\n` +
              `உங்கள் குடும்பத்தில் மொத்தம் எத்தனை நபர்களை (குடும்பத் தலைவர் உட்பட) உறுப்பினர்களாகச் சேர்க்க வேண்டும்?\n\n` +
              `கீழே உள்ள எண்ணிக்கையைத் தேர்வு செய்யவும் அல்லது தட்டச்சு செய்யவும்:`,
        options: MEMBER_COUNT_OPTIONS
    });
    return true;
}

module.exports = { handleNewRationCardIntake };
