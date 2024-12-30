// src/routes/mygiftcardRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog } = require('../commonFunctions')
const router = express.Router();
const { authenticateToken } = require('../utils/authMiddleware');

const tableName = TABLE.MY_GIFTCARD;
const ine_my_giftcard_ModuleID = TABLE.MY_GIFTCARD_MODULE_ID;
const tableName2 = TABLE.GIFTCARD_GENERATE;

// Add
router.post('/', async (req, res) => {
    try {
        await authenticateToken(req);

        const { gift_card_number, pin_number, user_id } = req.body;

        if (!gift_card_number || !pin_number) {
            return sendResponse(res, { error: 'Gift card number and PIN number are required', status: false }, 400);
        }

        const [results] = await pool.query(`SELECT * FROM ${tableName2} WHERE gift_card_number = ? AND pin_number = ?`, [gift_card_number, pin_number]);

        if (results && results.length > 0) {
            const giftCard = results[0];
            const [existingRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE giftcard_id = ?`, [giftCard.id]);

            if (existingRecord && existingRecord.length > 0) {
                return sendResponse(res, { error: 'This coupon has already been used', status: false }, 400);
            }

            const [insertResult] = await pool.query(`INSERT INTO ${tableName} (user_id, giftcard_id) VALUES (?, ?)`, [
                user_id,
                giftCard.id
            ]);

            const insertedRecordId = insertResult.insertId;
            const insertedRecord = await getRecordById(insertedRecordId, tableName, 'id');

            await activityLog(ine_my_giftcard_ModuleID, null, insertedRecord, 1, 0);

            return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);
        } else {
            return sendResponse(res, { error: 'Invalid gift card number or PIN number', status: false }, 404);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
});

// All List & Specific List
router.get('/', async (req, res) => {
    try {
        await authenticateToken(req);

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);
        const userId = url.searchParams.get('user_id');
        const id = getQueryParamId(url);

        if (id) {
            const [results] = await getRecordById(id, tableName, 'id');
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        let results;
        if (userId) {
            [results] = await pool.query(`SELECT g.*, gg.gift_card_number, gg.pin_number, gg.amount, gg.expiry_date FROM ${tableName} as g 
                LEFT JOIN ${tableName2} as gg on gg.id = g.giftcard_id WHERE g.user_id = ? ORDER BY g.ID desc`, [userId]);
        } else {
            [results] = await getRecordById(null, tableName, 'id');
        }

        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
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
            activityLog(ine_my_giftcard_ModuleID, currentRecord, null, 3, 0);
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