const {createObjectCsvStringifier} = require('csv-writer');
const moment = require('moment');
const categories = require('../secrets/categories.json');
const {getRows} = require('./utils/googlesheet.utils')
const {createCourseCategory, createCourse} = require('./utils/moodle.utils')
const {createSelfEnrollment} = require('./utils/moodle_db.utils')
const fs = require('fs');
const path = require('path');

exports.renderExportPage = (req, res) => {
    res.render('export', {title: 'E-Learning Script Generator', categories: categories});
};

exports.exportData = async (req, res) => {
    try {
        const rows = getRows(req.session.token, req.body.spreadsheet_id, req.body.range)
        const csv_headers = [
            {id: 'shortname', title: 'shortname'}, {id: 'fullname', title: 'fullname'},
            {id: 'category', title: 'category'}, {id: 'visible', title: 'visible'},
            {id: 'startdate', title: 'startdate'}, {id: 'enrolment_1', title: 'enrolment_1'},
            {id: 'enrolment_1_startdate', title: 'enrolment_1_startdate'},
            {id: 'enrolment_1_enddate', title: 'enrolment_1_enddate'},
            {id: 'enrolment_1_role', title: 'enrolment_1_role'},
            {id: 'enrolment_1_password', title: 'enrolment_1_password'},
            {id: 'enrolment_1_delete', title: 'enrolment_1_delete'}
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

exports.createCategory = async (req, res) => {
    const current_academic_year = getCurrentAcademicYear();
    const filePath = path.join(__dirname, '../secrets/categories.json');
    let write_to_category = categories;

    let log = "Creating new categories..."

    for (let i = 0; i < write_to_category.length; i++) {
        const category = categories[i];
        if (category.current_academic_year === current_academic_year) {
            res.send("Category already created for current academic year");
            break;
        }

        const create = await createCourseCategory(`${current_academic_year}-${getSemester()}`, category.cat_id)

        if (create) {
            write_to_category[i].current_academic_year = current_academic_year;
            write_to_category[i].academic_year_cat_id = create;
            log += `\n <br> Succesfully created new category: ${category.program_studi}`
        } else {
            log += `\n <br>  Failed to create new category ${category.program_studi}`
        }
    }

    fs.writeFileSync(filePath, JSON.stringify(write_to_category, null, 2));
    res.send(log);
}

exports.renderDryRunPage = async (req, res, next) => {
    const category = categories.find(c => c.cat_id === parseInt(req.body.cat_id))
    if (!category) {
        return res.status(404).send('Category not found');
    }
    console.log(category);
    const start_date = req.body.start_date
    const end_date = req.body.end_date

    try {
        const rows = await getRows(req.session.tokens, req.body.spreadsheet_id, req.body.range)
        res.render('dry-run', {
            title: 'E-Learning Script Generator',
            rows: rows,
            category: `${category.program_studi}, Category ID in e-learning: ${category.academic_year_cat_id}`,
            category_id: category.academic_year_cat_id,
            enrolmentStartDate: start_date,
            enrolmentEndDate: end_date
        });

    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);
        res.status(500).send('Error fetching data from Google Sheets');
    }
};

exports.createCourses = async (req, res, next) => {
    const category = categories.find(c => c.cat_id === parseInt(req.body.cat_id))
    if (!category) {
        return res.status(404).send('Category not found');
    }
    const start_date = req.body.start_date
    const end_date = req.body.end_date

    let log = `Creating courses for ${category.program_studi}, if one or two courses fails, please create it manually later`;


    let rows = await getRows(req.session.tokens, req.body.spreadsheet_id, req.body.range)

    for (let i = 0; i < rows.length; i++) {
        const course = await createCourse(rows[i][0], category.academic_year_cat_id)
        if (course) {
            rows[i][3] = `<a href="https://elearning.pnj.ac.id/course/view.php?id=${course}">${rows[i][0]}</a>`
        } else {
            rows[i][3] = `FAILED! ${rows[i][0]}`
            continue;
        }

        console.log(`Creating enrolment for dosen for ${rows[i][0]}, enrolment key: ${rows[i][1]}`);
        const enrolment_key_dosen = await createSelfEnrollment(course, 3, rows[i][1], `Teacher for ${rows[i][0]}`);
        rows[i][4] = enrolment_key_dosen ? `${rows[i][1]}` : `FAIL! ${rows[i][1]}`

        console.log(`Creating enrolment for mhs for ${rows[i][0]}, enrolment key: ${rows[i][2]}`);
        const enrolment_key_mhs = await createSelfEnrollment(course, 5, rows[i][2], `Student for ${rows[i][0]}`);
        rows[i][5] = enrolment_key_mhs ? `${rows[i][2]}` : `FAIL! ${rows[i][2]}`
    }

    res.render('run', {
        title: 'E-Learning Script Generator',
        rows: rows,
        category: `${category.program_studi}, Category ID in e-learning: ${category.academic_year_cat_id}`,
        category_id: category.academic_year_cat_id,
        enrolmentStartDate: start_date,
        enrolmentEndDate: end_date
    });


};

const getSemester = () => {
    const now = new Date();
    const month = now.getMonth() + 1; // getMonth() returns 0-11, so add 1 to get 1-12

    if (month >= 1 && month <= 6) {
        return "Genap"; // January to June
    } else {
        return "Ganjil"; // July to December
    }
};

const getCurrentAcademicYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // getMonth() returns 0-11, so add 1 to get 1-12

    // If the current month is January or February, use the previous year for the start of the academic year
    const startYear = (month === 1 || month === 2) ? year - 1 : year;
    const endYear = startYear + 1;

    return `${startYear}/${endYear}`;
};

