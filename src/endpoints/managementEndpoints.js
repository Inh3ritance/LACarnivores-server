const { verifyData, adminApproval, deleteProducts } = require('../funct/managementFunctions');
const { getSku } = require('../funct/stripeUtils');
const stripe = require('stripe')(process.env.API_KEY);
const q = faunadb.query;
const adminClient = new faunadb.Client({ 
    secret: process.env.FAUNA,
});

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
        if(adminApproval(req) && req.body.password == process.env.CREATE_PRODUCT) {
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
        if(adminApproval(req) && req.body.password == process.env.UPDATE_PRODUCT) {
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

    router.post('/deleteProduct', async (req, res) => {
        if(adminApproval(req) && req.body.password == process.env.DELETE_PRODUCT) {
            let sku = await getSku(req.body.id);
            if(req.body.review_id !== undefined) {
                adminClient.query(q.Exists(q.Ref(q.Collection('Reviews'), req.body.review_id)))
                .then(async ret => {
                    if(ret) {
                        adminClient.query(q.Delete(q.Ref(q.Collection('Reviews'), req.body.review_id)))
                        .then(async () => {
                            await deleteProducts(sku.id, req.body.id);
                        }).catch(err => {
                            console.log(err);
                            res.send(err);
                        });
                    }
                }).catch(err => {
                    console.log(err);
                    res.send(err);
                })
            }
            await deleteProducts(sku.id, req.body.id);
        } else {
            res.send("Unapproved Authorization");
        }
    });

}

module.exports = {
    managementEndpoints,
};
