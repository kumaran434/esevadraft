/**
 * src/catalog/universal_delta_engine.js
 * 
 * The Declarative Universal Delta Intake Engine (Golden Rule 11).
 * Computes: Required Service Fields MINUS Already Known Customer Fields.
 * 
 * Zero sprawl, zero hardcoded if/else ladders. Drives intake purely from service manifests.
 */

function getNestedValue(obj, keyPath) {
    if (!obj || !keyPath) return null;
    if (obj[keyPath] !== undefined && obj[keyPath] !== null && String(obj[keyPath]).trim() !== '') {
        return obj[keyPath];
    }
    const parts = keyPath.split('.');
    let cur = obj;
    for (const part of parts) {
        if (!cur || typeof cur !== 'object') return null;
        cur = cur[part];
    }
    return (cur !== undefined && cur !== null && String(cur).trim() !== '') ? cur : null;
}

function resolveFieldValue(profile, fieldDef) {
    let val = getNestedValue(profile, fieldDef.key);
    if (val) return val;
    if (Array.isArray(fieldDef.altKeys)) {
        for (const alt of fieldDef.altKeys) {
            val = getNestedValue(profile, alt);
            if (val) return val;
        }
    }
    return null;
}

function evaluateServiceDelta(serviceManifest, citizenProfile = {}, documents = {}) {
    if (!serviceManifest) {
        return { isReady: false, status: 'UNKNOWN_SERVICE', error: 'Service manifest not provided.' };
    }

    const prof = citizenProfile || {};
    const docs = documents || prof.documents || {};

    // -------------------------------------------------------------------------
    // STAGE 1 (Golden Rule 20): MANDATORY DOCUMENTS FIRST (ஆவணங்கள் முதலில்)
    // Always collect all mandatory documents upfront so AI extracts all demographic
    // and address details before asking any manual user questions.
    // -------------------------------------------------------------------------

    // 1a. Check Bucket A (Aadhaar / Identity document)
    if (Array.isArray(serviceManifest.bucketA) && serviceManifest.bucketA.length > 0) {
        const hasAadhaarDoc = Boolean(
            docs.headAadhaar || 
            docs.headAadhaarFront || 
            prof.headAadhaarDocPath || 
            (prof.base64Docs && prof.base64Docs.headAadhaarBase64)
        );
        const hasExtractedName = Boolean(prof.fullNameEng || prof.fullNameTam);

        if (!hasAadhaarDoc && !hasExtractedName) {
            return {
                isReady: false,
                status: 'NEEDS_BUCKET_A',
                serviceId: serviceManifest.id,
                promptTam: `விண்ணப்பதாரரின் ஆதார் அட்டை படம் / PDF பதிவேற்றவும் (அல்லது விவரங்களை உள்ளிடவும்):`,
                actionRequired: 'upload',
                uploadType: 'headAadhaar'
            };
        }
    }

    // 1b. Check Service-Specific Mandatory Documents (Photo, Proof of Community/Income/Residence/Gas)
    if (Array.isArray(serviceManifest.requiredDocuments)) {
        for (const reqDoc of serviceManifest.requiredDocuments) {
            if (!reqDoc.mandatory) continue;
            let docFound = Boolean(docs[reqDoc.key]);
            if (!docFound && Array.isArray(reqDoc.altKeys)) {
                for (const alt of reqDoc.altKeys) {
                    if (docs[alt] || prof[alt]) {
                        docFound = true;
                        break;
                    }
                }
            }
            if (!docFound && prof[reqDoc.key]) {
                docFound = true;
            }
            if (!docFound) {
                return {
                    isReady: false,
                    status: 'NEEDS_DOCUMENT',
                    serviceId: serviceManifest.id,
                    document: reqDoc,
                    promptTam: reqDoc.promptTam || `விண்ணப்பத்திற்கு ${reqDoc.labelTam} பதிவேற்றவும்:`,
                    actionRequired: 'upload',
                    uploadType: reqDoc.key
                };
            }
        }
    }

    // -------------------------------------------------------------------------
    // STAGE 2: Prerequisites (e.g., CAN number for Revenue certificates)
    // Only audited AFTER documents have been provided and auto-extracted.
    // -------------------------------------------------------------------------
    if (Array.isArray(serviceManifest.prerequisites)) {
        for (const pre of serviceManifest.prerequisites) {
            const preVal = resolveFieldValue(prof, pre);
            if (!preVal) {
                return {
                    isReady: false,
                    status: 'NEEDS_PREREQUISITE',
                    prerequisite: pre,
                    serviceId: serviceManifest.id,
                    promptTam: pre.promptTam || `இந்த சேவைக்கு ${pre.labelTam} கட்டாயமாகும்.`,
                    fallbackServiceId: pre.fallbackServiceId || null
                };
            }
        }
    }

    // -------------------------------------------------------------------------
    // STAGE 3: Bucket B (Service-Specific User Fields NOT on Documents)
    // Ask remaining missing questions one-by-one.
    // -------------------------------------------------------------------------
    const missingBucketB = [];
    if (Array.isArray(serviceManifest.bucketB)) {
        for (const field of serviceManifest.bucketB) {
            const val = resolveFieldValue(prof, field);
            if (!val && field.mandatory) {
                missingBucketB.push(field);
            }
        }
    }

    if (missingBucketB.length > 0) {
        const nextField = missingBucketB[0];
        return {
            isReady: false,
            status: 'NEEDS_FIELD',
            serviceId: serviceManifest.id,
            field: nextField,
            missingCount: missingBucketB.length,
            promptTam: nextField.promptTam || `தயவுசெய்து ${nextField.labelTam} உள்ளிடவும்:`,
            options: nextField.options || null,
            inputType: nextField.type || 'text'
        };
    }

    // 5. All Bucket A, Bucket B, and Documents satisfied! Ready for Pre-Submit Gate.
    return {
        isReady: true,
        status: 'READY_TO_APPLY',
        serviceId: serviceManifest.id,
        serviceNameTam: serviceManifest.nameTam,
        serviceNameEng: serviceManifest.nameEng,
        actionRequired: 'open_edit_modal'
    };
}

module.exports = {
    evaluateServiceDelta,
    resolveFieldValue,
    getNestedValue
};
