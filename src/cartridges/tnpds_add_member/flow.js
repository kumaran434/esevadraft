const adultFsm = require('../../core/fsm/fsm_add_member_adult');
const childFsm = require('../../core/fsm/fsm_add_member_child');
const docFsm = require('../../core/fsm/fsm_member_doc_upload');
const { renderSubserviceReadySummary } = require('../../core/fsm/fsm_summary_formatter');
const { getVerifiedRationCardDocs } = require('../../services/profile_helpers');
const { resetTransientServiceInputs } = require('../_fresh_service_guard');

function cleanupAddMemberUploads(sess) {
    if (sess.tempUploads) {
        delete sess.tempUploads.memberAadhaar;
        delete sess.tempUploads.memberAadhaarFront;
        delete sess.tempUploads.memberAadhaarBack;
        delete sess.tempUploads.mergedAadhaar;
        delete sess.tempUploads.birthCertificate;
        delete sess.tempUploads.surrenderProof;
    }
    if (sess.citizenProfile && sess.citizenProfile.documents) {
        delete sess.citizenProfile.documents.memberAadhaar;
        delete sess.citizenProfile.documents.memberAadhaarFront;
        delete sess.citizenProfile.documents.memberAadhaarBack;
        delete sess.citizenProfile.documents.memberAadhaars;
        delete sess.citizenProfile.documents.birthCertificate;
        delete sess.citizenProfile.documents.surrenderProof;
    }
    if (sess.documents) {
        delete sess.documents.memberAadhaar;
        delete sess.documents.memberAadhaarFront;
        delete sess.documents.memberAadhaarBack;
        delete sess.documents.memberAadhaars;
        delete sess.documents.birthCertificate;
        delete sess.documents.surrenderProof;
    }
    if (sess.base64Docs) {
        delete sess.base64Docs.memberAadhaarBase64;
        delete sess.base64Docs.memberAadhaarName;
        delete sess.base64Docs.memberAadhaarFrontBase64;
        delete sess.base64Docs.memberAadhaarFrontName;
        delete sess.base64Docs.memberAadhaarBackBase64;
        delete sess.base64Docs.memberAadhaarBackName;
        delete sess.base64Docs.memberAadhaarsBase64;
        delete sess.base64Docs.birthCertificateBase64;
        delete sess.base64Docs.surrenderProofBase64;
    }
    if (sess.citizenProfile && sess.citizenProfile.base64Docs) {
        delete sess.citizenProfile.base64Docs.memberAadhaarBase64;
        delete sess.citizenProfile.base64Docs.memberAadhaarName;
        delete sess.citizenProfile.base64Docs.memberAadhaarFrontBase64;
        delete sess.citizenProfile.base64Docs.memberAadhaarFrontName;
        delete sess.citizenProfile.base64Docs.memberAadhaarBackBase64;
        delete sess.citizenProfile.base64Docs.memberAadhaarBackName;
        delete sess.citizenProfile.base64Docs.memberAadhaarsBase64;
        delete sess.citizenProfile.base64Docs.birthCertificateBase64;
        delete sess.citizenProfile.base64Docs.surrenderProofBase64;
    }
    if (sess.storageUrls) {
        delete sess.storageUrls.memberAadhaar;
        delete sess.storageUrls.memberAadhaarFront;
        delete sess.storageUrls.memberAadhaarBack;
        delete sess.storageUrls.birthCertificate;
        delete sess.storageUrls.surrenderProof;
    }
    if (sess.citizenProfile) {
        sess.citizenProfile.tempMember = null;
    }
}

