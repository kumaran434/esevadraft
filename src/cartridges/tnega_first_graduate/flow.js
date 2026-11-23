const { evaluateServiceChecklist } = require('../../core/services_registry');
const { isPhysicalDocValid } = require('../_tnega_upload_utils');

function advanceFlow(sess, prefixMessage = '') {
    sess.subService = 'FIRST_GRADUATE';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'FIRST_GRADUATE';

    const p = sess.citizenProfile;

    const hasAadhaarDoc = isPhysicalDocValid(
        p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar,
        sess.draftData?.base64Docs?.headAadhaarBase64
    );
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);

    if (!hasAadhaarDoc || !hasBasicDemographics) {
        sess.intakeState = 'FIRST_GRADUATE_AADHAAR_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🎓 **முதல் பட்டதாரி சான்றிதழ் (First Graduate Certificate - REV-104)**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Mandatory Document Gate):**\n` +
            `முதல் பட்டதாரி சான்றிதழ் விண்ணப்பிக்க தேவையான ஆவணங்கள் முதலில் சரிபார்க்கப்பட வேண்டும்.\n\n` +
            `📄 மாணவரின் பெயர், பிறந்த தேதி மற்றும் முகவரி விவரங்களைத் தானாகப் பெற **ஆதார் அட்டை (படம் அல்லது 2-in-1 PDF)** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 மாணவர் ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (sess.tempUploads?.headAadhaarFront && !sess.tempUploads?.headAadhaarBack && !p.fatherNameTam && !p.fatherNameEng && !p.pincode) {
        sess.intakeState = 'FIRST_GRADUATE_AADHAAR_BACK_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔄 **ஆதார் முன்பக்கம் பெறப்பட்டது! தந்தை பெயர் மற்றும் முகவரி உள்ள பின்பக்கத்தை (Back Side) பதிவேற்றவும்:**`;
        const options = [
            { label: "📷 ஆதார் பின்பக்கம் அப்லோட்", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasPhotoDoc = isPhysicalDocValid(
        p.headPhotoPath || p.photoPath || p.documents?.profilePhoto || p.documents?.headPhoto || sess.tempUploads?.profilePhoto || sess.tempUploads?.headPhoto,
        sess.draftData?.base64Docs?.profilePhotoBase64 || sess.draftData?.base64Docs?.headPhotoBase64
    );
    if (!hasPhotoDoc) {
        sess.intakeState = 'FIRST_GRADUATE_PHOTO_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📷 **மாணவரின் பாஸ்போர்ட் புகைப்படம் தேவை:**\n\n` +
            `• 👤 **மாணவர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-104 Portal Rule):**\n` +
            `முதல் பட்டதாரி சான்றிதழ் விண்ணப்பத்திற்கு மாணவரின் நேரடி பாஸ்போர்ட் புகைப்படம் (<50KB) போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து நேரடி பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும் (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது):`;
        const options = [
            { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasApplicantProof = isPhysicalDocValid(
        p.applicantEducationProof || p.studentTc || p.twelfthMarksheet || p.documents?.applicantEducationProof || p.documents?.studentTc || sess.tempUploads?.applicantEducationProof,
        sess.draftData?.base64Docs?.applicantEducationProofBase64
    );
    if (!hasApplicantProof) {
        sess.intakeState = 'FIRST_GRADUATE_APPLICANT_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **மாணவரின் 12-ஆம் வகுப்பு பள்ளி மாற்றுச் சான்றிதழ் (TC) தேவை:**\n\n` +
            `• 👤 **மாணவர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-104 Portal Rule):**\n` +
            `முதல் பட்டதாரி சான்றிதழுக்கு விண்ணப்பதாரரின் **12-ஆம் வகுப்பு பள்ளி மாற்றுச் சான்றிதழ் (School TC)** அல்லது **மதிப்பெண் பட்டியல் (Marksheet)** போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து மாணவரின் 12-ஆம் வகுப்பு TC அல்லது மதிப்பெண் பட்டியலைப் பதிவேற்றவும் (புகைப்படம் அல்லது PDF):`;
        const options = [
            { label: "📷 மாணவர் 12th TC பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasSmartCard = isPhysicalDocValid(
        p.smartCard || p.rationCard || p.smartCardDocPath || p.documents?.smartCard || p.documents?.rationCard || sess.tempUploads?.smartCard,
        sess.draftData?.base64Docs?.smartCardBase64
    );
    if (!hasSmartCard) {
        sess.intakeState = 'FIRST_GRADUATE_SMARTCARD_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📑 **குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Card) தேவை:**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-104 Portal Rule):**\n` +
            `குடும்ப உறுப்பினர்களின் விவரங்களைச் சரிபார்க்க **குடும்ப ஸ்மார்ட் அட்டை (Smart Card)** போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து குடும்ப ஸ்மார்ட் அட்டையைப் பதிவேற்றவும்:`;
        const options = [
            { label: "📷 குடும்ப அட்டை (Smart Card) பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasFatherProof = isPhysicalDocValid(
        p.fatherEducationProof || p.fatherTc || p.fatherEducationProofPath || p.documents?.fatherEducationProof || p.documents?.fatherTc || sess.tempUploads?.fatherEducationProof,
        sess.draftData?.base64Docs?.fatherEducationProofBase64
    );
    if (!hasFatherProof) {
        sess.intakeState = 'FIRST_GRADUATE_FATHER_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨 **தந்தையின் பள்ளி மாற்றுச் சான்றிதழ் (Father TC / Educational Proof) தேவை:**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-104 Portal Rule):**\n` +
            `அரசு போர்ட்டலில் **Father Transfer Certificate** கட்டாயமாகப் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து **தந்தையின் பள்ளி TC அல்லது கல்வி ஆவணத்தைப்** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 தந்தையின் TC / ஆவணம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasMotherProof = isPhysicalDocValid(
        p.motherEducationProof || p.motherTc || p.motherEducationProofPath || p.documents?.motherEducationProof || p.documents?.motherTc || sess.tempUploads?.motherEducationProof,
        sess.draftData?.base64Docs?.motherEducationProofBase64
    );
    if (!hasMotherProof) {
        sess.intakeState = 'FIRST_GRADUATE_MOTHER_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👩 **தாயாரின் பள்ளி மாற்றுச் சான்றிதழ் (Mother TC / Educational Proof) தேவை:**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-104 Portal Rule):**\n` +
            `அரசு போர்ட்டலில் **Mother Transfer Certificate** கட்டாயமாகப் பதிவேற்றப்பட வேண்டும் (பள்ளிக்குச் செல்லாதவரெனில் சுய அறிவிப்பு ஆவணம் பதிவேற்றலாம்).\n\n` +
            `தயவுசெய்து **தாயாரின் பள்ளி TC அல்லது கல்வி ஆவணத்தைப்** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 தாயாரின் TC / ஆவணம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const resolvedCan = String(p.canNumber || sess.canNumber || p.can || '').replace(/\D+/g, '');
    if (resolvedCan && !p.canNumber) p.canNumber = resolvedCan;
    if (resolvedCan && !sess.canNumber) sess.canNumber = resolvedCan;
    const hasCan = Boolean(resolvedCan && resolvedCan.length >= 11);

    if (!hasCan) {
        sess.intakeState = 'FIRST_GRADUATE_CAN_GATE';
        const aadhDisp = (p.headAadhaar || p.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        const nameDisp = p.fullNameTam || p.fullNameEng || '';
        let welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **தேவையான அனைத்து ஆவணங்களும் பெறப்பட்டன!** 🛡️\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Portal Rule):**\n` +
            `முதல் பட்டதாரி சான்றிதழ் போர்ட்டலில் விண்ணப்பிக்க **13-இலக்க CAN எண் (Citizen Access Number)** தேவை.\n\n`;
        if (nameDisp || aadhDisp) {
            welcomeText += (nameDisp ? `• 👤 **மாணவர்:** ${nameDisp}\n` : '') +
                           (aadhDisp ? `• 🪪 **ஆதார் எண்:** ${aadhDisp}\n\n` : '\n');
        }
        welcomeText += `உங்களிடம் ஏற்கெனவே CAN எண் உள்ளதா அல்லது போர்ட்டலில் தேட / புதிதாகப் பதிவு செய்ய வேண்டுமா?`;
        const options = [
            { label: "🔍 CAN எண் தேடு (Search CAN)", value: "CAN_SEARCH_PROMPT" },
            { label: "📝 புதிய CAN பதிவு செய் (Register New CAN)", value: "CAN_REGISTER_PROMPT" },
            { label: "🔢 என்னிடம் CAN எண் உள்ளது (Direct Input)", value: "CAN_DIRECT_INPUT" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasMother = Boolean(p.motherNameTam || p.motherNameEng || p.motherName);
    if (!hasMother) {
        sess.intakeState = 'FIRST_GRADUATE_MOTHER_NAME_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண்:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **மாணவர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **கட்டாய அரசு விவரம் (Mandatory Detail):**\n` +
            `முதல் பட்டதாரி சான்றிதழ் படிவத்தில் தாயின் பெயர் கட்டாயமாகும்.\n\n` +
            `தயவுசெய்து **தாயாரின் பெயரை** உள்ளிடவும் (எ.கா: தேவகி அல்லது Devaki):`;
        return { text: welcomeText, options: [], step: sess.intakeState };
    }

    const hasCourse = Boolean(p.currentCourse || p.degreeCourse || p.courseName);
    if (!hasCourse) {
        sess.intakeState = 'FIRST_GRADUATE_COURSE_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண்:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **மாணவர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `🎓 **மாணவர் கல்லூரியில் படிக்கும் அல்லது சேரவுள்ள படிப்பு (Degree / Course) எது?**\n\n` +
            `கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும் அல்லது படிப்பின் பெயரை நேரடியாக தட்டச்சு செய்யவும்:`;
        const options = [
            { label: "💻 B.E. / B.Tech (பொறியியல்)", value: "B.E. Computer Science and Engineering" },
            { label: "🩺 M.B.B.S / B.D.S (மருத்துவம்)", value: "M.B.B.S (Medicine)" },
            { label: "🧪 B.Sc (அறிவியல்)", value: "B.Sc Computer Science" },
            { label: "💼 B.Com (வணிகவியல்)", value: "B.Com" },
            { label: "📚 B.A (கலை)", value: "B.A English" },
            { label: "🌾 B.Sc Agriculture (விவசாயம்)", value: "B.Sc Agriculture" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasCollege = Boolean(p.institutionName || p.collegeName || p.schoolCollegeName);
    if (!hasCollege) {
        sess.intakeState = 'FIRST_GRADUATE_COLLEGE_WAIT';
        const cCourse = p.currentCourse || p.degreeCourse || 'B.E.';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ படிப்பு: **${cCourse}** எனப் பதிவானது!\n\n` +
            `🏛️ **மாணவர் படிக்கும் அல்லது சேர்க்கை பெறவுள்ள கல்லூரி / கல்வி நிறுவனத்தின் பெயர் என்ன?**\n\n` +
            `தயவுசெய்து கல்லூரியின் பெயரைத் தட்டச்சு செய்யவும் (எ.கா: Government College of Technology, Coimbatore / அண்ணா பல்கலைக்கழகம்):`;
        const options = [
            { label: "🏛️ அரசு பொறியியல் கல்லூரி (GCT)", value: "Government College of Technology" },
            { label: "🏛️ அண்ணா பல்கலைக்கழகம் (Anna University)", value: "Anna University Chennai" },
            { label: "🏛️ தந்தை பெரியார் அரசு பொறியியல் கல்லூரி", value: "Thanthai Periyar Govt Institute of Technology, Vellore" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (!p.fatherEducation || !p.motherEducation) {
        sess.intakeState = 'FIRST_GRADUATE_PARENT_EDU_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨‍👩‍👦 **பெற்றோரின் கல்வித் தகுதி (Parents' Education Qualification) என்ன?**\n\n` +
            `• 👨 **தந்தை:** ${p.fatherNameTam || p.fatherNameEng || 'தந்தை'}\n` +
            `• 👩 **தாய்:** ${p.motherNameTam || p.motherNameEng || 'தாய்'}\n\n` +
            `TNeGA போர்ட்டலில் குடும்ப உறுப்பினர் அட்டவணையில் சேர்க்க, பெற்றோரின் கல்வித் தகுதியைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "📘 தந்தை: 10th | தாய்: 8th வகுப்பு", value: "PARENT_EDU:10th Standard|8th Standard" },
            { label: "📕 தந்தை: <10th | தாய்: படிக்காதவர்", value: "PARENT_EDU:Less than 10th standard|Non literate" },
            { label: "📗 இருவரும் 10th / 12th வகுப்பு", value: "PARENT_EDU:10th or 12th Standard|10th or 12th Standard" },
            { label: "📙 இருவரும் பள்ளிக்குச் செல்லாதவர் (Non literate)", value: "PARENT_EDU:Non literate|Non literate" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (!p.yearOfPassing && !p.passingYear) {
        sess.intakeState = 'FIRST_GRADUATE_YOP_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📅 **மாணவர் 12-ஆம் வகுப்பு (Higher Secondary) தேர்ச்சி பெற்ற ஆண்டு எது?**\n\n` +
            `தேர்ச்சி ஆண்டைத் தேர்ந்தெடுக்கவும் அல்லது 4 இலக்க ஆண்டை உள்ளிடவும்:`;
        const options = [
            { label: "📅 2026", value: "2026" },
            { label: "📅 2025", value: "2025" },
            { label: "📅 2024", value: "2024" },
            { label: "📅 2023", value: "2023" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const isGraduateConfirmed = Boolean(p.familyGraduateConfirmed);
    if (!isGraduateConfirmed) {
        sess.intakeState = 'FIRST_GRADUATE_FAMILY_CHECK_GATE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🛡️ **முதல் பட்டதாரி தகுதி உறுதிப்படுத்தல் (Eligibility Confirmation):**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-104 Mandatory Rule):**\n` +
            `குடும்பத்தில் தந்தை, தாய், உடன்பிறந்தோர் உள்ளிட்ட எவரும் இதுவரை பட்டப்படிப்பு (Degree) படித்திருக்கக் கூடாது.\n\n` +
            `குடும்பத்தில் வேறு யாரும் பட்டப்படிப்பு முடிக்கவில்லை என்பதையும், மாணவரே குடும்பத்தின் முதல் பட்டதாரி என்பதையும் உறுதி செய்கிறீர்களா?`;
        const options = [
            { label: "✅ ஆம், குடும்பத்தில் முதல் பட்டதாரி இவரே", value: "FIRST_GRADUATE_CONFIRMED" },
            { label: "❌ இல்லை, குடும்பத்தில் பட்டதாரி உள்ளார்", value: "FIRST_GRADUATE_INELIGIBLE" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    sess.intakeState = 'READY_TO_APPLY_FIRST_GRADUATE';
    const chk = evaluateServiceChecklist('FIRST_GRADUATE_CERTIFICATE', sess.citizenProfile, sess.draftData?.base64Docs || {});
    const yopDisp = p.yearOfPassing || p.passingYear || '2024';
    const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **முதல் பட்டதாரி சான்றிதழ் (REV-104) விண்ணப்பத்திற்கான விவரங்கள் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **மாணவர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 👨‍👧 **தந்தை பெயர்:** ${p.fatherNameTam || p.fatherNameEng || '—'} (கல்வி: ${p.fatherEducation || '10th'})\n` +
        `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng || '—'} (கல்வி: ${p.motherEducation || '8th'})\n` +
        `• 🎓 **படிப்பு:** ${p.currentCourse || p.degreeCourse || 'B.E.'} (12th தேர்ச்சி: ${yopDisp}) ✅\n` +
        `• 🏛️ **கல்வி நிறுவனம்:** ${p.institutionName || p.collegeName || '—'} ✅\n` +
        `• 📜 **மாணவர் 12th TC:** ${hasApplicantProof ? 'பதிவேற்றப்பட்டது ✅' : 'விடுபட்டுள்ளது ❌'}\n` +
        `• 📑 **குடும்ப ஸ்மார்ட் கார்டு:** ${hasSmartCard ? 'பதிவேற்றப்பட்டது ✅' : 'விடுபட்டுள்ளது ❌'}\n` +
        `• 👨 **தந்தை TC:** ${hasFatherProof ? 'பதிவேற்றப்பட்டது ✅' : 'விடுபட்டுள்ளது ❌'}\n` +
        `• 👩 **தாய் TC:** ${hasMotherProof ? 'பதிவேற்றப்பட்டது ✅' : 'விடுபட்டுள்ளது ❌'}\n` +
        `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
        (chk && chk.summaryTamil ? `${chk.summaryTamil}\n\n` : '') +
        `இப்போது இ-சேவை (TNeGA REV-104) போர்ட்டல் மூலம் விண்ணப்பிக்கத் தொடங்கலாம்!`;
    const options = [
        { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு", value: "START_FIRST_GRADUATE_APPLY" },
        { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
        { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
    ];
    return { text: welcomeText, options, step: sess.intakeState, actionRequired: 'open_edit_modal' };
}

function enterService(sess, { greeting = '', isDirectOperator = false, cleanMobile = '', createAppFn = null } = {}) {
    sess.subService = 'FIRST_GRADUATE';
    sess.pluginId = 'TNEGA_FIRST_GRADUATE';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'FIRST_GRADUATE';
        sess.citizenProfile.pluginId = 'TNEGA_FIRST_GRADUATE';
        delete sess.citizenProfile.currentCourse;
        delete sess.citizenProfile.institutionName;
        delete sess.citizenProfile.fatherEducation;
        delete sess.citizenProfile.motherEducation;
        delete sess.citizenProfile.familyGraduateConfirmed;
    }
    delete sess.currentCourse;
    delete sess.institutionName;
    delete sess.fatherEducation;
    delete sess.motherEducation;
    delete sess.familyGraduateConfirmed;
    if (isDirectOperator) {
        sess.intakeState = 'FIRST_GRADUATE_INTAKE';
        if (createAppFn && cleanMobile) { try { createAppFn(cleanMobile, 'FIRST_GRADUATE_CERTIFICATE', sess.citizenProfile); } catch (_) {} }
    }
    const flowStep = advanceFlow(sess, greeting);
    const botMsg = { sender: 'bot', text: flowStep.text, options: flowStep.options };
    if (isDirectOperator) sess.chatHistory = [botMsg];
    else sess.chatHistory.push(botMsg);
    return true;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = 'FIRST_GRADUATE';
    sess.chatHistory = Array.isArray(sess.chatHistory) ? sess.chatHistory : [];
    const p = sess.citizenProfile || {};
    if (docType === 'applicantEducationProof' || docType === 'studentTc') {
        delete p.applicantEducationProof;
        delete p.studentTc;
    } else if (docType === 'fatherEducationProof' || docType === 'fatherTc') {
        delete p.fatherEducationProof;
        delete p.fatherTc;
    } else if (docType === 'motherEducationProof' || docType === 'motherTc') {
        delete p.motherEducationProof;
        delete p.motherTc;
    } else if (docType === 'smartCard' || docType === 'rationCard') {
        delete p.smartCard;
        delete p.rationCard;
        delete p.smartCardDocPath;
    } else if (docType === 'headPhoto' || docType === 'profilePhoto') {
        delete p.headPhotoPath;
        delete p.profilePhoto;
    } else if (docType === 'headAadhaar') {
        delete p.headAadhaarDocPath;
    }
    const flowStep = advanceFlow(sess, `🗑️ **தேர்ந்தெடுக்கப்பட்ட ஆவணம் நீக்கப்பட்டது!**`);
    sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
    return true;
}

module.exports = { advanceFlow, enterService, onDocumentDeleted };
