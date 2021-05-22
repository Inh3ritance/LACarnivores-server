const stripe = require('stripe')(process.env.API_KEY);

async function getSku(productID) {
    return await stripe.skus.list({
        product: productID,
    }).then(result => {
        return Promise.resolve(result.data[0]);
    }).catch(err => {
        console.log(err);
    });
};

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getProduct(productID) {
    return await stripe.products.retrieve(
        productID,
    ).then(prod => {
        return Promise.resolve(prod);
    }).catch(err => 
        console.log(err)
    );
};

async function sanitize(cart) {
    let arr = [];
    for(let element of cart) {
        var sku = await getSku(element.id);
        var prod = await getProduct(element.id);
        element.price = sku.price/100;
        element.name = prod.name;
        element.weight = prod.metadata.weight;
        arr.push(element);
    };
    return arr;
}

module.exports = {
    getProduct,
    getSku,
    timeout,
    sanitize,
}