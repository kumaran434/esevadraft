// Golden Cartridge Template: automation.js
async function run(payload, onProgress, options = {}) {
    return { success: true, status: 'PRE_SUBMIT_GATE', ...options };
}

function startFromChat({ sess, req, res }) {
    res.json({ success: false, message: 'Implement startFromChat for this service Cartridge.' });
    return true;
}

module.exports = {
    runnerName: 'startTemplateServiceFlow',
    chatStartTriggers: ['START_TEMPLATE_APPLY'],
    readyStates: ['READY_TO_APPLY_TEMPLATE'],
    run,
    startFromChat
};
