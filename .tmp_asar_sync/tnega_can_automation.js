/**
 * TNeGA e-Sevai Operator Login & CAN (Citizen Access Number) Automation Engine
 * Clean Modular Orchestrator Facade
 */

const {
    getLiveTnegaStatus,
    launchTnegaBrowser,
    maximizeTnegaWindow,
    provideCanOtp,
    stopTnegaAutomation,
    setTnegaChromiumInstance
} = require('./src/portal/tnega/tnega_browser_manager');

const {
    loginTnegaOperator,
    searchCitizenCan,
    generateCanOtp
} = require('./src/portal/tnega/tnega_can_search_otp');

const {
    registerNewCan,
    startTnegaCanRegisterFlow
} = require('./src/portal/tnega/tnega_can_register');

const {
    startTnegaIncomeCertificateFlow
} = require('./src/portal/tnega/tnega_income_certificate');

const {
    startTnegaResidenceCertificateFlow
} = require('./src/portal/tnega/tnega_residence_certificate');

const {
    startTnegaCommunityCertificateFlow
} = require('./src/portal/tnega/tnega_community_certificate');

const {
    generateCanReceiptPdf
} = require('./src/services/tnega_receipt_generator');

module.exports = {
    loginTnegaOperator,
    searchCitizenCan,
    generateCanOtp,
    provideCanOtp,
    registerNewCan,
    startTnegaCanRegisterFlow,
    startTnegaIncomeFlow: startTnegaIncomeCertificateFlow,
    startTnegaResidenceFlow: startTnegaResidenceCertificateFlow,
    startTnegaCommunityFlow: startTnegaCommunityCertificateFlow,
    startTnegaCommunityCertificateFlow,
    startTnegaCanSearchFlow: searchCitizenCan,
    generateCanReceiptPdf,
    stopTnegaAutomation,
    maximizeTnegaWindow,
    getLiveTnegaStatus,
    setTnegaChromiumInstance
};