function enterService(sess, { isDirectOperator = false } = {}) {
    sess.service = 'ரேஷன் கார்டு';
    sess.subService = 'ADD_MEMBER';
    sess.pluginId = 'TNPDS_ADD_MEMBER';
    if (sess.citizenProfile) {
        sess.citizenProfile.subService = 'ADD_MEMBER';
        sess.citizenProfile.pluginId = 'TNPDS_ADD_MEMBER';
    }
    if (isDirectOperator) {
        sess.subServiceData = sess.subServiceData || {};
        if (sess.citizenProfile?.rationCardNo) sess.subServiceData.rationCardNo = sess.citizenProfile.rationCardNo;
        if (sess.citizenProfile?.district) sess.subServiceData.district = sess.citizenProfile.district;
        if (sess.citizenProfile?.taluk) sess.subServiceData.taluk = sess.citizenProfile.taluk;
        if (sess.citizenProfile?.village) sess.subServiceData.village = sess.citizenProfile.village;
        sess.chatHistory = [];
    }

    const subData = sess.subServiceData || sess.citizenProfile?.subServiceData || {};
    const prof = sess.citizenProfile || {};
    const headName = prof.fullNameTam || prof.fullNameEng || 'குடும்பத் தலைவர்';
    const isSameAsHead = (candidateName, candidateAadh) => {
        const cleanCandAadh = String(candidateAadh || '').replace(/\D/g, '');
        const cleanHeadAadh = String(prof.headAadhaar || '').replace(/\D/g, '');
        if (cleanCandAadh && cleanHeadAadh && cleanCandAadh === cleanHeadAadh) return true;
        if (candidateName && prof.fullNameTam && String(candidateName).trim() === String(prof.fullNameTam).trim() && !subData.relationshipTam) return true;
        return false;
    };
    if (isSameAsHead(subData.memberNameTam || subData.memberName, subData.aadhaarNo || subData.aadhaarNumber)) {
        delete subData.memberName;
        delete subData.memberNameTam;
        delete subData.memberNameEng;
        delete subData.aadhaarNo;
        delete subData.aadhaarNumber;
        delete subData.dob;
        delete subData.gender;
        delete subData.genderTam;
        delete subData.fatherNameTam;
        delete subData.fatherNameEng;
        delete subData.relationshipTam;
        delete subData.relationship;
        delete subData.docPath;
        delete subData.aadhaarDocPath;
        if (sess.tempUploads && sess.tempUploads.memberAadhaar && prof.documents?.headAadhaar &&
            String(sess.tempUploads.memberAadhaar) === String(prof.documents.headAadhaar)) {
            delete sess.tempUploads.memberAadhaar;
        }
    }

    const tempMem = sess.tempMember || sess.citizenProfile?.tempMember || null;
    if (tempMem) {
        const isHead = (tempMem.nameTam && tempMem.nameTam === sess.citizenProfile?.fullNameTam) ||
                       (tempMem.aadhaarNo && tempMem.aadhaarNo === sess.citizenProfile?.headAadhaar);
        if (!isHead) {
            if (!subData.memberName) subData.memberName = tempMem.nameTam || tempMem.nameEng || tempMem.name || '';
            if (!subData.memberNameTam) subData.memberNameTam = tempMem.nameTam || '';
            if (!subData.memberNameEng) subData.memberNameEng = tempMem.nameEng || '';
            if (!subData.aadhaarNo) subData.aadhaarNo = tempMem.aadhaarNo || tempMem.aadhaarNumber || '';
            if (!subData.relationshipTam) subData.relationshipTam = tempMem.relationshipTam || tempMem.relationship || '';
            if (!subData.dob) subData.dob = tempMem.dob || '';
            if (!subData.genderTam) subData.genderTam = tempMem.genderTam || (tempMem.gender === 'Female' ? 'பெண்' : (tempMem.gender === 'Male' ? 'ஆண்' : ''));
            if (!subData.gender) subData.gender = tempMem.gender || '';
            if (!subData.docPath && tempMem.docPath && tempMem.docPath !== sess.citizenProfile?.headAadhaarDocPath) {
                subData.docPath = tempMem.docPath;
            }
        }
    }

    const { memberAadhaarDoc, hasMemberAadhaarDoc } = getVerifiedRationCardDocs(sess.citizenProfile, sess.tempUploads);
    let existingMemDoc = subData.aadhaarDocPath || subData.docPath;
    if (!existingMemDoc && hasMemberAadhaarDoc) {
        const headPath = prof.headAadhaarDocPath || prof.documents?.headAadhaar || '';
        const headPdfMatch = prof.members?.[0]?.docPath || '';
        if (memberAadhaarDoc !== headPath && memberAadhaarDoc !== headPdfMatch) {
            existingMemDoc = memberAadhaarDoc;
        }
    }

    if (existingMemDoc && !subData.docPath) subData.docPath = existingMemDoc;
    if (existingMemDoc && !subData.aadhaarDocPath) subData.aadhaarDocPath = existingMemDoc;

    const rawMemberName = String(subData.memberNameTam || subData.memberName || subData.memberNameEng || '').trim();
    const memberName = (rawMemberName && rawMemberName !== 'புதிய குடும்ப உறுப்பினர்') ? rawMemberName : '';
    const aadhaarNo = String(subData.aadhaarNo || subData.aadhaarNumber || '').replace(/\D/g, '');
    const cleanHeadAadh = String(prof.headAadhaar || '').replace(/\D/g, '');
    const hasValidMemAadhaar = aadhaarNo.length === 12 && (!cleanHeadAadh || aadhaarNo !== cleanHeadAadh);
    const relTam = String(subData.relationshipTam || '').trim();

    // Collect any previously saved non-head family members (for optional 1-click reuse at ₹0 AI cost)
    const savedCandidates = [];
    const pushCandidate = (m) => {
        if (!m) return;
        const mNameTam = String(m.memberNameTam || m.nameTam || m.memberName || m.name || '').trim();
        const mNameEng = String(m.memberNameEng || m.nameEng || '').trim();
        const mName = mNameTam || mNameEng;
        if (!mName || mName === 'புதிய குடும்ப உறுப்பினர்') return;
        const mAadh = String(m.aadhaarNo || m.aadhaarNumber || '').replace(/\D/g, '');
        if (cleanHeadAadh && mAadh && mAadh === cleanHeadAadh) return;
        const mRelTam = String(m.relationshipTam || m.relationTam || m.relationship || m.relation || '').trim();
        const mGender = String(m.gender || '').trim();
        const mGenderTam = String(m.genderTam || (mGender === 'Female' || mGender === 'பெண்' ? 'பெண்' : (mGender === 'Male' || mGender === 'ஆண்' ? 'ஆண்' : ''))).trim();
        if (!savedCandidates.some(c => (c.aadhaarNo && mAadh && c.aadhaarNo === mAadh) || (!mAadh && (c.memberNameTam || c.memberName) === mName))) {
            savedCandidates.push({
                memberName: mName,
                memberNameTam: mNameTam || mName,
                memberNameEng: mNameEng,
                fatherNameTam: m.fatherNameTam || '',
                fatherNameEng: m.fatherNameEng || '',
                aadhaarNo: mAadh,
                dob: m.dob || '',
                gender: mGender,
                genderTam: mGenderTam,
                relationshipTam: mRelTam,
                relationshipEng: m.relationshipEng || '',
                isChild: Boolean(m.isChild),
                docPath: m.docPath || m.aadhaarDocPath || '',
                aadhaarDocPath: m.aadhaarDocPath || m.docPath || ''
            });
        }
    };

    if (memberName && (hasValidMemAadhaar || relTam) && (existingMemDoc || relTam)) {
        pushCandidate({ ...subData, memberName, aadhaarNo, docPath: existingMemDoc || subData.docPath });
    }
    if (Array.isArray(subData.addMembersList)) {
        subData.addMembersList.forEach(pushCandidate);
    }
    if (Array.isArray(prof.savedFamilyMembers)) {
        prof.savedFamilyMembers.forEach(pushCandidate);
    }

    // Golden Rule 24 (5-Basic Vault + Always-Fresh Service Run):
    // ALWAYS start fresh at Step 1 (Member Count: 1 / 2 / 3 / 4) — NEVER surprise-jump mid-stream!
    // If previously scanned family member(s) exist in Saved Family Vault, show optional 1-click chip(s) right below (₹0 AI waste).
    resetTransientServiceInputs(sess);
    cleanupAddMemberUploads(sess);
    sess.subServiceData = savedCandidates.length > 0 ? { _savedCandidates: savedCandidates.slice(0, 3) } : {};
    if (sess.citizenProfile) {
        sess.citizenProfile.subServiceData = sess.subServiceData;
    }

    const savedChips = savedCandidates.slice(0, 3).map((m, i) => ({
        label: `💡 சேமித்த நபர்: ${m.memberNameTam}${m.relationshipTam ? ` (${m.relationshipTam})` : ''}`,
        value: `ADD_MEMBER_RESUME_${i}`
    }));

    sess.intakeState = 'RATION_ADD_MEMBER_COUNT';
    sess.step = 'RATION_ADD_MEMBER_COUNT';
    sess.chatHistory.push({
        sender: 'bot',
        text: `➕ **குடும்ப உறுப்பினர் சேர்க்கை (Add Family Member - TNPDS)**\n\n` +
              `• 👤 **குடும்பத் தலைவர்:** ${headName}\n` +
              `• 📌 **முக்கிய விதி:** புதிய உறுப்பினர் சேர்க்கைக்கு (குழந்தை / மருமகள் / பெரியவர் அனைவருக்கும்) **ஆதார் அட்டை (Aadhaar Card) மட்டுமே** கட்டாயம். *(பிறப்புச் சான்றிதழ் இங்கு ஏற்கப்படாது)*.\n\n` +
              `1️⃣ **எத்தனை புதிய உறுப்பினர்களைச் சேர்க்கப் போகிறீர்கள்?**\n` +
              `கீழே எண்ணிக்கையைத் தேர்ந்தெடுக்கவும்` +
              (savedChips.length > 0 ? ` *(அல்லது கீழே உள்ள சேமித்த குடும்ப உறுப்பினரை ஒரே கிளிக்கில் தேர்வு செய்யலாம்)*:` : ` (அல்லது 1, 2, 3 எனத் தட்டச்சு செய்யவும்):`),
        options: [
            { label: "👤 1 புதிய உறுப்பினர்", value: "ADD_MEMBER_COUNT_1" },
            { label: "👥 2 புதிய உறுப்பினர்கள்", value: "ADD_MEMBER_COUNT_2" },
            { label: "👨‍👩‍👧 3 புதிய உறுப்பினர்கள்", value: "ADD_MEMBER_COUNT_3" },
            { label: "👨‍👩‍👧‍👦 4 புதிய உறுப்பினர்கள்", value: "ADD_MEMBER_COUNT_4" },
            ...savedChips,
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ]
    });
    return true;
}

