const Easypost = require('@easypost/api');
const easypost = new Easypost(process.env.EASYPOST);

function shipping() {
    const { info } = require('../endpoints/stripeEndpoints');
    const toAddress = new easypost.Address({
        name: info.getPersonalInfo.name,
        street1: info.getShippingAddress.line1,
        city: info.getShippingAddress.city,
        state: info.getShippingAddress.state,
        zip: info.getShippingAddress.zip,
        phone: info.getPersonalInfo.phone,
        country: 'US',
      });
}

const fromAddress = new easypost.Address({
    name: 'EasyPost',
    street1: '118 2nd Street',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    phone: '415-123-4567'
});
