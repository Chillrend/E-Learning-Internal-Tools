const db = require('../db');
const fs = require('fs');
const path = require('path');
const { customAlphabet } = require('nanoid');
const generateEnrolmentKey = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 8);
const { createCourse, createCourseCategory, uploadFileToMoodle, createFileResource } = require('./utils/moodle.utils');
const { createSelfEnrollment } = require('./utils/moodle_db.utils');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit-table');


// --- Helpers ---

function getSemester() {
    const month = new Date().getMonth() + 1;
    return (month >= 1 && month <= 6) ? 'Genap' : 'Ganjil';
}

function getCurrentAcademicYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startYear = (month === 1 || month === 2) ? year - 1 : year;
    return `${startYear}/${startYear + 1}`;
}

// --- Dashboard ---

exports.dashboard = (req, res) => {
    const jurusanList = db.prepare(`
        SELECT j.id, j.name,
               COUNT(DISTINCT c.id) as prodi_count,
               (SELECT COUNT(*) FROM staged_courses sc WHERE sc.category_id IN
                   (SELECT c2.id FROM categories c2 WHERE c2.jurusan_id = j.id)
               ) as staged_count
        FROM jurusan j
        LEFT JOIN categories c ON c.jurusan_id = j.id
        GROUP BY j.id
        ORDER BY j.name
    `).all();

    // For each jurusan, fetch its categories
    const getCategories = db.prepare(`
        SELECT c.*,
               (SELECT COUNT(*) FROM staged_courses sc WHERE sc.category_id = c.id) as staged_count
        FROM categories c
        WHERE c.jurusan_id = ?
        ORDER BY c.program_studi
    `);

    for (const j of jurusanList) {
        j.categories = getCategories.all(j.id);
    }

    res.render('courses/dashboard', {
        title: 'Course Management',
        jurusanList,
    });
};

// --- Category staging area ---

exports.showCategory = (req, res) => {
    const category = db.prepare(`
        SELECT c.*, j.name as jurusan_name
        FROM categories c
        JOIN jurusan j ON j.id = c.jurusan_id
        WHERE c.id = ?
    `).get(req.params.categoryId);

    if (!category) return res.status(404).send('Category not found');

    const stagedCourses = db.prepare(`
        SELECT * FROM staged_courses
        WHERE category_id = ?
        ORDER BY created_at DESC
    `).all(category.id);

    const recentDeployments = db.prepare(`
        SELECT d.*,
               (SELECT COUNT(*) FROM deployed_courses dc WHERE dc.deployment_id = d.id) as course_count,
               (SELECT COUNT(*) FROM deployed_courses dc WHERE dc.deployment_id = d.id AND dc.status = 'success') as success_count,
               (SELECT COUNT(*) FROM deployed_courses dc WHERE dc.deployment_id = d.id AND dc.status = 'failed') as failed_count
        FROM deployments d
        WHERE d.category_id = ?
        ORDER BY d.created_at DESC
        LIMIT 10
    `).all(category.id);

    res.render('courses/category', {
        title: `${category.program_studi}`,
        category,
        stagedCourses,
        recentDeployments,
        hasStagedCourses: stagedCourses.length > 0,
    });
};

// --- Add courses form ---

exports.renderAddForm = (req, res) => {
    const category = db.prepare(`
        SELECT c.*, j.name as jurusan_name
        FROM categories c
        JOIN jurusan j ON j.id = c.jurusan_id
        WHERE c.id = ?
    `).get(req.params.categoryId);

    if (!category) return res.status(404).send('Category not found');

    res.render('courses/add', {
        title: `Add Courses — ${category.program_studi}`,
        category,
    });
};

// --- Add courses POST ---

