/**
 * TNPDS New Smart Card - Document Preparation & Base64 Decoder
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

let produceCompliantPassportPhoto, produceCompliantDocument, produceDualSidedDocument;
try {
    const ps = require('../../../../photo_studio');
    produceCompliantPassportPhoto = ps.produceCompliantPassportPhoto;
    produceCompliantDocument = ps.produceCompliantDocument;
    produceDualSidedDocument = ps.produceDualSidedDocument;
} catch (e) {
    try {
        const ps = require(path.join(__dirname, '..', '..', '..', '..', 'photo_studio.js'));
        produceCompliantPassportPhoto = ps.produceCompliantPassportPhoto;
        produceCompliantDocument = ps.produceCompliantDocument;
        produceDualSidedDocument = ps.produceDualSidedDocument;
    } catch (_) {}
}
if (!produceCompliantPassportPhoto) produceCompliantPassportPhoto = async (p) => p;
if (!produceCompliantDocument) produceCompliantDocument = async (p) => p;
if (!produceDualSidedDocument) produceDualSidedDocument = async (f, b) => f || b;

async function prepareNewCardDocuments(citizenProfile, options = {}, isMockSandboxMode = true) {
    const cacheDir = path.join(os.tmpdir(), 'esevadraft_cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    async function resolveLocalDoc(filePath, defaultFileName, docCategory = '', memberIndex = -1) {
        const b64Sources = [
            options.draftData?.base64Docs,
            citizenProfile.base64Docs,
            options.base64Docs
        ].filter(Boolean);

        for (const b64Map of b64Sources) {
            const catKey = docCategory === 'photo' ? 'profilePhoto' :
                           docCategory === 'aadhaar' ? 'headAadhaar' :
                           docCategory === 'gas' ? 'gasBook' :
                           docCategory === 'residenceProof' ? 'residenceProof' : docCategory;

            const b64Data = b64Map[`${catKey}Base64`] || b64Map[catKey] || b64Map[`${docCategory}Base64`];
            const docFileName = b64Map[`${catKey}Name`] || b64Map[`${docCategory}Name`] || `${catKey}.jpg`;
            if (b64Data && typeof b64Data === 'string' && b64Data.length > 50) {
                try {
                    const targetFile = path.join(cacheDir, docFileName);
                    const rawData = b64Data.includes('base64,') ? b64Data.split('base64,')[1] : b64Data;
                    fs.writeFileSync(targetFile, Buffer.from(rawData, 'base64'));
                    return targetFile;
                } catch (b64Err) {
                    console.warn('[resolveLocalDoc] Base64 decode failed:', b64Err.message);
                }
            }

            const isMemberDoc = docCategory === 'memberAadhaar' || 
                                catKey.toLowerCase().includes('member') || 
                                (filePath && typeof filePath === 'string' && filePath.toLowerCase().includes('member'));
            if (isMemberDoc && b64Map.memberAadhaarsBase64 && Array.isArray(b64Map.memberAadhaarsBase64) && b64Map.memberAadhaarsBase64.length > 0) {
                const baseName = (filePath && typeof filePath === 'string') ? path.basename(filePath) : '';
                let matched = null;
                if (baseName) {
                    matched = b64Map.memberAadhaarsBase64.find(m => {
                        if (!m) return false;
                        const mName = typeof m === 'object' ? (m.name || m.fileName || '') : '';
                        return mName && (mName.includes(baseName) || baseName.includes(mName));
                    });
                }
                if (!matched && memberIndex >= 0 && memberIndex < b64Map.memberAadhaarsBase64.length) {
                    matched = b64Map.memberAadhaarsBase64[memberIndex];
                }
                if (matched) {
                    const mB64 = typeof matched === 'string' ? matched : (matched.base64 || matched.data || '');
                    const mFileName = typeof matched === 'object' ? (matched.name || matched.fileName || `member_${memberIndex + 1}_aadhaar.jpg`) : `member_${memberIndex + 1}_aadhaar.jpg`;
                    if (mB64 && mB64.length > 50) {
                        try {
                            const targetFile = path.join(cacheDir, mFileName);
                            const rawData = mB64.includes('base64,') ? mB64.split('base64,')[1] : mB64;
                            fs.writeFileSync(targetFile, Buffer.from(rawData, 'base64'));
                            return targetFile;
                        } catch (_) {}
                    }
                }
            }
        }

        if (filePath && typeof filePath === 'string') {
            if (fs.existsSync(filePath)) return filePath;
            const appDataDir = process.env.APPDATA || 'C:\\Users\\ADMIN\\AppData\\Roaming';
            const mobClean = (citizenProfile.mobileNumber || options.draftData?.mobileNumber || '').replace(/\D/g, '');
            const candidates = [
                path.join(appDataDir, 'esevadraft-desktop', 'data', 'uploads', mobClean, path.basename(filePath)),
                path.join(appDataDir, 'esevadraft-desktop', 'uploads', path.basename(filePath)),
                path.join(cacheDir, path.basename(filePath)),
                path.join('d:/downloads/ai assitant 2/uploads', path.basename(filePath))
            ];
            for (const cand of candidates) {
                if (fs.existsSync(cand)) return cand;
            }
        }

        if (defaultFileName) {
            const defaultCandidates = [
                path.join(process.resourcesPath || '', 'uploads', defaultFileName),
                path.join(__dirname, 'uploads', defaultFileName),
                path.join('d:/downloads/ai assitant 2/uploads', defaultFileName),
                path.join(process.cwd(), 'uploads', defaultFileName)
            ];
            for (const dc of defaultCandidates) {
                if (fs.existsSync(dc)) return dc;
            }
        }
        return null;
    }

    const headMember = (citizenProfile.members && citizenProfile.members.length > 0) ? citizenProfile.members[0] : {};
    const photoFallback = isMockSandboxMode ? 'kumaran_profile_photo.png' : null;
    const aadhaarFallback = isMockSandboxMode ? 'kumaran_aadhaar_card.jpeg' : null;
    const gasFallback = isMockSandboxMode ? 'kumaran_gas_book.jpg' : null;

    const rawHeadPhoto = await resolveLocalDoc(citizenProfile.headPhotoPath || citizenProfile.documents?.profilePhoto, photoFallback, 'photo');
    const rawHeadAadhaar = await resolveLocalDoc(headMember.docPath || citizenProfile.documents?.headAadhaar, aadhaarFallback, 'aadhaar');
    let rawGasBook = await resolveLocalDoc(
        citizenProfile.gasDetails?.gasBookPath || 
        citizenProfile.residenceProof?.docPath || 
        citizenProfile.documents?.gasBook || 
        citizenProfile.documents?.residenceProof,
        gasFallback, 
        'gas'
    );

    const optimizedHeadPhoto = rawHeadPhoto ? await produceCompliantPassportPhoto(rawHeadPhoto) : null;
    const optimizedHeadAadhaar = rawHeadAadhaar ? await produceCompliantDocument(rawHeadAadhaar) : null;
    const optimizedGasBook = rawGasBook ? await produceCompliantDocument(rawGasBook) : null;

    return {
        cacheDir,
        resolveLocalDoc,
        rawHeadPhoto,
        rawHeadAadhaar,
        rawGasBook,
        optimizedHeadPhoto,
        optimizedHeadAadhaar,
        optimizedGasBook
    };
}

module.exports = {
    prepareNewCardDocuments
};
