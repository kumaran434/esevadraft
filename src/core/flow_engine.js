// ============================================================================
// eSevaDraft Declarative Flow Engine
// Zero-code conversational state machine driven by declarative step definitions
// ============================================================================

/**
 * Standard Declarative Flow Definition Format:
 * {
 *   serviceId: 'INCOME_CERTIFICATE',
 *   initialState: 'ANNUAL_INCOME',
 *   completionState: 'READY_TO_APPLY',
 *   steps: {
 *     ANNUAL_INCOME: {
 *       prompt: '💰 உங்கள் குடும்பத்தின் மொத்த ஆண்டு வருமானம் எவ்வளவு?',
 *       type: 'number',
 *       min: 1000,
 *       max: 10000000,
 *       targetField: 'subServiceData.annualIncome',
 *       nextState: 'OCCUPATION'
 *     },
 *     OCCUPATION: {
 *       prompt: '💼 உங்கள் குடும்பத்தின் முதன்மைத் தொழில் என்ன?',
 *       type: 'options',
 *       options: [{ label: 'விவசாயம்', value: 'விவசாயம்' }, ...],
 *       targetField: 'subServiceData.occupation',
 *       nextState: 'READY_TO_APPLY'
 *     }
 *   }
 * }
 */

class FlowEngine {
    constructor(flowDefinition) {
        if (!flowDefinition || !flowDefinition.serviceId) {
            throw new Error('FlowEngine requires a valid flowDefinition with serviceId.');
        }
        this.flow = flowDefinition;
    }

    getInitialPrompt() {
        const firstStepKey = this.flow.initialState;
        const step = this.flow.steps[firstStepKey];
        if (!step) return null;
        return {
            state: firstStepKey,
            prompt: step.prompt,
            options: step.options || null,
            inputType: step.type || 'text'
        };
    }

    processInput(currentState, userInput, sessionData = {}) {
        const step = this.flow.steps[currentState];
        if (!step) {
            return {
                isCompleted: true,
                nextState: this.flow.completionState || 'READY_TO_APPLY',
                sessionData
            };
        }

        const inputStr = String(userInput || '').trim();
        let validatedVal = inputStr;

        // Validation Rules
        if (step.type === 'number') {
            const num = parseInt(inputStr.replace(/[^\d]/g, ''), 10);
            if (isNaN(num) || (step.min !== undefined && num < step.min) || (step.max !== undefined && num > step.max)) {
                return {
                    success: false,
                    error: `சரியான தொகையை உள்ளிடவும் (${step.min ? 'குறைந்தது ₹' + step.min : ''}).`,
                    retryPrompt: step.prompt,
                    options: step.options,
                    currentState
                };
            }
            validatedVal = num;
        } else if (step.type === 'aadhaar') {
            const clean = inputStr.replace(/\s+/g, '');
            if (!/^\d{12}$/.test(clean)) {
                return {
                    success: false,
                    error: 'சரியான 12-இலக்க ஆதார் எண்ணை உள்ளிடவும்.',
                    retryPrompt: step.prompt,
                    currentState
                };
            }
            validatedVal = clean;
        } else if (step.type === 'options' && Array.isArray(step.options)) {
            const match = step.options.find(o => o.value === inputStr || o.label === inputStr);
            if (match) {
                validatedVal = match.value;
            }
        }

        // Apply Value to Session Target Field
        if (step.targetField) {
            this._setDeepValue(sessionData, step.targetField, validatedVal);
        }

        const nextStateKey = typeof step.nextState === 'function' ? step.nextState(validatedVal, sessionData) : step.nextState;
        const isCompleted = !nextStateKey || nextStateKey === this.flow.completionState || !this.flow.steps[nextStateKey];

        let nextPrompt = null;
        let nextOptions = null;
        if (!isCompleted && this.flow.steps[nextStateKey]) {
            const nextStep = this.flow.steps[nextStateKey];
            nextPrompt = typeof nextStep.prompt === 'function' ? nextStep.prompt(sessionData) : nextStep.prompt;
            nextOptions = nextStep.options || null;
        }

        return {
            success: true,
            isCompleted,
            currentState: nextStateKey,
            nextPrompt,
            options: nextOptions,
            sessionData,
            extractedValue: validatedVal
        };
    }

    _setDeepValue(obj, path, value) {
        const parts = path.split('.');
        let curr = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i];
            if (!curr[p] || typeof curr[p] !== 'object') curr[p] = {};
            curr = curr[p];
        }
        curr[parts[parts.length - 1]] = value;
    }
}

module.exports = {
    FlowEngine
};
