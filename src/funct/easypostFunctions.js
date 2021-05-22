const Easypost = require('@easypost/api');
const { createTransport } = require('nodemailer'); 
const email_config = require('../configs/emailConfig');
const easypost = new Easypost(process.env.EASYPOST);
const EMAIL = (process.env.EMAIL);

async function shipping(info, res) {

    console.log("Now in Shipping methods...");
    console.log(info.getCart);

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
        name: 'LaCArnivores',
        street1: '118 2nd Street', //
        city: 'Los Angeles',
        state: 'CA',
        zip: '90255', //
        phone: '323-123-4567', //
        email: EMAIL,
        country: 'US',
    });

    // Adjust item weights and dimensions for shipment, optimize for lower costs... TODO
    // USPS standard is 13 oz. for now set as 12 oz max to avoid over weight packages.

    let shipments = [];
    let current_weight = 0;
    let shipment_details = [];
    let order_details = [];

    for(var i = 0; i < info.getCart.length; i++) {
        if(i + 1 == info.getCart.length) {
            shipments.push(
                new easypost.Shipment({
                    parcel: new easypost.Parcel({
                        weight: current_weight,
                    })
                })
            );
            shipment_details.push(info.getCart[i].name);
            order_details.push(shipment_details);
        } else {
            if(info.getCart[i].weight + current_weight <= 13) {
                current_weight += info.getCart[i].weight;
                shipment_details.push(info.getCart[i].name);
            } else {
                shipments.push(
                    new easypost.Shipment({
                        parcel: new easypost.Parcel({
                            weight: parseInt(current_weight),
                        })
                    })
                );
                order_details.push(shipment_details);
                current_weight = info.getCart[i].weight;
                shipment_details = [];
                shipment_details.push(info.getCart[i].name);
            }
        }  
    }

    console.log(order_details);
    console.log(shipments);

    /*const parcel = new easypost.Parcel({
        weight: 3,
    });

    let shipment = new easypost.Shipment({
        parcel: parcel,
    });*/

    const order = new easypost.Order({
        to_address: toAddress,
        from_address: fromAddress,
        shipments,
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
            const transporter = createTransport(email_config);
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
                res.send(err);
            });

            transporter.sendMail(toAdmin)
            .then((response) => {
                console.log(response);
                res.send("Success"); // Final function need a better way to handle this TODO
            }).catch((err) => {
                res.send(err);
            });
        });
    } catch(err) {
        res.send(err);
    }
}

module.exports = {
    shipping,
}
