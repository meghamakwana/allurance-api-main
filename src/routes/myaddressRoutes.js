// src/routes/myaddressRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog, checkEmailExistOrNot, checkPhoneExistOrNot } = require('../commonFunctions')
const router = express.Router();
const { authenticateToken } = require('../utils/authMiddleware');

const tableName = TABLE.MY_ADDRESS;
const ine_my_address_ModuleID = TABLE.MY_ADDRESS_MODULE_ID;

// Add
router.post('/', async (req, res) => {
    try {

        await authenticateToken(req);
        const { user_id, first_name, last_name, email, phone, address_1, country, state, district, landmark, pincode, is_default, a_type } = req.body;

        // Validate request data
        if (!first_name || !last_name || !email || !phone || !address_1) {
            return sendResponse(res, { error: 'First Name, Last Name, Email, Phone and Address fields are required', status: false }, 400);
        }

        if (is_default) {
            await pool.query(`UPDATE ${tableName} SET is_default = 0 WHERE user_id = ?`, [user_id]);
        }

        // Email Validation
        if (email) {
            const emailExists = await checkEmailExistOrNot(tableName, email);
            if (emailExists) {
                return sendResponse(res, { error: 'Email already exists', status: false }, 409);
            }
        }

        // Phone Validation
        if (phone) {
            const phoneExists = await checkPhoneExistOrNot(tableName, phone);
            if (phoneExists) {
                return sendResponse(res, { error: 'Phone already exists', status: false }, 409);
            }
        }

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (user_id, first_name, last_name, email, phone, address_1, country, state, district, landmark, pincode, is_default, a_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            user_id,
            first_name,
            last_name,
            email,
            phone,
            address_1,
            country,
            state,
            district,
            landmark,
            pincode,
            is_default,
            a_type
        ]);

        const insertedRecordId = insertResult.insertId;
        const [insertedRecord] = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

        await activityLog(ine_my_address_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// All List & Specific List
router.get('/', async (req, res) => {
    try {

        await authenticateToken(req);
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);
        const userId = url.searchParams.get('user_id');
        const id = getQueryParamId(fullUrl);

        if (id) {
            const results = await getRecordById(id, tableName, 'id');
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse({ error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        let results;
        if (userId) {
            [results] = await pool.query(`SELECT * FROM ${tableName} WHERE user_id = ? and status = 1 ORDER BY ID desc`, [userId]);
        } else {
            [results] = await getRecordById(null, tableName, 'id');
        }

        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Update
router.put('/', async (req, res) => {
    try {

        await authenticateToken(req);
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        // Check if the ID exists in the database and retrieve the existing record
        const [existingRecord] = await getRecordById(id, tableName, 'id');

        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const { user_id, first_name, last_name, email, phone, a_type, address_1, country, state, district, landmark, pincode, is_default } = req.body;

        if (!first_name || !last_name || !email || !phone || !address_1) {
            return sendResponse(res, { error: 'First Name, Last Name, Email, Phone and Address fields are required', status: false }, 400);
        }

        if (is_default) {
            await pool.query(`UPDATE ${tableName} SET is_default = 0 WHERE user_id = ?`, [user_id]);
        }

        // Email Validation
        if (email) {
            const emailExists = await checkEmailExistOrNot(tableName, email, id);
            if (emailExists) {
                return sendResponse(res, { error: 'Email already exists', status: false }, 409);
            }
        }

        // Phone Validation
        if (phone) {
            const phoneExists = await checkPhoneExistOrNot(tableName, phone, id);
            if (phoneExists) {
                return sendResponse(res, { error: 'Phone already exists', status: false }, 409);
            }
        }

        await pool.query(`UPDATE ${tableName} SET first_name = ?, last_name = ?, email = ?, phone = ?, a_type = ?, address_1 = ?, country = ?, state = ?, district = ?, landmark = ?, pincode = ?, is_default = ?, updated_at = NOW() WHERE id = ?`, [first_name, last_name, email, phone, a_type, address_1, country, state, district, landmark, pincode, is_default, id]);

        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, tableName, 'id');

        await activityLog(ine_my_address_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Update Default Address
router.put('/default', async (req, res) => {
    try {

        await authenticateToken(req);

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        const { user_id } = req.body;

        if (!user_id) {
            return sendResponse(res, { error: 'User ID must be required', status: false }, 400);
        }

        const [existingRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE user_id = ? and id = ?`, [user_id, id]);
        if (existingRecord.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        await pool.query(`UPDATE ${tableName} SET is_default = 0 WHERE user_id = ?`, [user_id]);
        await pool.query(`UPDATE ${tableName} SET is_default = 1, updated_at = NOW() WHERE user_id = ? and id = ?`, [user_id, id]);

        return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Delete
router.delete('/', async (req, res) => {
    try {

        await authenticateToken(req);
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));

        if (!deletedIds || deletedIds.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        await Promise.all(deletedIds.map(async (deletedId) => {
            const [currentRecord] = await getRecordById(deletedId, tableName, 'id');
            activityLog(ine_my_address_ModuleID, currentRecord, null, 3, 0);
        }));

        const query = `UPDATE ${tableName} SET status = 2, deleted_at = NOW() WHERE id IN (?)`;

        const [results] = await pool.query(query, [deletedIds]);
        if (results.affectedRows > 0) {
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;