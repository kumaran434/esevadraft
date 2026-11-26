// Thin compatibility re-export -> Single Source of Truth: src/services/app_store.js
const { listAllDrafts, trashCitizenDraft, restoreCitizenDraft, deleteCitizenDraft, migrateCustomerUploads } = require('../app_store');
module.exports = { listAllDrafts, trashCitizenDraft, restoreCitizenDraft, deleteCitizenDraft, migrateCustomerUploads };
