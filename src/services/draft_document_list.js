const path = require('path');
const fs = require('fs');
global.hasDraftData = true;
const { getCitizenDraft } = require('../../firestore_db');
const storageService = require('./storage_service');

function resolveDocPath(raw) {
    if (!raw) return '';
    if (typeof raw === 'string') return raw.trim();
    if (typeof raw === 'object' && raw.path) return String(raw.path).trim();
    if (typeof raw === 'object' && raw.filePath) return String(raw.filePath).trim();
    return '';
}

function fileOrDataExists(rawPath, base64Val, urlVal) {
    if (urlVal && typeof urlVal === 'string' && urlVal.startsWith('http')) return true;
    if (base64Val && typeof base64Val === 'string' && base64Val.length > 500) return true;
    const p = resolveDocPath(rawPath);
    if (p && p.length > 3 && p !== 'true') {
        try {
            if (fs.existsSync(p) && fs.statSync(p).size > 5) return true;
        } catch (_) {}
        try {
            const localP = path.join(__dirname, '..', '..', p.replace(/^[/\\]+/, ''));
            if (fs.existsSync(localP) && fs.statSync(localP).size > 5) return true;
        } catch (_) {}
        try {
            const absP = path.resolve(p);
            if (fs.existsSync(absP) && fs.statSync(absP).size > 5) return true;
        } catch (_) {}
    }
    return false;
}

function isPhysicalPdf(rawPath, base64Val) {
    if (base64Val && typeof base64Val === 'string' && base64Val.startsWith('JVBERi')) return true;
    const p = resolveDocPath(rawPath);
    if (p && p.length > 3) {
        if (p.toLowerCase().endsWith('.pdf')) return true;
        const candidates = [p, path.join(__dirname, '..', '..', p.replace(/^[/\\]+/, '')), path.resolve(p)];
        for (const cand of candidates) {
            try {
                if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
                    const fd = fs.openSync(cand, 'r');
                    const buf = Buffer.alloc(5);
                    fs.readSync(fd, buf, 0, 5, 0);
                    fs.closeSync(fd);
                    if (buf.toString().startsWith('%PDF')) return true;
                }
            } catch (_) {}
        }
    }
    return false;
}

