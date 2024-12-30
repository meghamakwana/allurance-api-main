const express = require('express');
const TABLE = require('../utils/tables');
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, initRequestforAdmin } = require('../commonFunctions');
const router = express.Router();

// Table Name
const tableName = TABLE.AFFILIATE_TABLE;
const module_id = TABLE.AFFILIATE_MODULE_ID;

// Create
router.post('/', async (req, res) => {
    try {
        const { user_id, name, url, commission1, commission2, commission3 } = req.body;

        if (!user_id || !name || !url) {
            return sendResponse(res, { error: 'User ID, Name, URL and Commission fields are required', status: false }, 400);
        }

        const [insertResult] = await pool.query(`INSERT INTO ine_affiliate_program (user_id, name, url, commission1, commission2, commission3) VALUES (?, ?, ?, ?, ?, ?)`, [user_id, name, url, commission1, commission2, commission3]);
        const insertedRecordId = insertResult.insertId;

        await initRequestforAdmin({ module_id, insertedRecordId });

        return sendResponse(res, { message: ManageResponseStatus('created'), status: true }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// All List & Specific List
router.get('/', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);
        if (id) {
            const [results] = await pool.query(`SELECT * FROM ine_affiliate_program WHERE status = 1 and id = ?`, [id]);
            if (results.length > 0) {
                const affiliateResult = results[0];
                const [historyResults] = await pool.query(`SELECT a.*, o.channel_mode as order_channel_mode, o.order_id as order_orde_id, o.invoice_id as order_invoice_id, o.payment_type as order_payment_type, o.payment_id as order_payment_id FROM ine_affiliate_program_history as a 
                LEFT JOIN ine_orders as o on o.id = a.order_id
                WHERE a.affiliate_id = ? and a.status = 1`, [affiliateResult.id]);
                affiliateResult.affiliate_history = historyResults;
                return sendResponse(res, { data: affiliateResult, message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        const [results] = await pool.query(`SELECT * FROM ine_affiliate_program WHERE status = 1 ORDER BY ID DESC`);

        for (let i = 0; i < results.length; i++) {
            const affiliate = results[i];
            const [historyResults] = await pool.query(`SELECT a.*, o.channel_mode as order_channel_mode, o.order_id as order_orde_id, o.invoice_id as order_invoice_id, o.payment_type as order_payment_type FROM ine_affiliate_program_history as a 
                LEFT JOIN ine_orders as o on o.id = a.order_id
                WHERE a.affiliate_id = ? and a.status = 1`, [affiliate.id]);
            affiliate.affiliate_history = historyResults;
        }

        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Update
router.put('/', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (!id) { return sendResponse({ error: ManageResponseStatus('RowIdRequired'), status: false }, 400); }

        const { user_id, name, url, commission1, commission2, commission3 } = req.body;

        const [existingRecord] = await pool.query(`SELECT * FROM ine_affiliate_program WHERE status = 1 and id = ?`, [id]);
        if (existingRecord.length > 0) {
            await pool.query(`UPDATE ine_affiliate_program SET user_id = ?, name = ?, url = ?, commission1 = ?, commission2 = ?, commission3 = ?, record_status = 1, updated_at = NOW() WHERE id = ?`, [user_id, name, url, commission1, commission2, commission3, id]);
            await initRequestforAdmin({ module_id, insertedRecordId: id });
            return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Delete
router.delete('/', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));

        if (!deletedIds || deletedIds.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        await Promise.all(deletedIds.map(async (deletedId) => {
            await getRecordById(deletedId, tableName, 'id');
        }));

        const query = `UPDATE ine_affiliate_program SET status = 2, deleted_at = NOW() WHERE id IN (?)`;

        const [results] = await pool.query(query, [deletedIds]);
        if (results.affectedRows > 0) {
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Affiliate User List
router.post('/users', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_users WHERE role_id = 14 and status = 1`);
        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true }, 201);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;