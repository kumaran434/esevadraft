const { execSync } = require('child_process');

try {
    const out = execSync('powershell -NoProfile -Command "Get-Process -Name \'eSevaDraft Desktop\' | Select-Object Id, ProcessName, MainWindowHandle, MainWindowTitle | Format-Table"').toString();
    console.log(out);
} catch (e) {
    console.error(e.message);
}
