const axios = require('axios');
const https = require('https');

const agent = new https.Agent({
    rejectUnauthorized: false  // Skip certificate verification
});

const {token} = require('../../secrets/tokens.json');
const MOODLE_BASE_URL = process.env.MOODLE_BASE_URL || 'https://elearning.pnj.ac.id';
const MOODLE_URL = `${MOODLE_BASE_URL}/webservice/rest/server.php`;

const makeMoodleRequest = async (wsfunction, params) => {
    try {
        const response = await axios.post(MOODLE_URL, null, {
            params: {
                wstoken: token,
                wsfunction: wsfunction,
                moodlewsrestformat: 'json',
                ...params
            },
            httpsAgent: agent
        });
        return response.data;
    } catch (error) {
        console.error('Error making Moodle request:', error.response ? error.response.data : error.message);
        throw error;
    }
};

exports.createCourse = async (name, categoryId, startDate, summary = `Course E-Learning ${name}`) => {
    const params = {
        courses: [
            {
                fullname: name,
                shortname: name,
                categoryid: categoryId,
                startdate: startDate,
                summary: summary,
                numsections: 16
            }
        ]
    };

    const response = await makeMoodleRequest('core_course_create_courses', params);

    if(response[0] !== undefined){
        return response[0].id;
    }else{
        console.error("Failed creating course: ", response.message)
        return false
    }
};

exports.createCourseCategory = async (name,parent, description = `Kategori untuk ${name}`) => {
    const params = {
        categories: [
            {
                name: name,
                parent: parent,
                description: description
            }
        ]
    };
    const response = await makeMoodleRequest('core_course_create_categories', params);
    return response[0].id;
};

const FormData = require('form-data');
const fs = require('fs');

exports.uploadFileToMoodle = async (filePath, fileName) => {
    const uploadUrl = `${MOODLE_BASE_URL}/webservice/upload.php`;
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), fileName);

    try {
        const response = await axios.post(uploadUrl, form, {
            params: {
                token: token
            },
            headers: {
                ...form.getHeaders()
            },
            httpsAgent: agent
        });

        if (Array.isArray(response.data) && response.data.length > 0) {
            return response.data[0]; // returns object containing itemid, etc.
        } else {
            console.error('Unexpected response from Moodle file upload:', response.data);
            return false;
        }
    } catch (error) {
        console.error('Error uploading file to Moodle:', error.response ? error.response.data : error.message);
        throw error;
    }
};

exports.createFileResource = async (courseId, name, draftItemId, section = 0) => {
    const params = {
        courseid: courseId,
        name: name,
        draftitemid: draftItemId,
        section: section
    };

    const response = await makeMoodleRequest('local_rps_create_file_resource', params);

    if (response && response.cmid) {
        return response;
    } else {
        console.error('Failed creating file resource activity:', response);
        return false;
    }
};