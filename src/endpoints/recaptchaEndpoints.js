const RECAPTCHA_KEY = (process.env.RECAPTCHA_KEY);
const fetch = require('node-fetch');

const recaptchaEndpoints = (router) => {
    router.post('/verify', async (req, res) => {
        var VERIFY_URL = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_KEY}&response=${req.body.response}`;
        await fetch(VERIFY_URL, { 
            method: 'POST',
            credentials: 'true',
            headers: { 
                "Content-Type": "application/x-www-form-urlencoded",
            },
        }).then(res =>
            res.json()
        ).then(json => 
            res.send(json)
        ).catch(err => 
            console.log(err)
        );
    });
}

module.exports = {
    recaptchaEndpoints,
};
