const nodemailer = require('nodemailer'); 
const email_config = require('../configs/emailConfig');
const EMAIL = (process.env.EMAIL);

const emailEndpoints = (router) => {
    router.post('/sendEmail', (req, res) => {
        const transporter = nodemailer.createTransport(email_config);
        var mailOptions = {
            from: req.body.email,
            to: EMAIL,
            subject: req.body.subject + ' ' + new Date().toLocaleString(),
            text: req.body.text,
        };
        transporter.sendMail(mailOptions)
        .then((response) => {
            console.log(response);
            res.send(true);
        }).catch((err) => {
            console.log(err);
            res.send(false);
        });
    });

    router.post('/reportReview', (req, res) => {
        const transporter = nodemailer.createTransport(email_config);
        var mailOptions = {
            from: EMAIL, // secondary lacarnivore email
            to: EMAIL, // secondary lacarnivore email
            subject: 'Review Complaint ' + new Date().toLocaleString(),
            text: 'PRODUCT ID: ' + req.body.id + '\n USER: ' + req.body.user + '\n REVIEW: ' + req.body.review + '\n COMPLAINT: ' + req.body.complaint,
        };
        transporter.sendMail(mailOptions)
        .then((response) => {
            console.log(response);
            res.send({success: true});
        }).catch((err) => {
            console.log(err);
            res.send({success: false});
        });
    });
}

module.exports = {
    emailEndpoints,
}
