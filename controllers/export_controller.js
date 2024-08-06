const { google } = require('googleapis');
const { createObjectCsvStringifier } = require('csv-writer');
const moment = require('moment');
const categories = require('../secrets/categories.json');

exports.renderExportPage = (req, res) => {
    res.render('export', { title: 'E-Learning Script Generator', categories: categories });
};

exports.exportData = async (req, res) => {
    try {
        const oAuth2Client = new google.auth.OAuth2();
        oAuth2Client.setCredentials(req.session.tokens);
        const sheets = google.sheets({ version: "v4", auth: oAuth2Client });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: req.body.spreadsheet_id,
            range: req.body.range,
        });

        const rows = response.data.values;
        const csv_headers = [
            { id: 'shortname', title: 'shortname' }, { id: 'fullname', title: 'fullname' },
            { id: 'category', title: 'category' }, { id: 'visible', title: 'visible' },
            { id: 'startdate', title: 'startdate' }, { id: 'enrolment_1', title: 'enrolment_1' },
            { id: 'enrolment_1_startdate', title: 'enrolment_1_startdate' },
            { id: 'enrolment_1_enddate', title: 'enrolment_1_enddate' },
            { id: 'enrolment_1_role', title: 'enrolment_1_role' },
            { id: 'enrolment_1_password', title: 'enrolment_1_password' },
            { id: 'enrolment_1_delete', title: 'enrolment_1_delete' }
        ];

        let start_date = moment(req.body.start_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
        let end_date = moment(req.body.end_date, 'YYYY-MM-DD').format('YYYY-MM-DD');

        res.setHeader('content-type', 'text/csv');
        res.setHeader('content-disposition', 'attachment; filename=export.csv');

        const csvStringifier = createObjectCsvStringifier({
            header: csv_headers
        });
        res.write(csvStringifier.getHeaderString());

        rows.forEach((row) => {
            let obj = {
                shortname: row[0],
                fullname: row[0],
                category: req.body.cat_id,
                visible: 1,
                startdate: start_date,
                enrolment_1: "self",
                enrolment_1_startdate: start_date,
                enrolment_1_enddate: end_date,
                enrolment_1_role: "editingteacher",
                enrolment_1_password: row[1],
                enrolment_1_delete: 0
            };

            res.write(csvStringifier.stringifyRecords([obj]));
        });

        res.end();

    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);
        res.status(500).send('Error fetching data from Google Sheets');
    }
};