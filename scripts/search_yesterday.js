const fs = require('fs');
const readline = require('readline');

const file = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\39c26b5f-9602-4d0a-a0dd-98ba1737cab3\\.system_generated\\logs\\transcript.jsonl';
const rl = readline.createInterface({ input: fs.createReadStream(file) });

const userMsgs = [];
const agentMentions = [];

rl.on('line', line => {
    try {
        const obj = JSON.parse(line);
        const text = obj.content || '';
        if (obj.type === 'USER_INPUT' || obj.source === 'USER_EXPLICIT') {
            if (/otp|sms|cloud|demo|forward|web/i.test(text)) {
                userMsgs.push(text);
            }
        } else if (obj.type === 'PLANNER_RESPONSE' && text) {
            if (/webhook|cloud|esevadraft\.in|forward/i.test(text)) {
                const lines = text.split('\n').filter(l => /http|webhook|cloud|forward|sms|otp/i.test(l));
                if (lines.length > 0) agentMentions.push(lines.slice(0, 3).join(' | '));
            }
        }
    } catch (_) {}
});

rl.on('close', () => {
    console.log('--- USER MSGS ---');
    console.log(userMsgs.slice(-10));
    console.log('--- AGENT MENTIONS ---');
    console.log(agentMentions.slice(-10));
});
