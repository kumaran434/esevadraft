/**
 * src/catalog/services/tnpds_change_address.js
 * 
 * Modular Service Plugin: Ration Card Address Change (குடும்ப அட்டை முகவரி மாற்றம்)
 * Portal: TNPDS (Civil Supplies & Consumer Protection, Tamil Nadu)
 */

module.exports = {
    id: 'TNPDS_CHANGE_ADDRESS',
    aliases: ['CHANGE_ADDRESS', 'RATION_CHANGE_ADDRESS', 'முகவரி மாற்றம்'],
    code: 'TNPDS_CHG_ADDR',
    portal: 'TNPDS',
    portalName: 'TNPDS (Civil Supplies & Consumer Protection)',
    nameTam: 'குடும்ப அட்டை முகவரி மாற்றம்',
    nameEng: 'Ration Card Address Change',
    category: 'CIVIL_SUPPLIES',
    portalUrl: 'https://www.tnpds.gov.in',
    descriptionTam: 'ஏற்கனவே உள்ள குடும்ப அட்டையில் புதிய வீட்டு முகவரியை மாற்றுதல்',

    prerequisites: [
        {
            key: 'smartCardNumber',
            altKeys: ['rationCardNumber'],
            labelTam: 'ஸ்மார்ட் குடும்ப அட்டை எண்',
            labelEng: 'Smart Ration Card Number',
            promptTam: 'முகவரி மாற்றம் செய்ய ஸ்மார்ட் கார்டு எண் தேவை.'
        }
    ],

    bucketA: [],

    bucketB: [
        {
            key: 'subServiceData.newDoorNo',
            labelTam: 'புதிய கதவு எண்',
            labelEng: 'New Door Number',
            promptTam: 'புதிய வீட்டின் கதவு எண்ணை உள்ளிடவும்:',
            mandatory: true,
            type: 'text'
        },
        {
            key: 'subServiceData.newStreet',
            labelTam: 'புதிய தெருப் பெயர்',
            labelEng: 'New Street Name',
            promptTam: 'புதிய தெருப் பெயரை உள்ளிடவும் (எ.கா: மேட்டுத் தெரு):',
            mandatory: true,
            type: 'text'
        }
    ],

    requiredDocuments: [
        {
            key: 'newAddressProof',
            altKeys: ['residenceProof'],
            labelTam: 'புதிய முகவரிச் சான்று (மின் கட்டணம் / வீட்டு வரி / கேஸ் அட்டை)',
            labelEng: 'New Address Proof',
            format: 'pdf',
            maxSizeKB: 200,
            mandatory: true
        }
    ],

    getRunner: () => {
        const { startTnpdsAddressChangeFlow } = require('../../../tnpds_automation');
        return startTnpdsAddressChangeFlow;
    }
};
