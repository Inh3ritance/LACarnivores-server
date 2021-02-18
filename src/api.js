require('dotenv').config();

const express = require("express");
const app = express();
const router = express.Router();
const serverless = require("serverless-http");
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const cors = require('cors');

const config = ({
    origin: ['https://www.lacarnivores.com','https://lacarnivoresapi.netlify.app/'], 
    credentials: true,
    methods: ['POST','GET','OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
});

const stripe = require('stripe')(process.env.API_KEY);
const RECAPTCHA_KEY = (process.env.RECAPTCHA_KEY);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors(config));
app.use('/.netlify/functions/api', router);

// Creates Customer => creates source => creates charge
async function CreateCustomer(data, res) {
    let existingCustomers = await stripe.customers.list({ 
            email: data.personal_info.email
        }).catch(err =>
            console.log(err)
        );

    if (existingCustomers.data.length) { // Use existing customerUID and pass in rest of data to create charge
        console.log(existingCustomers.data[0].id);
        updateSource(data, existingCustomers.data[0].id, res);
    } else {
        stripe.customers.create({
            name: data.personal_info.name,
            email: data.personal_info.email,
            address: data.billing_address,
            phone: data.personal_info.phone,
        }).then(customer =>
            createSource(data, customer.id, res)
        ).catch(err => 
            console.log(err)
        );
    }
}

async function createSource(data, customerID, res) {
    await stripe.customers.createSource(
        customerID,
        { 
            source: data.card.token.id 
        },
    ).then(card => {
        updateCard(data, card.customer, card.id);
        createOrder(data, customerID, res);
    }).catch(err =>
        console.log(err)
    );
};

async function updateCard(data, customerID, cardID) {
    await stripe.customers.updateSource(
        customerID, cardID,
        {
            name: data.personal_info.name,
            address_city: data.billing_address.city,
            address_country: 'United States',
            address_line1: data.billing_address.line1,
            address_state: data.billing_address.state,
        },
    ).catch(err =>
        console.log(err)
    );
}

async function updateSource(data, customerID, res) {
    await stripe.customers.update(
        customerID,
        { source: data.card.token.id },
    ).then(card => {
        updateCard(data, card.id, card.default_source);
        createOrder(data, customerID, res);
    }).catch(err =>
        console.log(err)
    );
};

function getSku(productID) {
    return stripe.skus.list({
        product: productID
    }).then(result => {
        return Promise.resolve(result.data[0].id);
    }).catch(e => {
        console.log(e);
    });
};

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// update product metadata quantity when user purchases item
async function updateProductQuantity(itemID, cartQuantity) {
    await stripe.products.retrieve(
        itemID, 
    ).then(product => {
        if (parseInt(product.metadata.quantity) - cartQuantity < 0) {
            console.log('No more in stock', parseInt(product.metadata.quantity) - cartQuantity);
        } else {
            stripe.products.update(
                itemID, 
                { 
                    metadata: 
                    { 
                        quantity: (parseInt(product.metadata.quantity) - cartQuantity).toString() 
                    } 
                },
            ).catch(err => 
                consolew.log(err)
            );
        }
    }).catch(err =>
        console.log(err)
    );
}

async function getProduct(productID) {
    return stripe.products.retrieve(
        productID,
    ).then(result => {
        return Promise.resolve(parseInt(result.metadata.quantity));
    }).catch(err => 
        console.log(err)
    );
};

async function createOrder(data, customerID, res) {
    let cart = [];
    for (var key in data.cart) {
        await timeout(1000);
        var item = data.cart[key];
        cart.push({ 
            type: 'sku',
            parent: await getSku(item.id),
            quantity: await getProduct(item.id) > 0 && (await getProduct(item.id) - item.quantity >= 0) ? item.quantity : 0,
            currency: 'usd',
            description: item.name 
        });
        await updateProductQuantity(item.id, item.quantity);
    }

    console.log(cart);

    var flag = true;
    for (key in cart) {
        item = cart[key];
        if (parseInt(item.quantity) === 0) {
            flag = false;
            break;
        }
    }

    if (flag) {
        stripe.orders.create(
        {
            currency: 'usd',
            customer: customerID,
            email: data.personal_info.email,
            items: cart,
            shipping: 
            {
                name: data.personal_info.name,
                address: 
                {
                    line1: data.shipping_address.line1,
                    city: data.shipping_address.city,
                    state: data.shipping_address.state,
                    postal_code: '94111',
                    country: 'US',
                },
            },
        }).then(result => {
            payOrder(result.id, customerID, data);
            res.sendStatus(200);
        }).catch(e => {
            console.log(e);
        });
    } else {
        console.log('Out of stock');
        res.sendStatus(404);
    }
}

function payOrder(orderID, customerID, data) {
    stripe.orders.pay(
        orderID,
        { 
            customer: customerID 
        },
    ).then(order =>
        updateOrder(order.charge, data.cart)
    ).catch(err => 
        console.log(err)
    );
}

// loop through and add to reciept description
function updateOrder(chargeID, cartInfo) {
    let reciept = '';
    for (var key in cartInfo) {
        var item = cartInfo[key];
        reciept += item.name + ' ' + item.quantity + 'x $' + item.price + '\n';
    }
    stripe.charges.update(
        chargeID,
        { 
            description: reciept 
        },
    ).catch(err => 
        console.log(err)
    );
}

// Get all products
router.get('/products', async (req, res) => {
    stripe.products.list(
        { 
            active: true 
        },
    ).then(list =>
        res.send(list)
    ).catch(err => 
        console.log(err)
    );
});

router.post('/charge', async (req, res) => {
    let data = {
        personal_info: {
            name: req.body.name,
            email: req.body.email,
            phone: '8008008888',
        },
        billing_address: {
            city: req.body.city,
            line1: req.body.line1,
            state: req.body.state,
        },
        shipping_address: {
            city: req.body.shippingCity,
            line1: req.body.shippingAddy,
            state: req.body.shippingState,
        },
        cart: req.body.cart,
        card: req.body.card,
    }
    
    try {
        data.card.token.card.address_city = req.body.city;
        data.card.token.card.address_line1 = req.body.line1;
        data.card.token.card.address_state = req.body.state;
        data.card.token.card.name = req.body.name;
        CreateCustomer(data, res);
    } catch (err) {
        console.log(err);
    }
});

router.post('/verify', async (req, res) => {
    var VERIFY_URL = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_KEY}&response=${req.body.response}`;
    await fetch(VERIFY_URL, { 
        method: 'POST',
    }).then(res =>
        res.json()
    ).then(json => 
        res.send(json)
    ).catch(err => 
        console.log(err)
    );
});

// Uncomment code below in order to run code locally using ` node api.js `
/*const port = process.env.PORT || 9000;

app.listen(port, () => console.log('Server is running...\n'));*/

module.exports.handler = serverless(app);