// scripts/watch_live_user_events.js
// Non-stop live monitor for operator activity in eSevaDraft Desktop

const fs = require('fs');
const path = require('path');
const http = require('http');

const flightLog = path.join(__dirname, '..', 'public', 'logs', 'flight_recorder.log');
console.log('👀 [Live Watcher Active] Monitoring eSevaDraft Desktop events in real-time...');

let lastSize = 0;
if (fs.existsSync(flightLog)) {
    lastSize = fs.statSync(flightLog).size;
}

function pollFlightLog() {
    if (!fs.existsSync(flightLog)) return;
    const stat = fs.statSync(flightLog);
    if (stat.size > lastSize) {
        const stream = fs.createReadStream(flightLog, { start: lastSize, end: stat.size });
        let buf = '';
        stream.on('data', c => buf += c);
        stream.on('end', () => {
            const lines = buf.trim().split('\n').filter(Boolean);
            lines.forEach(line => {
                console.log(`[USER ACTION] ${line}`);
            });
            lastSize = stat.size;
        });
    }
}

function pollActiveSession() {
    const req = http.get('http://127.0.0.1:3000/api/auth/session', { timeout: 2000 }, res => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => {
            try {
                const data = JSON.parse(b);
                if (data.activeMobile && data.activeMobile !== global._lastMobile) {
                    global._lastMobile = data.activeMobile;
                    console.log(`\n🔔 [CUSTOMER ACTIVE] +91 ${data.activeMobile} (${data.citizenProfile?.fullNameTam || data.citizenProfile?.fullNameEng || 'வாடிக்கையாளர்'})`);
                    console.log(`   📌 Intake State: ${data.intakeState || data.step || 'START'}`);
                }
            } catch (e) {}
        });
    });
    req.on('error', () => {});
}

setInterval(pollFlightLog, 1000);
setInterval(pollActiveSession, 2000);

// Keep process alive indefinitely
setInterval(() => {}, 60000);
