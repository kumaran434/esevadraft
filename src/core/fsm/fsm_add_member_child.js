/**
 * eSevaDraft FSM Add Member — Child & Unmarried Son/Daughter Handlers
 */

const { renderSubserviceReadySummary } = require('./fsm_summary_formatter');
const { maybePromptSubserviceAadhaarBack, completeSubserviceAadhaarBack } = require('./fsm_member_doc_upload');

function pushSonRelationPrompt(sess, isRealExtracted, mergedDualSided = false) {
    sess.intakeState = 'RATION_ADD_MEMBER_SON_RELATION';
    const ssd = sess.subServiceData || {};
    const nameDisplay = ssd.memberNameTam && ssd.memberNameEng
        ? `${ssd.memberNameTam} (${ssd.memberNameEng})`
        : (ssd.memberName || 'உறுப்பினர்');
    const aadhaarDisplay = ssd.aadhaarNo
        ? `\n• 🪪 **ஆதார் எண்:** ${(ssd.aadhaarNo || '').replace(/(\d{4})/g, '$1 ').trim()}`
        : '';
    const dobDisplay = ssd.dob ? `\n• 📅 **பிறந்த தேதி:** ${ssd.dob}` : '';
    const successPrefix = mergedDualSided
        ? '✅ **ஆதார் அட்டை (முன்பக்கம் + பின்பக்கம்) 2-in-1 A4 PDF-ஆக இணைக்கப்பட்டது!** 📄'
        : (isRealExtracted ? '✅ **ஆதார் அட்டை AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **ஆதார் அட்டை பெறப்பட்டது!** 🪪');

    sess.chatHistory.push({
        sender: 'bot',
        text: `${successPrefix}\n\n` +
              `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}\n\n` +
              `குடும்பத் தலைவருடன் இவரின் உறவுமுறை என்ன?\n\n` +
              `கீழே உள்ள விருப்பத்தைத் தேர்வு செய்யவும்:`,
        options: [
            { label: "👦 மகன் (Son)", value: "REL_SON" },
            { label: "👧 மகள் (Daughter)", value: "REL_DAUGHTER" },
            { label: "🔙 பின்செல்ல", value: "ADD_MEMBER_SON_DAUGHTER" }
        ]
    });
}

function inheritExistingProfile(sess) {
    if (!sess || !sess.subServiceData) return;
    const prof = sess.citizenProfile || {};
    if (prof.rationCardNo && !sess.subServiceData.rationCardNo) {
        sess.subServiceData.rationCardNo = prof.rationCardNo;
    }
    if (prof.district && !sess.subServiceData.district) {
        sess.subServiceData.district = prof.district;
    }
    if (prof.taluk && !sess.subServiceData.taluk) {
        sess.subServiceData.taluk = prof.taluk;
    }
    if (prof.village && !sess.subServiceData.village) {
        sess.subServiceData.village = prof.village;
    }
}

