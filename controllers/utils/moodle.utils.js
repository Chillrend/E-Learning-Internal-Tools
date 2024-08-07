const axios = require('axios');
const https = require('https');

const agent = new https.Agent({
    rejectUnauthorized: false  // Skip certificate verification
});

const {token} = require('../../secrets/tokens.json');
const MOODLE_URL = 'https://elearning.pnj.ac.id/webservice/rest/server.php';

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

exports.createCourse = async (name, categoryId, summary = `Course E-Learning ${name}`) => {
    const params = {
        courses: [
            {
                fullname: name,
                shortname: name,
                categoryid: categoryId,
                summary: summary,
                numsections: 16
            }
        ]
    };

    const response = await makeMoodleRequest('core_course_create_courses', params);

    if(response[0].id){
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