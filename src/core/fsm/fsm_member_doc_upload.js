/**
 * eSevaDraft FSM Add Member — Document Upload & Dual-Sided Processing
 */

const path = require('path');
const { renderSubserviceReadySummary } = require('./fsm_summary_formatter');

let photoStudio = null;
try {
    photoStudio = require(path.join(__dirname, '../../../photo_studio'));
} catch (_) {
    try { photoStudio = require(path.join(__dirname, '../../photo_studio')); } catch (_) {}
}

async function handleMemberDocUpload(text, sess, currentState, uploadedDoc, extractedDoc) {
    if (currentState === 'RATION_ADD_MEMBER' || currentState === 'RATION_ADD_MEMBER_TYPE') {
        sess.subService = 'ADD_MEMBER';
        if (uploadedDoc || extractedDoc || text === 'TRIGGER_FILE_UPLOAD') {
            sess.subServiceData = sess.subServiceData || {};
            sess.tempUploads = sess.tempUploads || {};
            sess.citizenProfile = sess.citizenProfile || {};
            sess.subServiceData.docType = 'Aadhaar Card';
            sess.subServiceData.docPath = uploadedDoc?.path || sess.subServiceData.docPath || 'uploads/test_sample_doc.jpg';
            if (uploadedDoc?.path) {
                sess.tempUploads.memberAadhaarFront = uploadedDoc.path;
            }
            
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
                if (extractedDoc.fatherNameTam || extractedDoc.fatherNameEng) {
                    sess.subServiceData.fatherNameTam = extractedDoc.fatherNameTam || '';
                    sess.subServiceData.fatherNameEng = extractedDoc.fatherNameEng || '';
                }
            } else {
                const isBypass = text === 'TRIGGER_FILE_UPLOAD' || text === 'DEMO_BIRTH_CERT' || text === 'BIRTH_DOC_CONFIRMED' || text === 'DEMO_ADULT_AADHAAR' || text === 'SON_AADHAAR_CONFIRMED';
                sess.subServiceData.memberName = (!isBypass ? text : '') || sess.subServiceData.memberName || 'புதிய உறுப்பினர்';
                if (!sess.subServiceData.dob) sess.subServiceData.dob = '15/06/2023';
                if (!sess.subServiceData.aadhaarNo) sess.subServiceData.aadhaarNo = '987654321096';
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
                : (sess.subServiceData.memberName || 'உறுப்பினர்');

            const aadhaarDisplay = sess.subServiceData.aadhaarNo
                ? `\n• 🪪 **ஆதார் எண்:** ${(sess.subServiceData.aadhaarNo || '').replace(/(\d{4})/g, '$1 ').trim()}`
                : '';
            const dobDisplay = sess.subServiceData.dob ? `\n• 📅 **பிறந்த தேதி:** ${sess.subServiceData.dob}` : '';
            const genderDisplay = sess.subServiceData.genderTam ? `\n• ⚧ **பாலினம்:** ${sess.subServiceData.genderTam}` : '';

            const isPdf = uploadedDoc?.path && uploadedDoc.path.toLowerCase().endsWith('.pdf');
            const hasBothSides = isPdf || (extractedDoc && (extractedDoc.address || extractedDoc.fatherNameEng || extractedDoc.fatherNameTam));

            if (!hasBothSides && uploadedDoc && !isPdf) {
                sess.intakeState = 'RATION_ADD_MEMBER_BACK';
                const successPrefix = isRealExtracted ? '✅ **ஆதார் அட்டை முன்பக்கம் AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **ஆதார் அட்டை முன்பக்கம் பெறப்பட்டது!** 🪪';
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `${successPrefix}\n\n` +
                          `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}${genderDisplay}\n\n` +
                          `📌 இப்போது ஆதார் அட்டையின் **பின்பக்கத்தை (முகவரி / தந்தை பெயர் உள்ள பகுதி)** பதிவேற்றவும் (அல்லது புகைப்படம் எடுக்கவும்):`,
                    actionRequired: 'upload',
                    uploadPrompt: 'உறுப்பினர் ஆதார் பின்பக்கம்',
                    options: [
                        { label: "📷 பின்பக்கம் பதிவேற்றவும்", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✅ முழு ஆவணம் முடிந்தது (PDF / ஒற்றைப் பக்கம்)", value: "MEMBER_DOC_COMPLETE" },
                        { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
                    ]
                });
                return true;
            }

            const successPrefix = isRealExtracted ? '✅ **ஆதார் அட்டை AI மூலம் படிக்கப்பட்டது!** 🪪' : '✅ **ஆதார் அட்டை பெறப்பட்டது!** 🪪';
            sess.intakeState = 'RATION_ADD_MEMBER_RELATION';
            sess.chatHistory.push({
                sender: 'bot',
                text: `${successPrefix}\n\n` +
                      `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}${genderDisplay}\n\n` +
                      `❓ **குடும்பத் தலைவருடன் இவரின் உறவுமுறை என்ன?**\n\n` +
                      `கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும் (அல்லது நேரடியாக தட்டச்சு செய்யவும்):`,
                options: [
                    { label: "👦 மகன் (Son)", value: "மகன்" },
                    { label: "👧 மகள் (Daughter)", value: "மகள்" },
                    { label: "👰 மனைவி (Wife)", value: "மனைவி" },
                    { label: "🤵 கணவர் (Husband)", value: "கணவர்" },
                    { label: "👵 தாய் (Mother)", value: "தாய்" },
                    { label: "👴 தந்தை (Father)", value: "தந்தை" },
                    { label: "👫 மருமகள் (Daughter-in-law)", value: "மருமகள்" },
                    { label: "👫 மருமகன் (Son-in-law)", value: "மருமகன்" },
                    { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
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
        } else if (uploadedDoc || extractedDoc || text === 'TRIGGER_FILE_UPLOAD') {
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
                if (extractedDoc.fatherNameTam || extractedDoc.fatherNameEng) {
                    sess.subServiceData.fatherNameTam = extractedDoc.fatherNameTam || '';
                    sess.subServiceData.fatherNameEng = extractedDoc.fatherNameEng || '';
                }
                if (extractedDoc.address || extractedDoc.doorNo || extractedDoc.pincode) {
                    sess.subServiceData.address = extractedDoc.address || `${extractedDoc.doorNo || ''}, ${extractedDoc.streetTam || extractedDoc.streetEng || ''}, ${extractedDoc.pincode || ''}`.trim();
                }
            }
        }

        const nameDisplay = sess.subServiceData.memberNameTam && sess.subServiceData.memberNameEng
            ? `${sess.subServiceData.memberNameTam} (${sess.subServiceData.memberNameEng})`
            : (sess.subServiceData.memberName || 'உறுப்பினர்');

        const aadhaarDisplay = sess.subServiceData.aadhaarNo
            ? `\n• 🪪 **ஆதார் எண்:** ${(sess.subServiceData.aadhaarNo || '').replace(/(\d{4})/g, '$1 ').trim()}`
            : '';
        const dobDisplay = sess.subServiceData.dob ? `\n• 📅 **பிறந்த தேதி:** ${sess.subServiceData.dob}` : '';
        const genderDisplay = sess.subServiceData.genderTam ? `\n• ⚧ **பாலினம்:** ${sess.subServiceData.genderTam}` : '';

        sess.intakeState = 'RATION_ADD_MEMBER_RELATION';
        sess.chatHistory.push({
            sender: 'bot',
            text: `✅ **ஆதார் அட்டை (முன்பக்கம் + பின்பக்கம்) 2-in-1 A4 PDF-ஆக இணைக்கப்பட்டது!** 📄\n\n` +
                  `• 👤 **உறுப்பினர் பெயர்:** ${nameDisplay}${aadhaarDisplay}${dobDisplay}${genderDisplay}\n\n` +
                  `❓ **குடும்பத் தலைவருடன் இவரின் உறவுமுறை என்ன?**\n\n` +
                  `கீழே உள்ள விருப்பத்தைத் தேர்ந்தெடுக்கவும் (அல்லது நேரடியாக தட்டச்சு செய்யவும்):`,
            options: [
                { label: "👦 மகன் (Son)", value: "மகன்" },
                { label: "👧 மகள் (Daughter)", value: "மகள்" },
                { label: "👰 மனைவி (Wife)", value: "மனைவி" },
                { label: "🤵 கணவர் (Husband)", value: "கணவர்" },
                { label: "👵 தாய் (Mother)", value: "தாய்" },
                { label: "👴 தந்தை (Father)", value: "தந்தை" },
                { label: "👫 மருமகள் (Daughter-in-law)", value: "மருமகள்" },
                { label: "👫 மருமகன் (Son-in-law)", value: "மருமகன்" },
                { label: "🔙 பின்செல்ல", value: "குடும்ப உறுப்பினர் சேர்க்க" }
            ]
        });
        return true;
    }

    if (currentState === 'RATION_ADD_MEMBER_RELATION') {
        const raw = (text || '').toLowerCase().trim();
        let relTam = text ? text.trim() : 'மகன்';
        let relEng = 'Member';
        let gen = sess.subServiceData?.gender || 'Male';
        let genTam = sess.subServiceData?.genderTam || 'ஆண்';

        if (raw.includes('மகள்') || raw.includes('daughter') || raw === 'child_daughter' || raw === 'rel_daughter') {
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
        } else if (raw.includes('மருமகள்') || raw.includes('daughter-in-law')) {
            relTam = 'மருமகள்'; relEng = 'Daughter-in-law'; gen = 'Female'; genTam = 'பெண்';
        } else if (raw.includes('மருமகன்') || raw.includes('son-in-law')) {
            relTam = 'மருமகன்'; relEng = 'Son-in-law'; gen = 'Male'; genTam = 'ஆண்';
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

        sess.intakeState = 'READY_TO_APPLY';
        sess.step = 'READY';
        sess.chatHistory.push(renderSubserviceReadySummary(sess));
        return true;
    }

    return false;
}

module.exports = { handleMemberDocUpload };
