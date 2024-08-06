const { google } = require('googleapis');

exports.getRows = async (tokens, spreadsheetId, range) => {
    const oAuth2Client = new google.auth.OAuth2();
    oAuth2Client.setCredentials(tokens);

    const sheets = google.sheets({ version: "v4", auth: oAuth2Client });

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range,
    });

    return response.data.values;
}