/**
 * eSevaDraft FSM Add Member — Document Upload & Dual-Sided Processing
 */

const path = require('path');
const { renderSubserviceReadySummary } = require('./fsm_summary_formatter');
const { isDoubleSidedCardComplete } = require('../../services/document_validator');

let photoStudio = null;
try {
    photoStudio = require(path.join(__dirname, '../../../photo_studio'));
} catch (_) {
    try { photoStudio = require(path.join(__dirname, '../../photo_studio')); } catch (_) {}
}

function isExtractedHeadAadhaar(sess, extractedDoc) {
    const cleanExtAadh = String(extractedDoc?.aadhaarNumber || extractedDoc?.aadhaarNo || '').replace(/\D/g, '');
    const cleanHeadAadh = String(sess?.citizenProfile?.headAadhaar || '').replace(/\D/g, '');
    return Boolean(cleanExtAadh && cleanHeadAadh && cleanExtAadh === cleanHeadAadh);
}

function promptNextMissingMemberDetailOrRelation(sess, successPrefix = '✅ **உறுப்பினர் ஆதார் அட்டை பெறப்பட்டது!** 🪪') {
    const ssd = sess.subServiceData || {};
    const prof = sess.citizenProfile || {};
    const headName = prof.fullNameTam || prof.fullNameEng || 'குடும்பத் தலைவர்';
    const memName = String(ssd.memberNameTam || ssd.memberNameEng || ssd.memberName || '').trim();
    const memAadhaar = String(ssd.aadhaarNo || ssd.aadhaarNumber || '').replace(/\D/g, '');
    const memDob = String(ssd.dob || '').trim();

    const nameDisplay = ssd.memberNameTam && ssd.memberNameEng
        ? `${ssd.memberNameTam} (${ssd.memberNameEng})`
        : (memName || '—');
    const aadhaarDisplay = memAadhaar
        ? `\n• 🪪 **ஆதார் எண்:** ${memAadhaar.replace(/(\d{4})/g, '$1 ').trim()}`
        : '';
    const dobDisplay = memDob ? `\n• 📅 **பிறந்த தேதி:** ${memDob}` : '';
    const genderDisplay = ssd.genderTam ? `\n• ⚧ **பாலினம்:** ${ssd.genderTam}` : '';

    if (!memName || memName === 'புதிய குடும்ப உறுப்பினர்') {
        sess.intakeState = 'RATION_ADD_MEMBER_NAME';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${successPrefix}\n\n` +
                  `❓ **சேர்க்கப்பட வேண்டிய புதிய உறுப்பினரின் முழுப் பெயர் (Full Name) என்ன?**\n` +
                  `ஆதாரில் உள்ளவாறு பெயரைத் தட்டச்சு செய்யவும் (எ.கா: \`காவியா க\` / \`Kaviya K\`):`,
            options: [
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" },
                { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
            ]
        });
        return;
    }

    if (memAadhaar.length !== 12) {
        sess.intakeState = 'RATION_ADD_MEMBER_AADHAAR_NO';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${successPrefix}\n\n` +
                  `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${dobDisplay}\n\n` +
                  `❓ **${nameDisplay} அவர்களின் 12-இலக்க ஆதார் எண்ணை (Aadhaar Number) உள்ளிடவும்:**`,
            options: [
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" },
                { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
            ]
        });
        return;
    }

    if (!memDob) {
        sess.intakeState = 'RATION_ADD_MEMBER_DOB';
        sess.chatHistory.push({
            sender: 'bot',
            text: `${successPrefix}\n\n` +
                  `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}\n\n` +
                  `❓ **${nameDisplay} அவர்களின் பிறந்த தேதியை (DD/MM/YYYY) உள்ளிடவும் (எ.கா: \`14/08/2018\`):**`,
            options: [
                { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" },
                { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
            ]
        });
        return;
    }

    sess.intakeState = 'RATION_ADD_MEMBER_RELATION';
    sess.chatHistory.push({
        sender: 'bot',
        text: `${successPrefix}\n\n` +
              `• 👤 **சேர்க்கப்படும் உறுப்பினர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}${genderDisplay}\n` +
              `• 👨‍👩‍👧 **குடும்பத் தலைவர்:** ${headName}\n\n` +
              `2️⃣ **குடும்பத் தலைவர் (${headName}) அவர்களுக்கு ${nameDisplay} என்ன உறவுமுறை?**\n\n` +
              `கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும் (அல்லது நேரடியாக தட்டச்சு செய்யவும்):`,
        options: [
            { label: "👧 மகள் (Daughter)", value: "மகள்" },
            { label: "👦 மகன் (Son)", value: "மகன்" },
            { label: "👫 மருமகள் (Daughter-in-law)", value: "மருமகள்" },
            { label: "👰 மனைவி (Wife)", value: "மனைவி" },
            { label: "🤵 கணவர் (Husband)", value: "கணவர்" },
            { label: "👵 தாய் (Mother)", value: "தாய்" },
            { label: "👴 தந்தை (Father)", value: "தந்தை" },
            { label: "👫 மருமகன் (Son-in-law)", value: "மருமகன்" },
            { label: "🔄 புதிய ஆவணம் மாற்று", value: "RATION_ADD_MEMBER_RESET" },
            { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
        ]
    });
}

async function handleMemberDocUpload(text, sess, currentState, uploadedDoc, extractedDoc) {
    if (currentState === 'RATION_ADD_MEMBER' || currentState === 'RATION_ADD_MEMBER_TYPE') {
        sess.subService = 'ADD_MEMBER';
        if (uploadedDoc || extractedDoc) {
            if (isExtractedHeadAadhaar(sess, extractedDoc)) {
                const headName = sess.citizenProfile?.fullNameTam || sess.citizenProfile?.fullNameEng || 'குடும்பத் தலைவர்';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `⚠️ **இது குடும்பத் தலைவர் (${headName}) அவர்களின் ஆதார் அட்டை!**\n\n` +
                          `குடும்பத் தலைவரையே புதிய உறுப்பினராகச் சேர்க்க முடியாது. சேர்க்கப்பட வேண்டிய **புதிய உறுப்பினரின் ஆதார் அட்டையைப்** பதிவேற்றவும்:`,
                    actionRequired: 'upload',
                    uploadPrompt: 'உறுப்பினர் ஆதார் அட்டை',
                    options: [
                        { label: "📷 புதிய உறுப்பினர் ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
                    ]
                });
                return true;
            }

            sess.subServiceData = sess.subServiceData || {};
            sess.tempUploads = sess.tempUploads || {};
            sess.citizenProfile = sess.citizenProfile || {};
            sess.subServiceData.docType = 'Aadhaar Card';
            if (uploadedDoc?.path) {
                sess.subServiceData.docPath = uploadedDoc.path;
                sess.subServiceData.aadhaarDocPath = uploadedDoc.path;
                sess.tempUploads.memberAadhaarFront = uploadedDoc.path;
                sess.tempUploads.memberAadhaar = uploadedDoc.path;
            }
            
            let isRealExtracted = false;
            if (extractedDoc && (extractedDoc.fullNameTam || extractedDoc.fullNameEng || extractedDoc.aadhaarNumber)) {
                isRealExtracted = true;
                if (extractedDoc.fullNameTam) sess.subServiceData.memberNameTam = extractedDoc.fullNameTam;
                if (extractedDoc.fullNameEng) sess.subServiceData.memberNameEng = extractedDoc.fullNameEng;
                if (extractedDoc.fullNameTam || extractedDoc.fullNameEng) {
                    sess.subServiceData.memberName = extractedDoc.fullNameTam || extractedDoc.fullNameEng;
                }
                if (extractedDoc.aadhaarNumber) sess.subServiceData.aadhaarNo = String(extractedDoc.aadhaarNumber).replace(/\D/g, '');
                if (extractedDoc.dob) sess.subServiceData.dob = extractedDoc.dob;
                if (extractedDoc.gender) {
                    sess.subServiceData.gender = extractedDoc.gender;
                    sess.subServiceData.genderTam = extractedDoc.genderTam || (extractedDoc.gender === 'Female' ? 'பெண்' : 'ஆண்');
                }
                if (extractedDoc.fatherNameTam || extractedDoc.fatherNameEng) {
                    sess.subServiceData.fatherNameTam = extractedDoc.fatherNameTam || '';
                    sess.subServiceData.fatherNameEng = extractedDoc.fatherNameEng || '';
                }
            }

            if (sess.subServiceData.dob) {
                const parts = sess.subServiceData.dob.split('/');
                if (parts.length === 3) {
                    const birthYear = parseInt(parts[2]);
                    const currYear = new Date().getFullYear();
                    sess.subServiceData.isChild = (currYear - birthYear) < 5;
                }
            }

            const nameDisplay = sess.subServiceData.memberNameTam && sess.subServiceData.memberNameEng
                ? `${sess.subServiceData.memberNameTam} (${sess.subServiceData.memberNameEng})`
                : (sess.subServiceData.memberName || '');

            const aadhaarDisplay = sess.subServiceData.aadhaarNo
                ? `\n• 🪪 **ஆதார் எண்:** ${(sess.subServiceData.aadhaarNo || '').replace(/(\d{4})/g, '$1 ').trim()}`
                : '';
            const dobDisplay = sess.subServiceData.dob ? `\n• 📅 **பிறந்த தேதி:** ${sess.subServiceData.dob}` : '';
            const genderDisplay = sess.subServiceData.genderTam ? `\n• ⚧ **பாலினம்:** ${sess.subServiceData.genderTam}` : '';
            const memberLine = nameDisplay ? `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}` : '• 🪪 **புதிய உறுப்பினர் ஆதார் முன்பக்கம் இணைக்கப்பட்டது**';

            const hasBothSides = isDoubleSidedCardComplete(extractedDoc, uploadedDoc?.path, 'aadhaar');

            if (!hasBothSides && uploadedDoc) {
                sess.intakeState = 'RATION_ADD_MEMBER_BACK';
                const successPrefix = isRealExtracted ? '✅ **ஆதார் அட்டை முன்பக்கம் AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **ஆதார் அட்டை முன்பக்கம் பெறப்பட்டது!** 🪪';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `${successPrefix}\n\n` +
                          `${memberLine}${aadhaarDisplay}${dobDisplay}${genderDisplay}\n\n` +
                          `📌 இப்போது ஆதார் அட்டையின் **பின்பக்கத்தை (முகவரி / தந்தை பெயர் உள்ள பகுதி)** பதிவேற்றவும் (அல்லது புகைப்படம் எடுக்கவும்):`,
                    actionRequired: 'upload',
                    uploadPrompt: 'உறுப்பினர் ஆதார் அட்டை',
                    options: [
                        { label: "📷 பின்பக்கம் பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✅ முழு ஆவணம் முடிந்தது (PDF / ஒற்றைப் பக்கம்)", value: "MEMBER_DOC_COMPLETE" },
                        { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
                    ]
                });
                return true;
            }

            const successPrefix = isRealExtracted ? '✅ **ஆதார் அட்டை AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **ஆதார் அட்டை பெறப்பட்டது!** 🪪';
            promptNextMissingMemberDetailOrRelation(sess, successPrefix);
            return true;
        }

        if (text === 'TRIGGER_FILE_UPLOAD') {
            sess.chatHistory.push({
                sender: 'bot',
                text: `📷 தயவுசெய்து புதிய உறுப்பினரின் **ஆதார் அட்டைப் புகைப்படம் அல்லது PDF**-ஐப் பதிவேற்றவும் (அல்லது கீழே படிவத்தில் விவரங்களை உள்ளிடலாம்):`,
                actionRequired: 'upload',
                uploadPrompt: 'புதிய உறுப்பினர் ஆதார் அட்டை (Aadhaar Card)',
                options: [
                    { label: "📷 புதிய உறுப்பினர் ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" },
                    { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
                ]
            });
            return true;
        }

        if (text === 'USE_DEMO_DATA' || text.includes('மாதிரி விவரங்கள்')) {
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
    }

    if (currentState === 'RATION_ADD_MEMBER_BACK') {
        sess.subService = 'ADD_MEMBER';
        sess.subServiceData = sess.subServiceData || {};
        sess.tempUploads = sess.tempUploads || {};

        if (text === 'MEMBER_DOC_COMPLETE' || text.includes('முழு ஆவணம் முடிந்தது')) {
            sess.subServiceData.docPath = sess.tempUploads.memberAadhaarFront || sess.subServiceData.docPath || 'uploads/test_sample_doc.jpg';
            sess.tempUploads.memberAadhaar = sess.subServiceData.docPath;
        } else if (uploadedDoc || extractedDoc) {
            if (uploadedDoc?.path) {
                sess.tempUploads.memberAadhaarBack = uploadedDoc.path;
            }
            if (photoStudio && photoStudio.produceDualSidedDocument && sess.tempUploads.memberAadhaarFront && sess.tempUploads.memberAadhaarBack) {
                try {
                    const mergedPdf = await photoStudio.produceDualSidedDocument(
                        sess.tempUploads.memberAadhaarFront,
                        sess.tempUploads.memberAadhaarBack
                    );
                    if (mergedPdf) {
                        sess.subServiceData.docPath = mergedPdf;
                        sess.tempUploads.memberAadhaar = mergedPdf;
                        sess.tempUploads.mergedAadhaar = mergedPdf;
                        if (sess.citizenProfile) {
                            sess.citizenProfile.documents = sess.citizenProfile.documents || {};
                            sess.citizenProfile.documents.memberAadhaar = mergedPdf;
                        }
                    }
                } catch (_) {
                    sess.subServiceData.docPath = sess.tempUploads.memberAadhaarBack || sess.tempUploads.memberAadhaarFront || uploadedDoc?.path;
                    sess.tempUploads.memberAadhaar = sess.subServiceData.docPath;
                }
            } else {
                sess.subServiceData.docPath = sess.tempUploads.memberAadhaarBack || sess.tempUploads.memberAadhaarFront || uploadedDoc?.path || 'uploads/test_sample_doc.jpg';
                sess.tempUploads.memberAadhaar = sess.subServiceData.docPath;
            }

            if (extractedDoc) {
                if (isExtractedHeadAadhaar(sess, extractedDoc)) {
                    const headName = sess.citizenProfile?.fullNameTam || sess.citizenProfile?.fullNameEng || 'குடும்பத் தலைவர்';
                    sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
                    delete sess.subServiceData.docPath;
                    delete sess.tempUploads.memberAadhaar;
                    delete sess.tempUploads.memberAadhaarFront;
                    delete sess.tempUploads.memberAadhaarBack;
                    sess.chatHistory.push({
                        sender: 'bot',
                        text: `⚠️ **இது குடும்பத் தலைவர் (${headName}) அவர்களின் ஆதார் அட்டை!**\n\nசேர்க்கப்பட வேண்டிய **புதிய உறுப்பினரின் ஆதார் அட்டையைப்** பதிவேற்றவும்:`,
                        actionRequired: 'upload',
                        uploadPrompt: 'புதிய உறுப்பினர் ஆதார் அட்டை (Aadhaar Card)',
                        options: [{ label: "📷 புதிய உறுப்பினர் ஆதார் அட்டை பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" }]
                    });
                    return true;
                }
                if (!sess.subServiceData.memberNameTam && extractedDoc.fullNameTam) sess.subServiceData.memberNameTam = extractedDoc.fullNameTam;
                if (!sess.subServiceData.memberNameEng && extractedDoc.fullNameEng) sess.subServiceData.memberNameEng = extractedDoc.fullNameEng;
                if (!sess.subServiceData.memberName && (extractedDoc.fullNameTam || extractedDoc.fullNameEng)) {
                    sess.subServiceData.memberName = extractedDoc.fullNameTam || extractedDoc.fullNameEng;
                }
                if (!sess.subServiceData.aadhaarNo && extractedDoc.aadhaarNumber) {
                    sess.subServiceData.aadhaarNo = String(extractedDoc.aadhaarNumber).replace(/\D/g, '');
                }
                if (!sess.subServiceData.dob && extractedDoc.dob) sess.subServiceData.dob = extractedDoc.dob;
                if (!sess.subServiceData.gender && extractedDoc.gender) {
                    sess.subServiceData.gender = extractedDoc.gender;
                    sess.subServiceData.genderTam = extractedDoc.genderTam || (extractedDoc.gender === 'Female' ? 'பெண்' : 'ஆண்');
                }
                if (extractedDoc.fatherNameTam || extractedDoc.fatherNameEng) {
                    sess.subServiceData.fatherNameTam = extractedDoc.fatherNameTam || '';
                    sess.subServiceData.fatherNameEng = extractedDoc.fatherNameEng || '';
                }
                if (extractedDoc.address || extractedDoc.doorNo || extractedDoc.pincode) {
                    sess.subServiceData.address = extractedDoc.address || `${extractedDoc.doorNo || ''}, ${extractedDoc.streetTam || extractedDoc.streetEng || ''}, ${extractedDoc.pincode || ''}`.trim();
                }
            }
        } else {
            sess.chatHistory.push({
                sender: 'bot',
                text: `🔄 தயவுசெய்து ஆதார் அட்டையின் **பின்பக்கத்தை (முகவரி பகுதி)** பதிவேற்றவும்:`,
                actionRequired: 'upload',
                uploadPrompt: 'உறுப்பினர் ஆதார் பின்பக்கம்',
                options: [
                    { label: "📷 பின்பக்கம் பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✅ முழு ஆவணம் முடிந்தது (PDF / ஒற்றைப் பக்கம்)", value: "MEMBER_DOC_COMPLETE" }
                ]
            });
            return true;
        }

        const isBackMerged = Boolean(text !== 'MEMBER_DOC_COMPLETE' && !String(text || '').includes('முழு ஆவணம் முடிந்தது') && (uploadedDoc || sess.tempUploads?.memberAadhaarBack));
        const backSuccessPrefix = isBackMerged
            ? '✅ **ஆதார் அட்டை (முன்பக்கம் + பின்பக்கம்) 2-in-1 A4 PDF-ஆக இணைக்கப்பட்டது!** 📄'
            : '✅ **ஆதார் அட்டை பெறப்பட்டது!** 🪪';
        promptNextMissingMemberDetailOrRelation(sess, backSuccessPrefix);
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_NAME') {
        const cleaned = String(text || '').trim();
        if (!cleaned || cleaned.length < 2) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ தயவுசெய்து புதிய உறுப்பினரின் சரியான பெயரை உள்ளிடவும்:`
            });
            return true;
        }
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.memberName = cleaned;
        if (/[\u0B80-\u0BFF]/.test(cleaned)) {
            sess.subServiceData.memberNameTam = cleaned;
        } else {
            sess.subServiceData.memberNameEng = cleaned;
        }
        promptNextMissingMemberDetailOrRelation(sess, `✅ உறுப்பினர் பெயர் **${cleaned}** பதிவு செய்யப்பட்டது.`);
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_AADHAAR_NO') {
        const digits = String(text || '').replace(/\D/g, '');
        const cleanHeadAadh = String(sess.citizenProfile?.headAadhaar || '').replace(/\D/g, '');
        if (digits.length !== 12) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ சரியான **12-இலக்க ஆதார் எண்ணை** உள்ளிடவும் (எ.கா: \`9876 5432 1096\`):`
            });
            return true;
        }
        if (cleanHeadAadh && digits === cleanHeadAadh) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ இது குடும்பத் தலைவரின் ஆதார் எண்! சேர்க்கப்பட வேண்டிய **புதிய உறுப்பினரின்** 12-இலக்க ஆதார் எண்ணை உள்ளிடவும்:`
            });
            return true;
        }
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.aadhaarNo = digits;
        promptNextMissingMemberDetailOrRelation(sess, `✅ ஆதார் எண் **${digits.replace(/(\d{4})/g, '$1 ').trim()}** பதிவு செய்யப்பட்டது.`);
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_DOB') {
        const dobRaw = String(text || '').trim().replace(/-/g, '/');
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dobRaw)) {
            sess.chatHistory.push({
                sender: 'bot',
                text: `⚠️ தயவுசெய்து பிறந்த தேதியை **DD/MM/YYYY** வடிவில் உள்ளிடவும் (எ.கா: \`14/08/2018\`):`
            });
            return true;
        }
        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.dob = dobRaw;
        const parts = dobRaw.split('/');
        const birthYear = parseInt(parts[2], 10);
        if (!isNaN(birthYear)) {
            sess.subServiceData.isChild = (new Date().getFullYear() - birthYear) < 5;
        }
        promptNextMissingMemberDetailOrRelation(sess, `✅ பிறந்த தேதி **${dobRaw}** பதிவு செய்யப்பட்டது.`);
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_RELATION') {
        const raw = (text || '').toLowerCase().trim();
        let relTam = text ? text.trim() : 'மகன்';
        let relEng = 'Member';
        let gen = sess.subServiceData?.gender || 'Male';
        let genTam = sess.subServiceData?.genderTam || 'ஆண்';

        if (raw.includes('மருமகள்') || raw.includes('daughter-in-law')) {
            relTam = 'மருமகள்'; relEng = 'Daughter-in-law'; gen = 'Female'; genTam = 'பெண்';
        } else if (raw.includes('மருமகன்') || raw.includes('son-in-law')) {
            relTam = 'மருமகன்'; relEng = 'Son-in-law'; gen = 'Male'; genTam = 'ஆண்';
        } else if (raw.includes('மகள்') || raw.includes('daughter') || raw === 'child_daughter' || raw === 'rel_daughter') {
            relTam = 'மகள்'; relEng = 'Daughter'; gen = 'Female'; genTam = 'பெண்';
        } else if (raw.includes('மகன்') || raw.includes('son') || raw === 'child_son' || raw === 'rel_son') {
            relTam = 'மகன்'; relEng = 'Son'; gen = 'Male'; genTam = 'ஆண்';
        } else if (raw.includes('மனைவி') || raw.includes('wife')) {
            relTam = 'மனைவி'; relEng = 'Wife'; gen = 'Female'; genTam = 'பெண்';
        } else if (raw.includes('கணவர்') || raw.includes('husband')) {
            relTam = 'கணவர்'; relEng = 'Husband'; gen = 'Male'; genTam = 'ஆண்';
        } else if (raw.includes('தாய்') || raw.includes('அம்மா') || raw.includes('mother')) {
            relTam = 'தாய்'; relEng = 'Mother'; gen = 'Female'; genTam = 'பெண்';
        } else if (raw.includes('தந்தை') || raw.includes('அப்பா') || raw.includes('father')) {
            relTam = 'தந்தை'; relEng = 'Father'; gen = 'Male'; genTam = 'ஆண்';
        }

        sess.subServiceData = sess.subServiceData || {};
        sess.subServiceData.relationshipTam = relTam;
        sess.subServiceData.relationshipEng = relEng;
        if (!sess.subServiceData.gender) {
            sess.subServiceData.gender = gen;
            sess.subServiceData.genderTam = genTam;
        }

        if (sess.subServiceData.dob) {
            const parts = sess.subServiceData.dob.split('/');
            if (parts.length === 3) {
                const birthYear = parseInt(parts[2]);
                const currYear = new Date().getFullYear();
                sess.subServiceData.isChild = (currYear - birthYear) < 5;
            }
        }

        // Record completed member cleanly into addMembersList (supports 1 or multiple new members)
        const targetCount = Math.max(1, Number(sess.subServiceData.targetAddCount || 1));
        const curList = Array.isArray(sess.subServiceData.addMembersList) ? [...sess.subServiceData.addMembersList] : [];
        const completedMember = {
            memberName: sess.subServiceData.memberName || sess.subServiceData.memberNameTam || sess.subServiceData.memberNameEng || '',
            memberNameTam: sess.subServiceData.memberNameTam || '',
            memberNameEng: sess.subServiceData.memberNameEng || '',
            fatherNameTam: sess.subServiceData.fatherNameTam || '',
            fatherNameEng: sess.subServiceData.fatherNameEng || '',
            aadhaarNo: sess.subServiceData.aadhaarNo || '',
            dob: sess.subServiceData.dob || '',
            gender: sess.subServiceData.gender || gen,
            genderTam: sess.subServiceData.genderTam || genTam,
            relationshipTam: relTam,
            relationshipEng: relEng,
            isChild: Boolean(sess.subServiceData.isChild),
            docPath: sess.subServiceData.docPath || sess.subServiceData.aadhaarDocPath || '',
            aadhaarDocPath: sess.subServiceData.aadhaarDocPath || sess.subServiceData.docPath || ''
        };

        const dupIdx = completedMember.aadhaarNo
            ? curList.findIndex(m => m.aadhaarNo && m.aadhaarNo === completedMember.aadhaarNo)
            : -1;
        if (dupIdx >= 0) curList[dupIdx] = completedMember;
        else curList.push(completedMember);

        // Permanent Saved Family Members Vault inside Master Profile (Zero AI Waste across service switches!)
        if (sess.citizenProfile && (completedMember.memberNameTam || completedMember.memberNameEng || completedMember.memberName)) {
            const vault = Array.isArray(sess.citizenProfile.savedFamilyMembers) ? [...sess.citizenProfile.savedFamilyMembers] : [];
            const vIdx = completedMember.aadhaarNo
                ? vault.findIndex(v => v.aadhaarNo && String(v.aadhaarNo).replace(/\D/g, '') === String(completedMember.aadhaarNo).replace(/\D/g, ''))
                : vault.findIndex(v => (v.memberNameTam || v.memberName) === (completedMember.memberNameTam || completedMember.memberName));
            const vaultEntry = { ...completedMember, savedAt: new Date().toISOString() };
            if (vIdx >= 0) vault[vIdx] = { ...vault[vIdx], ...vaultEntry };
            else vault.push(vaultEntry);
            sess.citizenProfile.savedFamilyMembers = vault;
        }

        sess.subServiceData.addMembersList = curList;
        sess.subServiceData.targetAddCount = targetCount;

        // If more members remain to be added, advance sequentially to next member's Aadhaar upload!
        if (curList.length < targetCount) {
            const nextIdx = curList.length + 1;
            const prevNameDisp = completedMember.memberNameTam && completedMember.memberNameEng
                ? `${completedMember.memberNameTam} (${completedMember.memberNameEng})`
                : (completedMember.memberName || 'உறுப்பினர்');
            sess.subServiceData.currentAddIndex = nextIdx;
            // Clear current single-member working fields so Member N+1 starts clean
            delete sess.subServiceData.memberName;
            delete sess.subServiceData.memberNameTam;
            delete sess.subServiceData.memberNameEng;
            delete sess.subServiceData.fatherNameTam;
            delete sess.subServiceData.fatherNameEng;
            delete sess.subServiceData.aadhaarNo;
            delete sess.subServiceData.dob;
            delete sess.subServiceData.gender;
            delete sess.subServiceData.genderTam;
            delete sess.subServiceData.relationshipTam;
            delete sess.subServiceData.relationshipEng;
            delete sess.subServiceData.docPath;
            delete sess.subServiceData.aadhaarDocPath;
            if (sess.tempUploads) {
                delete sess.tempUploads.memberAadhaarFront;
                delete sess.tempUploads.memberAadhaarBack;
                delete sess.tempUploads.memberAadhaar;
            }
            if (sess.citizenProfile) {
                sess.citizenProfile.tempMember = null;
                sess.citizenProfile.subServiceData = sess.subServiceData;
            }
            sess.intakeState = 'RATION_ADD_MEMBER_TYPE';
            sess.step = 'RATION_ADD_MEMBER_TYPE';
            sess.chatHistory.push({
                sender: 'bot',
                text: `✅ **உறுப்பினர் ${curList.length} (${prevNameDisp} — ${relTam}) சேர்க்கப்பட்டது!**\n\n` +
                      `📷 **இப்போது புதிய உறுப்பினர் ${nextIdx} / ${targetCount} — ஆதார் அட்டையைப் பதிவேற்றவும்:**\n` +
                      `*(முன்பக்கம் / முழு PDF — பெயர், பிறந்த தேதி, பாலினம், ஆதார் எண் தானாகப் பெறப்படும்)*`,
                actionRequired: 'upload',
                uploadPrompt: 'உறுப்பினர் ஆதார் அட்டை',
                options: [
                    { label: `📷 உறுப்பினர் ${nextIdx} ஆதார் அட்டை பதிவேற்றவும்`, value: "TRIGGER_FILE_UPLOAD" },
                    { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                ]
            });
            return true;
        }

        // All target members collected: keep top-level fields synced to first member for automation & Edit Modal
        const firstM = curList[0] || completedMember;
        Object.assign(sess.subServiceData, firstM, {
            addMembersList: curList,
            targetAddCount: targetCount,
            currentAddIndex: curList.length
        });
        if (sess.citizenProfile) {
            sess.citizenProfile.tempMember = null;
            sess.citizenProfile.subServiceData = sess.subServiceData;
        }

        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    return false;
}

