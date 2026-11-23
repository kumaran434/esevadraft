// =============================================================================
// UI Cartridge: TNEGA_INCOME (வருமானச் சான்றிதழ் - REV-103)
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
        id: 'TNEGA_INCOME',
        ownedDocTypes: ['profilePhoto', 'headPhoto', 'headAadhaar', 'smartCard', 'rationCard', 'incomeProof', 'salaryCertificate', 'incomeTaxReturn', 'applicationPdf'],
        editModal: {
            layoutMode: 'INCOME',
            title: '💰 வருமானச் சான்றிதழ் விண்ணப்ப விவரங்கள் (Income Certificate)',
            subtitle: 'வருமானச் சான்றிதழ் விண்ணப்ப விவரங்கள் மற்றும் பதிவேற்றப்பட்ட ஆவணங்களைச் சரிபார்க்கவும்',
            submitButtonHtml: '<i class="fa-solid fa-play"></i> 🚀 வருமானச் சான்றிதழ் விண்ணப்பிக்க (Start Income Apply)',
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
                income: true,
                residence: false,
                firstGraduate: false,
                obc: false,
                legalHeir: false,
                widow: false,
                ration: false,
                smartCardNo: true,
                canNo: true
            },
            dynamicDocs: [
                {
                    type: 'incomeProof',
                    title: '💰 வருமானச் சான்று / சம்பள ரசீது (Income Proof)',
                    titleEng: 'Income Proof / Salary Slip',
                    icon: 'fa-receipt',
                    defaultPrompt: 'வருமானச் சான்று அல்லது சம்பள ரசீது தேவை'
                }
            ]
        },
        populateEditFields: function (data, { safeSetVal }) {
            const resolvedAnnInc = data.annualIncome || (data.monthlyIncome ? String(Number(data.monthlyIncome) * 12) : '');
            const resolvedMonInc = data.monthlyIncome || (data.annualIncome ? String(Math.round(Number(data.annualIncome) / 12)) : '');
            safeSetVal('editAnnualIncome', resolvedAnnInc);
            safeSetVal('editMonthlyIncome', resolvedMonInc);
            safeSetVal('editOccupation', data.profession || data.occupation || '');
            const resolvedFamCnt = String(data.familyMemberCount || (Array.isArray(data.incomeMembers) && data.incomeMembers.length > 0 ? data.incomeMembers.length + 1 : '1'));
            safeSetVal('editFamilyMemberCount', resolvedFamCnt);
            if (typeof window.renderEditIncomeMembersList === 'function') {
                window.renderEditIncomeMembersList(resolvedFamCnt, Array.isArray(data.incomeMembers) ? data.incomeMembers : []);
            }
        },
        collectEditFields: function ({ data, sData }) {
            const annualIncome = document.getElementById('editAnnualIncome')?.value?.trim() || data?.annualIncome || '';
            const monthlyIncome = document.getElementById('editMonthlyIncome')?.value?.trim() || (annualIncome ? String(Math.round(Number(annualIncome) / 12)) : '');
            const profession = document.getElementById('editOccupation')?.value?.trim() || data?.profession || '';
            const familyMemberCount = document.getElementById('editFamilyMemberCount')?.value || data?.familyMemberCount || '1';
            const incomeMembers = (typeof window.collectEditIncomeMembers === 'function' && Number(familyMemberCount) > 1)
                ? window.collectEditIncomeMembers()
                : (Number(familyMemberCount) === 1 ? [] : (data?.incomeMembers || []));
            const canNumber = document.getElementById('editCanNumber')?.value?.replace(/\s+/g, '') || data?.canNumber || '';
            return {
                subService: 'INCOME',
                subServiceData: {
                    ...(sData || {}),
                    annualIncome,
                    monthlyIncome,
                    profession,
                    familyMemberCount,
                    incomeMembers,
                    canNumber
                },
                fields: { annualIncome, monthlyIncome, profession, familyMemberCount, incomeMembers }
            };
        },
        sidebar: {
            headTitle: '👤 விண்ணப்பதாரர் விவரங்கள்',
            boxId: 'sidebarIncomeBox'
        },
        populateSidebar: function (a, subData, { setVal }) {
            setVal('infoAnnualIncome', a.annualIncome ? `₹${Number(a.annualIncome).toLocaleString('en-IN')}` : '—');
            setVal('infoProfession', a.profession || '—');
            setVal('infoCanNo', a.canNumber || '—');
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
                    errorMessage: '⚠️ வருமானச் சான்றிதழ் (REV-103) விண்ணப்பிக்க விண்ணப்பதாரரின் பாஸ்போர்ட் புகைப்படம் கட்டாயம் தேவை.\n\nதயவுசெய்து புகைப்படத்தைப் பதிவேற்றவும்.'
                };
            }
            const hasIncome = Boolean(
                data?.incomeProof ||
                data?.salaryCertificatePath ||
                docs?.incomeProof ||
                data?.incomeProof === 'SELF_DECLARATION' ||
                data?.incomeProofType === 'SELF_DECLARATION' ||
                data?.salaryProofType === 'SELF_DECLARATION' ||
                (data?.annualIncome && data?.profession) ||
                (data?.monthlyIncome && data?.profession) ||
                data?.annualIncome ||
                data?.monthlyIncome
            );
            if (!hasIncome) {
                return {
                    valid: false,
                    errorMessage: '⚠️ வருமானச் சான்றிதழ் (REV-103) விண்ணப்பிக்க வருமான விவரங்கள் (தொழில் மற்றும் மாத/ஆண்டு வருமானம்) அல்லது வருமான ஆதாரம் உள்ளிடப்பட வேண்டும்.\n\nதயவுசெய்து படிவத்தில் பூர்த்தி செய்யவும்.'
                };
            }
            return { valid: true };
        },
        syncFromUpload: function (docType, prof, { setVal }) {
            if (!['incomeTaxReturn', 'incomeProof', 'salarySlip', 'salaryCertificate'].includes(docType)) return;
            if (prof.annualIncome) {
                setVal('editAnnualIncome', prof.annualIncome);
                setVal('editMonthlyIncome', prof.monthlyIncome || String(Math.round(Number(prof.annualIncome) / 12)));
            }
            const appOcc = prof.applicantOccupation || prof.occupation || '';
            if (appOcc) setVal('editOccupation', appOcc);
        }
    };
}));
