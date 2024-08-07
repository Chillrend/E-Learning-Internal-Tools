const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
};

exports.createSelfEnrollment = async (courseId, roleId, enrolmentKey, name) => {
    const connection = await mysql.createConnection(dbConfig);

    try {
        // Insert self enrollment method into the 'mdl_enrol' table
        const [result] = await connection.execute(
            `INSERT INTO mdl_enrol (enrol, courseid, customint4, customint6, password, roleid, name, status)
       VALUES ('self', ?, 1, 1, ?, ?, ?, 0)`,
            [courseId, enrolmentKey, roleId, name]
        );

        console.log('Self-enrollment method added with ID:', result.insertId);
        return result.insertId;
    } catch (error) {
        console.error('Error inserting self-enrollment method:', error.message);
        return false;
    } finally {
        await connection.end();
    }
};
