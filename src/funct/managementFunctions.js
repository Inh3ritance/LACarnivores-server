const jwt = require('jsonwebtoken');

// JSON web token, strip bearer
function verifyToken(bear) {
    if (bear) {
    const bearer = bear.split(' ');
    const bearerToken = bearer[1];
    return bearerToken;
    } return;
}

// When updating or creating a product this will make sure there are non-null values
function verifyData(data) {
    try {
        var temp = [];
        data.images.forEach(element => {
            if(element.length == 0)
                temp.push('https://files.stripe.com/links/fl_test_wYR38Z6vDNAmp37OBQmOa1tq'); // provide unavailable image
            else
                temp.push(element);
        });
        // int types convert to ints IMPORTANT!!!!
        return {
            name: data.name.length == 0 ? "PlaceHolder" : data.name,
            images: temp,
            description: data.description.length == 0 ? "PlaceHolder" : data.description,
            active: data.active,
            metadata: {
                type: data.type.length == 0 ? "PlaceHolder" : data.type,
                quantity: data.quantity < 0 ? 0 : data.quantity,
                price: data.price < 0 ? 0 : data.price,
                featured: data.featured !== "y" ? "n" : data.featured, 
                width: data.width == 0 ? 0 : data.width,
                height: data.height == 0 ? 0 : data.height,
                length: data.length == 0 ? 0 : data.length,
                weight: data.weight == 0 ? 0 : data.weight,
                recieve: data.recieve.length == 0 ? "PlaceHolder" : data.recieve,
                zones: data.zones.length == 0 ? "-1" : data.zones,
                water: data.water.length == 0 ? "PlaceHolder" : data.water,
                soil: data.soil.length == 0 ? "PlaceHolder" : data.soil,
                light: data.light.length == 0 ? "PlaceHolder" : data.light,
            },
        };
    } catch(err) {
        console.log(err);
    }
}

function adminApproval(req) {
    const token = verifyToken(req.headers.authorization, {complete: true});
    const decode = jwt.decode(token);
    if(decode.app_metadata.roles[0] === "admin") return true;
    return false;
}

module.exports = {
    verifyData,
    verifyToken,
    adminApproval,
}
