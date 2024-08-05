const express = require('express');
const router = express.Router();

const {OAuth2Client} = require('google-auth-library');

const moment = require("moment/moment");

router.post('/submit', async (req, res, next) => {
    if (!req.session.tokens) {
        res.redirect('/login/redirect');
    }

    try{
        oAuth2Client.setCredentials(req.session.tokens);
        const sheets = google.sheets({version: "v4", auth: oAuth2Client});
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: req.body.spreadsheet_id,
            range: req.body.range,
        });

        const rows = response.data.values;
        let start_date = moment(req.body.start_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
        let end_date = moment(req.body.end_date, 'YYYY-MM-DD').format('YYYY-MM-DD');

        rows.forEach((row) => {

        })


    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);
        res.status(500).send('Error fetching data from Google Sheets');
    }
})

module.exports = router;