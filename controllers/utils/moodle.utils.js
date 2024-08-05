const axios = require('axios');

const {token} = require('../secrets/tokens.json');
const MOODLE_URL = 'https://elearning.pnj.ac.id/webservice/rest/server.php';

const makeMoodleRequest = async (wsfunction, params) => {
    try {
        const response = await axios.post(MOODLE_URL, null, {
            params: {
                wstoken: TOKEN,
                wsfunction: wsfunction,
                moodlewsrestformat: 'json',
                ...params
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error making Moodle request:', error.response ? error.response.data : error.message);
        throw error;
    }
};

export const createCourse = async (name, categoryId, summary = `Course E-Learning ${name}`) => {
    const params = {
        courses: [
            {
                fullname: name,
                shortname: name,
                categoryid: categoryId,
                summary: summary
            }
        ]
    };

    const response = await makeMoodleRequest('core_course_create_courses', params);
    return response[0].id;
};

export const createEnrollmentKey = async (courseId, roleId, enrolmentKey) => {
    const params = {
        enrolments: [
            {
                roleid: roleId,
                courseid: courseId,
                enrolmentkey: enrolmentKey
            }
        ]
    };
    await makeMoodleRequest('enrol_manual_enrol_users', params);
};