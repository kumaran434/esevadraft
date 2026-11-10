/**
 * eSevaDraft FSM Add Member — Adult Member & Surrender/Marriage Handlers
 */

const { RELATIONSHIP_OPTIONS, mapRelationshipToEng } = require('./fsm_options_registry');
const { renderSubserviceReadySummary } = require('./fsm_summary_formatter');

function handleAddMemberAdult(text, sess, currentState, uploadedDoc, extractedDoc) {
    if (text === 'ADD_MEMBER_ADULT' || text === 'ADD_MEMBER_INLAW' || text === 'ADD_MEMBER_PARENT') {
        sess.subService = 'ADD_MEMBER';
        sess.intakeState = 'RATION_ADD_MEMBER_ADULT_AADHAAR';
        sess.subServiceData = { isChild: false, docType: 'Aadhaar Card' };
        sess.chatHistory.push({
            sender: 'bot',
            text: `👤 **திருமணமான உறுப்பினர் / பெற்றோர் சேர்க்கை**\n\n` +
                  `திருமணமான நபர் அல்லது பெற்றோரைச் சேர்க்க தமிழ்நாடு அரசு விதிகளின்படி **2 ஆவணங்கள்** தேவை:\n` +
                  `1. 🪪 **ஆதார் அட்டை (Aadhaar Card)**\n` +
                  `2. 📋 **பெயர் நீக்கல் சான்றிதழ் (Surrender Certificate)** அல்லது **திருமணப் பத்திரிகை (Marriage Certificate)**.\n\n` +
                  `படி 1/2: சேர்க்கப்பட வேண்டிய நபரின் **ஆதார் அட்டையைப்** பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'உறுப்பினர் ஆதார் அட்டை',
            options: [
                { label: "✅ ஆதார் உள்ளது - தொடரவும்", value: "ADULT_AADHAAR_CONFIRMED" },
                { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_ADULT_AADHAAR') {
        sess.intakeState = 'RATION_ADD_MEMBER_ADULT_SURRENDER';
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = false;
        sess.subServiceData.docType = 'Aadhaar Card';
        sess.subServiceData.docPath = uploadedDoc?.path || sess.subServiceData.docPath || 'uploads/kumaran_aadhaar_card.jpeg';
        const isBypass = text === 'TRIGGER_FILE_UPLOAD' || text === 'DEMO_ADULT_AADHAAR' || text === 'ADULT_AADHAAR_CONFIRMED';
        
        let isRealExtracted = false;
        if (extractedDoc && (extractedDoc.fullNameTam || extractedDoc.fullNameEng || extractedDoc.aadhaarNumber)) {
            isRealExtracted = true;
            sess.subServiceData.memberNameTam = extractedDoc.fullNameTam || '';
            sess.subServiceData.memberNameEng = extractedDoc.fullNameEng || '';
            sess.subServiceData.memberName = extractedDoc.fullNameTam || extractedDoc.fullNameEng;
            if (extractedDoc.aadhaarNumber) sess.subServiceData.aadhaarNo = extractedDoc.aadhaarNumber;
            if (extractedDoc.dob) sess.subServiceData.dob = extractedDoc.dob;
            if (extractedDoc.gender) {
                sess.subServiceData.gender = extractedDoc.gender;
                sess.subServiceData.genderTam = extractedDoc.genderTam || (extractedDoc.gender === 'Female' ? 'பெண்' : 'ஆண்');
            }
        } else {
            const memName = sess.tempMember?.nameTam || sess.tempMember?.nameEng || (!isBypass ? text : '') || sess.subServiceData.memberName || 'பிரியா';
            sess.subServiceData.memberName = memName;
            if (text === 'DEMO_ADULT_AADHAAR') {
                sess.subServiceData.memberName = 'பிரியா';
                sess.subServiceData.memberNameEng = 'Priya';
                sess.subServiceData.aadhaarNo = '987654321099';
                sess.subServiceData.dob = '10/05/1995';
                sess.subServiceData.gender = 'Female';
                sess.subServiceData.genderTam = 'பெண்';
            }
        }

        const nameDisplay = sess.subServiceData.memberNameTam && sess.subServiceData.memberNameEng
            ? `${sess.subServiceData.memberNameTam} (${sess.subServiceData.memberNameEng})`
            : (sess.subServiceData.memberName || 'உறுப்பினர்');

        const aadhaarDisplay = sess.subServiceData.aadhaarNo ? `\n• 🪪 **ஆதார் எண்:** ${(sess.subServiceData.aadhaarNo || '').replace(/(\d{4})/g, '$1 ').trim()}` : '';
        const dobDisplay = sess.subServiceData.dob ? `\n• 📅 **பிறந்த தேதி:** ${sess.subServiceData.dob}` : '';
        const successPrefix = isRealExtracted ? '✅ **உறுப்பினரின் ஆதார் அட்டை AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **உறுப்பினரின் ஆதார் அட்டை பெறப்பட்டது!** 🪪';

        sess.chatHistory.push({
            sender: 'bot',
            text: `${successPrefix}\n\n` +
                  `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}\n\n` +
                  `📋 **படி 2/2: அடுத்த கட்ட ஆவணம்:**\n` +
                  `முந்தைய குடும்ப அட்டையிலிருந்து பெயர் நீக்கப்பட்ட சான்றிதழ் (Surrender Certificate) அல்லது திருமணப் பத்திரிகையைப் பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'நீக்கல் சான்று / திருமணப் பத்திரிகை',
            options: [
                { label: "🧪 மாதிரி சான்றிதழ் (Demo Surrender)", value: "DEMO_SURRENDER_DOC" },
                { label: "✅ ஆவணம் உள்ளது - தொடரவும்", value: "SURRENDER_DOC_CONFIRMED" },
                { label: "🔙 பின்செல்ல", value: "ADD_MEMBER_ADULT" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_ADULT_SURRENDER') {
        sess.intakeState = 'RATION_ADD_MEMBER_ADULT_RELATION';
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.surrenderDocPath = uploadedDoc?.path || sess.subServiceData.surrenderDocPath || 'uploads/priya_sister_aadhaar.pdf';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **நீக்கல் / திருமணச் சான்று உறுதி செய்யப்பட்டது!** 📋\n\n` +
                  `குடும்பத் தலைவருடன் இந்த உறுப்பினரின் உறவுமுறை என்ன?\n\n` +
                  `கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:`,
            options: RELATIONSHIP_OPTIONS
        });
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_ADULT_RELATION') {
        const rel = mapRelationshipToEng(text);
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.relationshipTam = rel.tam;
        sess.subServiceData.relationshipEng = rel.eng;
        sess.subServiceData.gender = rel.gender;
        sess.subServiceData.genderTam = rel.genderTam;
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    return false;
}

module.exports = { handleAddMemberAdult };