function buildUploadPromptForMember(sess, idx, total) {
    const prof = sess.citizenProfile || {};
    const headName = prof.fullNameTam || prof.fullNameEng || 'குடும்பத் தலைவர்';
    const progressLine = total > 1
        ? `2️⃣ **புதிய உறுப்பினர் ${idx} / ${total} — ஆதார் அட்டையைப் பதிவேற்றவும்:**`
        : `2️⃣ **சேர்க்கப்பட வேண்டிய புதிய உறுப்பினரின் ஆதார் அட்டையைப் பதிவேற்றவும்:**`;
    return {
        sender: 'bot',
        text: `➕ **குடும்ப உறுப்பினர் சேர்க்கை (${total > 1 ? `உறுப்பினர் ${idx} / ${total}` : '1 புதிய உறுப்பினர்'})**\n\n` +
              `• 👤 **குடும்பத் தலைவர்:** ${headName}\n` +
              `${progressLine}\n` +
              `*(முன்பக்கம் / முழு PDF — பெயர், பிறந்த தேதி, பாலினம், ஆதார் எண் தானாகப் பெறப்பட்டு, அடுத்து உறவுமுறை கேட்கப்படும்)*`,
        actionRequired: 'upload',
        uploadPrompt: 'உறுப்பினர் ஆதார் அட்டை',
        options: [
            { label: "📷 புதிய உறுப்பினர் ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
            { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" },
            { label: "🔙 எண்ணிக்கை மாற்று", value: "குடும்ப உறுப்பினர் சேர்க்க" }
        ]
    };
}

async function handleFlow(text, sess, uploadedDoc = null, extractedDoc = null) {
    if (!sess) return false;
    const currentState = sess.intakeState;

    if (text === 'RATION_ADD_MEMBER_RESET' || (text && text.includes('புதிய ஆவணம் மாற்று'))) {
        sess.subService = 'ADD_MEMBER';
        const prevCount = Number(sess.subServiceData?.targetAddCount || 1);
        sess.subServiceData = { targetAddCount: prevCount, currentAddIndex: 1, addMembersList: [] };
        cleanupAddMemberUploads(sess);
        sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
        sess.step = 'RATION_ADD_MEMBER_TYPE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `➕ **புதிய உறுப்பினர் சேர்க்கை (Add Member - புதுப்பித்தல்)**\n\n` +
                  `சேர்க்கப்பட வேண்டிய புதிய உறுப்பினரின் **ஆதார் அட்டையைப்** பதிவேற்றவும் (அல்லது புகைப்படம் எடுக்கவும்):`,
            actionRequired: 'upload',
            uploadPrompt: 'உறுப்பினர் ஆதார் அட்டை',
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
            ]
        });
        return true;
    }

    // Optional 1-click Saved Family Member selection (works from either RATION_ADD_MEMBER_COUNT or RATION_ADD_MEMBER_RESUME_GATE)
    if (currentState === 'RATION_ADD_MEMBER_RESUME_GATE' || (currentState === 'RATION_ADD_MEMBER_COUNT' && /^ADD_MEMBER_RESUME_\d+$/i.test(String(text || '').trim()))) {
        const cleanTxt = String(text || '').trim();
        const candidates = Array.isArray(sess.subServiceData?._savedCandidates)
            ? sess.subServiceData._savedCandidates
            : (Array.isArray(sess.citizenProfile?.savedFamilyMembers) ? sess.citizenProfile.savedFamilyMembers : []);

        const resumeMatch = cleanTxt.match(/^ADD_MEMBER_RESUME_(\d+)$/i);
        if (resumeMatch || /தொடர்க|continue|resume|இதே உறுப்பினர்/i.test(cleanTxt)) {
            const idx = resumeMatch ? parseInt(resumeMatch[1], 10) : 0;
            const chosen = candidates[idx] || candidates[0];
            if (chosen) {
                const normChosen = {
                    ...chosen,
                    memberName: chosen.memberName || chosen.memberNameTam || chosen.nameTam || chosen.name || chosen.memberNameEng || chosen.nameEng || '',
                    memberNameTam: chosen.memberNameTam || chosen.nameTam || chosen.memberName || chosen.name || '',
                    memberNameEng: chosen.memberNameEng || chosen.nameEng || '',
                    relationshipTam: chosen.relationshipTam || chosen.relationTam || chosen.relationship || chosen.relation || '',
                    aadhaarNo: String(chosen.aadhaarNo || chosen.aadhaarNumber || '').replace(/\D/g, ''),
                    genderTam: chosen.genderTam || (chosen.gender === 'Female' || chosen.gender === 'பெண்' ? 'பெண்' : (chosen.gender === 'Male' || chosen.gender === 'ஆண்' ? 'ஆண்' : ''))
                };
                sess.subServiceData = {
                    ...normChosen,
                    targetAddCount: 1,
                    currentAddIndex: 1,
                    addMembersList: [normChosen]
                };
                if (normChosen.docPath) {
                    sess.tempUploads = sess.tempUploads || {};
                    sess.tempUploads.memberAadhaar = normChosen.docPath;
                    if (sess.citizenProfile) {
                        sess.citizenProfile.documents = sess.citizenProfile.documents || {};
                        sess.citizenProfile.documents.memberAadhaar = normChosen.docPath;
                    }
                }
                if (sess.citizenProfile) sess.citizenProfile.subServiceData = sess.subServiceData;

                if (normChosen.relationshipTam) {
                    sess.intakeState = 'READY_TO_APPLY';
                    sess.step = 'READY';
                    sess.chatHistory.push(renderSubserviceReadySummary(sess));
                    return true;
                }
                sess.intakeState = 'RATION_ADD_MEMBER_RELATION';
                sess.step = 'RATION_ADD_MEMBER_RELATION';
                const prof = sess.citizenProfile || {};
                const headName = prof.fullNameTam || prof.fullNameEng || 'குடும்பத் தலைவர்';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `✅ **${normChosen.memberNameTam} விவரம் தேர்ந்தெடுக்கப்பட்டது!**\n\n❓ **குடும்பத் தலைவர் (${headName}) அவர்களுக்கு ${normChosen.memberNameTam} என்ன உறவுமுறை?**`,
                    options: [
                        { label: "👧 மகள் (Daughter)", value: "மகள்" },
                        { label: "👦 மகன் (Son)", value: "மகன்" },
                        { label: "👫 மருமகள் (Daughter-in-law)", value: "மருமகள்" },
                        { label: "👰 மனைவி (Wife)", value: "மனைவி" },
                        { label: "🤵 கணவர் (Husband)", value: "கணவர்" },
                        { label: "👵 தாய் (Mother)", value: "தாய்" },
                        { label: "👴 தந்தை (Father)", value: "தந்தை" },
                        { label: "👫 மருமகன் (Son-in-law)", value: "மருமகன்" }
                    ]
                });
                return true;
            }
        }

        if (cleanTxt === 'ADD_MEMBER_START_NEW' || /புதிதாக|வேறு உறுப்பினர்|new member|fresh/i.test(cleanTxt)) {
            cleanupAddMemberUploads(sess);
            sess.subServiceData = {};
            if (sess.citizenProfile) sess.citizenProfile.subServiceData = {};
            const prof = sess.citizenProfile || {};
            const headName = prof.fullNameTam || prof.fullNameEng || 'குடும்பத் தலைவர்';
            sess.intakeState = 'RATION_ADD_MEMBER_COUNT';
            sess.step = 'RATION_ADD_MEMBER_COUNT';
            sess.chatHistory.push({
                sender: 'bot',
                text: `➕ **புதிய குடும்ப உறுப்பினர் சேர்க்கை (Add Family Member - TNPDS)**\n\n` +
                      `• 👤 **குடும்பத் தலைவர்:** ${headName}\n` +
                      `• 📌 **முக்கிய விதி:** புதிய உறுப்பினர் சேர்க்கைக்கு **ஆதார் அட்டை (Aadhaar Card) மட்டுமே** கட்டாயம்.\n\n` +
                      `1️⃣ **எத்தனை புதிய உறுப்பினர்களைச் சேர்க்கப் போகிறீர்கள்?**`,
                options: [
                    { label: "👤 1 புதிய உறுப்பினர்", value: "ADD_MEMBER_COUNT_1" },
                    { label: "👥 2 புதிய உறுப்பினர்கள்", value: "ADD_MEMBER_COUNT_2" },
                    { label: "👨‍👩‍👧 3 புதிய உறுப்பினர்கள்", value: "ADD_MEMBER_COUNT_3" },
                    { label: "👨‍👩‍👧‍👦 4 புதிய உறுப்பினர்கள்", value: "ADD_MEMBER_COUNT_4" },
                    { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
                ]
            });
            return true;
        }
    }

    // Step 1 Handler: Member Count Selection (RATION_ADD_MEMBER_COUNT)
    if (currentState === 'RATION_ADD_MEMBER_COUNT') {
        const cleanTxt = String(text || '').trim();
        // Seamless direct upload or legacy child/adult option click -> default count to 1 and continue immediately
        if (uploadedDoc || extractedDoc || cleanTxt === 'TRIGGER_FILE_UPLOAD') {
            sess.subServiceData = { ...(sess.subServiceData || {}), targetAddCount: 1, currentAddIndex: 1, addMembersList: [] };
            sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
            sess.step = 'RATION_ADD_MEMBER_TYPE';
            return await docFsm.handleMemberDocUpload(text, sess, 'RATION_ADD_MEMBER_TYPE', uploadedDoc, extractedDoc);
        }
        if (['ADD_MEMBER_CHILD', 'CHILD_UNDER_5', 'ADULT_ABOVE_5', 'ADD_MEMBER_ADULT'].includes(cleanTxt)) {
            sess.subServiceData = { ...(sess.subServiceData || {}), targetAddCount: 1, currentAddIndex: 1, addMembersList: [] };
            sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
            sess.step = 'RATION_ADD_MEMBER_TYPE';
            if (await childFsm.handleAddMemberChild(text, sess, 'RATION_ADD_MEMBER_TYPE', uploadedDoc, extractedDoc)) return true;
            if (await adultFsm.handleAddMemberAdult(text, sess, 'RATION_ADD_MEMBER_TYPE', uploadedDoc, extractedDoc)) return true;
        }

        const countBtnMatch = cleanTxt.match(/^ADD_MEMBER_COUNT_(\d+)$/i);
        const digitMatch = cleanTxt.match(/^(\d{1,2})\s*(உறுப்பினர்|உறுப்பினர்கள்|நபர்|நபர்கள்|member|members|புதிய.*)?$/i) ||
                           cleanTxt.match(/(\d{1,2})\s*(உறுப்பினர்|நபர்|member)/i);
        let parsedCount = countBtnMatch ? parseInt(countBtnMatch[1], 10) : (digitMatch ? parseInt(digitMatch[1], 10) : 0);
        if (!parsedCount) {
            if (/^ஒன்று|ஒரு/i.test(cleanTxt)) parsedCount = 1;
            else if (/^இரண்டு|ரெண்டு/i.test(cleanTxt)) parsedCount = 2;
            else if (/^மூன்று|மூணு/i.test(cleanTxt)) parsedCount = 3;
            else if (/^நான்கு|நாலு/i.test(cleanTxt)) parsedCount = 4;
        }
        if (parsedCount >= 1 && parsedCount <= 10) {
            sess.subServiceData = {
                ...(sess.subServiceData || {}),
                targetAddCount: parsedCount,
                currentAddIndex: 1,
                addMembersList: []
            };
            if (sess.citizenProfile) {
                sess.citizenProfile.subServiceData = sess.subServiceData;
            }
            sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
            sess.step = 'RATION_ADD_MEMBER_TYPE';
            sess.chatHistory.push(buildUploadPromptForMember(sess, 1, parsedCount));
            return true;
        }

        sess.chatHistory.push({
            sender: 'bot',
            text: `⚠️ தயவுசெய்து சேர்க்க வேண்டிய புதிய உறுப்பினர்களின் எண்ணிக்கையை (1 முதல் 10 வரை) தேர்ந்தெடுக்கவும்:`,
            options: [
                { label: "👤 1 புதிய உறுப்பினர்", value: "ADD_MEMBER_COUNT_1" },
                { label: "👥 2 புதிய உறுப்பினர்கள்", value: "ADD_MEMBER_COUNT_2" },
                { label: "👨‍👩‍👧 3 புதிய உறுப்பினர்கள்", value: "ADD_MEMBER_COUNT_3" },
                { label: "👨‍👩‍👧‍👦 4 புதிய உறுப்பினர்கள்", value: "ADD_MEMBER_COUNT_4" }
            ]
        });
        return true;
    }

    if (await childFsm.handleAddMemberChild(text, sess, currentState, uploadedDoc, extractedDoc)) return true;
    if (await adultFsm.handleAddMemberAdult(text, sess, currentState, uploadedDoc, extractedDoc)) return true;
    if (await docFsm.handleMemberDocUpload(text, sess, currentState, uploadedDoc, extractedDoc)) return true;
    return false;
}