exports.addCourses = (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
    if (!category) return res.status(404).send('Category not found');

    const { mata_kuliah, nama_kelas_pattern, generate_multiple, class_count } = req.body;
    const rpsFilePath = req.file ? req.file.path : null;

    const insert = db.prepare(`
        INSERT INTO staged_courses (category_id, mata_kuliah, nama_kelas, enrolment_key_dosen, enrolment_key_mhs, rps_file_path)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((courses) => {
        for (const course of courses) {
            insert.run(categoryId, course.mata_kuliah, course.nama_kelas, course.key_dosen, course.key_mhs, rpsFilePath);
        }
    });

    const courses = [];

    if (generate_multiple === 'on') {
        const count = Math.min(Math.max(parseInt(class_count) || 1, 1), 26);
        for (let i = 0; i < count; i++) {
            const letter = String.fromCharCode(65 + i); // A, B, C...
            const namaKelas = nama_kelas_pattern.replace(/\{X\}/g, letter);
            courses.push({
                mata_kuliah,
                nama_kelas: namaKelas,
                key_dosen: generateEnrolmentKey(),
                key_mhs: generateEnrolmentKey(),
            });
        }
    } else {
        // Single class — use the pattern field literally as the name
        courses.push({
            mata_kuliah,
            nama_kelas: nama_kelas_pattern,
            key_dosen: generateEnrolmentKey(),
            key_mhs: generateEnrolmentKey(),
        });
    }

    insertMany(courses);

    res.redirect(`/courses/${categoryId}`);
};

// --- Delete staged course ---

exports.deleteStagedCourse = (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    const courseId = parseInt(req.params.id);

    const staged = db.prepare('SELECT rps_file_path FROM staged_courses WHERE id = ? AND category_id = ?').get(courseId, categoryId);
    db.prepare('DELETE FROM staged_courses WHERE id = ? AND category_id = ?').run(courseId, categoryId);

    if (staged && staged.rps_file_path) {
        const count = db.prepare('SELECT COUNT(*) as count FROM staged_courses WHERE rps_file_path = ?').get(staged.rps_file_path).count;
        if (count === 0 && fs.existsSync(staged.rps_file_path)) {
            try {
                fs.unlinkSync(staged.rps_file_path);
            } catch (e) {
                console.error('Error deleting RPS file:', e.message);
            }
        }
    }

    res.redirect(`/courses/${categoryId}`);
};


// --- Deploy page (dry-run) ---

exports.renderDeployPage = (req, res) => {
    const category = db.prepare(`
        SELECT c.*, j.name as jurusan_name
        FROM categories c
        JOIN jurusan j ON j.id = c.jurusan_id
        WHERE c.id = ?
    `).get(req.params.categoryId);

    if (!category) return res.status(404).send('Category not found');

    let stagedCourses;
    let selectedIds = '';
    
    if (req.query.ids) {
        selectedIds = req.query.ids;
        const ids = req.query.ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
        if (ids.length === 0) return res.redirect(`/courses/${category.id}`);
        const placeholders = ids.map(() => '?').join(',');
        stagedCourses = db.prepare(`
            SELECT * FROM staged_courses
            WHERE category_id = ? AND id IN (${placeholders})
            ORDER BY nama_kelas
        `).all(category.id, ...ids);
    } else {
        stagedCourses = db.prepare(`
            SELECT * FROM staged_courses
            WHERE category_id = ?
            ORDER BY nama_kelas
        `).all(category.id);
    }

    if (stagedCourses.length === 0) {
        return res.redirect(`/courses/${category.id}`);
    }

    const semester = getSemester();
    const academicYear = category.current_academic_year || getCurrentAcademicYear();
    const shortName = category.short_name || category.program_studi;

    const mappedCourses = stagedCourses.map(staged => {
        return {
            ...staged,
            final_course_name: `${shortName}-${staged.mata_kuliah}-${staged.nama_kelas}-${academicYear}-${semester}`
        };
    });

    res.render('courses/deploy', {
        title: `Deploy Courses — ${category.program_studi}`,
        category,
        stagedCourses: mappedCourses,
        courseCount: mappedCourses.length,
        selectedIds: selectedIds,
    });
};

// --- Deploy courses POST ---

exports.deployCourses = async (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    const category = db.prepare(`
        SELECT c.*, j.name as jurusan_name
        FROM categories c
        JOIN jurusan j ON j.id = c.jurusan_id
        WHERE c.id = ?
    `).get(categoryId);

    if (!category) return res.status(404).send('Category not found');

    const { start_date, end_date, ids: selectedIdsStr } = req.body;
    const startTimestamp = Math.floor(new Date(start_date).getTime() / 1000);

    let stagedCourses;
    let selectedIds = [];
    if (selectedIdsStr) {
        selectedIds = selectedIdsStr.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
        if (selectedIds.length === 0) return res.redirect(`/courses/${category.id}`);
        const placeholders = selectedIds.map(() => '?').join(',');
        stagedCourses = db.prepare(`
            SELECT * FROM staged_courses WHERE category_id = ? AND id IN (${placeholders}) ORDER BY nama_kelas
        `).all(categoryId, ...selectedIds);
    } else {
        stagedCourses = db.prepare(`
            SELECT * FROM staged_courses WHERE category_id = ? ORDER BY nama_kelas
        `).all(categoryId);
    }

    if (stagedCourses.length === 0) {
        return res.redirect(`/courses/${categoryId}`);
    }

    // Create deployment record
    const deployment = db.prepare(`
        INSERT INTO deployments (category_id, start_date, end_date, status, total_courses, processed_courses) VALUES (?, ?, ?, 'processing', ?, 0)
    `).run(categoryId, start_date, end_date, stagedCourses.length);
    const deploymentId = deployment.lastInsertRowid;

    // Start background job
    processDeploymentBackground(deploymentId, category, stagedCourses, startTimestamp);

    // Redirect to the detail page, which will poll
    res.redirect(`/courses/${categoryId}/history/${deploymentId}`);
};

// Add background processing function
async function processDeploymentBackground(deploymentId, category, stagedCourses, startTimestamp) {
    const insertDeployed = db.prepare(`
        INSERT INTO deployed_courses (deployment_id, mata_kuliah, nama_kelas, enrolment_key_dosen, enrolment_key_mhs, moodle_course_id, status, error_message, rps_file_path, rps_status, rps_error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateDeployment = db.prepare(`
        UPDATE deployments SET processed_courses = processed_courses + 1 WHERE id = ?
    `);

    const finishDeployment = db.prepare(`
        UPDATE deployments SET status = ? WHERE id = ?
    `);

    let failedAny = false;

    for (const staged of stagedCourses) {
        const result = {
            nama_kelas: staged.nama_kelas,
            mata_kuliah: staged.mata_kuliah,
            enrolment_key_dosen: staged.enrolment_key_dosen,
            enrolment_key_mhs: staged.enrolment_key_mhs,
            status: 'success',
            moodle_course_id: null,
            error_message: null,
            rps_status: null,
            rps_error_message: null
        };

        const semester = getSemester();
        const academicYear = category.current_academic_year || getCurrentAcademicYear();
        const shortName = category.short_name || category.program_studi;
        const finalCourseName = `${shortName}-${staged.mata_kuliah}-${staged.nama_kelas}-${academicYear}-${semester}`;

        try {
            // Create course in Moodle
            const moodleCourseId = await createCourse(
                finalCourseName,
                category.academic_year_cat_id,
                startTimestamp
            );

            if (!moodleCourseId) {
                result.status = 'failed';
                result.error_message = 'Moodle API returned no course ID';
            } else {
                result.moodle_course_id = moodleCourseId;

                // Create teacher enrolment
                const teacherEnrol = await createSelfEnrollment(
                    moodleCourseId, 3, staged.enrolment_key_dosen, `Teacher for ${finalCourseName}`
                );
                if (!teacherEnrol) {
                    result.error_message = (result.error_message || '') + 'Teacher enrolment failed. ';
                }

                // Create student enrolment
                const studentEnrol = await createSelfEnrollment(
                    moodleCourseId, 5, staged.enrolment_key_mhs, `Student for ${finalCourseName}`
                );
                if (!studentEnrol) {
                    result.error_message = (result.error_message || '') + 'Student enrolment failed. ';
                }

                // Upload & Create RPS file activity if RPS file is attached
                if (staged.rps_file_path && fs.existsSync(staged.rps_file_path)) {
                    try {
                        const ext = path.extname(staged.rps_file_path);
                        const rpsFileName = `RPS - ${staged.mata_kuliah}${ext}`;
                        const uploadRes = await uploadFileToMoodle(staged.rps_file_path, rpsFileName);

                        if (uploadRes && uploadRes.itemid) {
                            const resourceRes = await createFileResource(
                                moodleCourseId,
                                `RPS - ${staged.mata_kuliah}`,
                                uploadRes.itemid,
                                0 // Section 0 (General)
                            );

                            if (resourceRes && resourceRes.cmid) {
                                result.rps_status = 'success';
                            } else {
                                result.rps_status = 'failed';
                                result.rps_error_message = 'Failed to create RPS activity on Moodle (local_rps plugin response invalid)';
                            }
                        } else {
                            result.rps_status = 'failed';
                            result.rps_error_message = 'Failed to upload RPS file to Moodle draft area';
                        }
                    } catch (rpsErr) {
                        result.rps_status = 'failed';
                        result.rps_error_message = rpsErr.message || 'Unknown error during RPS upload';
                        console.error('[Deployment] RPS Upload Error:', rpsErr);
                    }
                }
            }
        } catch (err) {
            result.status = 'failed';
            result.error_message = err.message || 'Unknown error';
        }

        if (result.status === 'failed') failedAny = true;

        // Record in deployed_courses
        insertDeployed.run(
            deploymentId,
            result.mata_kuliah,
            result.nama_kelas,
            result.enrolment_key_dosen,
            result.enrolment_key_mhs,
            result.moodle_course_id,
            result.status,
            result.error_message,
            staged.rps_file_path || null,
            result.rps_status,
            result.rps_error_message
        );

        // Delete from staged_courses
        db.prepare('DELETE FROM staged_courses WHERE id = ?').run(staged.id);

        // Update processed count
        updateDeployment.run(deploymentId);
    }

    cleanupOrphanRpsFiles();

    finishDeployment.run(failedAny ? 'completed_with_errors' : 'completed', deploymentId);
}

function cleanupOrphanRpsFiles() {
    try {
        const stagedRows = db.prepare('SELECT DISTINCT rps_file_path FROM staged_courses WHERE rps_file_path IS NOT NULL').all();
        const deployedRows = db.prepare('SELECT DISTINCT rps_file_path FROM deployed_courses WHERE rps_file_path IS NOT NULL').all();
        const activeFiles = new Set([
            ...stagedRows.map(r => r.rps_file_path),
            ...deployedRows.map(r => r.rps_file_path)
        ]);
        const dir = path.join(__dirname, '../uploads/rps');
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                if (!activeFiles.has(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            }
        }
    } catch (e) {
        console.error('Error cleaning up orphan RPS files:', e.message);
    }
}


// --- Edit category ---

exports.editCategory = (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    const { moodle_parent_cat_id, academic_year_cat_id, short_name, current_academic_year } = req.body;

    db.prepare(`
        UPDATE categories
        SET moodle_parent_cat_id = ?, 
            academic_year_cat_id = ?,
            short_name = ?,
            current_academic_year = ?
        WHERE id = ?
    `).run(
        parseInt(moodle_parent_cat_id),
        academic_year_cat_id ? parseInt(academic_year_cat_id) : null,
        short_name || '',
        current_academic_year || null,
        categoryId
    );

    res.redirect(`/courses/${categoryId}`);
};

// --- Create semester category ---

exports.createSemesterCategory = async (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);

    if (!category) return res.status(404).send('Category not found');

    const currentYear = getCurrentAcademicYear();
    const semester = getSemester();
    const categoryName = `${currentYear}-${semester}`;

    try {
        const newCatId = await createCourseCategory(categoryName, category.moodle_parent_cat_id);

        if (newCatId) {
            db.prepare(`
                UPDATE categories
                SET academic_year_cat_id = ?, current_academic_year = ?
                WHERE id = ?
            `).run(newCatId, currentYear, categoryId);
        }

        res.redirect(`/courses/${categoryId}`);
    } catch (err) {
        console.error('[CreateSemesterCategory] Error:', err);
        res.status(500).send(`Error creating semester category: ${err.message}`);
    }
};

// --- Deployment history ---

exports.deploymentHistory = (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    const category = db.prepare(`
        SELECT c.*, j.name as jurusan_name
        FROM categories c
        JOIN jurusan j ON j.id = c.jurusan_id
        WHERE c.id = ?
    `).get(categoryId);

    if (!category) return res.status(404).send('Category not found');

    const deployments = db.prepare(`
        SELECT d.*,
               (SELECT COUNT(*) FROM deployed_courses dc WHERE dc.deployment_id = d.id) as course_count,
               (SELECT COUNT(*) FROM deployed_courses dc WHERE dc.deployment_id = d.id AND dc.status = 'success') as success_count,
               (SELECT COUNT(*) FROM deployed_courses dc WHERE dc.deployment_id = d.id AND dc.status = 'failed') as failed_count
        FROM deployments d
        WHERE d.category_id = ?
        ORDER BY d.created_at DESC
    `).all(categoryId);

    res.render('courses/history', {
        title: `Deployment History — ${category.program_studi}`,
        category,
        deployments,
        hasDeployments: deployments.length > 0,
    });
};

// --- Deployment detail ---

exports.deploymentDetail = (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    const deploymentId = parseInt(req.params.deploymentId);

    const category = db.prepare(`
        SELECT c.*, j.name as jurusan_name
        FROM categories c
        JOIN jurusan j ON j.id = c.jurusan_id
        WHERE c.id = ?
    `).get(categoryId);

    if (!category) return res.status(404).send('Category not found');

    const deployment = db.prepare('SELECT * FROM deployments WHERE id = ? AND category_id = ?')
        .get(deploymentId, categoryId);

    if (!deployment) return res.status(404).send('Deployment not found');

    const courses = db.prepare(`
        SELECT * FROM deployed_courses
        WHERE deployment_id = ?
        ORDER BY nama_kelas
    `).all(deploymentId);

    const successCount = courses.filter(c => c.status === 'success').length;
    const failedCount = courses.filter(c => c.status === 'failed').length;

    let progressPercent = 0;
    if (deployment.total_courses > 0) {
        progressPercent = Math.round((deployment.processed_courses / deployment.total_courses) * 100);
    }

    res.render('courses/history-detail', {
        title: `Deployment #${deploymentId} — ${category.program_studi}`,
        category,
        deployment,
        courses,
        successCount,
        failedCount,
        totalCount: courses.length,
        progressPercent
    });
};

exports.deploymentStatus = (req, res) => {
    const deploymentId = parseInt(req.params.deploymentId);
    const categoryId = parseInt(req.params.categoryId);
    const deployment = db.prepare('SELECT status, total_courses, processed_courses FROM deployments WHERE id = ? AND category_id = ?').get(deploymentId, categoryId);
    if (!deployment) return res.status(404).json({ error: 'Not found' });
    res.json(deployment);
};

exports.reuseDeployment = (req, res) => {
    const deploymentId = parseInt(req.params.deploymentId);
    const categoryId = parseInt(req.params.categoryId);
    const courses = db.prepare('SELECT mata_kuliah, nama_kelas, enrolment_key_dosen, enrolment_key_mhs, rps_file_path FROM deployed_courses WHERE deployment_id = ?').all(deploymentId);
    
    if (courses.length > 0) {
        const insert = db.prepare(`
            INSERT INTO staged_courses (category_id, mata_kuliah, nama_kelas, enrolment_key_dosen, enrolment_key_mhs, rps_file_path)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const insertMany = db.transaction((coursesToInsert) => {
            for (const course of coursesToInsert) {
                // Only carry rps_file_path if the file still exists on disk
                const rpsPath = (course.rps_file_path && fs.existsSync(course.rps_file_path)) ? course.rps_file_path : null;
                insert.run(categoryId, course.mata_kuliah, course.nama_kelas, course.enrolment_key_dosen, course.enrolment_key_mhs, rpsPath);
            }
        });
        insertMany(courses);
    }
    res.redirect(`/courses/${categoryId}`);
};

exports.deleteBatchStagedCourses = (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    const { ids } = req.body;
    if (ids && ids.length > 0) {
        const idList = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
        if (idList.length > 0) {
            const placeholders = idList.map(() => '?').join(',');
            db.prepare(`DELETE FROM staged_courses WHERE category_id = ? AND id IN (${placeholders})`).run(categoryId, ...idList);
            cleanupOrphanRpsFiles();
        }
    }
    res.redirect(`/courses/${categoryId}`);
};

exports.deleteAllStagedCourses = (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    db.prepare('DELETE FROM staged_courses WHERE category_id = ?').run(categoryId);
    cleanupOrphanRpsFiles();
    res.redirect(`/courses/${categoryId}`);
};


exports.exportDeployment = async (req, res) => {
    const deploymentId = parseInt(req.params.deploymentId);
    const categoryId = parseInt(req.params.categoryId);
    const format = req.params.format;

    const category = db.prepare(`
        SELECT c.*, j.name as jurusan_name
        FROM categories c
        JOIN jurusan j ON j.id = c.jurusan_id
        WHERE c.id = ?
    `).get(categoryId);

    if (!category) return res.status(404).send('Category not found');

    const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
    if (!deployment) return res.status(404).send('Deployment not found');

    const courses = db.prepare('SELECT * FROM deployed_courses WHERE deployment_id = ? ORDER BY nama_kelas').all(deploymentId);

    const MOODLE_BASE_URL = process.env.MOODLE_BASE_URL || 'https://elearning.pnj.ac.id';
    const sanitizedTitle = category.program_studi.replace(/[^a-z0-9]/gi, '_');

    if (format === 'xlsx') {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Deployment History');

        sheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'Nama Kelas', key: 'nama_kelas', width: 25 },
            { header: 'Mata Kuliah', key: 'mata_kuliah', width: 40 },
            { header: 'Enrolment Key Dosen', key: 'key_dosen', width: 20 },
            { header: 'Enrolment Key Mahasiswa', key: 'key_mhs', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Moodle Link / Error', key: 'link', width: 50 },
        ];

        courses.forEach((c, idx) => {
            sheet.addRow({
                no: idx + 1,
                nama_kelas: c.nama_kelas,
                mata_kuliah: c.mata_kuliah,
                key_dosen: c.enrolment_key_dosen,
                key_mhs: c.enrolment_key_mhs,
                status: c.status,
                link: c.moodle_course_id ? `${MOODLE_BASE_URL}/course/view.php?id=${c.moodle_course_id}` : (c.error_message || 'Failed')
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Deployment_${deploymentId}_${sanitizedTitle}.xlsx"`);
        await workbook.xlsx.write(res);
        return res.end();
    } else if (format === 'pdf') {
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Deployment_${deploymentId}_${sanitizedTitle}.pdf"`);
        doc.pipe(res);

        doc.fontSize(16).text(`Deployment #${deploymentId} - ${category.program_studi}`, { align: 'center' });
        doc.moveDown();

        const table = {
            headers: ["No", "Nama Kelas", "Mata Kuliah", "Key Dosen", "Key Mahasiswa", "Status"],
            rows: courses.map((c, idx) => [
                (idx + 1).toString(),
                c.nama_kelas,
                c.mata_kuliah,
                c.enrolment_key_dosen,
                c.enrolment_key_mhs,
                c.status === 'success' ? 'Success' : 'Failed'
            ])
        };

        try {
            await doc.table(table, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
                prepareRow: () => doc.font("Helvetica").fontSize(9)
            });
        } catch (e) {
            console.error(e);
        }

        doc.end();
    } else {
        return res.status(400).send('Invalid format');
    }
};
