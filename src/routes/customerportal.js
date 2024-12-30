const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, checkEmailExistOrNot, checkPhoneExistOrNot, processDocuments } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');

const router = express.Router();

// Table Name
const tableName = TABLE.USERS;
const tableName2 = TABLE.USER_DETAILS;
const tableName3 = TABLE.ROLES;

router.get('/:id?', async (req, res) => {
    try {
        await authenticateToken(req);

        // Extract ID from URL path or query parameters
        const id = req.params.id || req.query.id;

        // Define the base query
        const baseQuery = `SELECT u.*, u.status as record_status, ir.name as rolename, ud.date_of_birth, ud.anniversary, ud.gender, ud.address, ud.state, ud.district, ud.pincode, ud.govt_id_number, ud.govt_id_upload, ud.pan_number, ud.pan_upload FROM \`${tableName}\` as u LEFT JOIN \`${tableName2}\` as ud on ud.user_id = u.id LEFT JOIN \`${tableName3}\` as ir on ir.id = u.role_id WHERE u.role_id = 9`;

        if (id) {
            // Query by ID
            const query1 = `${baseQuery} AND u.id = ? ORDER BY u.id DESC`;
            const [results] = await pool.query(query1, [id]);

            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        // Query all records if no ID is provided
        const query2 = `${baseQuery} ORDER BY u.id DESC`;
        const [results] = await pool.query(query2);

        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }

        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


router.post('/subject', async (req, res) => {
    try {
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title fields are required', status: false });
        }

        const [insertResult] = await pool.query(`INSERT INTO ${TABLE.TICKET_SUBJECT} (title) VALUES (?)`, [title]);
        const insertedRecordId = insertResult[0].insertId;
        if (insertedRecordId > 0) {
            return res.status(201).json({ data: insertedRecordId, message: 'Created successfully', status: true });
        }

        return res.status(404).json({ error: 'Could not Create', status: false });

    } catch (error) {
        return res.status(500).json({ error: `Error occurred: ${error.message}`, status: false });
    }
});

router.put('/subject', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        const [existingRecord] = await getRecordById(id, TABLE.TICKET_SUBJECT, 'id');

        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const { title } = await req.body;

        await pool.query(`UPDATE ${TABLE.TICKET_SUBJECT} SET title = ?, updated_at = NOW() WHERE id = ?`, [title, id]);

        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, TABLE.TICKET_SUBJECT, 'id');

        //  await activityLog(ine_tickets_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.delete('/subject', async (req, res) => {

    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));

        if (!deletedIds || deletedIds.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        await Promise.all(deletedIds.map(async (deletedId) => {
            const [currentRecord] = await getRecordById(deletedId, TABLE.TICKET_SUBJECT, 'id');
            //activityLog(ine_tickets_ModuleID, currentRecord, null, 3, 0);
        }));
        const query = `UPDATE ${TABLE.TICKET_SUBJECT} SET status = 2, deleted_at = NOW() WHERE id IN (?)`;
        const formattedQuery = mysql.format(query, [deletedIds]);
        const [results] = await pool.query(query, [deletedIds]);
        if (results.affectedRows > 0) {
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


const generateUniqueUserId = async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(today.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;

    let randomNumber;
    let userId;
    let userIdExists;

    do {
        // Generate a random number between 1000 and 9999
        randomNumber = Math.floor(Math.random() * 9000) + 1000;
        userId = `${datePart}${randomNumber}`;

        // Check if the generated user ID already exists in the database
        userIdExists = await checkUserIdExists(userId);
        // If the user ID exists, regenerate the random number
    } while (userIdExists);

    return userId;
};

// Function to check if a user ID already exists in the database
const checkUserIdExists = async (userId) => {
    // Perform database query to check if the user ID exists
    // Replace the following line with your database query
    // Example query: const result = await query('SELECT COUNT(*) AS count FROM users WHERE user_id = ?', [userId]);
    const [result] = await pool.query('SELECT COUNT(*) AS count FROM ine_users WHERE customer_id = ?', [userId]);

    // Extract count from the result
    const count = result[0].count;

    // Return true if the user ID exists, false otherwise
    return count > 0;
};

module.exports = router;