require('dotenv').config();

const express = require("express");
const app = express();
const router = express.Router();
const serverless = require("serverless-http");
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const cors = require('cors');
const nodemailer = require('nodemailer'); 

const config = ({
    origin: ['https://www.lacarnivores.com'],
    credentials: true,
    methods: ['POST','GET','OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
});

const stripe = require('stripe')(process.env.API_KEY);
const RECAPTCHA_KEY = (process.env.RECAPTCHA_KEY);
const EMAIL = (process.env.EMAIL);
const PASSWORD = (process.env.PASSWORD);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors(config));
app.use('/.netlify/functions/api', router);
router.options('*', cors(config));

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

function verifyData(data){
    console.log(typeof(data.active));
    console.log(data.active);
    try {
        var temp = [];
        data.images.forEach( element => {
            if(element.length == 0)
                temp.push('https://files.stripe.com/links/fl_test_wYR38Z6vDNAmp37OBQmOa1tq'); // provide unavailable image
            else
                temp.push(element);
        });
        return {
            name: data.name.length == 0 ? "PlaceHolder" : data.name,
            images: temp,
            description: data.description.length == 0 ? "PlaceHolder" : data.description,
            active: data.active,
            metadata: {
                type: data.type.length == 0 ? "PlaceHolder" : data.type,
            }
        };
    } catch(err) {
        console.log(err);
    }
}

function verifyToken(req, res, next) {
    const bearerHeader = req.headers['Authorization'];
    if (bearerHeader) {
      const bearer = bearerHeader.split(' ');
      const bearerToken = bearer[1];
      req.token = bearerToken;
      next();
    } else {
      res.sendStatus(403);
    }
  }

// Get all products
router.get('/products', async (_, res) => {
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

// Get all products
router.get('/allProducts', async (_, res) => {
    stripe.products.list({
    }).then(list =>
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

router.post('/verify', cors(config), async (req, res) => {
    var VERIFY_URL = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_KEY}&response=${req.body.response}`;
    await fetch(VERIFY_URL, { 
        method: 'POST',
        credentials: 'true',
        headers: { 
            "Content-Type": "application/x-www-form-urlencoded",
            "Access-Control-Allow-Origin:": "https://www.lacarnivores.com",
        },
    }).then(res =>
        res.json()
    ).then(json => 
        res.send(json)
    ).catch(err => 
        console.log(err)
    );
});

router.post('/sendEmail', (req, res) => {
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        service: 'gmail',
        port: 465,
        secure: true,
        auth: {
          user: EMAIL,
          pass: PASSWORD,
        }
    });
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

// TODO: make this work without relying on netlify-lamda
router.get('/getMaster', verifyToken, (req, res) => {
    console.log(req.Authorization);
    res.send({Approved: true});
});

router.post('/updateProduct', async (req, res) => {
    var temp = [];
    req.body.images.forEach( element => {
        if(element.length === 0)
            temp.push('https://files.stripe.com/links/fl_test_wYR38Z6vDNAmp37OBQmOa1tq'); // provide unavailable image
        else
            temp.push(element);
    });
    await stripe.products.update(
        req.body.id,
        {
            name: req.body.name,
            description: req.body.description,
            images: temp,
            metadata: {
                type: req.body.type,
                price: 0,
                quantity: 0,
            }
        }
    ).catch(err => {
        console.log(err);
        res.send(err);
    });
    res.send('success');
});

router.post('/createProduct', async (req, res) => {
    const data = verifyData(req.body);
    await stripe.products.create(
        data,
    ).catch(err => {
        console.log(err);
        res.send(err);
    });
    res.send('success');
});

router.post('/deleteProduct', async (req, res) => {
    await stripe.products.del(req.body.id)
    .catch(err => {
        console.log(err);
        res.send(err);
    });
    res.send('success');
});

// Uncomment code below in order to run code locally using ` node api.js `
/*const port = process.env.PORT || 9000;

app.listen(port, () => console.log('Server is running...\n'));*/

module.exports.handler = serverless(app);