function handleAddMemberChild(text, sess, currentState, uploadedDoc, extractedDoc) {
    const isChildChoice = text === 'CHILD_UNDER_5' || text === 'ADD_MEMBER_CHILD' || (currentState === 'RATION_ADD_MEMBER_CHILD_CHECK' && (text.includes('குழந்தை') || text.includes('< 5') || text.includes('CHILD')));
    const isAdultChoice = text === 'ADULT_ABOVE_5' || (currentState === 'RATION_ADD_MEMBER_CHILD_CHECK' && (text.includes('மேற்பட்டவர்') || text.includes('> 5') || text.includes('ADULT')));

    if (isChildChoice) {
        sess.subService = 'ADD_MEMBER';
        sess.intakeState = 'RATION_ADD_MEMBER_CHILD_DOC';
        sess.step = 'RATION_ADD_MEMBER_CHILD_DOC';
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = true;
        sess.subServiceData.docType = 'Aadhaar Card';
        inheritExistingProfile(sess);
        sess.chatHistory.push({
            sender: 'bot',
            text: `👶 **குழந்தை சேர்க்கை (Child Member - ஆதார் அட்டை கட்டாயம்)**\n\n` +
                  `TNPDS குடும்ப உறுப்பினர் சேர்க்கைக்கு **குழந்தையின் ஆதார் அட்டை (Aadhaar Card) மட்டுமே** கட்டாயம் *(பிறப்புச் சான்றிதழ் இங்கு ஏற்கப்படாது)*.\n\n` +
                  `🪪 குழந்தையின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது புகைப்படம் எடுக்கவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'குழந்தையின் ஆதார் அட்டை (Aadhaar Card)',
            options: [
                { label: "📷 குழந்தை ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
            ]
        });
        return true;
    } else if (isAdultChoice) {
        sess.subService = 'ADD_MEMBER';
        sess.intakeState = 'RATION_ADD_MEMBER_ADULT_CHECK';
        sess.step = 'RATION_ADD_MEMBER_ADULT_CHECK';
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = false;
        inheritExistingProfile(sess);
        sess.chatHistory.push({
            sender: 'bot',
            text: `🧑 **5 வயதிற்கு மேற்பட்ட உறுப்பினர் சேர்க்கை (Above 5 Years)**\n\n` +
                  `சேர்க்கப்பட வேண்டிய உறுப்பினர் யார்?\n\n` +
                  `1. **திருமணமாகாத மகன் / மகள்** எனில்: ஆதார் அட்டை மட்டுமே போதுமானது.\n` +
                  `2. **திருமணமானவர் / பெற்றோர் / மருமகள்** எனில்: ஆதார் அட்டை + பெயர் நீக்கல் சான்றிதழ் தேவை.\n\n` +
                  `கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும்:`,
            options: [
                { label: "👦 திருமணமாகாத மகன் / மகள் (Son/Daughter)", value: "ADD_MEMBER_SON_DAUGHTER" },
                { label: "👰 திருமணமானவர் / பெற்றோர் (Married / Parent)", value: "ADD_MEMBER_ADULT" },
                { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
            ]
        });
        return true;
    } else if (text === 'ADD_MEMBER_SON_DAUGHTER') {
        sess.subService = 'ADD_MEMBER';
        sess.intakeState = 'RATION_ADD_MEMBER_SON_AADHAAR';
        sess.step = 'RATION_ADD_MEMBER_SON_AADHAAR';
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = false;
        sess.subServiceData.memberCategory = 'SON_DAUGHTER';
        sess.subServiceData.docType = 'Aadhaar Card';
        inheritExistingProfile(sess);
        sess.chatHistory.push({
            sender: 'bot',
            text: `👦 **மகன் / மகள் சேர்க்கை (5 வயதுக்கு மேற்பட்டவர்)**\n\n` +
                  `5 வயதுக்கு மேற்பட்ட திருமணமாகாத மகன்/மகளுக்கு **ஆதார் அட்டை (Aadhaar Card)** மட்டுமே போதுமானது.\n(வேறு குடும்ப அட்டையில் பெயர் இல்லாததால் பெயர் நீக்கல் சான்றிதழ் தேவையில்லை).\n\n` +
                  `🪪 மகன்/மகளின் **ஆதார் அட்டையைப்** பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'மகன்/மகள் ஆதார் அட்டை',
            options: [
                { label: "✅ ஆதார் உள்ளது - தொடரவும்", value: "SON_AADHAAR_CONFIRMED" },
                { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_CHILD_DOC') {
        if (text === 'USE_DEMO_DATA' || text.includes('மாதிரி விவரங்கள்')) {
            sess.subService = 'ADD_MEMBER';
            sess.subServiceData = {
                isChild: true,
                docType: 'Aadhaar Card',
                docPath: 'uploads/test_sample_doc.jpg',
                memberName: 'கவின் குமார்',
                memberNameEng: 'Kavin Kumar',
                relationshipTam: 'மகன்',
                relationshipEng: 'Son',
                gender: 'Male',
                genderTam: 'ஆண்',
                dob: '15/06/2023',
                aadhaarNo: '987654321096',
                rationCardNo: sess.citizenProfile?.rationCardNo || '332145897210'
            };
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }
        sess.intakeState = 'RATION_ADD_MEMBER_CHILD_RELATION';
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = true;
        sess.subServiceData.docType = 'Aadhaar Card';
        sess.subServiceData.docPath = uploadedDoc?.path || sess.subServiceData.docPath || 'uploads/test_sample_doc.jpg';
        const isBypass = text === 'TRIGGER_FILE_UPLOAD' || text === 'DEMO_BIRTH_CERT' || text === 'BIRTH_DOC_CONFIRMED' || text === 'DEMO_ADULT_AADHAAR' || text === 'CHILD_AADHAAR_CONFIRMED';
        
        let isRealExtracted = false;
        if (extractedDoc && (extractedDoc.fullNameTam || extractedDoc.fullNameEng)) {
            isRealExtracted = true;
            sess.subServiceData.memberNameTam = extractedDoc.fullNameTam || '';
            sess.subServiceData.memberNameEng = extractedDoc.fullNameEng || '';
            sess.subServiceData.memberName = extractedDoc.fullNameTam || extractedDoc.fullNameEng;
            if (extractedDoc.dob) sess.subServiceData.dob = extractedDoc.dob;
            if (extractedDoc.aadhaarNumber || extractedDoc.aadhaarNo) {
                sess.subServiceData.aadhaarNo = extractedDoc.aadhaarNumber || extractedDoc.aadhaarNo;
            }
        } else {
            const childName = sess.tempMember?.nameTam || sess.tempMember?.nameEng || (!isBypass ? text : '') || sess.subServiceData.memberName || 'கவின் குமார்';
            sess.subServiceData.memberName = childName;
            if (!sess.subServiceData.dob) sess.subServiceData.dob = '15/06/2023';
            if (!sess.subServiceData.aadhaarNo) sess.subServiceData.aadhaarNo = '987654321096';
        }

        const successPrefix = isRealExtracted ? '✅ **குழந்தையின் ஆதார் அட்டை AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **குழந்தையின் ஆதார் அட்டை பெறப்பட்டது!** 🪪';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${successPrefix}\n\n` +
                  `• 👶 **குழந்தையின் பெயர்:** ${sess.subServiceData.memberName}\n\n` +
                  `குடும்பத் தலைவருடன் குழந்தையின் உறவுமுறை என்ன?\n\n` +
                  `கீழே உள்ள விருப்பத்தைத் தேர்வு செய்யவும்:`,
            options: [
                { label: "👦 மகன் (Son)", value: "CHILD_SON" },
                { label: "👧 மகள் (Daughter)", value: "CHILD_DAUGHTER" },
                { label: "🔙 பின்செல்ல", value: "ADD_MEMBER_CHILD" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_CHILD_RELATION') {
        const isSon = text === 'CHILD_SON' || text.includes('மகன்');
        const isDaughter = text === 'CHILD_DAUGHTER' || text.includes('மகள்');
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = true;
        sess.subServiceData.relationshipTam = isSon ? 'மகன்' : (isDaughter ? 'மகள்' : text);
        sess.subServiceData.relationshipEng = isSon ? 'Son' : (isDaughter ? 'Daughter' : 'Child');
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_SON_AADHAAR') {
        if (text === 'USE_DEMO_DATA' || text.includes('மாதிரி விவரங்கள்')) {
            sess.subService = 'ADD_MEMBER';
            sess.subServiceData = {
                isChild: false,
                memberCategory: 'SON_DAUGHTER',
                docType: 'Aadhaar Card',
                docPath: 'uploads/test_sample_doc.jpg',
                memberName: 'கார்த்திக்',
                memberNameEng: 'Karthik',
                relationshipTam: 'மகன்',
                relationshipEng: 'Son',
                gender: 'Male',
                genderTam: 'ஆண்',
                dob: '10/05/2012',
                aadhaarNo: '987654321098',
                rationCardNo: sess.citizenProfile?.rationCardNo || '332145897210'
            };
            sess.intakeState = 'READY_TO_APPLY';
            sess.step = 'READY';
            sess.chatHistory.push(renderSubserviceReadySummary(sess));
            return true;
        }
        sess.intakeState = 'RATION_ADD_MEMBER_SON_RELATION';
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = false;
        sess.subServiceData.memberCategory = 'SON_DAUGHTER';
        sess.subServiceData.docType = 'Aadhaar Card';
        sess.subServiceData.docPath = uploadedDoc?.path || sess.subServiceData.docPath || 'uploads/test_sample_doc.jpg';
        const isBypass = text === 'TRIGGER_FILE_UPLOAD' || text === 'DEMO_ADULT_AADHAAR' || text === 'SON_AADHAAR_CONFIRMED';
        
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
            const memName = sess.tempMember?.nameTam || sess.tempMember?.nameEng || (!isBypass ? text : '') || sess.subServiceData.memberName || 'கார்த்திக்';
            sess.subServiceData.memberName = memName;
            if (text === 'DEMO_ADULT_AADHAAR') {
                sess.subServiceData.memberName = 'கார்த்திக்';
                sess.subServiceData.memberNameEng = 'Karthik';
                sess.subServiceData.aadhaarNo = '987654321098';
                sess.subServiceData.dob = '10/05/2012';
                sess.subServiceData.gender = 'Male';
                sess.subServiceData.genderTam = 'ஆண்';
            }
        }

        if (text !== 'SON_AADHAAR_CONFIRMED' && text !== 'DEMO_ADULT_AADHAAR' && maybePromptSubserviceAadhaarBack({
            sess,
            uploadedDoc,
            extractedDoc,
            backWaitState: 'RATION_ADD_MEMBER_SON_AADHAAR_BACK',
            skipValue: 'SON_AADHAAR_SKIP_BACK',
            isRealExtracted
        })) {
            return true;
        }

        pushSonRelationPrompt(sess, isRealExtracted, false);
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_SON_AADHAAR_BACK') {
        return completeSubserviceAadhaarBack({
            text, sess, uploadedDoc, extractedDoc,
            skipValue: 'SON_AADHAAR_SKIP_BACK'
        }).then((res) => {
            if (!res.done) return true;
            pushSonRelationPrompt(sess, true, res.merged);
            return true;
        });
    }

    if (currentState === 'RATION_ADD_MEMBER_SON_RELATION') {
        const isDaughter = text === 'REL_DAUGHTER' || text.includes('மகள்');
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.isChild = false;
        sess.subServiceData.memberCategory = 'SON_DAUGHTER';
        sess.subServiceData.relationshipTam = isDaughter ? 'மகள்' : 'மகன்';
        sess.subServiceData.relationshipEng = isDaughter ? 'Daughter' : 'Son';
        sess.subServiceData.gender = isDaughter ? 'Female' : 'Male';
        sess.subServiceData.genderTam = isDaughter ? 'பெண்' : 'ஆண்';
        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    return false;
}

module.exports = { handleAddMemberChild };
