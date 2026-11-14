const { saveCitizenProfile } = require('../../../database');
const { saveCitizenDraft } = require('../../../firestore_db');
const { saveStepCheckpoint, clearStepCheckpoint } = require('../../services/automation_checkpoint_service');
const storageService = require('../../services/storage_service');
const { persistSessions } = storageService;

function runAutomationTask(runner, flowProfile, targetSess, targetMob, isMockTest, isAddMemberAction, isChangeAddressAction, req) {
    runner(
        flowProfile,
        (progressMsg) => {
            const stepMatch = progressMsg.match(/\[படி\s*(\d+)\s*\/\s*(\d+)\]/);
            if (stepMatch && targetSess) {
                targetSess.automationStep = parseInt(stepMatch[1]);
                targetSess.automationTotal = parseInt(stepMatch[2]);
                saveStepCheckpoint(targetMob, flowProfile.subService || 'new_ration_card', stepMatch[1], progressMsg);
            }
            if (targetSess) {
                targetSess.automationCurrentStepMsg = progressMsg;
            }
            const isMilestone = progressMsg.includes('OTP') ||
                progressMsg.includes('ஒப்புதல்') ||
                progressMsg.includes('சரிபார்ப்பு') ||
                progressMsg.includes('பதிவு எண்') ||
                progressMsg.includes('நிறுத்தப்பட்டது') ||
                progressMsg.includes('வெற்றிகரமாக') ||
                progressMsg.includes('பிழை') ||
                progressMsg.includes('human') ||
                progressMsg.includes('Human');
            if (isMilestone && targetSess && targetSess.chatHistory) {
                const lastMsg = targetSess.chatHistory[targetSess.chatHistory.length - 1];
                if (!lastMsg || lastMsg.text !== progressMsg) {
                    targetSess.chatHistory.push({
                        sender: 'bot',
                        text: progressMsg
                    });
                }
            }
        },
        { 
            isMockSandbox: isMockTest, 
            fastTest: (req.headers['x-operator-uid'] === 'test_suite_operator_uid' || req.body?.fastTest === true || process.env.NODE_ENV === 'test' || process.env.REGRESSION_TEST === 'true'), 
            draftData: targetSess, 
            subServiceData: targetSess.subServiceData, 
            keepBrowserOpen: isMockTest,
            operatorUid: targetSess.operatorUid || req.headers['x-operator-uid'] || req.body?.operatorUid || targetSess.citizenProfile?.operatorUid || '',
            operatorName: targetSess.operatorName || req.body?.operatorName || (req.headers['x-user-role'] === 'admin' ? 'admin' : (req.headers['x-operator-name'] || 'admin')),
            automationName: isAddMemberAction ? 'add_member' : (isChangeAddressAction ? 'change_address' : (flowProfile?.subService || 'new_ration_card'))
        }
    ).then((result) => {
        if (!targetSess) return;
        if (result && result.success) {
            clearStepCheckpoint(targetMob, flowProfile.subService || 'new_ration_card');
            if (result.canNumber || result.isTnegaCan) {
                if (result.canNumber && targetSess.citizenProfile) {
                    targetSess.citizenProfile.canNumber = result.canNumber;
                    saveCitizenProfile(targetMob, targetSess.citizenProfile);
                }
                saveCitizenDraft(targetMob, {
                    operatorUid: targetSess.operatorUid || null,
                    citizenProfile: targetSess.citizenProfile,
                    canNumber: result.canNumber || targetSess.citizenProfile?.canNumber || null,
                    intakeState: targetSess.intakeState,
                    step: targetSess.step,
                    chatHistory: targetSess.chatHistory,
                    documents: targetSess.tempUploads || {}
                }).catch(() => {});
                if (targetSess.chatHistory && result.message) {
                    targetSess.chatHistory.push({
                        sender: 'bot',
                        text: result.message,
                        options: result.canNumber ? [
                            { label: "📜 வருமானச் சான்றிதழ் விண்ணப்பி (Apply Income Certificate)", value: "வருமானச் சான்றிதழ்" }
                        ] : [
                            { label: "📝 புதிய CAN பதிவு செய் (Register New CAN)", value: "CAN_REGISTER_PROMPT" }
                        ]
                    });
                }
            } else if (result.applicationNumber) {
                targetSess.applicationNumber = result.applicationNumber;
                targetSess.applicationPdfUrl = result.applicationPdfUrl;
                if (targetSess.citizenProfile) {
                    targetSess.citizenProfile.applicationNumber = result.applicationNumber;
                    targetSess.citizenProfile.applicationPdfUrl = result.applicationPdfUrl;
                    targetSess.citizenProfile.submittedAt = new Date().toISOString();
                    saveCitizenProfile(targetMob, targetSess.citizenProfile);
                }
                targetSess.step = 'submitted';
                targetSess.intakeState = 'submitted';
                saveCitizenDraft(targetMob, {
                    operatorUid: targetSess.operatorUid || null,
                    citizenProfile: targetSess.citizenProfile,
                    intakeState: 'submitted',
                    step: 'submitted',
                    applicationNumber: targetSess.applicationNumber,
                    applicationPdfUrl: targetSess.applicationPdfUrl,
                    chatHistory: targetSess.chatHistory,
                    documents: targetSess.tempUploads || {}
                }).catch(() => {});
                if (targetSess.chatHistory) {
                    targetSess.chatHistory.push({
                        sender: 'bot',
                        text: result.message,
                        applicationNumber: result.applicationNumber,
                        applicationPdfUrl: result.applicationPdfUrl
                    });
                }
            } else {
                if (targetSess.chatHistory) {
                    targetSess.chatHistory.push({
                        sender: 'bot',
                        text: `🎉 **${targetSess.citizenProfile?.fullNameEng || 'விண்ணப்பதாரர்'} அவர்களின் ரேஷன் கார்டு விண்ணப்ப முன்னோட்டம் தயார்!**\n\nஅனைத்து விவரங்களையும் சரிபார்த்துவிட்டு கீழே உள்ள **விண்ணப்பத்தைச் சமர்ப்பி** பொத்தானை அழுத்தவும்.`,
                        previewImage: result.previewUrl,
                        showConfirmButtons: true
                    });
                }
                targetSess.step = 'preview_ready';
            }
        } else if (result && !result.success) {
            if (targetSess.chatHistory) {
                targetSess.chatHistory.push({
                    sender: 'bot',
                    text: `⚠️ ஆட்டோமேஷன் நிறுத்தம்: ${result.message || 'செயல்முறை இடைநிறுத்தப்பட்டது.'}`
                });
            }
        }
        if (targetSess) {
            targetSess.isAutomating = false;
            targetSess.isAutomationRunning = false;
            targetSess.automationStep = 0;
        }
        persistSessions();
    }).catch((err) => {
        if (targetSess) {
            targetSess.isAutomating = false;
            targetSess.isAutomationRunning = false;
            targetSess.automationStep = 0;
            if (targetSess.chatHistory) {
                targetSess.chatHistory.push({
                    sender: 'bot',
                    text: `⚠️ ஆட்டோமேஷன் பிழை: ${err.message}`
                });
            }
        }
        persistSessions();
    });
}

module.exports = {
    runAutomationTask
};
