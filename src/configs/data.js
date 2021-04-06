module.exports = class data {
    #personal_info;
    #billing_address;
    #shipping_address;
    #cart;
    #card;
    constructor(body) {

        this.#personal_info = {
            name: body.name,
            email: body.email,
            phone: body.phone,
        };
        this.#billing_address = {
            city: body.city,
            line1: body.line1,
            state: body.state,
            zip: body.zip,
        };
        this.#shipping_address = {
            city: body.shippingCity,
            line1: body.shippingAddy,
            state: body.shippingState,
            zip: body.zip,
        };
        this.#cart = body.cart;
        this.#card = body.card;
        this.#card.token.card = {
            address_city: body.city,
            address_line1: body.line1,
            address_state: body.state,
            name: body.name,
        };
    }

    get getPersonalInfo() {
        return this.#personal_info;
    }

    get getBillingAddress() {
        return this.#billing_address;
    }
    
    get getShippingAddress() {
        return this.#shipping_address;
    }

    get getCart() {
        return this.#cart;
    }

    get getCard() {
        return this.#card;
    }
}