/**
 * Check whether an uploaded Aadhaar in an add-member subservice is only the Front side.
 * When single-sided, records Front path/bounding-box, moves to backWaitState, and prompts for Back.
 */
function maybePromptSubserviceAadhaarBack({ sess, uploadedDoc, extractedDoc, backWaitState, skipValue, isRealExtracted }) {
    if (!uploadedDoc || isDoubleSidedCardComplete(extractedDoc, uploadedDoc.path, 'aadhaar')) {
        return false;
    }
    sess.tempUploads = sess.tempUploads || {};
    sess.tempUploads.memberAadhaarFront = uploadedDoc.path;
    sess.tempUploads.memberAadhaarFrontBoundingBox = extractedDoc?.documentBoundingBox || null;
    sess.intakeState = backWaitState;

    const ssd = sess.subServiceData || {};
    const nameDisplay = ssd.memberNameTam && ssd.memberNameEng
        ? `${ssd.memberNameTam} (${ssd.memberNameEng})`
        : (ssd.memberName || 'உறுப்பினர்');
    const aadhaarDisplay = ssd.aadhaarNo ? `\n• 🪪 **ஆதார் எண்:** ${String(ssd.aadhaarNo).replace(/(\d{4})/g, '$1 ').trim()}` : '';
    const dobDisplay = ssd.dob ? `\n• 📅 **பிறந்த தேதி:** ${ssd.dob}` : '';
    const prefix = isRealExtracted ? '✅ **உறுப்பினர் ஆதார் அட்டை முன்பக்கம் AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **உறுப்பினர் ஆதார் அட்டை முன்பக்கம் பெறப்பட்டது!** 🪪';

    sess.chatHistory.push({
        sender: 'bot',
        text: `${prefix}\n\n` +
              `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}\n\n` +
              `🔄 **இப்போது ஆதார் அட்டையின் பின்பக்கத்தை (முகவரி பகுதி) பதிவேற்றவும்:**\n` +
              `*(AI தானாக முன் + பின் பக்கங்களை ஒரே 2-in-1 A4 PDF ஆவணமாக இணைக்கும் ✨)*`,
        actionRequired: 'upload',
        uploadPrompt: 'உறுப்பினர் ஆதார் பின்பக்கம்',
        options: [
            { label: "📷 ஆதார் பின்பக்கம் பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
            { label: "⏭️ பின்பக்கம் தேவையில்லை — தொடர்க", value: skipValue }
        ]
    });
    return true;
}

/**
 * Process Aadhaar Back upload (or explicit skip) inside a subservice back-wait state,
 * merging Front + Back into a compliant 2-in-1 A4 PDF when Back is uploaded.
 */
async function completeSubserviceAadhaarBack({ text, sess, uploadedDoc, extractedDoc, skipValue }) {
    sess.subServiceData = sess.subServiceData || {};
    sess.tempUploads = sess.tempUploads || {};

    const isSkip = text === skipValue || text === 'MEMBER_DOC_COMPLETE' ||
        (text && /பின்பக்கம் தேவையில்லை|skip|முழு ஆவணம் முடிந்தது/i.test(text));
    if (isSkip) {
        sess.subServiceData.docPath = sess.tempUploads.memberAadhaarFront || sess.subServiceData.docPath || 'uploads/test_sample_doc.jpg';
        sess.tempUploads.memberAadhaar = sess.subServiceData.docPath;
        return { done: true, merged: false };
    }

    if (!uploadedDoc && !extractedDoc) {
        sess.chatHistory.push({
            sender: 'bot',
            text: `🔄 தயவுசெய்து ஆதார் அட்டையின் **பின்பக்கத்தை (முகவரி பகுதி)** பதிவேற்றவும்:`,
            actionRequired: 'upload',
            uploadPrompt: 'உறுப்பினர் ஆதார் பின்பக்கம்',
            options: [
                { label: "📷 ஆதார் பின்பக்கம் பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                { label: "⏭️ பின்பக்கம் தேவையில்லை — தொடர்க", value: skipValue }
            ]
        });
        return { done: false, merged: false };
    }

    if (uploadedDoc?.path) {
        sess.tempUploads.memberAadhaarBack = uploadedDoc.path;
    }

    let finalDoc = sess.tempUploads.memberAadhaarBack || sess.tempUploads.memberAadhaarFront || uploadedDoc?.path || sess.subServiceData.docPath;
    if (photoStudio && photoStudio.produceDualSidedDocument && sess.tempUploads.memberAadhaarFront && sess.tempUploads.memberAadhaarBack) {
        try {
            const mergedPdf = await photoStudio.produceDualSidedDocument(
                sess.tempUploads.memberAadhaarFront,
                sess.tempUploads.memberAadhaarBack,
                null,
                {
                    frontBoundingBox: sess.tempUploads.memberAadhaarFrontBoundingBox || null,
                    backBoundingBox: extractedDoc?.documentBoundingBox || null
                }
            );
            if (mergedPdf) finalDoc = mergedPdf;
        } catch (_) {}
    }

    sess.subServiceData.docPath = finalDoc;
    sess.tempUploads.memberAadhaar = finalDoc;
    if (sess.citizenProfile) {
        sess.citizenProfile.documents = sess.citizenProfile.documents || {};
        sess.citizenProfile.documents.memberAadhaar = finalDoc;
    }

    if (extractedDoc) {
        if (!sess.subServiceData.memberNameTam && extractedDoc.fullNameTam) sess.subServiceData.memberNameTam = extractedDoc.fullNameTam;
        if (!sess.subServiceData.memberNameEng && extractedDoc.fullNameEng) sess.subServiceData.memberNameEng = extractedDoc.fullNameEng;
        if (extractedDoc.aadhaarNumber && !sess.subServiceData.aadhaarNo) sess.subServiceData.aadhaarNo = extractedDoc.aadhaarNumber;
        if (extractedDoc.fatherNameTam || extractedDoc.fatherNameEng) {
            sess.subServiceData.fatherNameTam = extractedDoc.fatherNameTam || sess.subServiceData.fatherNameTam || '';
            sess.subServiceData.fatherNameEng = extractedDoc.fatherNameEng || sess.subServiceData.fatherNameEng || '';
        }
        if (extractedDoc.address || extractedDoc.doorNo || extractedDoc.pincode) {
            sess.subServiceData.address = extractedDoc.address || `${extractedDoc.doorNo || ''}, ${extractedDoc.streetTam || extractedDoc.streetEng || ''}, ${extractedDoc.pincode || ''}`.trim();
        }
    }

    return { done: true, merged: true };
}

module.exports = {
    handleMemberDocUpload,
    maybePromptSubserviceAadhaarBack,
    completeSubserviceAadhaarBack
};
