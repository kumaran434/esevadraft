const fs = require('fs');
const storageService = require('../../services/storage_service');
const { inspectAndExtractDocument } = require('../../../ai_document_extractor');
const { validateUploadedDocument } = require('../../services/document_validator');
const { ensureBilingualPair } = require('../../utils/bilingual_helper');
const { produceCompliantDocument } = require('../../../photo_studio');
const { advanceFlow } = require('./flow');
const { extractIncomeAndProfession } = require('./extractor');
const {
    handleTnegaAadhaarUploadHelper,
    handleTnegaSmartCardUploadHelper,
    handleTnegaPassportPhotoUpload,
    handleCanActionsForCartridge,
    handleMemberSelectForCartridge
} = require('../_tnega_upload_utils');

const persistSessions = (...a) => storageService.persistSessions(...a);

async function handleIntake(ctx, req, res) {
    const { text, uploadedFile, sess } = ctx;
    if (!sess) return false;

    if (await handleCanActionsForCartridge({ ctx, req, res, advanceFlowFn: advanceFlow })) return true;

    if (text && (text.startsWith('SELECT_MEMBER_') || (sess.intakeState === 'INCOME_INTAKE' && sess.citizenProfile?.members?.some(m => (m.nameTam && text.includes(m.nameTam)) || (m.nameEng && text.includes(m.nameEng)))))) {
        if (handleMemberSelectForCartridge({
            ctx, req, res,
            resetIntakeState: 'INCOME_INTAKE',
            advanceFlowFn: advanceFlow,
            bannerSuffix: 'தேர்ந்தெடுக்கப்பட்டார்! அவரது ஆதார் மற்றும் குடும்ப முகவரி விவரங்கள் தானாகப் பொருத்தப்பட்டுவிட்டன.'
        })) return true;
    }

    if (sess.intakeState === 'INCOME_MOTHER_NAME_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const { eng, tam } = ensureBilingualPair(text.trim(), text.trim());
        sess.citizenProfile.motherNameEng = eng;
        sess.citizenProfile.motherNameTam = tam;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ தாயின் பெயர் **${sess.citizenProfile.motherNameTam || sess.citizenProfile.motherNameEng}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'INCOME_COMMUNITY_WAIT' || (text && text.startsWith('COMMUNITY_'))) && text) {
        let comm = 'MBC';
        if (text.includes('MBC') || text === 'COMMUNITY_MBC') comm = 'MBC';
        else if (text.includes('BCM') || text === 'COMMUNITY_BCM') comm = 'BCM';
        else if (text.includes('BC') || text === 'COMMUNITY_BC') comm = 'BC';
        else if (text.includes('SC') || text === 'COMMUNITY_SC') comm = 'SC';
        else if (text.includes('ST') || text === 'COMMUNITY_ST') comm = 'ST';
        else if (text.includes('OC') || text === 'COMMUNITY_OC') comm = 'OC';
        sess.citizenProfile.community = comm;
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ வகுப்பு / பிரிவு **${comm}** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if ((sess.intakeState === 'INCOME_MEMBER_COUNT_WAIT' || (text && /^\d+\s*நபர்/i.test(text.trim()))) && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const countMatch = text.match(/\d+/);
        const count = countMatch ? parseInt(countMatch[0], 10) : (text.includes('1') ? 1 : (text.includes('2') ? 2 : (text.includes('3') ? 3 : (text.includes('4') ? 4 : 1))));
        sess.citizenProfile.familyMemberCount = count;
        if (count === 1) sess.citizenProfile.incomeMembers = [];
        persistSessions();
        const flowStep = advanceFlow(sess, `✅ குடும்ப உறுப்பினர்கள் எண்ணிக்கை **${count} நபர்** எனப் பதிவானது!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'INCOME_SELECT_MEMBERS_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const p = sess.citizenProfile || {};
        const scMembers = Array.isArray(p.smartCardMembers) ? p.smartCardMembers : [];
        if (!Array.isArray(sess.smartCardSelectedIndices)) {
            sess.smartCardSelectedIndices = Array.isArray(p.incomeSelectedIndices) ? [...p.incomeSelectedIndices] : [];
        }

        if (text === 'INC_ADD_NEWBORN') {
            p.incomeSelectedIndices = [...sess.smartCardSelectedIndices];
            sess.intakeState = 'INCOME_EXTRA_NEWBORN_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `👶 **ரேஷன் கார்டில் இல்லாத பிறந்த குழந்தை / கூடுதல் உறுப்பினர் சேர்க்க:**\n\n` +
                      `நபரின் **பெயர் மற்றும் உறவுமுறை** (அல்லது வயது) தட்டச்சு செய்யவும்:\n` +
                      `*(எ.கா: \`மகன் - ஆதித்யா, வயது 1\` அல்லது \`மகள் - தியா, வயது 2\`)*`,
                options: [
                    { label: "👶 ஆண் குழந்தை (வயது 1)", value: "மகன் - பிறந்த குழந்தை, வயது 1" },
                    { label: "👧 பெண் குழந்தை (வயது 1)", value: "மகள் - பிறந்த குழந்தை, வயது 1" },
                    { label: "🔙 உறுப்பினர் பட்டியலுக்குத் திரும்பு", value: "BACK_TO_MEMBER_PICKER" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        if (text === 'INC_SEL_SELF_ONLY') {
            p.familyMemberCount = 1;
            p.incomeMembers = [];
            p.incomeExtraAddedMembers = [];
            p.incomeSelectedIndices = [];
            p.incomeMembersConfirmed = true;
            sess.smartCardSelectedIndices = [];
            persistSessions();
            const flowStep = advanceFlow(sess, `✅ **விண்ணப்பதாரர் மட்டும் (1 நபர்)** தேர்ந்தெடுக்கப்பட்டார்!`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        if (text === 'INC_SEL_ALL') {
            sess.smartCardSelectedIndices = scMembers.map((_, i) => i);
            p.incomeSelectedIndices = [...sess.smartCardSelectedIndices];
        } else if (text.startsWith('INC_TOGGLE_')) {
            const idx = parseInt(text.replace('INC_TOGGLE_', ''), 10);
            if (!Number.isNaN(idx) && idx >= 0 && idx < scMembers.length) {
                const pos = sess.smartCardSelectedIndices.indexOf(idx);
                if (pos === -1) sess.smartCardSelectedIndices.push(idx);
                else sess.smartCardSelectedIndices.splice(pos, 1);
            }
            p.incomeSelectedIndices = [...sess.smartCardSelectedIndices];
            persistSessions();
            const flowStep = advanceFlow(sess);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        } else if (text !== 'INC_MEMBERS_CONFIRMED') {
            const nums = (text.match(/\d+/g) || []).map(n => parseInt(n, 10) - 1).filter(i => i >= 0 && i < scMembers.length);
            if (nums.length > 0) {
                sess.smartCardSelectedIndices = Array.from(new Set(nums));
                p.incomeSelectedIndices = [...sess.smartCardSelectedIndices];
            }
        }

        if (text === 'INC_SEL_ALL' || text === 'INC_MEMBERS_CONFIRMED' || (text.match(/\d+/) && !text.startsWith('INC_TOGGLE_'))) {
            const pickedIndices = Array.isArray(sess.smartCardSelectedIndices) ? sess.smartCardSelectedIndices : [];
            const extraBabies = Array.isArray(p.incomeExtraAddedMembers) ? p.incomeExtraAddedMembers : [];
            const selfNameLow = String(p.fullNameEng || p.fullNameTam || '').trim().toLowerCase();

            const mappedAddl = [];
            pickedIndices.forEach(idx => {
                const m = scMembers[idx];
                if (!m) return;
                const mNameLow = String(m.nameEng || m.nameTam || m.name || '').trim().toLowerCase();
                const mRelLow = String(m.relationship || '').trim().toLowerCase();
                const isSelf = mRelLow === 'self' || mRelLow === 'தலைவர்' || (selfNameLow && mNameLow === selfNameLow);
                if (isSelf) return;
                mappedAddl.push({
                    name: m.nameEng || m.nameTam || m.name || 'உறுப்பினர்',
                    nameEng: m.nameEng || m.name || '',
                    nameTam: m.nameTam || m.nameEng || m.name || '',
                    relationship: m.relationship || 'Family Member',
                    age: m.age ? String(m.age) : '',
                    gender: m.gender || '',
                    profession: '',
                    monthlyIncome: '0',
                    workConfirmed: false
                });
            });
            extraBabies.forEach(eb => {
                mappedAddl.push({ ...eb, workConfirmed: true, monthlyIncome: String(eb.monthlyIncome || '0') });
            });

            p.incomeMembers = mappedAddl;
            p.familyMemberCount = Math.max(1, 1 + mappedAddl.length);
            p.incomeMembersConfirmed = true;
            persistSessions();

            const flowStep = advanceFlow(
                sess,
                `✅ **குடும்ப உறுப்பினர்கள் (${p.familyMemberCount} நபர்கள்) உறுதிப்படுத்தப்பட்டனர்!**\n` +
                (mappedAddl.length > 0 ? `இப்போது ஒவ்வொரு உறுப்பினரின் தொழில் & மாத வருமானத்தை உறுதிப்படுத்துவோம்:` : '')
            );
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (sess.intakeState === 'INCOME_EXTRA_NEWBORN_WAIT' && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const p = sess.citizenProfile || {};
        if (text === 'BACK_TO_MEMBER_PICKER') {
            sess.intakeState = 'INCOME_SELECT_MEMBERS_WAIT';
            persistSessions();
            const flowStep = advanceFlow(sess);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
        const rel = /மகள்|daughter|பெண்/i.test(text) ? 'Daughter' : (/மனைவி|wife/i.test(text) ? 'Wife' : (/கணவர்|husband/i.test(text) ? 'Husband' : 'Son'));
        const dashMatch = text.match(/[-–:]\s*([^\(,0-9]+)/);
        const cleanedName = (dashMatch && dashMatch[1] ? dashMatch[1].trim() : text.replace(/(மகன்|மகள்|குழந்தை|பிறந்த|வயது|age|\d+|,|-)/gi, ' ').trim()) || (rel === 'Daughter' ? 'Baby Girl' : 'Baby Boy');
        const ageMatch = text.match(/\b(\d{1,2})\b/);
        const ageVal = ageMatch ? ageMatch[1] : '1';
        if (!Array.isArray(p.incomeExtraAddedMembers)) p.incomeExtraAddedMembers = [];
        p.incomeExtraAddedMembers.push({
            name: cleanedName, nameEng: cleanedName, nameTam: cleanedName,
            relationship: rel, age: ageVal, profession: 'குழந்தை / வேலை இல்லை', monthlyIncome: '0', workConfirmed: true
        });
        sess.intakeState = 'INCOME_SELECT_MEMBERS_WAIT';
        persistSessions();
        const flowStep = advanceFlow(sess, `👶 **${cleanedName} (${rel}, ${ageVal} வயது)** பட்டியலில் சேர்க்கப்பட்டார்!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'INCOME_SALARY_DOC_OPTIONAL_WAIT') {
        const p = sess.citizenProfile || {};
        if (text === 'TRIGGER_FILE_UPLOAD') {
            sess.chatHistory.push({
                sender: 'bot',
                text: `📤 தயவுசெய்து **சம்பளச் சான்று / Pay Slip** ஆவணத்தைப் பதிவேற்றவும் (<200KB அளவிற்கு தானாகச் சுருக்கப்படும்):`,
                actionRequired: 'upload',
                uploadPrompt: 'சம்பளச் சான்று பதிவேற்றுக'
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
        if (uploadedFile) {
            let extracted = null;
            try { extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }); } catch (_) {}
            const validation = validateUploadedDocument('incomeProof', extracted);
            if (!validation.valid) {
                try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "📷 சம்பளச் சான்று பதிவேற்றுக (Upload Salary Cert)", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "⏭️ தேவையில்லை / சுய அறிவிப்பு போதும்", value: "SKIP_SALARY_PROOF" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }
            const compliantProof = await produceCompliantDocument(uploadedFile.path, { service: 'TNEGA_INCOME', portal: 'TNEGA' });
            p.incomeProof = compliantProof;
            p.salaryCertificatePath = compliantProof;
            p.salaryCertificate = compliantProof;
            p.salaryProofPrompted = true;
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.incomeProof = compliantProof;
            if (!p.documents) p.documents = {};
            p.documents.incomeProof = compliantProof;
            persistSessions();
            const flowStep = advanceFlow(sess, `✅ **சம்பளச் சான்று (<200KB PDF) வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
        if (text === 'SKIP_SALARY_PROOF' || /தேவையில்லை|சுய அறிவிப்பு|skip/i.test(text || '')) {
            p.salaryProofPrompted = true;
            if (!p.incomeProof) p.incomeProof = 'SELF_DECLARATION';
            if (!p.salaryCertificatePath) p.salaryCertificatePath = 'SELF_DECLARATION';
            persistSessions();
            const flowStep = advanceFlow(sess, `✅ **சுய அறிவிப்புடன்** தொடரலாம்!`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if ((sess.intakeState === 'INCOME_ADDITIONAL_MEMBER_WAIT' || sess.intakeState === 'INCOME_ADDITIONAL_MEMBER_WORK_WAIT') && text && !text.startsWith('TRIGGER_') && !text.startsWith('START_') && !text.startsWith('CAN_')) {
        const p = sess.citizenProfile;

        if (sess.intakeState === 'INCOME_ADDITIONAL_MEMBER_WORK_WAIT' && (typeof sess.pendingIncomeMemberIndex === 'number' || sess.pendingIncomeMember)) {
            const incParsed = extractIncomeAndProfession(text) || {};
            let prof = incParsed.profession || '';
            if (!prof) {
                if (/இல்லத்தரசி|வீட்டு|house|dependent|வேலை இல்லை|no work/i.test(text)) prof = 'குடும்பத் தலைவி / இல்லத்தரசி';
                else if (/மாணவ|student|பள்ளி|கல்லூரி|குழந்தை/i.test(text)) prof = 'மாணவர்';
                else if (/அரசு|govt/i.test(text)) prof = 'அரசு வேலை';
                else prof = text.replace(/\d+|₹|,|மாதம்|ஆண்டு|ரூ/g, '').trim() || 'கூலி வேலை';
            }
            const monMatch = text.replace(/,/g, '').match(/\b\d{1,6}\b/);
            const monInc = /வருமானம் இல்லை|இல்லத்தரசி|மாணவர்|குழந்தை|₹0|\b0\b/i.test(text)
                ? '0'
                : String(incParsed.monthlyIncome || (monMatch ? parseInt(monMatch[0], 10) : 0));

            if (!p.incomeMembers) p.incomeMembers = [];
            let finalMem = null;
            if (typeof sess.pendingIncomeMemberIndex === 'number' && p.incomeMembers[sess.pendingIncomeMemberIndex]) {
                p.incomeMembers[sess.pendingIncomeMemberIndex] = { ...p.incomeMembers[sess.pendingIncomeMemberIndex], profession: prof, monthlyIncome: monInc, workConfirmed: true };
                finalMem = p.incomeMembers[sess.pendingIncomeMemberIndex];
                delete sess.pendingIncomeMemberIndex;
            } else {
                const pending = sess.pendingIncomeMember;
                finalMem = { ...pending, profession: prof, monthlyIncome: monInc, workConfirmed: true };
                p.incomeMembers.push(finalMem);
                delete sess.pendingIncomeMember;
            }

            const curSelfMon = parseInt(String(p.monthlyIncome || 0), 10) || 0;
            const memSum = p.incomeMembers.reduce((s, m) => s + (parseInt(String(m.monthlyIncome || 0), 10) || 0), 0);
            if (curSelfMon + memSum > 0) p.annualIncome = String((curSelfMon + memSum) * 12);
            persistSessions();

            const flowStep = advanceFlow(sess, `✅ உறுப்பினர் **${finalMem.nameTam || finalMem.name} (${finalMem.relationship} - ${finalMem.profession}, மாதம் ₹${monInc})** சேர்க்கப்பட்டார்!`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        let memberRel = '';
        let memberName = '';
        const lowerT = text.toLowerCase();
        if (/கணவர்|husband/i.test(lowerT)) {
            memberRel = 'Husband';
            memberName = p.spouseNameTam || p.spouseNameEng || (p.relationship === 'Husband' ? (p.fatherNameTam || p.fatherNameEng || '') : '');
        } else if (/மனைவி|wife/i.test(lowerT)) memberRel = 'Wife';
        else if (/மாமியார்|mother-in-law/i.test(lowerT)) memberRel = 'Mother-in-law';
        else if (/மாமனார்|father-in-law/i.test(lowerT)) memberRel = 'Father-in-law';
        else if (/மகள்|daughter/i.test(lowerT)) memberRel = 'Daughter';
        else if (/மகன்|son/i.test(lowerT)) memberRel = 'Son';
        else if (/சகோதரி|sister/i.test(lowerT)) memberRel = 'Sister';
        else if (/சகோதரர்|brother/i.test(lowerT)) memberRel = 'Brother';
        else if (/தாய்|mother|அம்மா/i.test(lowerT)) { memberRel = 'Mother'; memberName = p.motherNameTam || p.motherNameEng || ''; }
        else if (/தந்தை|father|அப்பா/i.test(lowerT)) { memberRel = 'Father'; memberName = (p.relationship !== 'Husband') ? (p.fatherNameTam || p.fatherNameEng || '') : ''; }
        else memberRel = (p.relationship === 'Husband' ? 'Husband' : 'Son');

        const dashMatch = text.match(/[-–:]\s*([^\(,0-9]+)/);
        if (dashMatch && dashMatch[1] && dashMatch[1].trim().length >= 2) {
            memberName = dashMatch[1].trim();
        } else if (!memberName && !/^(கணவர்|மனைவி|மகன்|மகள்|தாய்|தந்தை|மாமியார்|மாமனார்|Husband|Wife|Son|Daughter|Mother|Father)$/i.test(text.trim())) {
            memberName = text.replace(/(கணவர்|மனைவி|மகன்|மகள்|தாய்|தந்தை|மாமியார்|மாமனார்|வயது|\d+|கூலி வேலை|விவசாயம்|தனியார் வேலை|குடும்பத் தலைவி|மாதம்|₹|,|-)/gi, ' ').trim();
        }
        if (!memberName) memberName = memberRel;

        const ageMatch = text.match(/(?:வயது|age)?\s*(\d{2})\b/i);
        const memberAge = ageMatch ? ageMatch[1] : '';

        const incParsed = extractIncomeAndProfession(text);
        const hasExplicitWork = Boolean(incParsed && (incParsed.profession || incParsed.monthlyIncome !== null)) || /இல்லத்தரசி|தலைவி|மாணவ|வேலை|விவசாய|கூலி|தனியார்|வியாபார|அரசு|₹0|\b0\b/i.test(text);

        if (!hasExplicitWork) {
            sess.pendingIncomeMember = { name: memberName, nameEng: memberName, nameTam: memberName, relationship: memberRel, age: memberAge };
            sess.intakeState = 'INCOME_ADDITIONAL_MEMBER_WORK_WAIT';
            persistSessions();
            sess.chatHistory.push({
                sender: 'bot',
                text: `💼 **${memberName} (${memberRel})** என்ன வேலை செய்கிறார் மற்றும் மாத வருமானம் எவ்வளவு?\n*(கீழே தேர்ந்தெடுக்கவும் அல்லது தட்டச்சு செய்யவும் — எ.கா: \`கூலி வேலை, மாதம் 6000\`)*`,
                options: [
                    { label: "🔨 கூலி வேலை (மாதம் ₹6,000)", value: "கூலி வேலை மாதம் 6000" },
                    { label: "🌾 விவசாயம் (மாதம் ₹6,000)", value: "விவசாயம் மாதம் 6000" },
                    { label: "🏢 தனியார் வேலை (மாதம் ₹8,000)", value: "தனியார் வேலை மாதம் 8000" },
                    { label: "🏠 இல்லத்தரசி / வருமானம் இல்லை (₹0)", value: "இல்லத்தரசி ₹0" },
                    { label: "🎓 மாணவர் / வேலை இல்லை (₹0)", value: "மாணவர் ₹0" }
                ]
            });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        let memberProf = (incParsed && incParsed.profession) || (/இல்லத்தரசி|தலைவி/i.test(text) ? 'குடும்பத் தலைவி' : (/மாணவ/i.test(text) ? 'மாணவர்' : 'கூலி வேலை'));
        const monMatch = text.replace(/,/g, '').match(/மாதம்\s*₹?\s*(\d{1,6})|₹\s*(\d{1,6})/i);
        const memberMon = (incParsed && incParsed.monthlyIncome) ? String(incParsed.monthlyIncome) : (monMatch ? (monMatch[1] || monMatch[2]) : '0');

        if (!sess.citizenProfile.incomeMembers) sess.citizenProfile.incomeMembers = [];
        sess.citizenProfile.incomeMembers.push({
            name: memberName, nameEng: memberName, nameTam: memberName,
            relationship: memberRel, age: memberAge, profession: memberProf, monthlyIncome: memberMon
        });
        persistSessions();

        const flowStep = advanceFlow(sess, `✅ கூடுதல் குடும்ப உறுப்பினர் **${memberName} (${memberRel} - ${memberProf}, மாதம் ₹${memberMon})** சேர்க்கப்பட்டார்!`);
        sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
        res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
        return true;
    }

    if (sess.intakeState === 'INCOME_PROOF_WAIT') {
        if (uploadedFile) {
            let extracted = null;
            try { extracted = await inspectAndExtractDocument(uploadedFile.path, { isTnega: true }); } catch (_) {}

            const validation = validateUploadedDocument('incomeProof', extracted);
            if (!validation.valid) {
                try { if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path); } catch (_) {}
                delete sess.citizenProfile.incomeProof;
                delete sess.citizenProfile.salaryCertificatePath;
                if (sess.tempUploads) delete sess.tempUploads.incomeProof;
                if (sess.citizenProfile.documents) delete sess.citizenProfile.documents.incomeProof;
                persistSessions();

                sess.chatHistory.push({
                    sender: 'bot',
                    text: validation.errorTamil,
                    options: [
                        { label: "🌾 விவசாயி (Farmer - மாதம் ₹6,000 / ஆண்டு ₹72,000)", value: "INCOME_DECL_FARMER_6000" },
                        { label: "🔨 கூலி வேலை (Daily Wage - மாதம் ₹6,000 / ஆண்டு ₹72,000)", value: "INCOME_DECL_COOLIE_6000" },
                        { label: "📷 சம்பளச் சான்று / Pay Slip பதிவேற்றுக", value: "TRIGGER_FILE_UPLOAD" },
                        { label: "✏️ படிவத்தில் உள்ளிட (Open Form)", value: "TRIGGER_EDIT_MODAL" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }

            const compliantProof = await produceCompliantDocument(uploadedFile.path, { service: 'TNEGA_INCOME', portal: 'TNEGA' });
            sess.citizenProfile.incomeProof = compliantProof;
            sess.citizenProfile.salaryCertificatePath = compliantProof;
            if (!sess.tempUploads) sess.tempUploads = {};
            sess.tempUploads.incomeProof = compliantProof;
            if (!sess.citizenProfile.documents) sess.citizenProfile.documents = {};
            sess.citizenProfile.documents.incomeProof = compliantProof;
            persistSessions();

            const flowStep = advanceFlow(sess, `✅ **வருமான ஆதாரம் / சம்பளச் சான்று வெற்றிகரமாகப் பெறப்பட்டது!** 🛡️`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }

        if (text && !text.startsWith('TRIGGER_')) {
            let prof = null, mInc = null, aInc = null;
            if (text === 'INCOME_DECL_FARMER_6000') { prof = 'விவசாயம்'; mInc = 6000; aInc = 72000; }
            else if (text === 'INCOME_DECL_COOLIE_6000') { prof = 'கூலி வேலை'; mInc = 6000; aInc = 72000; }
            else if (text === 'INCOME_DECL_BIZ_7000') { prof = 'சிறு வணிகம் / வியாபாரம்'; mInc = 7000; aInc = 84000; }
            else if (text === 'INCOME_DECL_PVT_8000') { prof = 'தனியார் வேலை'; mInc = 8000; aInc = 96000; }
            else {
                const parsed = extractIncomeAndProfession(text);
                if (parsed) { prof = parsed.profession; mInc = parsed.monthlyIncome; aInc = parsed.annualIncome; }
            }

            if (prof && aInc) {
                sess.citizenProfile.profession = prof;
                sess.citizenProfile.monthlyIncome = mInc;
                sess.citizenProfile.annualIncome = String(aInc);
                sess.citizenProfile.incomeProof = 'SELF_DECLARATION';
                sess.citizenProfile.incomeProofType = 'SELF_DECLARATION';
                sess.citizenProfile.salaryCertificate = 'SELF_DECLARATION';
                sess.citizenProfile.salaryCertificatePath = 'SELF_DECLARATION';
                persistSessions();

                const flowStep = advanceFlow(sess, `✅ தொழில்: **${prof}** | மாத வருமானம்: **₹${Number(mInc).toLocaleString('en-IN')}** (ஆண்டு வருமானம்: **₹${Number(aInc).toLocaleString('en-IN')}** - சுய அறிவிப்பு) வெற்றிகரமாகப் பதிவானது! 🛡️`);
                sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            } else if (prof && !aInc) {
                sess.citizenProfile.profession = prof;
                sess.intakeState = 'INCOME_MONTHLY_WAIT';
                persistSessions();
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `🌾 தொழில்: **${prof}** எனப் பதிவானது!\n\n${prof} தொழிலில் தோராயமான **மாத வருமானம்** எவ்வளவு? கீழே தேர்ந்தெடுக்கவும் அல்லது தொகையை உள்ளிடவும்:`,
                    options: [
                        { label: "₹5,000 / மாதம் (ஆண்டுக்கு ₹60,000)", value: "INCOME_AMOUNT_5000" },
                        { label: "🌾 ₹6,000 / மாதம் (ஆண்டுக்கு ₹72,000)", value: "INCOME_AMOUNT_6000" },
                        { label: "₹7,000 / மாதம் (ஆண்டுக்கு ₹84,000)", value: "INCOME_AMOUNT_7000" },
                        { label: "₹8,000 / மாதம் (ஆண்டுக்கு ₹96,000)", value: "INCOME_AMOUNT_8000" },
                        { label: "₹10,000 / மாதம் (ஆண்டுக்கு ₹1,20,000)", value: "INCOME_AMOUNT_10000" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            } else if (!prof && aInc) {
                sess.citizenProfile.monthlyIncome = mInc;
                sess.citizenProfile.annualIncome = String(aInc);
                sess.intakeState = 'INCOME_PROFESSION_WAIT';
                persistSessions();
                sess.chatHistory.push({
                    sender: 'bot',
                    text: `💰 மாத வருமானம்: **₹${Number(mInc).toLocaleString('en-IN')}** (ஆண்டு: **₹${Number(aInc).toLocaleString('en-IN')}**) எனப் பதிவானது!\n\nவிண்ணப்பதாரரின் **தொழில் (Occupation)** என்ன? கீழே உள்ள தொழிலைத் தேர்ந்தெடுக்கவும்:`,
                    options: [
                        { label: "🌾 விவசாயி (Farmer / Agriculture)", value: "INCOME_PROF_FARMER" },
                        { label: "🔨 கூலி வேலை (Daily Wage / Coolie)", value: "INCOME_PROF_COOLIE" },
                        { label: "🏪 சிறு வணிகம் / வியாபாரம் (Small Business)", value: "INCOME_PROF_BIZ" },
                        { label: "🏢 தனியார் வேலை (Private Sector)", value: "INCOME_PROF_PVT" }
                    ]
                });
                res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
                return true;
            }
        }
    }

    if (sess.intakeState === 'INCOME_MONTHLY_WAIT' && text && !text.startsWith('TRIGGER_')) {
        let mInc = null, aInc = null;
        if (text === 'INCOME_AMOUNT_5000') { mInc = 5000; aInc = 60000; }
        else if (text === 'INCOME_AMOUNT_6000') { mInc = 6000; aInc = 72000; }
        else if (text === 'INCOME_AMOUNT_7000') { mInc = 7000; aInc = 84000; }
        else if (text === 'INCOME_AMOUNT_8000') { mInc = 8000; aInc = 96000; }
        else if (text === 'INCOME_AMOUNT_10000') { mInc = 10000; aInc = 120000; }
        else {
            const parsed = extractIncomeAndProfession(text);
            if (parsed && parsed.annualIncome) { mInc = parsed.monthlyIncome; aInc = parsed.annualIncome; }
        }
        if (aInc) {
            sess.citizenProfile.monthlyIncome = mInc;
            sess.citizenProfile.annualIncome = String(aInc);
            sess.citizenProfile.incomeProof = 'SELF_DECLARATION';
            sess.citizenProfile.incomeProofType = 'SELF_DECLARATION';
            sess.citizenProfile.salaryCertificate = 'SELF_DECLARATION';
            sess.citizenProfile.salaryCertificatePath = 'SELF_DECLARATION';
            persistSessions();
            const prof = sess.citizenProfile.profession || 'விவசாயம்';
            const flowStep = advanceFlow(sess, `✅ தொழில்: **${prof}** | மாத வருமானம்: **₹${Number(mInc).toLocaleString('en-IN')}** (ஆண்டு வருமானம்: **₹${Number(aInc).toLocaleString('en-IN')}** - சுய அறிவிப்பு) வெற்றிகரமாகப் பதிவானது! 🛡️`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (sess.intakeState === 'INCOME_PROFESSION_WAIT' && text && !text.startsWith('TRIGGER_')) {
        let prof = null;
        if (text === 'INCOME_PROF_FARMER' || text.includes('விவசாய')) prof = 'விவசாயம்';
        else if (text === 'INCOME_PROF_COOLIE' || text.includes('கூலி')) prof = 'கூலி வேலை';
        else if (text === 'INCOME_PROF_BIZ' || text.includes('வியாபார')) prof = 'சிறு வணிகம் / வியாபாரம்';
        else if (text === 'INCOME_PROF_PVT' || text.includes('தனியார்')) prof = 'தனியார் வேலை';
        else {
            const parsed = extractIncomeAndProfession(text);
            prof = (parsed && parsed.profession) ? parsed.profession : text.trim();
        }
        if (prof) {
            sess.citizenProfile.profession = prof;
            sess.citizenProfile.incomeProof = 'SELF_DECLARATION';
            sess.citizenProfile.incomeProofType = 'SELF_DECLARATION';
            sess.citizenProfile.salaryCertificate = 'SELF_DECLARATION';
            sess.citizenProfile.salaryCertificatePath = 'SELF_DECLARATION';
            persistSessions();
            const mInc = sess.citizenProfile.monthlyIncome || 6000;
            const aInc = sess.citizenProfile.annualIncome || 72000;
            const flowStep = advanceFlow(sess, `✅ தொழில்: **${prof}** | மாத வருமானம்: **₹${Number(mInc).toLocaleString('en-IN')}** (ஆண்டு வருமானம்: **₹${Number(aInc).toLocaleString('en-IN')}** - சுய அறிவிப்பு) வெற்றிகரமாகப் பதிவானது! 🛡️`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    if (sess.intakeState === 'INCOME_SMARTCARD_WAIT' || sess.intakeState === 'INCOME_SMARTCARD_BACK_WAIT') {
        const handled = await handleTnegaSmartCardUploadHelper({
            ctx, req, res,
            backWaitState: 'INCOME_SMARTCARD_BACK_WAIT',
            advanceFlowFn: advanceFlow
        });
        if (handled !== null) return handled;
    }

    if (await handleTnegaPassportPhotoUpload({
        ctx, req, res,
        photoWaitState: 'INCOME_PHOTO_WAIT',
        advanceFlowFn: advanceFlow,
        bannerText: `✨ **ஏஐ போட்டோ ஸ்டுடியோ:** விண்ணப்பதாரர் பாஸ்போர்ட் புகைப்படம் அரசு விதிகளுக்கு ஏற்ப (<50KB) தயார் செய்யப்பட்டு சேமிக்கப்பட்டது! 📸`
    })) return true;

    if (sess.intakeState === 'INCOME_INTAKE' || sess.intakeState === 'INCOME_AADHAAR_WAIT' || sess.intakeState === 'INCOME_AADHAAR_BACK_WAIT') {
        if (uploadedFile || sess.intakeState === 'INCOME_AADHAAR_BACK_WAIT') {
            const handled = await handleTnegaAadhaarUploadHelper({
                ctx, req, res,
                backWaitState: 'INCOME_AADHAAR_BACK_WAIT',
                advanceFlowFn: advanceFlow
            });
            if (handled) return true;
        }

        const cleanDigits = (text || '').replace(/[,₹\s]/g, '');
        const hasIncomeNum = cleanDigits.match(/\d{4,7}/);
        if (hasIncomeNum) {
            const val = parseInt(hasIncomeNum[0], 10);
            if (val <= 25000) {
                sess.citizenProfile.monthlyIncome = val;
                sess.citizenProfile.annualIncome = String(val * 12);
            } else {
                sess.citizenProfile.annualIncome = String(val);
                sess.citizenProfile.monthlyIncome = Math.round(val / 12);
            }
            if (!sess.citizenProfile.incomeProof) {
                sess.citizenProfile.incomeProof = 'SELF_DECLARATION';
                sess.citizenProfile.incomeProofType = 'SELF_DECLARATION';
            }
            persistSessions();
            const flowStep = advanceFlow(sess, `✅ குடும்ப ஆண்டு வருமானம் **₹${Number(sess.citizenProfile.annualIncome).toLocaleString('en-IN')}** எனப் பதிவானது!`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        } else if (text && (text.includes('வேலை') || text.includes('தொழில்') || text.includes('விவசாயம்') || text.includes('விவசாயி') || text.includes('வியாபாரம்') || text.includes('கூலி') || text.includes('Private') || text.includes('Business'))) {
            let prof = text.trim();
            if (prof.includes('விவசாய')) prof = 'விவசாயம்';
            else if (prof.includes('கூலி')) prof = 'கூலி வேலை';
            else if (prof.includes('வியாபார')) prof = 'சிறு வணிகம் / வியாபாரம்';
            else if (prof.includes('தனியார்')) prof = 'தனியார் வேலை';
            sess.citizenProfile.profession = prof;
            if (!sess.citizenProfile.incomeProof) {
                sess.citizenProfile.incomeProof = 'SELF_DECLARATION';
                sess.citizenProfile.incomeProofType = 'SELF_DECLARATION';
            }
            persistSessions();
            const flowStep = advanceFlow(sess, `✅ தொழில்: **${prof}** எனப் பதிவானது!`);
            sess.chatHistory.push({ sender: 'bot', text: flowStep.text, options: flowStep.options });
            res.json({ chatHistory: sess.chatHistory, citizenProfile: sess.citizenProfile, step: sess.intakeState, intakeState: sess.intakeState });
            return true;
        }
    }

    return false;
}

module.exports = { handleIntake };
