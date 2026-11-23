// =============================================================================
// UI Cartridge: TNEGA_FIRST_GRADUATE (முதல் பட்டதாரி சான்றிதழ் - REV-104)
// =============================================================================
(function (root, factory) {
    const mod = factory();
    if (typeof module === 'object' && module.exports) module.exports = mod;
    else {
        root.ESEVA_UI_CARTRIDGES = root.ESEVA_UI_CARTRIDGES || {};
        root.ESEVA_UI_CARTRIDGES[mod.id] = mod;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    return {
        id: 'TNEGA_FIRST_GRADUATE',
        ownedDocTypes: ['profilePhoto', 'headPhoto', 'headAadhaar', 'smartCard', 'rationCard', 'applicantEducationProof', 'studentTc', 'fatherEducationProof', 'fatherTc', 'motherEducationProof', 'motherTc', 'incomeProof', 'incomeTaxReturn', 'applicationPdf'],
        editModal: {
            layoutMode: 'FIRST_GRADUATE',
            title: '🎓 முதல் பட்டதாரி விண்ணப்ப விவரங்கள் (First Graduate Certificate - REV-104)',
            subtitle: 'முதல் பட்டதாரி விண்ணப்ப விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 முதல் பட்டதாரி விண்ணப்பிக்க (Start First Graduate Apply)',
            isRationHead: false,
            showMasterButton: true,
            showGasToggle: false,
            customWrapMode: 'newCard',
            docBoxes: {
                photo: true,
                headAadhaar: true,
                residence: false,
                smartCard: true,
                universalDocs: true,
                membersAadhaar: false
            },
            fieldWraps: {
                community: false,
                income: false,
                residence: false,
                firstGraduate: true,
                obc: false,
                legalHeir: false,
                widow: false,
                ration: false,
                smartCardNo: true,
                canNo: true
            },
            dynamicDocs: [
                {
                    type: 'applicantEducationProof',
                    title: '🎓 மாணவர் 12-ஆம் வகுப்பு TC (Applicant 12th TC)',
                    titleEng: 'Applicant Transfer Certificate',
                    icon: 'fa-graduation-cap',
                    defaultPrompt: 'மாணவர் 12th TC தேவை'
                },
                {
                    type: 'fatherEducationProof',
                    title: '👨 தந்தை பள்ளி மாற்றுச் சான்றிதழ் (Father TC)',
                    titleEng: 'Father Transfer Certificate',
                    icon: 'fa-file-lines',
                    defaultPrompt: 'தந்தையின் TC அல்லது கல்வி ஆவணம் தேவை'
                },
                {
                    type: 'motherEducationProof',
                    title: '👩 தாய் பள்ளி மாற்றுச் சான்றிதழ் (Mother TC)',
                    titleEng: 'Mother Transfer Certificate',
                    icon: 'fa-file-lines',
                    defaultPrompt: 'தாயின் TC அல்லது கல்வி ஆவணம் தேவை'
                }
            ]
        },
        populateEditFields: function (data, { safeSetVal }) {
            safeSetVal('editFirstGraduateCourse', data.currentCourse || data.degreeCourse || '');
            safeSetVal('editFirstGraduateCollege', data.institutionName || data.collegeName || '');
            safeSetVal('editFirstGraduateFatherEdu', data.fatherEducation || '10th Standard');
            safeSetVal('editFirstGraduateMotherEdu', data.motherEducation || '8th Standard');
            safeSetVal('editFirstGraduateYop', data.yearOfPassing || '2024');
            safeSetVal('editFirstGraduateCollegeAdd', data.institutionAddress || 'Coimbatore Tamil Nadu');
        },
        collectEditFields: function ({ data, sData }) {
            const currentCourse = document.getElementById('editFirstGraduateCourse')?.value?.trim() || data?.currentCourse || '';
            const institutionName = document.getElementById('editFirstGraduateCollege')?.value?.trim() || data?.institutionName || '';
            const fatherEducation = document.getElementById('editFirstGraduateFatherEdu')?.value || data?.fatherEducation || '10th Standard';
            const motherEducation = document.getElementById('editFirstGraduateMotherEdu')?.value || data?.motherEducation || '8th Standard';
            const yearOfPassing = document.getElementById('editFirstGraduateYop')?.value?.trim() || data?.yearOfPassing || '2024';
            const institutionAddress = document.getElementById('editFirstGraduateCollegeAdd')?.value?.trim() || data?.institutionAddress || 'Coimbatore Tamil Nadu';
            const canNumber = document.getElementById('editCanNumber')?.value?.replace(/\s+/g, '') || data?.canNumber || '';
            return {
                subService: 'FIRST_GRADUATE',
                subServiceData: {
                    ...(sData || {}),
                    currentCourse,
                    institutionName,
                    fatherEducation,
                    motherEducation,
                    yearOfPassing,
                    institutionAddress,
                    familyGraduateConfirmed: true,
                    canNumber
                },
                fields: {
                    currentCourse,
                    degreeCourse: currentCourse,
                    institutionName,
                    collegeName: institutionName,
                    fatherEducation,
                    motherEducation,
                    yearOfPassing,
                    institutionAddress,
                    familyGraduateConfirmed: true
                }
            };
        },
        sidebar: {
            headTitle: '👤 மாணவர் / விண்ணப்பதாரர் விவரங்கள்',
            boxId: 'sidebarFirstGraduateBox'
        },
        populateSidebar: function (a, subData, { setVal }) {
            setVal('infoFirstGraduateCanNo', a.canNumber || '—');
            setVal('infoFirstGraduateCourse', a.currentCourse || a.degreeCourse || a.courseName || '—');
            setVal('infoFirstGraduateCollege', a.institutionName || a.collegeName || '—');
            setVal('infoFirstGraduateFatherEdu', a.fatherEducation || '—');
            setVal('infoFirstGraduateMotherEdu', a.motherEducation || '—');
            return true;
        },
        validatePreSubmit: function (data, docs, { hasPhoto, hasSmartCard }) {
            if (!hasSmartCard) {
                return {
                    valid: false,
                    errorMessage: '⚠️ அனைத்து வருவாய்த் துறை சேவைகளுக்கும் குடும்ப ஸ்மார்ட் ரேஷன் கார்டு (Smart Card) கட்டாயம் தேவை.\n\nதயவுசெய்து ரேஷன் கார்டு (முழு அட்டை OR முன்பக்கம்+பின்பக்கம்) பதிவேற்றிய பிறகு விண்ணப்பிக்கவும்.'
                };
            }
            if (!hasPhoto) {
                return {
                    valid: false,
                    errorMessage: '⚠️ முதல் பட்டதாரி சான்றிதழ் (REV-104) விண்ணப்பிக்க மாணவரின் பாஸ்போர்ட் புகைப்படம் (<50KB) கட்டாயம் தேவை.\n\nதயவுசெய்து புகைப்படத்தைப் பதிவேற்றவும்.'
                };
            }
            const hasApplicantProof = Boolean(
                data?.applicantEducationProof || data?.studentTc ||
                docs?.applicantEducationProof || docs?.studentTc
            );
            if (!hasApplicantProof) {
                return {
                    valid: false,
                    errorMessage: '⚠️ முதல் பட்டதாரி சான்றிதழ் (REV-104) விண்ணப்பிக்க மாணவரின் 12-ஆம் வகுப்பு மாற்றுச் சான்றிதழ் (TC) அல்லது மதிப்பெண் பட்டியல் கட்டாயம் தேவை.\n\nதயவுசெய்து ஆவணத்தைப் பதிவேற்றிய பிறகு விண்ணப்பிக்கவும்.'
                };
            }
            return { valid: true };
        }
    };
}));
