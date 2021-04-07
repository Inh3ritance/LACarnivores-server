const stripe = require('stripe')(process.env.API_KEY);
const { getCustomer } = require('../funct/stripeFunctions');
const { sanitize } = require('../funct/stripeUtils');
const data = require('../configs/data');

const stripeEndpoints = (router) => {

    // Get available products
    router.get('/products', async (_, res) => {
        await stripe.products.list(
            { 
                active: true,
            },
        ).then(list =>
            res.send(list)
        ).catch(err => 
            console.log(err)
        );
    });

    // pass data along from info
    router.post('/charge', async (req, res) => {
        req.body.cart = await sanitize(req.body.cart);
        try {
            const info = new data(req.body);
            module.exports = { info };
            getCustomer();
            res.sendStatus(202);
        } catch (err) {
            res.sendStatus(500);
            console.log(err);
        }
    });

}

module.exports = {
    stripeEndpoints,
};
