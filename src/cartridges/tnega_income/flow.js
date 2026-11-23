const { evaluateServiceChecklist } = require('../../core/services_registry');
const { isPhysicalDocValid, hasValidSmartCard, buildSmartCardPromptStep } = require('../_tnega_upload_utils');

function advanceFlow(sess, prefixMessage = '') {
    sess.subService = 'INCOME';
    if (!sess.citizenProfile) sess.citizenProfile = {};
    sess.citizenProfile.subService = 'INCOME';

    if (sess.citizenProfile.subServiceData && (sess.citizenProfile.subServiceData.memberName || sess.citizenProfile.subServiceData.isChild !== undefined)) {
        sess.citizenProfile.subServiceData = {};
    }
    if (sess.subServiceData && (sess.subServiceData.memberName || sess.subServiceData.isChild !== undefined)) {
        sess.subServiceData = {};
    }

    const p = sess.citizenProfile;
    const members = p.members || [];
    const hasFamily = members.length > 1;

    if (hasFamily && !sess.selectedMember) {
        sess.intakeState = 'INCOME_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📜 **வருமானச் சான்றிதழ் (Income Certificate)**\n\n` +
            `இந்த குடும்பத்தில் **யாருக்கு வருமானச் சான்றிதழ்** தேவைப்படுகிறது? கீழே உள்ள நபரைத் தேர்ந்தெடுக்கவும்:`;
        const options = members.map((m, idx) => ({
            label: `👤 ${m.nameTam || m.nameEng} (${m.relationshipTam || (idx === 0 ? 'தலைவர்' : 'உறுப்பினர்')})`,
            value: `SELECT_MEMBER_${idx}`
        }));
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasAadhaarDoc = isPhysicalDocValid(
        p.headAadhaarDocPath || p.documents?.headAadhaar || sess.tempUploads?.headAadhaar,
        sess.draftData?.base64Docs?.headAadhaarBase64
    );
    const hasBasicDemographics = Boolean(p.headAadhaar || p.aadhaarNumber || p.fullNameTam || p.fullNameEng);

    if (!hasAadhaarDoc || !hasBasicDemographics) {
        sess.intakeState = 'INCOME_AADHAAR_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💰 **வருமானச் சான்றிதழ் (Income Certificate - REV-103) விண்ணப்பம்**\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Mandatory Document Gate):**\n` +
            `வருமானச் சான்றிதழ் விண்ணப்பிக்க தேவையான ஆவணங்கள் முதலில் சரிபார்க்கப்பட வேண்டும்.\n\n` +
            `📄 விண்ணப்பதாரரின் பெயர் மற்றும் முகவரி விவரங்களைத் தானாகப் பெற **ஆதார் அட்டை (படம் அல்லது 2-in-1 PDF)** பதிவேற்றவும்:`;
        const options = [
            { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (sess.tempUploads?.headAadhaarFront && !sess.tempUploads?.headAadhaarBack && !p.fatherNameTam && !p.fatherNameEng && !p.pincode) {
        sess.intakeState = 'INCOME_AADHAAR_BACK_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `🔄 **ஆதார் முன்பக்கம் பெறப்பட்டது! தந்தை/கணவர் பெயர் மற்றும் முகவரி உள்ள பின்பக்கத்தை (Back Side) பதிவேற்றவும்:**`;
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
        sess.intakeState = 'INCOME_PHOTO_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📷 **விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் தேவை:**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA REV-103 Portal Rule):**\n` +
            `வருமானச் சான்றிதழ் விண்ணப்பத்திற்கு விண்ணப்பதாரரின் நேரடி பாஸ்போர்ட் புகைப்படம் (<50KB) போர்ட்டலில் கட்டாயம் பதிவேற்றப்பட வேண்டும்.\n\n` +
            `தயவுசெய்து நேரடி பாஸ்போர்ட் புகைப்படத்தைப் பதிவேற்றவும் (ஆதார் அட்டையிலிருந்து படம் வெட்டப்பட மாட்டாது):`;
        const options = [
            { label: "📷 பாஸ்போர்ட் புகைப்படம் பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (!hasValidSmartCard(p, sess)) {
        return buildSmartCardPromptStep(sess, 'INCOME_SMARTCARD_WAIT', prefixMessage, 'வருமானச் சான்றிதழ் (REV-103)', true);
    }

    const hasIncomeProof = isPhysicalDocValid(
        p.incomeProof || p.salaryCertificatePath || p.salaryCertificate || p.documents?.incomeProof || p.documents?.salaryCertificate || sess.tempUploads?.incomeProof,
        sess.draftData?.base64Docs?.incomeProofBase64
    ) || p.incomeProof === 'SELF_DECLARATION' || p.incomeProofType === 'SELF_DECLARATION' || p.salaryProofType === 'SELF_DECLARATION' || Boolean(p.annualIncome && p.profession);

    if (!hasIncomeProof) {
        sess.intakeState = 'INCOME_PROOF_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💼 **வருமான விவரம் / சம்பளச் சான்று (Income Details / Proof):**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `💡 **அரசு நடைமுறை விதி (TNeGA REV-103 Rule):**\n` +
            `விவசாயிகள், கூலித் தொழிலாளர்கள் மற்றும் முறைசாரா தொழிலாளர்களுக்கு **சம்பள ரசீது (Pay Slip) கட்டாயமில்லை!** நேரடி சுய அறிவிப்பு (Self-Declaration) மூலம் தொழில் மற்றும் மாத வருமானத்தை உள்ளிட்டே விண்ணப்பிக்கலாம்.\n\n` +
            `👇 **தொழில் மற்றும் மாத வருமானத்தைத் தேர்ந்தெடுக்கவும் (அல்லது நேரடியாக தட்டச்சு செய்யவும்):**`;
        const options = [
            { label: "🌾 விவசாயி (Farmer - மாதம் ₹6,000 / ஆண்டு ₹72,000)", value: "INCOME_DECL_FARMER_6000" },
            { label: "🔨 கூலி வேலை (Daily Wage - மாதம் ₹6,000 / ஆண்டு ₹72,000)", value: "INCOME_DECL_COOLIE_6000" },
            { label: "🏪 சிறு வியாபாரம் (மாதம் ₹7,000 / ஆண்டு ₹84,000)", value: "INCOME_DECL_BIZ_7000" },
            { label: "🏢 தனியார் வேலை (மாதம் ₹8,000 / ஆண்டு ₹96,000)", value: "INCOME_DECL_PVT_8000" },
            { label: "📷 சம்பளச் சான்று / Pay Slip பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const resolvedCan = String(p.canNumber || sess.canNumber || p.can || '').replace(/\D+/g, '');
    if (resolvedCan && !p.canNumber) p.canNumber = resolvedCan;
    if (resolvedCan && !sess.canNumber) sess.canNumber = resolvedCan;
    const hasCan = Boolean(resolvedCan && resolvedCan.length >= 11);

    if (!hasCan) {
        sess.intakeState = 'INCOME_CAN_GATE';
        const aadhDisp = (p.headAadhaar || p.aadhaarNumber || '').replace(/(\d{4})/g, '$1 ').trim();
        const nameDisp = p.fullNameTam || p.fullNameEng || '';
        let welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **தேவையான அனைத்து ஆவணங்களும் பெறப்பட்டன!** 🛡️\n\n` +
            `⚠️ **முக்கிய அரசு விதி (TNeGA Portal Rule):**\n` +
            `வருமானச் சான்றிதழ் போர்ட்டலில் விண்ணப்பிக்க **13-இலக்க CAN எண் (Citizen Access Number)** தேவை.\n\n`;
        if (nameDisp || aadhDisp) {
            welcomeText += (nameDisp ? `• 👤 **விண்ணப்பதாரர்:** ${nameDisp}\n` : '') +
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
        sess.intakeState = 'INCOME_MOTHER_NAME_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண் இணைக்கப்பட்டுள்ளது:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n\n` +
            `⚠️ **கட்டாய அரசு விவரம் (Mandatory Detail):**\n` +
            `இ-சேவை (TNeGA) போர்ட்டலில் தாயின் பெயர் கட்டாயமாகும்.\n\n` +
            `தயவுசெய்து **தாயாரின் பெயரை** உள்ளிடவும் (எ.கா: தேவகி அல்லது Devaki):`;
        return { text: welcomeText, options: [], step: sess.intakeState };
    }

    const hasCommunity = Boolean(p.community || p.caste || p.socialCategory);
    if (!hasCommunity) {
        sess.intakeState = 'INCOME_COMMUNITY_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ **TNeGA CAN எண்:** **${p.canNumber}** 🛡️\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng}\n\n` +
            `🏛️ **விண்ணப்பதாரரின் வகுப்பு / பிரிவு (Community) எது?**\n` +
            `கீழே உள்ள பிரிவைத் தேர்ந்தெடுக்கவும்:`;
        const options = [
            { label: "MBC (மிகவும் பிற்படுத்தப்பட்டோர்)", value: "COMMUNITY_MBC" },
            { label: "BC (பிற்படுத்தப்பட்டோர்)", value: "COMMUNITY_BC" },
            { label: "BCM (பிற்படுத்தப்பட்ட முஸ்லிம்)", value: "COMMUNITY_BCM" },
            { label: "SC (பட்டியலினத்தவர்)", value: "COMMUNITY_SC" },
            { label: "ST (பழங்குடியினர்)", value: "COMMUNITY_ST" },
            { label: "OC (பொதுப் பிரிவு)", value: "COMMUNITY_OC" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const relHintInc = String(p.relationship || p.headRelationship || '').toLowerCase();
    const isMarriedInc = relHintInc.includes('husband') || relHintInc.includes('spouse') || String(p.maritalStatus || '').toLowerCase().includes('married') || Boolean(p.spouseNameEng || p.spouseNameTam || p.spouseName);

    if (Array.isArray(p.smartCardMembers) && p.smartCardMembers.length > 0 && p.incomeMembersConfirmed !== true) {
        sess.intakeState = 'INCOME_SELECT_MEMBERS_WAIT';
        const pickedSet = new Set(Array.isArray(p.incomeSelectedIndices) ? p.incomeSelectedIndices : []);
        const extraBabies = Array.isArray(p.incomeExtraAddedMembers) ? p.incomeExtraAddedMembers : [];
        const lines = p.smartCardMembers.map((m, idx) => {
            const mark = pickedSet.has(idx) ? '✅' : '⬜';
            return `${mark} **${idx + 1}. ${m.nameTam || m.nameEng || m.name}** (${m.relationship || 'உறுப்பினர்'}${m.age ? `, ${m.age} வயது` : ''})`;
        });
        extraBabies.forEach((eb, i) => {
            lines.push(`✅ **${p.smartCardMembers.length + i + 1}. ${eb.name} (${eb.relationship}${eb.age ? `, ${eb.age} வயது` : ''})** *(புதிதாகச் சேர்க்கப்பட்டது)*`);
        });
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨‍👩‍👧‍👦 **ரேஷன் கார்டிலிருந்து கண்டறியப்பட்ட குடும்ப உறுப்பினர்கள்:**\n\n` +
            lines.join('\n') + `\n\n` +
            `⚠️ *திருமணமான பெண்களின் விண்ணப்பத்தில் கணவர் குடும்ப உறுப்பினர்களை மட்டுமே தேர்ந்தெடுக்கவும்; ரேஷன் கார்டில் இல்லாத பிறந்த குழந்தையையும் சேர்க்கலாம்.*\n` +
            `👇 சேர்க்க வேண்டிய நபர்களைத் தேர்ந்தெடுக்கவும் (அல்லது எண்களைத் தட்டச்சு செய்க — எ.கா: \`1, 2\`):`;
        const options = [
            { label: `✅ அனைவரையும் சேர் (${p.smartCardMembers.length + extraBabies.length} நபர்கள்)`, value: "INC_SEL_ALL" },
            { label: "👤 விண்ணப்பதாரர் மட்டும் (1 நபர்)", value: "INC_SEL_SELF_ONLY" }
        ];
        p.smartCardMembers.forEach((m, idx) => {
            const mark = pickedSet.has(idx) ? '✅' : '➕';
            options.push({
                label: `${mark} ${idx + 1}. ${m.nameTam || m.nameEng || m.name} (${m.relationship || 'உறுப்பினர்'})`,
                value: `INC_TOGGLE_${idx}`
            });
        });
        options.push({ label: "👶 + பிறந்த குழந்தை / கூடுதல் நபர் சேர்", value: "INC_ADD_NEWBORN" });
        if (pickedSet.size > 0 || extraBabies.length > 0) {
            options.push({ label: `➡️ தேர்வு முடிந்தது (${pickedSet.size + extraBabies.length} பேர்) — தொடர்க`, value: "INC_MEMBERS_CONFIRMED" });
        }
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (!p.familyMemberCount) {
        sess.intakeState = 'INCOME_MEMBER_COUNT_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👨‍👩‍👧‍👦 **வருமானச் சான்றிதழில் சேர்க்க வேண்டிய குடும்ப உறுப்பினர்கள் மொத்தம் எத்தனை பேர்? (ரேஷன் கார்டின் படி)**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
            (isMarriedInc ? `• 💍 **திருமணமானவர் (கணவர்/மனைவி குடும்பம் — பெற்றோர் சேர்க்கப்பட மாட்டார்)**\n` : '') +
            `• 🏛️ **வகுப்பு:** ${p.community || 'MBC'}\n\n` +
            `குடும்பத்தில் உள்ள மொத்த நபர்களின் எண்ணிக்கையைத் தேர்ந்தெடுக்கவும் (அல்லது எண் தட்டச்சு செய்க):`;
        const options = isMarriedInc ? [
            { label: "👤 1 நபர் (விண்ணப்பதாரர் மட்டும்)", value: "1 நபர்" },
            { label: "👥 2 நபர்கள் (கணவன் & மனைவி மட்டும்)", value: "2 நபர்கள்" },
            { label: "👨‍👩‍👧 3 நபர்கள் (குழந்தை/குடும்பத்துடன்)", value: "3 நபர்கள்" },
            { label: "👨‍👩‍👧‍👦 4 நபர்கள்", value: "4 நபர்கள்" }
        ] : [
            { label: "👤 1 நபர் (விண்ணப்பதாரர் மட்டும்)", value: "1 நபர்" },
            { label: "👥 2 நபர்கள் (விண்ணப்பதாரர் + குடும்ப நபர்)", value: "2 நபர்கள்" },
            { label: "👨‍👩‍👧 3 நபர்கள்", value: "3 நபர்கள்" },
            { label: "👨‍👩‍👧‍👦 4 நபர்கள்", value: "4 நபர்கள்" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const neededAddl = Number(p.familyMemberCount) - 1;
    const currentAddl = (p.incomeMembers || []).length;
    if (neededAddl > 0 && currentAddl < neededAddl) {
        sess.intakeState = 'INCOME_ADDITIONAL_MEMBER_WAIT';
        const spouseName = p.spouseNameTam || p.spouseNameEng || (relHintInc.includes('husband') ? (p.fatherNameTam || p.fatherNameEng || '') : '');
        const alreadyHasHusband = (p.incomeMembers || []).some(m => String(m.relationship || '').toLowerCase() === 'husband');
        const options = [];
        if (isMarriedInc) {
            if (!alreadyHasHusband) {
                const hLbl = spouseName ? `👨 கணவர் - ${spouseName}` : '👨 கணவர் (பெயர் சேர்க்க)';
                options.push({ label: hLbl, value: spouseName ? `கணவர் - ${spouseName}` : 'கணவர்' });
            }
            options.push({ label: "👶 பிறந்த குழந்தை / மகன் / மகள்", value: "மகன்" });
            options.push({ label: "👧 மகள் (Daughter)", value: "மகள்" });
            options.push({ label: "👵 மாமியார் (Mother-in-law)", value: "மாமியார்" });
            options.push({ label: "👴 மாமனார் (Father-in-law)", value: "மாமனார்" });
        } else {
            const motherName = p.motherNameTam || p.motherNameEng || '';
            const fatherName = p.fatherNameTam || p.fatherNameEng || '';
            options.push({ label: motherName ? `👩 தாய் - ${motherName}` : '👩 தாய்', value: motherName ? `தாய் - ${motherName}` : 'தாய்' });
            options.push({ label: fatherName ? `👨 தந்தை - ${fatherName}` : '👨 தந்தை', value: fatherName ? `தந்தை - ${fatherName}` : 'தந்தை' });
            options.push({ label: "👰 மனைவி (Wife)", value: "மனைவி" });
            options.push({ label: "👶 பிறந்த குழந்தை / மகன் / மகள்", value: "மகன்" });
        }
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `👥 **குடும்ப உறுப்பினர் ${currentAddl + 2}/${Number(p.familyMemberCount)} விவரங்கள்:**\n\n` +
            `இந்த உறுப்பினரின் **உறவுமுறை, பெயர், வயது மற்றும் தொழில்/மாத வருமானம்** உள்ளிடவும் (அல்லது கீழே தேர்ந்தெடுக்கவும்):\n` +
            `*(எ.கா: \`கணவர் - முனுசாமி, வயது 58, கூலி வேலை, மாதம் 6000\` அல்லது \`பிறந்த குழந்தை - ஆதித்யா, வயது 1\`)*`;
        return { text: welcomeText, options, step: sess.intakeState };
    }

    if (Array.isArray(p.incomeMembers)) {
        const nextPendingIdx = p.incomeMembers.findIndex(m => m && m.workConfirmed === false);
        if (nextPendingIdx !== -1) {
            const targetMem = p.incomeMembers[nextPendingIdx];
            sess.pendingIncomeMemberIndex = nextPendingIdx;
            sess.intakeState = 'INCOME_ADDITIONAL_MEMBER_WORK_WAIT';
            const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
                `💼 **உறுப்பினர் ${nextPendingIdx + 2}: ${targetMem.nameTam || targetMem.name} (${targetMem.relationship || 'உறுப்பினர்'})**\n\n` +
                `இவர் என்ன வேலை செய்கிறார் மற்றும் மாத வருமானம் எவ்வளவு?\n` +
                `*(கீழே தேர்ந்தெடுக்கவும் அல்லது தட்டச்சு செய்யவும் — எ.கா: \`கூலி வேலை மாதம் 6000\`)*`;
            const options = [
                { label: "🔨 கூலி வேலை (மாதம் ₹6,000)", value: "கூலி வேலை மாதம் 6000" },
                { label: "🌾 விவசாயம் (மாதம் ₹6,000)", value: "விவசாயம் மாதம் 6000" },
                { label: "🏢 தனியார் வேலை (மாதம் ₹8,000)", value: "தனியார் வேலை மாதம் 8000" },
                { label: "🏪 சிறு வியாபாரம் (மாதம் ₹7,000)", value: "வியாபாரம் மாதம் 7000" },
                { label: "🏠 இல்லத்தரசி / வேலை இல்லை (₹0)", value: "இல்லத்தரசி ₹0" },
                { label: "🎓 மாணவர் / 👶 குழந்தை (₹0)", value: "மாணவர் ₹0" }
            ];
            return { text: welcomeText, options, step: sess.intakeState };
        }
    }

    const hasIncome = Boolean(p.annualIncome);
    if (!hasIncome) {
        sess.intakeState = 'INCOME_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `💰 **குடும்ப மொத்த ஆண்டு வருமானம் எவ்வளவு?**\n\n` +
            `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng || 'விண்ணப்பதாரர்'}\n` +
            `• 👨‍👩‍👧‍👦 **குடும்ப உறுப்பினர்கள்:** ${p.familyMemberCount || 1} நபர்\n\n` +
            `வருமானச் சான்றிதழில் குறிப்பிட வேண்டிய ஆண்டு வருமானத்தைத் தேர்ந்தெடுக்கவும் (மாதம் ₹6,000 என்றால் ஆண்டுக்கு ₹72,000):`;
        const options = [
            { label: "₹60,000 (மாதம் ₹5,000)", value: "₹60,000" },
            { label: "🌾 ₹72,000 (மாதம் ₹6,000)", value: "₹72,000" },
            { label: "₹84,000 (மாதம் ₹7,000)", value: "₹84,000" },
            { label: "₹1,00,000", value: "₹1,00,000" },
            { label: "₹1,20,000", value: "₹1,20,000" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasProfession = Boolean(p.profession);
    if (!hasProfession) {
        sess.intakeState = 'INCOME_INTAKE';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `✅ குடும்ப ஆண்டு வருமானம் **₹${Number(p.annualIncome).toLocaleString('en-IN')}** எனப் பதிவானது!\n\n` +
            `💼 **விண்ணப்பதாரரின் தொழில் (Occupation) என்ன?**\n` +
            `கீழே உள்ள தொழிலைத் தேர்ந்தெடுக்கவும் (அல்லது தட்டச்சு செய்யவும்):`;
        const options = [
            { label: "🌾 விவசாயம் (Agriculture / Farmer)", value: "விவசாயம்" },
            { label: "🔨 கூலி வேலை (Daily Wage / Coolie)", value: "கூலி வேலை" },
            { label: "🏪 சிறு வணிகம் / வியாபாரம் (Small Business)", value: "சிறு வணிகம் / வியாபாரம்" },
            { label: "🏢 தனியார் துறை (Private Sector)", value: "தனியார் வேலை" }
        ];
        return { text: welcomeText, options, step: sess.intakeState };
    }

    const hasEmployedMember = /தனியார்|அரசு|private|govt|salary/i.test(`${p.profession || ''} ${(p.incomeMembers || []).map(m => m.profession || '').join(' ')}`);
    const hasPhysicalSalaryDoc = isPhysicalDocValid(p.salaryCertificatePath || p.salaryCertificate || p.incomeProof, sess.draftData?.base64Docs?.incomeProofBase64) && p.incomeProof !== 'SELF_DECLARATION';
    if (hasEmployedMember && !hasPhysicalSalaryDoc && !p.salaryProofPrompted) {
        sess.intakeState = 'INCOME_SALARY_DOC_OPTIONAL_WAIT';
        const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
            `📄 **சம்பளச் சான்று / Pay Slip உள்ளதா? (விருப்பம் / Optional):**\n\n` +
            `குடும்பத்தில் தனியார்/அரசு வேலை செய்பவர் உள்ளதால், **சம்பளச் சான்று (Salary Certificate)** இருந்தால் பதிவேற்றலாம்; இல்லையெனில் சுய அறிவிப்புடன் தொடரலாம்:`;
        return {
            text: welcomeText,
            options: [
                { label: "📷 சம்பளச் சான்று பதிவேற்றுக (Upload Salary Cert)", value: "TRIGGER_FILE_UPLOAD" },
                { label: "⏭️ தேவையில்லை / சுய அறிவிப்பு போதும்", value: "SKIP_SALARY_PROOF" }
            ],
            step: sess.intakeState
        };
    }

    sess.intakeState = 'READY_TO_APPLY_INCOME';
    const chk = evaluateServiceChecklist('INCOME_CERTIFICATE', sess.citizenProfile, sess.draftData?.base64Docs || {});
    const addlSummary = (p.incomeMembers && p.incomeMembers.length > 0)
        ? p.incomeMembers.map((m, idx) => `• 👥 **உறுப்பினர் ${idx + 2}:** ${m.name} (${m.relationship} - ${m.profession})`).join('\n') + '\n'
        : '';

    const welcomeText = (prefixMessage ? prefixMessage + '\n\n' : '') +
        `🎉 **வருமானச் சான்றிதழ் விண்ணப்பத்திற்கான அனைத்து விவரங்களும் 100% தயாராக உள்ளன!** 🛡️\n\n` +
        `📋 **விவரங்கள் சுருக்கம்:**\n` +
        `• 🔢 **CAN எண்:** **${p.canNumber}** ✅\n` +
        `• 👤 **விண்ணப்பதாரர்:** ${p.fullNameTam || p.fullNameEng}\n` +
        `• 👨‍👧 **தந்தை/கணவர்:** ${p.fatherNameTam || p.fatherNameEng || '—'}\n` +
        `• 👩 **தாயின் பெயர்:** ${p.motherNameTam || p.motherNameEng}\n` +
        `• 🏛️ **வகுப்பு:** ${p.community}\n` +
        `• 👨‍👩‍👧‍👦 **மொத்த குடும்ப உறுப்பினர்கள்:** ${p.familyMemberCount || 1} நபர்\n` +
        addlSummary +
        `• 💰 **ஆண்டு வருமானம்:** ₹${Number(p.annualIncome).toLocaleString('en-IN')}\n` +
        `• 💼 **தொழில்:** ${p.profession}\n` +
        `• 🏠 **முகவரி:** ${p.doorNo ? p.doorNo + ', ' : ''}${p.streetTam || p.streetEng || ''}, ${p.village || ''} - ${p.pincode || ''}\n\n` +
        (chk && chk.summaryTamil ? `${chk.summaryTamil}\n\n` : '') +
        `இப்போது இ-சேவை (TNeGA REV-103) போர்ட்டல் மூலம் விண்ணப்பிக்கத் தொடங்கலாம்!`;
    const options = [
        { label: "🚀 இ-சேவை போர்ட்டலில் விண்ணப்பிக்கத் தொடங்கு", value: "START_INCOME_APPLY" },
        { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Edit Details)", value: "TRIGGER_EDIT_MODAL" },
        { label: "🔄 புதிய விண்ணப்பம் தொடங்க (Reset)", value: "reset" }
    ];
    return { text: welcomeText, options, step: sess.intakeState, actionRequired: 'open_edit_modal' };
}

function enterService(sess, { greeting = '', isDirectOperator = false, cleanMobile = '', createAppFn = null } = {}) {
    sess.subService = 'INCOME';
    sess.pluginId = 'TNEGA_INCOME';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'INCOME';
        sess.citizenProfile.pluginId = 'TNEGA_INCOME';
        delete sess.citizenProfile.familyMemberCount;
        delete sess.citizenProfile.annualIncome;
        delete sess.citizenProfile.profession;
        delete sess.citizenProfile.incomeMembers;
        delete sess.citizenProfile.incomeMembersConfirmed;
        delete sess.citizenProfile.incomeSelectedIndices;
        delete sess.citizenProfile.incomeExtraAddedMembers;
        delete sess.citizenProfile.salaryProofPrompted;
    }
    delete sess.annualIncome;
    delete sess.profession;
    delete sess.familyMemberCount;
    delete sess.incomeMembers;
    if (isDirectOperator) {
        sess.intakeState = 'INCOME_INTAKE';
        if (createAppFn && cleanMobile) { try { createAppFn(cleanMobile, 'INCOME_CERT', sess.citizenProfile); } catch (_) {} }
    }
    const flowStep = advanceFlow(sess, greeting);
    const botMsg = { sender: 'bot', text: flowStep.text, options: flowStep.options };
    if (isDirectOperator) sess.chatHistory = [botMsg];
    else sess.chatHistory.push(botMsg);
    return true;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = 'INCOME';
    sess.chatHistory = Array.isArray(sess.chatHistory) ? sess.chatHistory : [];
    const p = sess.citizenProfile || {};
    if (docType === 'incomeProof' || docType === 'salaryCertificate' || docType === 'incomeTaxReturn') {
        delete p.incomeProof;
        delete p.incomeTaxReturn;
        delete p.salaryCertificate;
        delete p.salaryCertificatePath;
    } else if (docType === 'headPhoto' || docType === 'profilePhoto') {
        delete p.headPhotoPath;
        delete p.profilePhoto;
    } else if (docType === 'headAadhaar') {
        delete p.headAadhaarDocPath;
    } else if (docType === 'smartCard' || docType === 'rationCard') {
        delete p.smartCard;
        delete p.rationCard;
        delete p.smartCardDocPath;
    }
    const flowStep = advanceFlow(sess, `🗑️ **தேர்ந்தெடுக்கப்பட்ட ஆவணம் நீக்கப்பட்டது!**`);
    sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
    return true;
}

module.exports = { advanceFlow, enterService, onDocumentDeleted };
