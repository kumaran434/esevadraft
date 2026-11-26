// Thin compatibility re-export -> Single Source of Truth: src/services/app_store.js
const { saveCitizenDraft, buildMasterCloudPayload } = require('../app_store');
module.exports = { saveCitizenDraft, buildMasterCloudPayload };
