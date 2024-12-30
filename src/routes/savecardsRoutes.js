// src/routes/savecardsRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog } = require('../commonFunctions')
const router = express.Router();
const { authenticateToken } = require('../utils/authMiddleware');

const tableName = TABLE.SAVECARD;
const ine_savecards_ModuleID = TABLE.SAVECARD_MODULE_ID;

// Add
router.post('/', async (req, res) => {
    try {
        await authenticateToken(req);

        const { user_id, card_name, card_number } = req.body;

        // Validate request data
        if (!card_name || !card_number) {
            return sendResponse(res, { error: 'Card Name and Card Number are required', status: false }, 400);
        }

        // Check if the record already exists
        const [existingRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE user_id = ? AND card_number = ? AND status = 1`, [
            user_id,
            card_number
        ]);

        if (existingRecord.length > 0) {
            return sendResponse(res, { error: 'Record already exists', status: false }, 409); // 409 Conflict
        }

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (user_id, card_name, card_number) VALUES (?, ?, ?)`, [
            user_id,
            card_name,
            card_number
        ]);

        const insertedRecordId = insertResult.insertId;
        const insertedRecord = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

        await activityLog(ine_savecards_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

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
            const [results] = await getRecordById(id, tableName, 'id');
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        let results;
        if (userId) {
            [results] = await pool.query(`SELECT * FROM ${tableName} WHERE user_id = ? and status = 1 ORDER BY ID desc`, [userId]);
        } else {
            [results] = await getRecordById(null, tableName, 'id');
        }

        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
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
            activityLog(ine_savecards_ModuleID, currentRecord, null, 3, 0);
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