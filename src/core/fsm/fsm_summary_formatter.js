/**
 * eSevaDraft FSM Application Ready Summary Formatter
 */

function renderSubserviceReadySummary(sess) {
    const subService = sess.subService || 'RATION_SERVICE';
    let svcNameTam = 'குடும்ப அட்டை சேவை';
    let detailsList = '';

    if (subService === 'NEW_CARD' || subService === 'NEW_RATION_CARD') {
        svcNameTam = 'புதிய குடும்ப அட்டை (New Smart Card)';
        const headName = sess.citizenProfile?.fullNameTam || sess.citizenProfile?.fullNameEng || 'குடும்பத் தலைவர்';
        const memberCount = (sess.citizenProfile?.members && sess.citizenProfile.members.length > 0) ? sess.citizenProfile.members.length : 1;
        const addrParts = [sess.citizenProfile?.doorNo, sess.citizenProfile?.streetTam || sess.citizenProfile?.streetEng, sess.citizenProfile?.taluk, sess.citizenProfile?.district].filter(Boolean);
        const address = addrParts.join(', ') || 'சரிபார்க்கப்பட்ட முகவரி';
        detailsList = `• 👤 **குடும்பத் தலைவர்:** ${headName}\n` +
                      `• 👥 **மொத்த உறுப்பினர்கள்:** ${memberCount} நபர்(கள்)\n` +
                      `• 🏠 **முகவரி:** ${address}\n` +
                      `• 📄 **இணைக்கப்பட்ட ஆவணங்கள்:** புகைப்படம், ஆதார் மற்றும் முகவரிச் சான்று ✅\n`;
    } else if (subService === 'ADD_MEMBER') {
        const list = Array.isArray(sess.subServiceData?.addMembersList) && sess.subServiceData.addMembersList.length > 0
            ? sess.subServiceData.addMembersList
            : null;
        if (list && list.length > 1) {
            svcNameTam = `குடும்ப உறுப்பினர் சேர்க்கை (${list.length} நபர்கள்)`;
            detailsList = list.map((m, i) => {
                const n = m.memberNameTam ? (m.memberNameEng ? `${m.memberNameTam} (${m.memberNameEng})` : m.memberNameTam) : (m.memberName || '—');
                const aStr = m.aadhaarNo ? ` | ஆதார்: ${String(m.aadhaarNo).replace(/(\d{4})/g, '$1 ').trim()}` : '';
                return `• 👤 **${i + 1}. ${n}** (${m.relationshipTam || 'உறுப்பினர்'})${aStr} ✅`;
            }).join('\n') + `\n• 📄 **இணைக்கப்பட்ட ஆவணம்:** ஆதார் அட்டை (Aadhaar Card) ✅\n`;
        } else {
            const isChild = sess.subServiceData?.isChild;
            svcNameTam = isChild ? 'குடும்ப உறுப்பினர் சேர்க்கை (குழந்தை)' : 'குடும்ப உறுப்பினர் சேர்க்கை';
            const rel = sess.subServiceData?.relationshipTam || 'உறுப்பினர்';
            const name = sess.subServiceData?.memberNameTam || sess.subServiceData?.memberName || sess.subServiceData?.memberNameEng || (sess.tempMember && (sess.tempMember.nameTam || sess.tempMember.nameEng)) || '—';
            let memberExtra = '';
            if (sess.subServiceData?.aadhaarNo) {
                memberExtra += `• 🪪 **ஆதார் எண்:** ${(sess.subServiceData.aadhaarNo || '').replace(/(\d{4})/g, '$1 ').trim()} ✅\n`;
            }
            if (sess.subServiceData?.dob) {
                memberExtra += `• 📅 **பிறந்த தேதி:** ${sess.subServiceData.dob}\n`;
            }
            detailsList = `• 👤 **சேர்க்கப்படும் நபர்:** ${name} (${rel})\n` +
                          memberExtra +
                          `• 📄 **இணைக்கப்பட்ட ஆவணம்:** ஆதார் அட்டை (Aadhaar Card) ✅\n`;
        }
    } else if (subService === 'REMOVE_MEMBER') {
        svcNameTam = 'குடும்ப உறுப்பினர் நீக்கம்';
        const reason = sess.subServiceData?.reason || 'இறப்பு / திருமணம்';
        const name = sess.subServiceData?.memberNameTam ? (sess.subServiceData?.memberNameEng ? `${sess.subServiceData.memberNameTam} (${sess.subServiceData.memberNameEng})` : sess.subServiceData.memberNameTam) : (sess.subServiceData?.memberName || 'கார்டில் உள்ள உறுப்பினர்');
        const docName = sess.subServiceData?.docType || 'சான்றிதழ் ஆவணம்';
        detailsList = `• 👤 **நீக்கப்படும் நபர்:** ${name}\n` +
                      `• 📋 **காரணம்:** ${reason}\n` +
                      `• 📄 **இணைக்கப்பட்ட சான்று:** ${docName} சரிபார்க்கப்பட்டது ✅\n`;
    } else if (subService === 'CHANGE_HEAD') {
        svcNameTam = 'குடும்பத் தலைவர் மாற்றம்';
        const reason = sess.subServiceData?.reason || 'குடும்ப விருப்பம்';
        const newHead = sess.subServiceData?.newHeadNameTam || sess.subServiceData?.newHeadName || 'சரிபார்க்கப்பட்ட உறுப்பினர்';
        detailsList = `• 👤 **புதிய குடும்பத் தலைவர்:** ${newHead}\n` +
                      `• 📋 **காரணம்:** ${reason}\n` +
                      `• 📄 **ஆவணம்:** புதிய தலைவர் ஆதார் / சான்று ✅\n`;
    } else if (subService === 'CHANGE_ADDRESS') {
        svcNameTam = 'முகவரி மாற்றம்';
        const proof = sess.subServiceData?.proofType || 'மின் கட்டண ரசீது (EB Bill)';
        const sData = sess.subServiceData || {};
        const addrLine = [sData.doorNo, sData.streetTam || sData.streetEng, sData.village || sData.areaTam, sData.taluk, sData.district, sData.pincode].filter(Boolean).join(', ');
        detailsList = `• 🏠 **சேவை:** புதிய முகவரி மாற்றம்\n` +
                      (addrLine ? `• 📍 **புதிய முகவரி:** ${addrLine}\n` : '') +
                      `• 📄 **முகவரிச் சான்று:** ${proof} ✅\n`;
    } else if (subService === 'CHANGE_CARD_TYPE') {
        svcNameTam = 'குடும்ப அட்டை வகை மாற்றம்';
        const cardType = sess.subServiceData?.cardType || 'அரிசி அட்டை (Rice Card)';
        detailsList = `• 📇 **புதிய அட்டை வகை:** ${cardType}\n` +
                      `• 📄 **சுய உறுதிமொழி:** பெறப்பட்டது ✅\n`;
    } else if (subService === 'UPDATE_MOBILE') {
        svcNameTam = 'கைபேசி எண் மாற்றம் / பதிவு';
        const regMob = String(sess.citizenProfile?.mobileNumber || sess.mobileNumber || '').replace(/\D/g, '').slice(-10);
        const newMob = sess.subServiceData?.newMobile || 'பதிவு செய்யப்பட்ட எண்';
        detailsList = (regMob ? `• 📞 **தற்போதைய பதிவு எண்:** +91 ${regMob}\n` : '') +
                      `• 📱 **புதிய கைபேசி எண்:** +91 ${newMob} ✅\n`;
    } else if (subService === 'LPG_UPDATE') {
        svcNameTam = 'எரிவாயு (LPG) விவரங்கள் திருத்தம்';
        const cyl = sess.subServiceData?.cylinders || '1 சிலிண்டர்';
        detailsList = `• ⛽ **சிலிண்டர் எண்ணிக்கை:** ${cyl}\n` +
                      `• 📄 **சான்று:** எரிவாயு நுகர்வோர் அட்டை (Gas Book) ✅\n`;
    }

    const isNewCard = subService === 'NEW_CARD' || subService === 'NEW_RATION_CARD';

    return {
        sender: 'bot',
        text: `🎉 **${svcNameTam} விண்ணப்பம் தயார்! (Application Ready)** 🎯\n\n` +
              `• 🏛️ **அரசு சேவை:** ${svcNameTam}\n` +
              detailsList +
              `• 📱 **அங்கீகரிப்பு முறை:** ${isNewCard ? 'விண்ணப்பதாரர் மொபைல் எண் நேரடி OTP மூலம்.' : 'குடும்ப அட்டை பதிவு மொபைல் எண் OTP மூலம்.'}\n\n` +
              `${isNewCard ? 'இப்போது TNPDS போர்ட்டலில் புதிய குடும்ப அட்டைக்கு நேரடியாக விண்ணப்பிக்கலாம்:' : 'இப்போது TNPDS போர்ட்டலில் உள்நுழைந்து நேரடியாக விண்ணப்பிக்கலாம்:'}`,
        options: [
            { label: "📱 நேரலை TNPDS சமர்ப்பி (Real Govt OTP)", value: "REAL_LIVE_OTP" },
            { label: "🚀 TNPDS போர்ட்டலில் விண்ணப்பி (Submit to Portal)", value: "CONFIRM_SUBMIT" },
            ...(subService === 'ADD_MEMBER' ? [{ label: "🔄 வேறு நபர் சேர்க்க / புதிய ஆவணம் (Change Member)", value: "RATION_ADD_MEMBER_RESET" }] : []),
            ...(subService === 'REMOVE_MEMBER' ? [{ label: "🔄 வேறு நபர் நீக்க / புதிய ஆவணம் (Change Member)", value: "RATION_REMOVE_MEMBER_RESET" }] : []),
            { label: "✏️ விவரங்களைச் சரிபார் / திருத்து (Review Details)", value: "TRIGGER_EDIT_MODAL" },
            { label: "🔙 ரேஷன் கார்டு சேவைகள்", value: "ரேஷன் கார்டு" }
        ]
    };
}

module.exports = { renderSubserviceReadySummary };
