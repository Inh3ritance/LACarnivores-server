const EMAIL = (process.env.EMAIL);
const PASSWORD = (process.env.PASSWORD);

const email_config = {
    host: 'smtp.gmail.com',
    service: 'gmail',
    port: 465,
    secure: true,
    auth: {
      user: EMAIL,
      pass: PASSWORD,
    }
};

module.exports = email_config;