function onDocumentDeleted(sess, docType) {
    if (!sess) return false;
    sess.subService = 'ADD_MEMBER';
    sess.chatHistory = Array.isArray(sess.chatHistory) ? sess.chatHistory : [];
    if (docType === 'memberAadhaar' || docType === 'memberAadhaarFront' || docType === 'memberAadhaarBack') {
        cleanupAddMemberUploads(sess);
        if (sess.subServiceData) {
            delete sess.subServiceData.docPath;
            delete sess.subServiceData.aadhaarDocPath;
        }
        sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
        sess.chatHistory.push({
            sender: 'bot',
            text: `🗑️ **புதிய உறுப்பினர் ஆதார் அட்டை நீக்கப்பட்டது!**\n\nசேர்க்கப்பட வேண்டிய உறுப்பினரின் புதிய **ஆதார் அட்டையைப்** பதிவேற்றவும்:`,
            options: [
                { label: "📷 ஆதார் அட்டை பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
            ]
        });
        return true;
    }
    if (docType === 'memberProof' || docType === 'birthCertificate' || docType === 'surrenderProof') {
        if (sess.subServiceData) {
            delete sess.subServiceData.proofDocPath;
            delete sess.subServiceData.birthDocPath;
            delete sess.subServiceData.surrenderDocPath;
        }
    }
    return true;
}

module.exports = {
    ...adultFsm,
    ...childFsm,
    ...docFsm,
    cleanupAddMemberUploads,
    enterService,
    handleFlow,
    onDocumentDeleted
};
