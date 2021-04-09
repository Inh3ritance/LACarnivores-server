require('dotenv').config();

module.exports = {
    onPreBuild: () => {
      global.GENTLY = false;
    },
}

const express = require("express");
const app = express();
const router = express.Router();
const serverless = require("serverless-http");
const cors = require('cors');

const { managementEndpoints } = require('./endpoints/managementEndpoints');
const { stripeEndpoints } = require('./endpoints/stripeEndpoints');
const { recaptchaEndpoints } = require('./endpoints/recaptchaEndpoints');
const { emailEndpoints } = require('./endpoints/emailEndpoints');

const config = ({
    origin: ['https://www.lacarnivores.com'],
    credentials: true,
    methods: ['POST','GET','OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors(config));
app.use('/.netlify/functions/api', router);

emailEndpoints(router);
managementEndpoints(router);
recaptchaEndpoints(router);
stripeEndpoints(router);

// Uncomment code below in order to run code locally using ` node api.js `
/*const port = process.env.PORT || 9000;

app.listen(port, () => console.log('Server is running...\n'));*/

module.exports.handler = serverless(app);