const db = require('../db');
const mysql = require('mysql2/promise');
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

// --- Render the health check page ---

exports.renderHealthPage = (req, res) => {
    res.render('health', {
        title: 'Connection Diagnostics',
    });
};

// --- SSE endpoint: run checks sequentially and stream results ---

exports.runTests = async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const checks = [
        { step: 1, label: 'Local SQLite Database', fn: checkSQLite },
        { step: 2, label: 'Moodle MySQL Database', fn: checkMoodleDB },
        { step: 3, label: 'Moodle REST API', fn: checkMoodleAPI },
    ];

    let passed = 0;

    for (const check of checks) {
        send({ type: 'start', step: check.step, total: checks.length, label: check.label });

        const start = Date.now();
        try {
            const detail = await check.fn();
            const latencyMs = Date.now() - start;
            passed++;
            send({
                type: 'result',
                step: check.step,
                total: checks.length,
                label: check.label,
                status: 'ok',
                message: detail || 'Connected',
                latencyMs,
            });
        } catch (err) {
            const latencyMs = Date.now() - start;
            send({
                type: 'result',
                step: check.step,
                total: checks.length,
                label: check.label,
                status: 'fail',
                message: err.message || 'Unknown error',
                latencyMs,
            });
        }
    }

    send({
        type: 'done',
        passed,
        total: checks.length,
    });

    res.end();
};

// --- Individual check functions ---

async function checkSQLite() {
    const row = db.prepare('SELECT 1 AS ok').get();
    if (row && row.ok === 1) {
        return 'SELECT 1 returned OK';
    }
    throw new Error('Unexpected result from SELECT 1');
}

async function checkMoodleDB() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        connectTimeout: 5000,
    };

    if (!config.host) throw new Error('DB_HOST not configured in .env');

    const connection = await mysql.createConnection(config);
    try {
        const [rows] = await connection.execute('SELECT 1 AS ok');
        if (rows[0] && rows[0].ok === 1) {
            return `Connected to ${config.host}/${config.database}`;
        }
        throw new Error('Unexpected result from SELECT 1');
    } finally {
        await connection.end();
    }
}

async function checkMoodleAPI() {
    const MOODLE_BASE_URL = process.env.MOODLE_BASE_URL || 'https://elearning.pnj.ac.id';
    const MOODLE_URL = `${MOODLE_BASE_URL}/webservice/rest/server.php`;

    let token;
    try {
        token = require('../secrets/tokens.json').token;
    } catch (e) {
        throw new Error('Could not load API token from secrets/tokens.json');
    }

    if (!token) throw new Error('API token is empty in secrets/tokens.json');

    const response = await axios.post(MOODLE_URL, null, {
        params: {
            wstoken: token,
            wsfunction: 'core_webservice_get_site_info',
            moodlewsrestformat: 'json',
        },
        httpsAgent: agent,
        timeout: 10000,
    });

    const data = response.data;
    const dataJson = JSON.stringify(data);
    console.log(dataJson);
    if (data.exception) {
        throw new Error(`Moodle error: ${data.message || data.exception} ${dataJson}`);
    }

    return `${data.sitename || 'Moodle'} v${data.release || '?'}`;
}
