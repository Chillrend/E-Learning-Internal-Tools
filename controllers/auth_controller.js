const { OAuth2Client } = require('google-auth-library');
const secrets = require('../secrets/clients.json');

const CLIENT_ID = secrets.web.client_id;
const CLIENT_SECRET = secrets.web.client_secret;
const REDIRECT_URI = process.env.GOOGLE_AUTH_CALLBACK_URL || secrets.web.redirect_uris[1];
const SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
];
const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

/**
 * Parse the ALLOWED_EMAILS env var into a Set of lowercase emails.
 * Format: comma-separated list, e.g. "alice@pnj.ac.id,bob@pnj.ac.id"
 * If empty or unset, ALL authenticated users are allowed (open access).
 */
function getAllowedEmails() {
    const raw = process.env.ALLOWED_EMAILS || '';
    if (!raw.trim()) return null; // null = no restriction
    return new Set(
        raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    );
}

exports.index = (req, res) => {
    res.render('index', { title: 'E-Learning Script Generator' });
};

exports.loginRedirect = (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "select_account",
    });
    res.redirect(authUrl);
};

exports.loginCallback = async (req, res) => {
    const code = req.query.code;
    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Fetch user email from Google
        const tokenInfo = await oAuth2Client.getTokenInfo(tokens.access_token);
        const userEmail = (tokenInfo.email || '').toLowerCase();

        // Check against allowlist
        const allowed = getAllowedEmails();
        if (allowed && !allowed.has(userEmail)) {
            console.warn(`[Auth] Blocked login attempt from: ${userEmail}`);
            return res.redirect('/forbidden');
        }

        // Save tokens and email to session
        req.session.tokens = tokens;
        req.session.userEmail = userEmail;
        res.redirect('/courses');
    } catch (error) {
        console.error('Error authenticating with Google:', error);
        res.status(500).send('Error authenticating with Google');
    }
};

exports.forbidden = (req, res) => {
    res.status(403).render('forbidden', { title: 'Access Denied' });
};