require('dotenv').config();

const express = require("express");
const app = express();
const router = express.Router();
const serverless = require("serverless-http");
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { uuid } = require('uuidv4');
const cors = require('cors');

const config = ({
    origin: 'https://www.lacarnivores.com', 
    credentials: true,
    methods: ['POST','GET','OPTIONS']
});

const stripe = require('stripe')(process.env.API_KEY);
const RECAPTCHA_KEY = (process.env.RECAPTCHA_KEY);
const EMAIL = (process.env.EMAIL);
const PASSWORD = (process.env.PASSWORD);

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL,
        pass: PASSWORD
    }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors(config));
app.use('/.netlify/functions/api', router);

// Creates Customer => creates source => creates charge
async function CreateCustomer(data, res) {
    let existingCustomers = await stripe.customers.list({ email: data.personal_info.email });
    if (existingCustomers.data.length) {
        console.log('Not creating new customer');
        /* Use existing customerUID and pass in rest of data to create charge */
        console.log(existingCustomers.data[0].id);
        updateSource(data, existingCustomers.data[0].id, res);
    } else {
        stripe.customers.create({
            name: data.personal_info.name,
            email: data.personal_info.email,
            address: data.billing_address,
            phone: data.personal_info.phone,
        }, (err, customer) => {
            createSource(data, customer.id, res);
        }).catch(e => {
            console.log(e);
        });
    }
}

async function createSource(data, customerID, res) {
    await stripe.customers.createSource(
        customerID,
        { source: data.card.token.id },
        (err, card) => {
            updateCard(data, card.customer, card.id);
            createOrder(data, customerID, res);
        }).catch(e => {
            console.log(e);
        })
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
    ).then((card) => {
    }).catch((err) => {
        console.log(err);
    })
}

async function updateSource(data, customerID, res) {
    await stripe.customers.update(
        customerID,
        { source: data.card.token.id },
        (err, card) => {
            updateCard(data, card.id, card.default_source);
            createOrder(data, customerID, res);
        }).catch(err => {
            console.log(err);
        })
};

function getSku(productID) {
    return stripe.skus.list({
        product: productID
    }).then((result) => {
        return Promise.resolve(result.data[0].id);
    }).catch(e => {
        console.log(e);
    });
};

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateProductQuantity(itemID, cartQuantity) {
    // update product metadata quantity when user purchases item
    await stripe.products.retrieve(
        itemID, (err, product) => {
            if (parseInt(product.metadata.quantity) - cartQuantity < 0) {
                console.log('No more in stock', parseInt(product.metadata.quantity) - cartQuantity);
            } else {
                stripe.products.update(
                    itemID,
                    { metadata: { quantity: (parseInt(product.metadata.quantity) - cartQuantity).toString() } }
                );
            }
        }
    );
}

async function getProduct(productID) {
    return stripe.products.retrieve(
        productID
    ).then((result) => {
        return Promise.resolve(parseInt(result.metadata.quantity));
    }).catch(e => {
        console.log(e);
    });
};

async function createOrder(data, customerID, res) {
    // in parent put the sku number
    let cart = [];
    for (var key in data.cart) {
        await timeout(1000);
        var item = data.cart[key];
        cart.push({ type: 'sku', parent: await getSku(item.id), quantity: await getProduct(item.id) > 0 && (await getProduct(item.id) - item.quantity >= 0) ? item.quantity : 0, currency: 'usd', description: item.name });
        await updateProductQuantity(item.id, item.quantity);
    }

    console.log(cart);

    var flag = true;
    for (key in cart) {
        item = cart[key];
        console.log(item.quantity);
        if (parseInt(item.quantity) === 0) {
            flag = false;
            break;
        }
    }

    if (flag) {
        stripe.orders.create({
            currency: 'usd',
            customer: customerID,
            email: data.personal_info.email,
            items: cart,
            shipping: {
                name: data.personal_info.name,
                address: {
                    line1: data.shipping_address.line1,
                    city: data.shipping_address.city,
                    state: data.shipping_address.state,
                    postal_code: '94111',
                    country: 'US',
                },
            },
        }).then((result) => {
            res.sendStatus(200);
            payOrder(result.id, customerID, data);
        }).catch(e => {
            console.log(e);
        });
    } else {
        res.sendStatus(404);
        console.log('Out of stock');
    }

}

function payOrder(orderID, customerID, data) {
    stripe.orders.pay(orderID,
        { customer: customerID },
        (err, order) => {
            updateOrder(order.charge, data.cart);
        });
}

function updateOrder(chargeID, cartInfo) {
    //loop thru and add to reciept description
    let reciept = '';
    for (var key in cartInfo) {
        var item = cartInfo[key];
        reciept += item.name + ' ' + item.quantity + 'x $' + item.price + '\n';
    }
    stripe.charges.update(
        chargeID,
        { description: reciept },
        (err, charge) => {
            // asynchronously called
        }
    );
}

// Get all products
router.get('/products', async (request, response) => {
    stripe.products.list(
        { active: true },
        (err, list) => {
            response.json(list);
        }
    )
});

router.get('/skus', async (request, response) => {
    stripe.skus.list(
        { active: true },
        (err, skus) => {
            response.json(skus);
            console.log(skus);
        }
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
    data.card.token.card.address_city = req.body.city;
    data.card.token.card.address_line1 = req.body.line1;
    data.card.token.card.address_state = req.body.state;
    data.card.token.card.name = req.body.name;
    //console.log("DATA", data.card);
    CreateCustomer(data,res);
});

router.get('/prices', async (req, res) => {
    stripe.prices.list(
        { product: req.query.id },
        (err, price) => {
            console.log(price.data);
            res.send(price.data);
        }
    );
});

router.post('/sendEmail', (req, res) => {
    let mailOptions = {
        from: req.body.email,
        to: EMAIL,
        subject: req.body.subject,
        text: req.body.text
    };
    transporter.sendMail(mailOptions, error => {
        if(error){
          const response = {
            statusCode: 500,
            headers: { 
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTION',
            },
            body: JSON.stringify({
              error: error.message,
            }),
          };
          res.send(response);
        }
        const response = {
          statusCode: 200,
          headers: { 
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTION',
          },
          body: JSON.stringify({
            message: `Email processed succesfully!`
          }),
        };
        res.send(response);
      });
});

router.post('/verify', (req, res) => {
    var VERIFY_URL = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_KEY}&response=${req.body['g-recaptcha-response']}`;
    return fetch(VERIFY_URL, { 
        method: 'POST',
        headers: { 
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTION',
        }
    })
    .then(res => {res.json(), console.log(res.json())})
    .then(json => res.send(json))
    .catch(err => console.log(err));
});

// Uncomment code below in order to run code locally using ` node api.js `
/*const port = process.env.PORT || 9000;

app.listen(port, () => console.log('Server is running...\n'));
*/
module.exports.handler = serverless(app);