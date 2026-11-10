const { spawn } = require('child_process');
const path = require('path');

const exe = path.join(process.env.LOCALAPPDATA, 'Programs', 'eSevaDraft Desktop', 'eSevaDraft Desktop.exe');
console.log('Spawning:', exe);

const child = spawn(exe, [], {
    detached: false,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1', ELECTRON_LOG_ASSETS: '1' }
});

child.stdout.on('data', d => console.log('STDOUT:', d.toString()));
child.stderr.on('data', d => console.log('STDERR:', d.toString()));
child.on('error', err => console.error('SPAWN ERROR:', err));
child.on('close', (code, signal) => console.log(`CLOSED with code=${code}, signal=${signal}`));

setTimeout(() => {
    console.log('Still alive after 10 seconds? Pid:', child.pid);
}, 10000);
