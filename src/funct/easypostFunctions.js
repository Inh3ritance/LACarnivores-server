const Easypost = require('@easypost/api/src/easypost');
const easypost = new Easypost(process.env.EASYPOST);
const nodemailer = require('nodemailer'); 
const email_config = require('../configs/emailConfig');
const EMAIL = (process.env.EMAIL);

async function shipping(info) {

    const toAddress = new easypost.Address({
        name: info.getPersonalInfo.name,
        street1: info.getShippingAddress.line1,
        city: info.getShippingAddress.city,
        state: info.getShippingAddress.state,
        zip: '90255', //info.getShippingAddress.zip, TODO
        phone: info.getPersonalInfo.phone,
        email: info.getPersonalInfo.email,
        country: 'US',
    });

    // Replace with personal info TODO
    const fromAddress = new easypost.Address({
        name: 'EasyPost',
        street1: '118 2nd Street',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        phone: '415-123-4567',
        email: EMAIL,
        country: 'US',
    });

    // Adjust item weights and dimensions for shipment, optimize for lower costs... TODO
    const parcel = new easypost.Parcel({
        weight: 3,
    });

    let shipment = new easypost.Shipment({
        parcel: parcel,
    });

    const order = new easypost.Order({
        to_address: toAddress,
        from_address: fromAddress,
        shipments: [
            shipment,
        ],
    });
        
    try {    
        await order.save();
        await order.buy('USPS', 'FIRST').then(data => {

            console.log(data);
            var tracking_labels = [];
            var postage_labels = [];
            var public_tracking = [];

            data.shipments.forEach(element => {
                if(tracking_labels.indexOf(element.tracking_code) === -1) {
                    tracking_labels.push(element.tracking_code);
                }
                if(postage_labels.indexOf(element.postage_label.label_url) === -1) {
                    postage_labels.push(element.postage_label.label_url);
                }
                if(public_tracking.indexOf(element.tracker.public_url) === -1) {
                    public_tracking.push(element.tracker.public_url);
                }
            });

            let tracking_str = tracking_labels.join('/n');
            let postage_str = postage_labels.join('/n');
            let public_str = public_tracking.join('/n');
            const transporter = nodemailer.createTransport(email_config);
            const toUser = {
                from: EMAIL,
                to: info.getPersonalInfo.email,
                subject: 'Track your packages',
                text: 'Your tracking URL\'s : ' + public_str,
            };
            const toAdmin = {
                from: EMAIL,
                to: EMAIL, // make this a special email for handling goods TODO
                subject: 'FULFILL REQUESTS',
                text: 'Tracking#\'s : ' + tracking_str + '\nPostage Labels: ' + postage_str,
            }

            transporter.sendMail(toUser)
            .then((response) => {
                console.log(response);
            }).catch((err) => {
                console.log(err.errors);
            });

            transporter.sendMail(toAdmin)
            .then((response) => {
                console.log(response);
            }).catch((err) => {
                console.log(err.errors);
            });
        });
    } catch(e) {
        console.log(e);
    }
}

module.exports = {
    shipping,
}
