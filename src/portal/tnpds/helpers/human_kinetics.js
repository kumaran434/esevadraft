/**
 * eSevaDraft TNPDS Human Kinetics Engine (Rule 30)
 * Cubic Bezier curved mouse physics, Fitts's law easing, and authentic human keystroke rhythms.
 */

let globalMousePos = { x: 350, y: 250 };

function generateHumanTrajectory(startX, startY, targetX, targetY) {
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.hypot(dx, dy);

    const steps = Math.min(40, Math.max(16, Math.floor(distance / 14) + Math.floor(Math.random() * 6)));
    const normalX = -dy / (distance || 1);
    const normalY = dx / (distance || 1);

    const arcMagnitude = (Math.random() - 0.48) * Math.min(distance * 0.35, 70);
    const midPointX = startX + dx * 0.5 + normalX * arcMagnitude;
    const midPointY = startY + dy * 0.5 + normalY * arcMagnitude;

    const cp1X = startX + (midPointX - startX) * (0.35 + Math.random() * 0.3) + (Math.random() - 0.5) * 15;
    const cp1Y = startY + (midPointY - startY) * (0.35 + Math.random() * 0.3) + (Math.random() - 0.5) * 15;
    const cp2X = midPointX + (targetX - midPointX) * (0.35 + Math.random() * 0.3) + (Math.random() - 0.5) * 15;
    const cp2Y = midPointY + (targetY - midPointY) * (0.35 + Math.random() * 0.3) + (Math.random() - 0.5) * 15;

    const points = [];
    for (let i = 1; i <= steps; i++) {
        const rawT = i / steps;
        const t = rawT < 0.5
            ? 4 * rawT * rawT * rawT
            : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        const u = 1 - t;
        let px = (u * u * u * startX) + (3 * u * u * t * cp1X) + (3 * u * t * t * cp2X) + (t * t * t * targetX);
        let py = (u * u * u * startY) + (3 * u * u * t * cp1Y) + (3 * u * t * t * cp2Y) + (t * t * t * targetY);

        if (i > 2 && i < steps - 2) {
            px += (Math.random() - 0.5) * 1.5;
            py += (Math.random() - 0.5) * 1.5;
        }

        points.push({ x: Math.round(px * 10) / 10, y: Math.round(py * 10) / 10 });
    }
    points[points.length - 1] = { x: targetX, y: targetY };
    return points;
}

async function humanMouseMove(activePage, targetX, targetY) {
    if (!activePage || activePage.isClosed()) return;
    try {
        const startX = globalMousePos.x || 350;
        const startY = globalMousePos.y || 250;
        const trajectory = generateHumanTrajectory(startX, startY, targetX, targetY);

        for (const pt of trajectory) {
            await activePage.mouse.move(pt.x, pt.y);
            globalMousePos.x = pt.x;
            globalMousePos.y = pt.y;
            const stepDelay = 6 + Math.floor(Math.random() * 10);
            await activePage.waitForTimeout(stepDelay);
        }
        globalMousePos = { x: targetX, y: targetY };
    } catch (_) {
        await activePage.mouse.move(targetX, targetY).catch(() => {});
        globalMousePos = { x: targetX, y: targetY };
    }
}

async function humanClick(activePage, locatorOrSelector) {
    if (!activePage || activePage.isClosed()) return false;
    try {
        const locator = typeof locatorOrSelector === 'string' ? activePage.locator(locatorOrSelector).first() : locatorOrSelector;
        if (await locator.count() === 0 || !(await locator.isVisible().catch(() => false))) {
            return false;
        }
        const box = await locator.boundingBox().catch(() => null);
        if (box && box.width > 0 && box.height > 0) {
            const targetX = box.x + box.width * (0.35 + Math.random() * 0.3);
            const targetY = box.y + box.height * (0.35 + Math.random() * 0.3);

            await humanMouseMove(activePage, targetX, targetY);
            await activePage.waitForTimeout(70 + Math.floor(Math.random() * 90));
            await activePage.mouse.down();
            await activePage.waitForTimeout(55 + Math.floor(Math.random() * 55));
            await activePage.mouse.up();
            await activePage.waitForTimeout(80 + Math.floor(Math.random() * 100));
            return true;
        } else {
            await locator.hover().catch(() => {});
            await activePage.waitForTimeout(80);
            await locator.click({ delay: 60 + Math.floor(Math.random() * 50) });
            return true;
        }
    } catch (_) {
        try {
            const locator = typeof locatorOrSelector === 'string' ? activePage.locator(locatorOrSelector).first() : locatorOrSelector;
            await locator.click({ force: true, delay: 60 }).catch(() => {});
            return true;
        } catch (_) {
            return false;
        }
    }
}

async function humanType(activePage, locatorOrSelector, text, options = {}) {
    if (!activePage || activePage.isClosed() || text === undefined || text === null) return;
    const strText = String(text);
    const locator = typeof locatorOrSelector === 'string' ? activePage.locator(locatorOrSelector).first() : locatorOrSelector;

    try {
        await humanClick(activePage, locator);
        await activePage.waitForTimeout(80 + Math.floor(Math.random() * 70));

        if (options.clearFirst !== false) {
            const curVal = await locator.inputValue().catch(() => '');
            if (curVal && curVal.length > 0) {
                const selectAllKey = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
                await activePage.keyboard.press(selectAllKey);
                await activePage.waitForTimeout(40 + Math.floor(Math.random() * 40));
                await activePage.keyboard.press('Backspace');
                await activePage.waitForTimeout(60 + Math.floor(Math.random() * 60));
            }
        }

        const isOtp = options.isOtp === true;
        for (let i = 0; i < strText.length; i++) {
            const char = strText[i];
            await activePage.keyboard.press(char);

            let delay = isOtp
                ? 130 + Math.floor(Math.random() * 110)
                : 60 + Math.floor(Math.random() * 85);

            if (isOtp && i === 2) {
                delay += 250 + Math.floor(Math.random() * 200);
            }
            await activePage.waitForTimeout(delay);
        }

        await activePage.waitForTimeout(80 + Math.floor(Math.random() * 80));
    } catch (_) {
        try {
            await locator.fill(strText);
        } catch (_) {}
    }
}

module.exports = {
    generateHumanTrajectory,
    humanMouseMove,
    humanClick,
    humanType
};
