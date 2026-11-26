// =============================================================================
// UI Cartridge: TNEGA_OBC (OBC சான்றிதழ் - REV-115)
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
        id: 'TNEGA_OBC',
        ownedDocTypes: ['profilePhoto', 'headPhoto', 'headAadhaar', 'smartCard', 'rationCard', 'communityCertificate', 'communityProof', 'familyCommunityProof', 'incomeTaxReturn', 'incomeProof', 'salaryCertificate', 'applicationPdf'],
        editModal: {
            layoutMode: 'OBC',
            title: '📜 OBC சான்றிதழ் விண்ணப்ப விவரங்கள் (Other Backward Classes - REV-115)',
            subtitle: 'OBC சான்றிதழ் விண்ணப்ப விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 OBC சான்றிதழ் விண்ணப்பிக்க (Start OBC Apply)',
            isRationHead: false,
            showMasterButton: false,
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
                firstGraduate: false,
                obc: true,
                legalHeir: false,
                widow: false,
                ration: false,
                smartCardNo: false,
                canNo: true
            },
            dynamicDocs: [
                {
                    type: 'communityCertificate',
                    title: '📜 சாதிச் சான்றிதழ் (Community Certificate)',
                    titleEng: 'Community Certificate',
                    icon: 'fa-certificate',
                    defaultPrompt: 'சாதிச் சான்றிதழ் தேவை'
                },
                {
                    type: 'incomeTaxReturn',
                    title: '💰 வருமானச் சான்றிதழ் / வருமான வரி (Income Cert / ITR)',
                    titleEng: 'Income Certificate / Income Tax Return',
                    icon: 'fa-file-invoice-dollar',
                    defaultPrompt: 'வருமானச் சான்றிதழ் / ITR சான்று தேவை'
                }
            ]
        },
        populateEditFields: function (data, { safeSetVal }) {
            safeSetVal('editObcCaste', data.caste || data.subCaste || '');
            const rawObcOcc = String(data.occupation || data.applicantOccupation || 'Service').toLowerCase();
            let mappedObcOcc = 'Service';
            if (/student|மாணவ/i.test(rawObcOcc)) mappedObcOcc = 'Student';
            else if (/agri|farmer|விவசாய/i.test(rawObcOcc)) mappedObcOcc = 'Agriculture';
            else if (/busi|வியாபார/i.test(rawObcOcc)) mappedObcOcc = 'Business';
            safeSetVal('editObcOccupation', mappedObcOcc);
            safeSetVal('editObcFatherOccupation', data.fatherOccupation || '');
            safeSetVal('editObcMotherOccupation', data.motherOccupation || '');
            const resolvedAnnInc = data.annualIncome || (data.monthlyIncome ? String(Number(data.monthlyIncome) * 12) : '');
            safeSetVal('editObcAnnualIncome', resolvedAnnInc);
        },
        collectEditFields: function ({ data, sData }) {
            const caste = document.getElementById('editObcCaste')?.value?.trim() || document.getElementById('editCaste')?.value?.trim() || data?.caste || '';
            const occupation = document.getElementById('editObcOccupation')?.value || data?.occupation || 'Service';
            const fatherOccupation = document.getElementById('editObcFatherOccupation')?.value?.trim() || data?.fatherOccupation || '';
            const motherOccupation = document.getElementById('editObcMotherOccupation')?.value?.trim() || data?.motherOccupation || '';
            const annualIncome = document.getElementById('editObcAnnualIncome')?.value?.trim() || document.getElementById('editAnnualIncome')?.value?.trim() || data?.annualIncome || '';
            const canNumber = document.getElementById('editCanNumber')?.value?.replace(/\s+/g, '') || data?.canNumber || '';
            return {
                subService: 'OBC',
                subServiceData: {
                    ...(sData || {}),
                    caste,
                    occupation,
                    fatherOccupation,
                    motherOccupation,
                    annualIncome,
                    canNumber
                },
                fields: { caste, occupation, fatherOccupation, motherOccupation, annualIncome }
            };
        },
        sidebar: {
            headTitle: '👤 விண்ணப்பதாரர் விவரங்கள் (OBC சான்றிதழ்)',
            boxId: 'sidebarObcBox'
        },
        populateSidebar: function (a, subData, { setVal }) {
            setVal('infoObcCanNo', a.canNumber || '—');
            setVal('infoObcCaste', a.caste || a.subCaste || '—');
            setVal('infoObcOccupation', a.occupation || a.applicantOccupation || '—');
            setVal('infoObcIncome', a.annualIncome ? `₹${a.annualIncome}` : '—');
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
                    errorMessage: '⚠️ OBC சான்றிதழ் (REV-115) விண்ணப்பிக்க விண்ணப்பதாரரின் பாஸ்போர்ட் புகைப்படம் (<250x250px, <50KB) கட்டாயம் தேவை.'
                };
            }
            const hasCommProof = Boolean(docs?.communityCertificate || docs?.communityProof || data?.communityCertificate || data?.communityCertificatePath || data?.communityProof);
            if (!hasCommProof) {
                return {
                    valid: false,
                    errorMessage: '⚠️ OBC சான்றிதழ் (REV-115) விண்ணப்பிக்க சாதிச் சான்றிதழ் (Community Certificate) கட்டாயம் தேவை.'
                };
            }
            const hasItrProof = Boolean(docs?.incomeTaxReturn || docs?.incomeProof || docs?.salarySlip || data?.incomeTaxReturn || data?.incomeProof);
            if (!hasItrProof) {
                return {
                    valid: false,
                    errorMessage: '⚠️ OBC சான்றிதழ் (REV-115) விண்ணப்பிக்க வருமான வரி (ITR) அல்லது வருமானச் சான்று கட்டாயம் தேவை.'
                };
            }
            return { valid: true };
        },
        syncFromUpload: function (docType, prof, { setVal, flash }) {
            if (!['incomeTaxReturn', 'incomeProof', 'salarySlip', 'salaryCertificate', 'communityCertificate', 'communityProof', 'familyCommunityProof'].includes(docType)) return;
            if (prof.annualIncome) {
                setVal('editObcAnnualIncome', prof.annualIncome);
            }
            if (prof.caste) {
                setVal('editObcCaste', prof.caste);
            }
            if (prof.fatherOccupation) setVal('editObcFatherOccupation', prof.fatherOccupation);
            if (prof.motherOccupation) setVal('editObcMotherOccupation', prof.motherOccupation);
            const appOcc = prof.applicantOccupation || prof.occupation || '';
            if (appOcc) {
                const obcSel = document.getElementById('editObcOccupation');
                if (obcSel) {
                    const lowOcc = String(appOcc).toLowerCase();
                    let mappedVal = 'Service';
                    if (/student|மாணவ/i.test(lowOcc)) mappedVal = 'Student';
                    else if (/agri|farmer|விவசாய/i.test(lowOcc)) mappedVal = 'Agriculture';
                    else if (/busi|வியாபார/i.test(lowOcc)) mappedVal = 'Business';
                    obcSel.value = mappedVal;
                    if (typeof flash === 'function') flash(obcSel);
                }
            }
        }
    };
}));