function extractDraftDocumentsList(sessOrMob, draftArg, cleanMobArg, subServiceFilterArg) {
    let sess = null;
    let draft = null;
    let cleanMob = '';

    if (typeof sessOrMob === 'string') {
        cleanMob = sessOrMob;
        draft = draftArg || null;
    } else {
        sess = sessOrMob;
        draft = draftArg || null;
        cleanMob = cleanMobArg || '';
    }

    if (!cleanMob && sess?.mobileNumber) cleanMob = sess.mobileNumber;
    if (!cleanMob && typeof storageService.getActiveMobile === 'function' && storageService.getActiveMobile()) {
        cleanMob = storageService.getActiveMobile();
    }

    if (!draft && !sess) return [];
    if (draft && (draft.isDeleted || draft.status === 'TRASHED')) return [];

    const prof = (draft && draft.citizenProfile) || (sess && sess.citizenProfile) || {};
    const dMap = {
        ...(sess?.tempUploads || {}),
        ...(prof?.documents || {}),
        ...(draft?.documents || {})
    };
    const b64Map = {
        ...(sess?.base64Docs || {}),
        ...(prof?.base64Docs || {}),
        ...(draft?.base64Docs || {})
    };
    const storageUrls = {
        ...(sess?.storageUrls || {}),
        ...(prof?.storageUrls || {}),
        ...(draft?.storageUrls || {})
    };

    const docs = [];
    const isExplicitSidebarFilter = Boolean(subServiceFilterArg);
    const activeSubService = String(subServiceFilterArg || prof.subService || draft?.subService || '').toUpperCase();
    const isExplicitNewCard = activeSubService === 'NEW_CARD' ||
                              activeSubService === 'NEW_RATION_CARD' ||
                              activeSubService === 'NEW_SMART_CARD' ||
                              draft?.service === 'புதிய ரேஷன் கார்டு' ||
                              draft?.service === 'new_smart_card' ||
                              draft?.service === 'ration' ||
                              prof.service === 'new_smart_card' ||
                              prof.service === 'புதிய ரேஷன் கார்டு' ||
                              prof.service === 'ration' ||
                              prof.subService === 'NEW_CARD' ||
                              prof.subService === 'NEW_RATION_CARD';
    const isAddMember = !isExplicitNewCard && (
                            activeSubService === 'ADD_MEMBER' || 
                            (prof.intakeState && String(prof.intakeState).startsWith('RATION_ADD_MEMBER')) || 
                            (!activeSubService && Boolean(prof.subServiceData?.memberName))
                        );
    const isNewRationCard = isExplicitNewCard || (!isAddMember && (draft?.service === 'புதிய ரேஷன் கார்டு' || prof.service === 'new_smart_card' || prof.service === 'புதிய ரேஷன் கார்டு' || activeSubService === 'NEW_CARD' || prof.subService === 'NEW_CARD'));

    const photoPath = dMap.profilePhoto || dMap.headPhoto || prof.headPhotoPath || sess?.citizenProfile?.headPhotoPath;
    const aadhaarPath = dMap.headAadhaar || prof.headAadhaarDocPath || sess?.citizenProfile?.headAadhaarDocPath || dMap.headAadhaarFront;
    const gasPath = dMap.gasBook || prof.gasDetails?.gasBookPath || sess?.citizenProfile?.gasDetails?.gasBookPath;
    const resPath = dMap.residenceProof || prof.residenceProof?.docPath || sess?.citizenProfile?.residenceProof?.docPath;
    const sSub = (sess && sess.subServiceData) || (prof && prof.subServiceData);
    const subMemDoc = sSub?.docPath || dMap.subServiceMemberDoc || (typeof dMap.memberAadhaar === 'string' ? dMap.memberAadhaar : '') || dMap.memberAadhaarFront || '';

    const hasPhoto = fileOrDataExists(photoPath, b64Map.profilePhotoBase64, storageUrls.profilePhoto);
    const hasGas = fileOrDataExists(gasPath, b64Map.gasBookBase64, storageUrls.gasBook);
    const hasRes = fileOrDataExists(resPath, b64Map.residenceProofBase64, storageUrls.residenceProof);
    const hasMasterProfileDocs = hasPhoto || hasGas || hasRes || Boolean(aadhaarPath && (!subMemDoc || String(aadhaarPath) !== String(subMemDoc)));

    // When an explicit subService filter is passed (e.g. from right sidebar), strictly omit irrelevant documents!
    const skipMasterDocsForSubservice = isExplicitSidebarFilter && (activeSubService === 'ADD_MEMBER' || activeSubService === 'REMOVE_MEMBER' || activeSubService === 'CHANGE_ADDRESS');

    // 1. Photo (Strict real-file existence check)
    if (!skipMasterDocsForSubservice && hasPhoto) {
        docs.push({
            type: 'profilePhoto',
            title: isNewRationCard ? 'குடும்பத் தலைவர் புகைப்படம்' : 'விண்ணப்பதாரர் புகைப்படம்',
            titleEng: isNewRationCard ? 'Head Passport Photo' : 'Applicant Passport Photo',
            downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/profilePhoto?download=1`,
            previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/profilePhoto`,
            icon: 'fa-user',
            isPdf: isPhysicalPdf(photoPath, b64Map.profilePhotoBase64)
        });
    }

    // 2. Aadhaar (Strict real-file existence check)
    const isSingleWalkinAddMemOnly = isAddMember && !hasMasterProfileDocs && Boolean(subMemDoc);
    if (!skipMasterDocsForSubservice && !isSingleWalkinAddMemOnly && fileOrDataExists(aadhaarPath, b64Map.headAadhaarBase64, storageUrls.headAadhaar)) {
        const headName = prof.fullNameTam || prof.fullNameEng || (isNewRationCard ? 'தலைவர்' : 'விண்ணப்பதாரர்');
        docs.push({
            type: 'headAadhaar',
            title: isNewRationCard ? `குடும்பத் தலைவர் ஆதார் (${headName})` : `விண்ணப்பதாரர் ஆதார் (${headName})`,
            titleEng: isNewRationCard ? 'Head of Family Aadhaar' : 'Applicant Aadhaar',
            downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/headAadhaar?download=1`,
            previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/headAadhaar`,
            icon: 'fa-id-card',
            isPdf: isPhysicalPdf(aadhaarPath, b64Map.headAadhaarBase64)
        });
    }

    // 3. Smart Ration Card (if present on Master Profile)
    const cardPath = dMap.smartCard || dMap.rationCard || prof.smartCardDocPath || prof.rationCardDocPath;
    if (fileOrDataExists(cardPath, b64Map.smartCardBase64, storageUrls.smartCard)) {
        const cardNo = prof.smartCardNumber || prof.rationCardNumber || prof.rationCardNo || '';
        docs.push({
            type: 'smartCard',
            title: cardNo ? `ஸ்மார்ட் ரேஷன் கார்டு (${cardNo})` : 'ஸ்மார்ட் ரேஷன் கார்டு',
            titleEng: 'Smart Ration Card',
            downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/smartCard?download=1`,
            previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/smartCard`,
            icon: 'fa-address-card',
            isPdf: isPhysicalPdf(cardPath, b64Map.smartCardBase64)
        });
    }

    // 3. Family Members Aadhaar (Strict real-file existence check)
    if (!isAddMember && !skipMasterDocsForSubservice && prof.members && prof.members.length > 1) {
        prof.members.slice(1).forEach((m, idx) => {
            const memKey = `memberAadhaar${idx}`;
            const mDoc = m.docPath || (dMap.memberAadhaars && dMap.memberAadhaars[idx]) || dMap[`memberAadhaar_${idx}`];
            const mB64 = (b64Map.memberAadhaarsBase64 && b64Map.memberAadhaarsBase64[idx]);
            const mUrl = (storageUrls.memberAadhaars && storageUrls.memberAadhaars[idx]);
            if (fileOrDataExists(mDoc, mB64, mUrl)) {
                const mName = m.nameTam || m.nameEng || `உறுப்பினர் ${idx + 2}`;
                docs.push({
                    type: `memberAadhaar${idx}`,
                    title: `உறுப்பினர் ஆதார் (${mName})`,
                    titleEng: `Member Aadhaar (${m.nameEng || idx + 2})`,
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/${memKey}?download=1&index=${idx}`,
                    previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/${memKey}?index=${idx}`,
                    icon: 'fa-address-card',
                    isPdf: isPhysicalPdf(mDoc, mB64),
                    memberIndex: idx + 1
                });
            }
        });
    }

    // 4. Gas Book (Strict real-file check: NEVER add dummy gas book if file doesn't exist!)
    const hasGasDoc = hasGas;
    const skipGasForSubservice = isExplicitSidebarFilter && (activeSubService === 'ADD_MEMBER' || activeSubService === 'REMOVE_MEMBER' || activeSubService === 'COMMUNITY' || activeSubService === 'INCOME' || activeSubService === 'RESIDENCE');
    if (!skipGasForSubservice && hasGasDoc) {
        docs.push({
            type: 'gasBook',
            title: 'எரிவாயு இணைப்பு அட்டை / ரசீது',
            titleEng: 'Gas Consumer Book / Receipt',
            downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/gasBook?download=1`,
            previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/gasBook`,
            icon: 'fa-fire',
            isPdf: isPhysicalPdf(gasPath, b64Map.gasBookBase64)
        });
    }

    // 5. Residence Proof (Strict real-file check)
    const skipResForSubservice = isExplicitSidebarFilter && (activeSubService === 'ADD_MEMBER' || activeSubService === 'REMOVE_MEMBER' || activeSubService === 'COMMUNITY');
    if (!skipResForSubservice && hasRes) {
        const proofName = prof.residenceProof?.typeTam || 'குடியிருப்புச் சான்று';
        docs.push({
            type: 'residenceProof',
            title: proofName.startsWith('குடியிருப்பு') ? proofName : `குடியிருப்புச் சான்று (${proofName})`,
            titleEng: 'Residence Proof',
            downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/residenceProof?download=1`,
            previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/residenceProof`,
            icon: 'fa-house',
            isPdf: isPhysicalPdf(resPath, b64Map.residenceProofBase64)
        });
    }

    // 5.5 Community Proof (Family Community Certificate or School TC)
    const commProofPath = dMap.communityProof || prof.communityCertificatePath || prof.familyCommunityProofPath || prof.communityProof;
    if (fileOrDataExists(commProofPath, b64Map.communityProofBase64, storageUrls.communityProof)) {
        docs.push({
            type: 'communityProof',
            title: 'குடும்ப சாதிச் சான்றிதழ் (தந்தை/தாய்/TC)',
            titleEng: 'Family Community Certificate / TC',
            downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/communityProof?download=1`,
            previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/communityProof`,
            icon: 'fa-certificate',
            isPdf: isPhysicalPdf(commProofPath, b64Map.communityProofBase64)
        });
    }

    // 6. Sub-Service New Member Aadhaar / Birth Certificate (Strict real-file check, never duplicate headAadhaar)
    const sName = sSub?.memberNameTam || sSub?.memberNameEng || sSub?.memberName || '';
    const memLabel = sName ? ` (${sName})` : '';

    const hasSubMemDoc = fileOrDataExists(subMemDoc, b64Map.memberAadhaarBase64, storageUrls.memberAadhaar);
    const isDuplicateOfHeadAadhaar = docs.some(d => d.type === 'headAadhaar') && (
        !sSub?.docPath ||
        (aadhaarPath && subMemDoc && path.basename(String(subMemDoc)) === path.basename(String(aadhaarPath)))
    );

    if (isAddMember && hasSubMemDoc && !isDuplicateOfHeadAadhaar && (sName || sSub?.docPath || sess?.tempUploads?.memberAadhaarFront || sess?.tempUploads?.memberAadhaar || dMap.memberAadhaar)) {
        if (sSub?.isChild) {
            docs.push({
                type: 'birthCertificate',
                title: `குழந்தையின் பிறப்புச் சான்றிதழ்${memLabel}`,
                titleEng: `Child Birth Certificate${memLabel}`,
                downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/birthCertificate?download=1`,
                previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/birthCertificate`,
                icon: 'fa-file-lines',
                isPdf: isPhysicalPdf(subMemDoc, b64Map.birthCertificateBase64 || b64Map.memberAadhaarBase64)
            });
        } else {
            docs.push({
                type: 'memberAadhaar',
                title: `உறுப்பினர் ஆதார் அட்டை${memLabel}`,
                titleEng: `Member Aadhaar Card${memLabel}`,
                downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/memberAadhaar?download=1`,
                previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/memberAadhaar`,
                icon: 'fa-id-card',
                isPdf: isPhysicalPdf(subMemDoc, b64Map.memberAadhaarBase64)
            });
        }
    }
    if (!isAddMember && fileOrDataExists(dMap.birthCertificate, b64Map.birthCertificateBase64, storageUrls.birthCertificate)) {
        docs.push({
            type: 'birthCertificate',
            title: `குழந்தையின் பிறப்புச் சான்றிதழ்${memLabel}`,
            titleEng: `Child Birth Certificate${memLabel}`,
            downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/birthCertificate?download=1`,
            previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/birthCertificate`,
            icon: 'fa-file-lines'
        });
    }
    if (fileOrDataExists(dMap.surrenderProof, b64Map.surrenderProofBase64, storageUrls.surrenderProof)) {
        docs.push({
            type: 'surrenderProof',
            title: 'பழைய குடும்ப அட்டை நீக்கல் சான்று / திருமணச் சான்று',
            titleEng: 'Surrender / Marriage Certificate',
            downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/surrenderProof?download=1`,
            previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/surrenderProof`,
            icon: 'fa-file-signature'
        });
    }
    if (fileOrDataExists(dMap.removeProof, b64Map.removeProofBase64, storageUrls.removeProof)) {
        docs.push({
            type: 'removeProof',
            title: 'உறுப்பினர் நீக்கல் சான்றிதழ்',
            titleEng: 'Member Removal Proof',
            downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/removeProof?download=1`,
            previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/removeProof`,
            icon: 'fa-file-shield'
        });
    }
    const isNewAddrDuplicate = Boolean(
        (gasPath && dMap.newAddressProof && path.basename(String(gasPath)) === path.basename(String(dMap.newAddressProof))) ||
        (resPath && dMap.newAddressProof && path.basename(String(resPath)) === path.basename(String(dMap.newAddressProof))) ||
        (b64Map.newAddressProofBase64 && (b64Map.newAddressProofBase64 === b64Map.gasBookBase64 || b64Map.newAddressProofBase64 === b64Map.residenceProofBase64)) ||
        (!activeSubService.includes('CHANGE_ADDRESS') && (hasGas || hasRes))
    );
    if (!isNewAddrDuplicate && fileOrDataExists(dMap.newAddressProof, b64Map.newAddressProofBase64, storageUrls.newAddressProof)) {
        docs.push({
            type: 'newAddressProof',
            title: 'புதிய முகவரிச் சான்று',
            titleEng: 'New Address Proof',
            downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/newAddressProof?download=1`,
            previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/newAddressProof`,
            icon: 'fa-location-dot'
        });
    }

    // 6.5 Master Profile Accumulating Documents (PAN Card, Voter ID, Income Proof, TC, Bank Passbook, etc.)
    const KNOWN_DOC_METADATA = {
        panCard: { title: 'பான் கார்டு (PAN Card)', titleEng: 'PAN Card', icon: 'fa-id-card' },
        panCardFront: { title: 'பான் கார்டு முன்பக்கம் (PAN Card Front)', titleEng: 'PAN Card Front', icon: 'fa-id-card' },
        panCardBack: { title: 'பான் கார்டு பின்பக்கம் (PAN Card Back)', titleEng: 'PAN Card Back', icon: 'fa-id-card' },
        panFront: { title: 'பான் கார்டு முன்பக்கம் (PAN Front)', titleEng: 'PAN Card Front', icon: 'fa-id-card' },
        panBack: { title: 'பான் கார்டு பின்பக்கம் (PAN Back)', titleEng: 'PAN Card Back', icon: 'fa-id-card' },
        voterId: { title: 'வாக்காளர் அடையாள அட்டை (Voter ID)', titleEng: 'Voter ID Card', icon: 'fa-address-card' },
        voterIdFront: { title: 'வாக்காளர் அட்டை முன்பக்கம் (Voter ID Front)', titleEng: 'Voter ID Front', icon: 'fa-address-card' },
        voterIdBack: { title: 'வாக்காளர் அட்டை பின்பக்கம் (Voter ID Back)', titleEng: 'Voter ID Back', icon: 'fa-address-card' },
        epicCard: { title: 'வாக்காளர் அட்டை (EPIC Card)', titleEng: 'EPIC Voter Card', icon: 'fa-address-card' },
        incomeProof: { title: 'வருமானச் சான்று / சம்பள ரசீது (Income Proof)', titleEng: 'Income Proof / Pay Slip', icon: 'fa-receipt' },
        salarySlip: { title: 'சம்பள ரசீது (Salary Slip)', titleEng: 'Salary Slip', icon: 'fa-money-bill-wave' },
        incomeCertificate: { title: 'வருமானச் சான்றிதழ் (Income Certificate)', titleEng: 'Income Certificate', icon: 'fa-certificate' },
        drivingLicense: { title: 'ஓட்டுநர் உரிமம் (Driving License)', titleEng: 'Driving License', icon: 'fa-id-badge' },
        bankPassbook: { title: 'வங்கி கணக்குப் புத்தகம் (Bank Passbook)', titleEng: 'Bank Passbook', icon: 'fa-building-columns' },
        ebBill: { title: 'மின் கட்டண ரசீது (EB Bill)', titleEng: 'Electricity Bill', icon: 'fa-bolt' },
        propertyTax: { title: 'சொத்து வரி ரசீது (Property Tax Receipt)', titleEng: 'Property Tax Receipt', icon: 'fa-landmark' },
        marriageCertificate: { title: 'திருமணச் சான்றிதழ் (Marriage Certificate)', titleEng: 'Marriage Certificate', icon: 'fa-certificate' },
        communityCertificate: { title: 'சாதிச் சான்றிதழ் (Community Certificate)', titleEng: 'Community Certificate', icon: 'fa-award' },
        schoolTc: { title: 'பள்ளி மாற்றுச் சான்றிதழ் (Transfer Certificate - TC)', titleEng: 'School TC', icon: 'fa-graduation-cap' },
        deathCertificate: { title: 'இறப்புச் சான்றிதழ் (Death Certificate)', titleEng: 'Death Certificate', icon: 'fa-file-medical' },
        canReceipt: { title: 'TNeGA CAN பதிவு ரசீது', titleEng: 'TNeGA CAN Receipt', icon: 'fa-receipt' }
    };

    const internalKeysToSkip = new Set([
        'profilePhoto', 'headPhoto', 'headPhotoPath', 'headAadhaar', 'headAadhaarDocPath', 'headAadhaarFront', 'headAadhaarBack',
        'smartCard', 'rationCard', 'smartCardDocPath', 'rationCardDocPath', 'gasBook', 'residenceProof', 'communityProof',
        'subServiceMemberDoc', 'memberAadhaarFront', 'memberAadhaarBack', 'memberAadhaar', 'memberAadhaars', 'birthCertificate',
        'surrenderProof', 'removeProof', 'newAddressProof', 'applicationPdf'
    ]);

    for (const [k, meta] of Object.entries(KNOWN_DOC_METADATA)) {
        if (!docs.some(d => d.type === k)) {
            const rawP = dMap[k] || prof[k] || sess?.tempUploads?.[k];
            const rawB64 = b64Map[`${k}Base64`] || b64Map[k];
            const rawUrl = storageUrls[k];
            if (fileOrDataExists(rawP, rawB64, rawUrl)) {
                docs.push({
                    type: k,
                    title: meta.title,
                    titleEng: meta.titleEng,
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/${k}?download=1`,
                    previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/${k}`,
                    icon: meta.icon || 'fa-file-lines',
                    isPdf: isPhysicalPdf(rawP, rawB64)
                });
            }
        }
    }

    const allDocKeys = new Set([
        ...Object.keys(dMap || {}),
        ...Object.keys(prof.documents || {}),
        ...Object.keys(draft?.documents || {})
    ]);

    for (const k of allDocKeys) {
        if (!internalKeysToSkip.has(k) && !docs.some(d => d.type === k) && !k.endsWith('Base64') && !k.startsWith('temp_')) {
            const rawP = dMap[k] || prof.documents?.[k];
            const rawB64 = b64Map[`${k}Base64`] || b64Map[k];
            const rawUrl = storageUrls[k];
            if (fileOrDataExists(rawP, rawB64, rawUrl)) {
                const meta = KNOWN_DOC_METADATA[k] || {
                    title: `ஆவணம் (${k})`,
                    titleEng: k,
                    icon: 'fa-file-lines'
                };
                docs.push({
                    type: k,
                    title: meta.title,
                    titleEng: meta.titleEng,
                    downloadUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/${k}?download=1`,
                    previewUrl: `/api/drafts/${encodeURIComponent(cleanMob)}/doc/${k}`,
                    icon: meta.icon,
                    isPdf: isPhysicalPdf(rawP, rawB64)
                });
            }
        }
    }

    // 7. Submitted Application PDF (if exists)
    const appNo = (draft && draft.applicationNumber) || prof.applicationNumber || (sess && sess.applicationNumber);
    const appPdf = (draft && draft.applicationPdfUrl) || prof.applicationPdfUrl || (sess && sess.applicationPdfUrl);
    if (appNo || appPdf) {
        docs.push({
            type: 'applicationPdf',
            title: `சமர்ப்பிக்கப்பட்ட TNPDS விண்ணப்பம் (${appNo || 'PDF'})`,
            titleEng: 'Submitted TNPDS Application PDF',
            downloadUrl: appPdf || `/receipts/Application_${appNo}.pdf`,
            previewUrl: appPdf || `/receipts/Application_${appNo}.pdf`,
            isTnpdsPdf: true,
            appNo: appNo,
            icon: 'fa-file-pdf'
        });
    }

    return docs;
}

module.exports = {
    extractDraftDocumentsList,
    fileOrDataExists
};
