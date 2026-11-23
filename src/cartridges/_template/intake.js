// Golden Cartridge Template: intake.js
const { advanceFlow } = require('./flow');

async function handleIntake(ctx, req, res) {
    const { sess } = ctx;
    const flowStep = advanceFlow(sess);
    sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
    res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState });
    return true;
}

module.exports = { handleIntake };
