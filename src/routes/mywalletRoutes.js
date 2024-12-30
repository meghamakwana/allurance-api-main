// src/routes/mywalletRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, ManageResponseStatus, sendResponse } = require('../commonFunctions')
const router = express.Router();

const tableName = TABLE.MY_GIFTCARD;

// All List & Specific List
router.get('/', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);
        const userId = url.searchParams.get('user_id');
        const id = getQueryParamId(url);

        if (id) {
            const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE id = ? ORDER BY ID desc`, [id]); //await getRecordById(id, tableName, 'id');
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        let results;
        if (userId) {
            [results] = await pool.query(`SELECT * FROM ${tableName} WHERE user_id = ? ORDER BY ID desc`, [userId]);

        } else {
            [results] = await pool.query(`SELECT * FROM ${tableName}`);
        }

        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;