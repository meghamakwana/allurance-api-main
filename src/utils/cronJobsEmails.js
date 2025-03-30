const { sendEmail } = require('../utils/emailService');
const pool = require('../utils/db');
const TABLE = require('../utils/tables')
const userTable = TABLE.USERS;
const userDetailTable = TABLE.USER_DETAILS;
const cartTable = TABLE.CART;
const productTable = TABLE.PRODUCT;
const send_bday_anniversary_email = async (req, res) => {
    try {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, "0"); // MM
        const day = String(today.getDate()).padStart(2, "0"); // DD

        const getBirthdayQuery = `
            SELECT email FROM ${userDetailTable} LEFT JOIN ${userTable} ON ${userDetailTable}.user_id = ${userTable}.id
            WHERE DATE_FORMAT(date_of_birth, '%m-%d') = ?;
        `;
        const getAnniversaryQuery = `
            SELECT email FROM ${userDetailTable} LEFT JOIN ${userTable} ON ${userDetailTable}.user_id = ${userTable}.id
            WHERE DATE_FORMAT(anniversary, '%m-%d') = ?;
        `;

        const [birthdayUsers] = await pool.query(getBirthdayQuery, [`${month}-${day}`]);
        const [anniversaryUsers] = await pool.query(getAnniversaryQuery, [`${month}-${day}`]);
        const brthdaySubject = `🎉 Happy Birthday to Our Amazing Users! 🎂`;

        const birthdayBody = `<h2>Dear,</h2>
                       <p>Wishing you a fantastic birthday filled with love and joy! 🎈🎁</p>
                       <p>Best wishes,</p>
                       <p>Allurance Team</p>`;
        const anniversarySubject = `🎉 Happy Anniversary to Our Amazing Users! 🎂`;
        const anniversaryBody = `<h2>Dear,</h2>
                       <p>Wishing you a fantastic anniversary filled with love and joy! 💑💍</p>
                       <p>Best wishes,</p>
                       <p>Allurance Team</p>`;
        const birthdayEmailArray = birthdayUsers.map((row) => row.email);
        const anniversaryEmailArray = anniversaryUsers.map((row) => row.email);
        // Use emailArray as needed
        if (birthdayEmailArray.length > 0) {
            await sendEmail(
                birthdayEmailArray,
                brthdaySubject,
                birthdayBody,
                true // Set to true for HTML email
            );

        }
        if (anniversaryEmailArray.length > 0) {
            await sendEmail(
                anniversaryEmailArray,
                anniversarySubject,
                anniversaryBody,
                true // Set to true for HTML email
            );
        }
        return "Email Successfully Sent";
    } catch (error) {
        return `Error occurred: ${error.message}`;
    }
}

const send_restock_and_cart_reminder_email = async (req, res) => {
    try {
        const getReminderUsersQuery = `
             SELECT u.email,c.id as cart_id
            FROM ${cartTable} c
            JOIN ${userDetailTable} u ON c.user_id = u.id
            JOIN ${productTable} p ON c.product_id = p.id
            WHERE TIMESTAMPDIFF(HOUR, c.created_at, NOW()) >= 5 AND c.status = 1 AND c.reminder_email_sent = 0`;

        const [reminderUsers] = await pool.query(getReminderUsersQuery);
        const reminderSubject = "🛍️ Items in Your Cart!";
        const reminderBody = `<p>Don't forget about your cart iteams! Complete your purchase before it's gone. 🛒</p>`;

        const reminderEmailArray = reminderUsers.map((row) => row.email);
        const reminderCartIds = reminderUsers.map((row) => row.id);
        // Use emailArray as needed
        if (reminderEmailArray.length > 0) {
            await sendEmail(
                emailArray,
                reminderSubject,
                reminderBody,
                true // Set to true for HTML email
            );
            await pool.query(`UPDATE ${cartTable} SET reminder_email_sent = 1, updated_at = NOW() WHERE id IN(?)`, [reminderCartIds]);

        }
        const getRestockUsersQuery = `
            SELECT u.email , c.id as cart_id
        FROM ${cartTable} c
        JOIN ${userDetailTable} u ON c.user_id = u.id
        JOIN ${productTable} p ON c.product_id = p.id
        WHERE (p.stock - p.sell_stock) > 0 AND status = 1 AND is_restock_email_sent = 0`;

        const [restockUsers] = await pool.query(getRestockUsersQuery);
        const restockSubject = "✅ Back in Stock!";
        const restockBody = `<p>Your favorite product is back in stock! Order now before it sells out again. 🚀</p>`;

        const restockEmailArray = restockUsers.map((row) => row.email);
        const restockIdArray = restockUsers.map((row) => row.id);
        // Use emailArray as needed
        if (restockEmailArray.length > 0) {
            await sendEmail(
                restockEmailArray,
                restockSubject,
                restockBody,
                true // Set to true for HTML email
            );
            await pool.query(`UPDATE ${cartTable} SET is_restock_email_sent = 1, updated_at = NOW() WHERE id IN(?)`, [restockIdArray]);
        }
        return "Email Successfully Sent";
    } catch (error) {
        return `Error occurred: ${error.message}`;
    }
}

module.exports = { send_bday_anniversary_email, send_restock_and_cart_reminder_email };
