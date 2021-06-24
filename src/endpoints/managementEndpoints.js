const { verifyData, adminApproval } = require('../funct/managementFunctions');
const { getSku } = require('../funct/stripeUtils');
const stripe = require('stripe')(process.env.API_KEY);

const managementEndpoints = (router) => {
    // Verify admin to enter Masterpage
    router.post('/getMaster', (req, res) => {
        if(adminApproval(req)) {
            res.send({ Approved: true });
            return;
        }
        res.send({ Approved: false });
    });

    // Get all products
    router.get('/allProducts', async (_, res) => {
        await stripe.products.list({
        }).then(list => {
            res.send(list)
        }).catch(err => {
            console.log(err)
        });
    });

    // Create new Product
    router.post('/createProduct', async (req, res) => {
        if(adminApproval(req)) {
            const data = verifyData(req.body);
            await stripe.products.create({
                name: data.name,
                active: data.active,
                images: data.images,
                description: data.description,
                metadata: data.metadata,
                type: 'good',
                attributes: ["name"],
            }).then(async prod => {
                await stripe.skus.create({
                    currency: 'usd',
                    inventory: {
                        type: 'infinite',
                    },
                    attributes: {
                        name: data.name,
                    },
                    price: data.metadata.price,
                    product: prod.id,
                }).catch(err => {
                    console.log(err);
                });
            }).catch(err => {
                console.log(err);
                res.send(err);
            });
            res.send('success');
        } else {
            res.send("Unapproved Authorization");
        }
    });

    // Update Product details
    router.post('/updateProduct', async (req, res) => {
        if(adminApproval(req)) {
            const data = verifyData(req.body);
            let sku = await getSku(req.body.id);
            await stripe.skus.update(
                sku.id,
                {
                    price: data.metadata.price,
                }
            ).then(async sku => {
                console.log(sku);
                await stripe.products.update(
                    req.body.id,
                    {
                        name: data.name,
                        description: data.description,
                        images: data.images,
                        active: data.active,
                        metadata: data.metadata,
                    }
                ).then(prod => {
                    console.log(prod);
                    res.send('success');
                }).catch(err => {
                    console.log(err);
                    res.send(err);
                });
            }).catch(err => {
                console.log(err);
                res.send(err);
            });
        } else {
            res.send("Unapproved Authorization");
        }
    });
}

module.exports = {
    managementEndpoints,
};
