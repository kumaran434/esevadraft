// Golden Cartridge Template: flow.js
function advanceFlow(sess, prefixMessage = '') {
    sess.subService = 'TEMPLATE_SERVICE';
    sess.intakeState = 'TEMPLATE_INTAKE';
    return { text: `${prefixMessage ? prefixMessage + '\n\n' : ''}Template Prompt`, options: [], step: sess.intakeState };
}

function enterService(sess, { greeting = '', isDirectOperator = false } = {}) {
    sess.subService = 'TEMPLATE_SERVICE';
    sess.pluginId = 'TEMPLATE_SERVICE';
    const flowStep = advanceFlow(sess, greeting);
    const botMsg = { sender: 'bot', text: flowStep.text, options: flowStep.options };
    if (isDirectOperator) sess.chatHistory = [botMsg];
    else sess.chatHistory.push(botMsg);
    return true;
}

function onDocumentDeleted(sess) {
    const flowStep = advanceFlow(sess, '🗑️ **தேர்ந்தெடுக்கப்பட்ட ஆவணம் நீக்கப்பட்டது!**');
    sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
    return true;
}

module.exports = { advanceFlow, enterService, onDocumentDeleted };
