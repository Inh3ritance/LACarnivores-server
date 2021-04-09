const RECAPTCHA_KEY = (process.env.RECAPTCHA_KEY);
const { httpRequest } = require('../funct/reCaptchaFunctions');

const recaptchaEndpoints = (router) => {
    router.post('/verify', async (req, res) => {
        const params = {
            host: 'google.com',
            path: `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_KEY}&response=${req.body.response}`,
            method: 'POST'
        }
        return httpRequest(params).then((body) => {
            return body
        }).then((json) => {
            console.log(json);
            res.send(json)
        }).catch((err) => {
            console.error(err);
            res.send(err);
        });
    });
}

module.exports = {
    recaptchaEndpoints,
};
