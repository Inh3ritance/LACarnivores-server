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
                quantity: data.quantity < 0 ? 0 : data.quantity,
                price: data.price < 0 ? 0 : data.price,
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
