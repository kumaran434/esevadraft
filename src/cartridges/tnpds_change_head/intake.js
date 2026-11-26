const { handleFlow } = require('./flow');
const { runTnpdsSubserviceTurn } = require('../_tnpds_subservice_utils');

async function handleIntake(ctx, req, res) {
    return runTnpdsSubserviceTurn({
        ctx,
        req,
        res,
        handleFlowFn: handleFlow,
        onUploadedFn: async (sess, uploadedFile) => {
            sess.tempUploads = sess.tempUploads || {};
            sess.tempUploads.headChangeProof = uploadedFile.path;
        }
    });
}

module.exports = { handleIntake };
