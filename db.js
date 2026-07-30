const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'elearning.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schema ---
db.exec(`
    CREATE TABLE IF NOT EXISTS jurusan (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        name  TEXT    NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS categories (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        jurusan_id            INTEGER NOT NULL REFERENCES jurusan(id),
        program_studi         TEXT    NOT NULL,
        short_name            TEXT    DEFAULT '',
        moodle_parent_cat_id  INTEGER NOT NULL,
        current_academic_year TEXT,
        academic_year_cat_id  INTEGER
    );

    CREATE TABLE IF NOT EXISTS staged_courses (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id            INTEGER NOT NULL REFERENCES categories(id),
        mata_kuliah            TEXT    NOT NULL,
        nama_kelas             TEXT    NOT NULL,
        enrolment_key_dosen    TEXT    NOT NULL,
        enrolment_key_mhs      TEXT    NOT NULL,
        rps_file_path          TEXT,
        created_at             TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deployments (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id   INTEGER NOT NULL REFERENCES categories(id),
        start_date    TEXT    NOT NULL,
        end_date      TEXT    NOT NULL,
        status        TEXT    DEFAULT 'completed',
        total_courses INTEGER DEFAULT 0,
        processed_courses INTEGER DEFAULT 0,
        created_at    TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deployed_courses (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id          INTEGER NOT NULL REFERENCES deployments(id),
        mata_kuliah            TEXT    NOT NULL,
        nama_kelas             TEXT    NOT NULL,
        enrolment_key_dosen    TEXT,
        enrolment_key_mhs      TEXT,
        moodle_course_id       INTEGER,
        status                 TEXT    DEFAULT 'success',
        error_message          TEXT,
        rps_file_path          TEXT,
        rps_status             TEXT,
        rps_error_message      TEXT
    );
`);

// --- Migrations for existing databases ---
try {
    db.exec(`ALTER TABLE staged_courses ADD COLUMN rps_file_path TEXT`);
} catch (e) {
    // Column already exists
}

try {
    db.exec(`ALTER TABLE deployed_courses ADD COLUMN rps_status TEXT`);
} catch (e) {
    // Column already exists
}

try {
    db.exec(`ALTER TABLE deployed_courses ADD COLUMN rps_error_message TEXT`);
} catch (e) {
    // Column already exists
}

try {
    db.exec(`ALTER TABLE deployed_courses ADD COLUMN rps_file_path TEXT`);
} catch (e) {
    // Column already exists
}


// --- Seed data ---
const JURUSAN_LIST = [
    'Administrasi Bisnis',
    'Akuntansi',
    'Pascasarjana',
    'Teknik Elektro',
    'Teknik Grafika & Penerbitan',
    'Teknik Informatika dan Komputer',
    'Teknik Mesin',
    'Teknik Sipil',
];

// Mapping: program_studi substring → jurusan name
// Order matters — first match wins
const PRODI_TO_JURUSAN = [
    // Administrasi Bisnis
    { match: 'Administrasi Bisnis', jurusan: 'Administrasi Bisnis' },
    { match: 'MICE', jurusan: 'Administrasi Bisnis' },
    { match: 'Manajemen Pemasaran', jurusan: 'Administrasi Bisnis' },
    { match: 'Bahasa Inggris', jurusan: 'Administrasi Bisnis' },
    // Akuntansi
    { match: 'Akuntansi', jurusan: 'Akuntansi' },
    { match: 'Keuangan dan Perbankan', jurusan: 'Akuntansi' },
    { match: 'Manajemen Keuangan', jurusan: 'Akuntansi' },
    // Pascasarjana
    { match: 'Magister', jurusan: 'Pascasarjana' },
    // Teknik Elektro
    { match: 'Broadband', jurusan: 'Teknik Elektro' },
    { match: 'Instrumentasi', jurusan: 'Teknik Elektro' },
    { match: 'Elektronika', jurusan: 'Teknik Elektro' },
    { match: 'Teknik Listrik', jurusan: 'Teknik Elektro' },
    { match: 'Otomasi', jurusan: 'Teknik Elektro' },
    { match: 'Telekomunikasi', jurusan: 'Teknik Elektro' },
    // Teknik Grafika & Penerbitan
    { match: 'Desain Grafis', jurusan: 'Teknik Grafika & Penerbitan' },
    { match: 'Penerbitan', jurusan: 'Teknik Grafika & Penerbitan' },
    { match: 'Jurnalistik', jurusan: 'Teknik Grafika & Penerbitan' },
    { match: 'Cetak', jurusan: 'Teknik Grafika & Penerbitan' },
    // Teknik Informatika dan Komputer
    { match: 'Teknik Informatika', jurusan: 'Teknik Informatika dan Komputer' },
    { match: 'Teknik Komputer', jurusan: 'Teknik Informatika dan Komputer' },
    { match: 'Teknik Multimedia', jurusan: 'Teknik Informatika dan Komputer' },
    // Teknik Mesin
    { match: 'Alat Berat', jurusan: 'Teknik Mesin' },
    { match: 'Konversi Energi', jurusan: 'Teknik Mesin' },
    { match: 'Rekayasa Manufaktur', jurusan: 'Teknik Mesin' },
    { match: 'Pembangkit Energi', jurusan: 'Teknik Mesin' },
    { match: 'Teknik Mesin', jurusan: 'Teknik Mesin' },
    { match: 'Renewable Energy', jurusan: 'Teknik Mesin' },
    { match: 'RESD', jurusan: 'Teknik Mesin' },
    // Teknik Sipil
    { match: 'Konstruksi', jurusan: 'Teknik Sipil' },
    { match: 'Jalan Dan Jembatan', jurusan: 'Teknik Sipil' },
];

function resolveJurusan(programStudi) {
    for (const rule of PRODI_TO_JURUSAN) {
        if (programStudi.includes(rule.match)) {
            return rule.jurusan;
        }
    }
    return null; // unmatched — will need manual assignment
}

function seed() {
    const jurusanCount = db.prepare('SELECT COUNT(*) as count FROM jurusan').get().count;
    if (jurusanCount > 0) {
        return; // already seeded
    }

    console.log('[DB] Seeding jurusan and categories...');

    const insertJurusan = db.prepare('INSERT INTO jurusan (name) VALUES (?)');
    const insertCategory = db.prepare(`
        INSERT INTO categories (jurusan_id, program_studi, moodle_parent_cat_id, current_academic_year, academic_year_cat_id)
        VALUES (?, ?, ?, ?, ?)
    `);

    // Insert jurusan
    const jurusanMap = {};
    for (const name of JURUSAN_LIST) {
        const result = insertJurusan.run(name);
        jurusanMap[name] = result.lastInsertRowid;
    }

    // Load categories from JSON and insert
    const categoriesPath = path.join(__dirname, 'secrets', 'categories.json');
    if (fs.existsSync(categoriesPath)) {
        const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));
        for (const cat of categories) {
            const jurusanName = resolveJurusan(cat.program_studi);
            const jurusanId = jurusanName ? jurusanMap[jurusanName] : null;

            if (!jurusanId) {
                console.warn(`[DB] WARNING: Could not map "${cat.program_studi}" to a jurusan. Skipping.`);
                continue;
            }

            insertCategory.run(
                jurusanId,
                cat.program_studi,
                cat.cat_id,
                cat.current_academic_year || null,
                cat.academic_year_cat_id || null
            );
        }
        console.log(`[DB] Seeded ${JURUSAN_LIST.length} jurusan and ${categories.length} categories.`);
    } else {
        console.warn('[DB] No categories.json found at', categoriesPath, '— skipping category seed.');
    }
}

seed();

module.exports = db;
