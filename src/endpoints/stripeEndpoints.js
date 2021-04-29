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
        if(req.body.card.error) {
            res.send(err);
            return;
        }
        req.body.cart = await sanitize(req.body.cart);
        try {
            const info = new data(req.body);
            await getCustomer(info, res);
        } catch (err) {
            res.send(err)
        }
    });

}

module.exports = {
    stripeEndpoints,
};
