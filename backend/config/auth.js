const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID && process.env.NODE_ENV !== 'test') {
    console.warn('⚠️  GOOGLE_CLIENT_ID ausente — login com Google desabilitado.');
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

module.exports = {
    client,
    GOOGLE_CLIENT_ID,
    googleHabilitado: Boolean(GOOGLE_CLIENT_ID)
};
