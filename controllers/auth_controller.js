const { OAuth2Client } = require('google-auth-library');
const secrets = require('../secrets/clients.json');

const CLIENT_ID = secrets.web.client_id;
const CLIENT_SECRET = secrets.web.client_secret;
const REDIRECT_URI = secrets.web.redirect_uris[1];
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

exports.index = (req, res) => {
    res.render('index', { title: 'E-Learning Script Generator' });
};

exports.loginRedirect = (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES
    });
    res.redirect(authUrl);
};

exports.loginCallback = async (req, res) => {
    const code = req.query.code;
    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Save tokens to database or session for future use
        req.session.tokens = tokens;
        res.redirect('/export');
    } catch (error) {
        console.error('Error authenticating with Google:', error);
        res.status(500).send('Error authenticating with Google');
    }
};