const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = '432080672502-ba91tog3jvoc6c0mac01iq2b5k5q3mb1.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

module.exports = {
    client,
    GOOGLE_CLIENT_ID
};