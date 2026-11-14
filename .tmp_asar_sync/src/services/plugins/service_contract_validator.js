// ============================================================================
// eSevaDraft Strict Service Contract Validator
// Enforces zero-contamination contracts and document integrity per service
// ============================================================================

/**
 * Validates a draft / profile payload against the service's strict contract.
 * Automatically cleanses forbidden fields (e.g. headPhoto in Add Member).
 * 
 * @param {string} serviceId - 'ADD_MEMBER' | 'NEW_RATION_CARD' | 'CHANGE_ADDRESS'
 * @param {object} profile - Citizen profile object
 * @param {object} documents - Documents map (local paths or storage URLs)
 * @returns {object} { isValid: boolean, errors: string[], sanitizedProfile: object, sanitizedDocuments: object }
 */
function validateServiceContract(serviceId, profile = {}, documents = {}) {
    const sId = String(serviceId || '').trim().toUpperCase();
    const errors = [];
    const sanitizedProfile = { ...profile };
    if (profile && profile.documents) {
        sanitizedProfile.documents = { ...profile.documents };
    }
    const sanitizedDocuments = { ...documents };

    if (sId === 'ADD_MEMBER' || sId === 'RATION_ADD_MEMBER') {
        // --- ADD MEMBER CONTRACT ---
        // INVARIANT 1: Strictly NO Family Head Photo or Head Aadhaar
        const forbiddenKeys = ['profilePhoto', 'headPhotoPath', 'headAadhaar', 'headAadhaarFront', 'headAadhaarBack'];
        for (const k of forbiddenKeys) {
            if (sanitizedProfile[k]) delete sanitizedProfile[k];
            if (sanitizedDocuments[k]) delete sanitizedDocuments[k];
            if (sanitizedProfile.documents?.[k]) delete sanitizedProfile.documents[k];
        }

        // INVARIANT 2: Must have Member Details
        const subData = sanitizedProfile.subServiceData || {};
        const memberName = subData.memberName || subData.memberNameTam || subData.memberNameEng || sanitizedProfile.members?.[0]?.nameTam;
        const aadhaarNo = subData.aadhaarNo || subData.aadhaarNumber || sanitizedProfile.members?.[0]?.aadhaarNo;
        const rel = subData.relationship || subData.relationshipTam || sanitizedProfile.members?.[0]?.relationship;

        if (!memberName) errors.push('உறுப்பினர் பெயர் விடுபட்டுள்ளது (Member Name is required).');
        if (!aadhaarNo || !/^\d{12}$/.test(String(aadhaarNo).replace(/\s/g, ''))) {
            errors.push('சரியான 12-இலக்க உறுப்பினர் ஆதார் எண் தேவை (Valid 12-digit Aadhaar required).');
        }
        if (!rel) errors.push('குடும்பத் தலைவருடனான உறவுமுறை தேவை (Relationship with head required).');

        // INVARIANT 3: Member document must exist (memberAadhaar or birthCertificate)
        const hasMemberDoc = Boolean(
            sanitizedDocuments.memberAadhaar || 
            sanitizedDocuments.birthCertificate ||
            subData.docPath ||
            sanitizedProfile.members?.[0]?.docPath
        );
        if (!hasMemberDoc) {
            errors.push('உறுப்பினர் ஆதார் அட்டை அல்லது பிறப்புச் சான்றிதழ் தேவை (Member Aadhaar or Birth Certificate required).');
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitizedProfile,
            sanitizedDocuments
        };
    }

    if (sId === 'NEW_RATION_CARD' || sId === 'TNPDS_NFC') {
        // --- NEW RATION CARD CONTRACT ---
        // INVARIANT 1: Family Head Details required
        const headNameTam = sanitizedProfile.fullNameTam;
        const headNameEng = sanitizedProfile.fullNameEng;
        const headAadhaar = sanitizedProfile.headAadhaar;

        if (!headNameTam && !headNameEng) errors.push('குடும்பத் தலைவர் பெயர் தேவை (Family Head Name is required).');
        if (!headAadhaar || !/^\d{12}$/.test(String(headAadhaar).replace(/\s/g, ''))) {
            errors.push('குடும்பத் தலைவர் 12-இலக்க ஆதார் எண் தேவை (Head Aadhaar required).');
        }

        // INVARIANT 2: Head Photo & Head Aadhaar required
        const hasHeadPhoto = Boolean(sanitizedProfile.headPhotoPath || sanitizedDocuments.profilePhoto);
        const hasHeadAadhaarDoc = Boolean(sanitizedDocuments.headAadhaar || sanitizedProfile.members?.[0]?.docPath);
        if (!hasHeadPhoto) errors.push('குடும்பத் தலைவர் பாஸ்போர்ட் புகைப்படம் தேவை (Head Photo required).');
        if (!hasHeadAadhaarDoc) errors.push('குடும்பத் தலைவர் ஆதார் ஆவணம் தேவை (Head Aadhaar Document required).');

        return {
            isValid: errors.length === 0,
            errors,
            sanitizedProfile,
            sanitizedDocuments
        };
    }

    if (sId === 'CHANGE_ADDRESS' || sId === 'RATION_CHANGE_ADDRESS') {
        // --- CHANGE ADDRESS CONTRACT ---
        // INVARIANT 1: Strictly NO Family Head Photo
        if (sanitizedProfile.headPhotoPath) delete sanitizedProfile.headPhotoPath;
        if (sanitizedDocuments.profilePhoto) delete sanitizedDocuments.profilePhoto;

        // INVARIANT 2: New Address details & proof required
        const subData = sanitizedProfile.subServiceData || {};
        if (!subData.newDoorNo && !sanitizedProfile.doorNo) errors.push('புதிய கதவு எண் தேவை.');
        if (!subData.newStreet && !sanitizedProfile.streetTam) errors.push('புதிய தெருப் பெயர் தேவை.');
        if (!sanitizedDocuments.newAddressProof && !subData.addressProofDocPath) {
            errors.push('புதிய முகவரிச் சான்று ஆவணம் தேவை (New Address Proof required).');
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitizedProfile,
            sanitizedDocuments
        };
    }

    // Default passthrough
    return {
        isValid: true,
        errors: [],
        sanitizedProfile,
        sanitizedDocuments
    };
}

module.exports = {
    validateServiceContract
};
