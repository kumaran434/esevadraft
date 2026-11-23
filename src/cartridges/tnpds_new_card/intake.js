const { handleMemberCount } = require('../../routes/chat/chat_member_count');
const { handleHeadPhoto } = require('../../routes/chat/chat_head_photo');
const { handleHeadAadhaar } = require('../../routes/chat/chat_head_aadhaar');
const { handleMemberAadhaar } = require('../../routes/chat/chat_member_aadhaar');
const { handleMemberVerification } = require('../../routes/chat/chat_member_verification');
const { handleAddressAndMobile } = require('../../routes/chat/chat_address_and_mobile');
const { handleResidenceProof } = require('../../routes/chat/chat_residence_proof');

async function handleIntake(ctx, req, res) {
    if (await handleMemberCount(ctx, req, res)) return true;
    if (await handleHeadPhoto(ctx, req, res)) return true;
    if (await handleHeadAadhaar(ctx, req, res)) return true;
    if (await handleMemberAadhaar(ctx, req, res)) return true;
    if (await handleMemberVerification(ctx, req, res)) return true;
    if (await handleAddressAndMobile(ctx, req, res)) return true;
    if (await handleResidenceProof(ctx, req, res)) return true;
    return false;
}

module.exports = { handleIntake };
