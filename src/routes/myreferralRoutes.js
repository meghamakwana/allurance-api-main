// src/routes/myreferralRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse } = require('../commonFunctions')
const router = express.Router();
const { authenticateToken } = require('../utils/authMiddleware');

const tableName = TABLE.MY_REFERRAL;
const tableName2 = TABLE.USERS;

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

        let results, totalAmount;
        if (userId) {
            [results] = await pool.query(`SELECT r.*, u.first_name as fname, u.last_name as lname, u.email FROM ${tableName} as r LEFT JOIN ${tableName2} as u on u.id = r.user_id WHERE r.refer_id = ? ORDER BY ID desc`, [userId]);
            const [totalResult] = await pool.query(`SELECT SUM(amount) as totalAmount FROM ${tableName} WHERE refer_id = ?`, [userId]);
            totalAmount = totalResult[0].totalAmount || 0;
        } else {
            [results] = await getRecordById(null, tableName, 'id');
            const [totalResult] = await pool.query(`SELECT SUM(amount) as totalAmount FROM ${tableName}`);
            totalAmount = totalResult[0].totalAmount || 0;
        }

        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length, total_amt: totalAmount }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;