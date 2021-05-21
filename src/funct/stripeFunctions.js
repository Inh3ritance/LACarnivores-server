const stripe = require('stripe')(process.env.API_KEY);
const { getProduct, getSku, timeout } = require('./stripeUtils');
const { shipping } = require('./easypostFunctions');

// Creates Customer => creates source => creates charge 
async function getCustomer(info, res) {
    let existingCustomers = await stripe.customers.list({ 
        email: info.getPersonalInfo.email,
    }).catch(err =>
        res.send(err)
    );

    if (existingCustomers.data.length) { // Use existing customerUID and pass in rest of data to create charge
        console.log(existingCustomers.data[0].id);
        updateSource(existingCustomers.data[0].id, info, res);
    } else {
        await stripe.customers.create(
            info.getPersonalInfo,
        ).then(customer =>
            createSource(customer.id, info, res)
        ).catch(err => 
            res.send(err)
        );
    }
}

async function updateSource(customerID, info, res) {
    await stripe.customers.update(
        customerID,
        { 
            source: info.getCard.token.id,
        },
    ).then(card => {
        updateCard(card.id, card.default_source, info, res);
        createOrder(customerID, info, res);
    }).catch(err =>
        res.send(err)
    );
};

async function createSource(customerID, info, res) {
    await stripe.customers.createSource(
        customerID,
        { 
            source: info.getCard.token.id,
        },
    ).then(card => {
        updateCard(card.customer, card.id, info, res);
        createOrder(customerID, info, res);
    }).catch(err =>
        res.send(err)
    );
};

async function updateCard(customerID, cardID, info, res) {
    await stripe.customers.updateSource(
        customerID, cardID,
        {
            name: info.getPersonalInfo.name,
            address_city: info.getBillingAddress.city,
            address_country: 'United States',
            address_line1: info.getBillingAddress.line1,
            address_state: info.getBillingAddress.state,
        },
    ).catch(err =>
        res.send(err)
    );
}

// update product metadata quantity when user purchases item
async function updateProductQuantity(itemID, cartQuantity) {
    await stripe.products.retrieve(
        itemID, 
    ).then(async product => {
        if (parseInt(product.metadata.quantity) - cartQuantity < 0) {
            console.log('No more in stock', parseInt(product.metadata.quantity) - cartQuantity);
        } else {
            await stripe.products.update(
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

async function createOrder(customerID, info, res) {
    let cart = [];
    for (var key in info.getCart) {
        await timeout(1000);
        var item = info.getCart[key];
        var sku = await getSku(item.id);
        var prod = await getProduct(item.id);
        console.log(sku);
        console.log(prod);
        cart.push({
            type: 'sku',
            parent: sku.id,
            quantity: parseInt(prod.metadata.quantity) > 0 && (parseInt(prod.metadata.quantity) - item.quantity >= 0) ? item.quantity : 0,
            currency: 'usd',
            description: prod.name, 
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
        await stripe.orders.create(
        {
            currency: 'usd',
            customer: customerID,
            email: info.getPersonalInfo.email,
            items: cart,
            shipping: 
            {
                name: info.getPersonalInfo.email,
                address: 
                {
                    line1: info.getShippingAddress.line1,
                    city: info.getShippingAddress.city,
                    state: info.getShippingAddress.state,
                    postal_code: info.getShippingAddress.zip,
                    country: 'US',
                },
            },
        }).then(result => {
            console.log(result);
            payOrder(result.id, customerID, info, res);
        }).catch(e => {
            res.send(e);
        });
    } else {
        console.log('Out of stock');
    }
}

async function payOrder(orderID, customerID, info, res) {
    await stripe.orders.pay(
        orderID,
        { 
            customer: customerID 
        },
    ).then(order => {
        console.log(order);
        updateOrder(order.charge, info, res)
    }).catch(err => 
        res.send(err)
    );
}

// loop through and add to reciept description
async function updateOrder(chargeID, info, res) {
    cartInfo = info.getCart;
    let reciept = '';
    for (var key in cartInfo) {
        var item = cartInfo[key];
        reciept += item.name + ' ' + item.quantity + 'x $' + item.price + '\n';
    }
    await stripe.charges.update(
        chargeID,
        { 
            description: reciept 
        },
    ).then(charge => {
        console.log(charge);
        shipping(info, res); // If charge is succesful, move onto shipping process
    }).catch(err => 
        res.send(err)
    );
}

module.exports = {
    getCustomer,
    getSku,
    timeout,
    getProduct,
}
