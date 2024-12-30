// src/routes/ratingRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog } = require('../commonFunctions')
const router = express.Router();
const { authenticateToken } = require('../utils/authMiddleware');

const tableName = TABLE.RATING;
const ine_rating_ModuleID = TABLE.RATING_MODULE_ID;
const tableName2 = TABLE.PRODUCT;
const tableName3 = TABLE.USERS;
const tableName4 = TABLE.USERS_DETAILS

// Add / Update
router.post('/', async (req, res) => {
    try {

        await authenticateToken(req);

        const { user_id, product_id, rating_no, order_id, description } = req.body;

        if (!user_id || !product_id || !rating_no || !description || !order_id) {
            return sendResponse(res, { error: 'User ID, Product ID, Description, Order ID and Rating Must be required', status: false }, 400);
        }

        const [query1] = await pool.query(`SELECT * FROM ${tableName} WHERE user_id = ? and product_id = ? and status = 1`, [user_id, product_id]);
        if (query1.length === 0) {
            await pool.query(`INSERT INTO ${tableName} (user_id, product_id, description, rating_no, order_id) VALUES (?, ?, ?, ?, ?)`, [user_id, product_id, description, rating_no, order_id]);
            return sendResponse(res, { message: ManageResponseStatus('created'), status: true }, 201);
        } else {
            await pool.query(`UPDATE ${tableName} SET description = ?, rating_no = ?, updated_at = NOW() WHERE user_id = ? and product_id = ?`, [description, rating_no, user_id, product_id]);
            return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 201);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// All List & Specific List
router.get('/', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);
        const userId = url.searchParams.get('user_id');
        const productId = url.searchParams.get('product_id');
        const id = getQueryParamId(fullUrl);

        if (id) {
            const [results] = await pool.query(`SELECT r.*, o.invoice_date FROM ine_rating as r LEFT JOIN ine_orders as o on o.id = r.order_id WHERE r.status = 1 and r.id = ? ORDER BY r.ID DESC`, [id]);
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        let results = [];

        if (userId) {
            [results] = await pool.query(`SELECT r.*, p.name as product_name, o.invoice_date FROM ${tableName} r 
                LEFT JOIN ${tableName2} p ON p.id = r.product_id
                LEFT JOIN ine_orders as o on o.id = r.order_id 
                WHERE r.user_id = ? and r.status = 1 ORDER BY r.id DESC`, [userId]);
        }

        if (productId) {
            [results] = await pool.query(`SELECT ir.*, iu.first_name, iu.last_name, iud.gender, o.invoice_date FROM ${tableName} as ir 
                LEFT JOIN ${tableName3} as iu on iu.id = ir.user_id
                LEFT JOIN ${tableName4} as iud on iud.user_id = iu.id
                LEFT JOIN ine_orders as o on o.id = ir.order_id
                WHERE ir.product_id = ? and ir.status = 1  ORDER BY ir.id DESC`, [productId]);
        }

        if (!userId && !productId) {
            [results] = await pool.query(`SELECT r.*, o.invoice_date FROM ine_rating as r LEFT JOIN ine_orders as o on o.id = r.order_id WHERE r.status = 1 ORDER BY r.ID DESC`);
        }

        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Rating Calculte Product Wise
router.get('/product', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);
        const productId = url.searchParams.get('id');

        if (!productId) {
            return res.status(400).json({ error: "Product Id required", status: false });
        }

        const [results] = await pool.query(`SELECT SUM(rating_no) AS sumofratingno, COUNT(*) AS count FROM ${tableName} WHERE product_id = ?`, [productId]);
        const sumofratingno = results[0]?.sumofratingno || 0;
        const count = results[0]?.count || 0;

        if (count > 0) {
            const averageRating = sumofratingno / count;
            const roundedRating = Math.round(averageRating); // Round to nearest whole number
            return res.status(200).json({ data: { avgrating: roundedRating }, message: 'Fetched successfully', status: true, count });
        } else {
            return res.status(200).json({ message: 'No ratings found', status: true, count: 0 });
        }

    } catch (error) {
        return res.status(500).json({ error: `Error occurred: ${error.message}` });
    }
});

// Update
// router.put('/', async (req, res) => {
//     try {

//         await authenticateToken(req);

//         const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
//         const id = getQueryParamId(fullUrl);

//         if (!id) {
//             return sendResponse({ error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
//         }

//         // Check if the ID exists in the database and retrieve the existing record
//         const [existingRecord] = await getRecordById(id, tableName, 'id');

//         if (!existingRecord) {
//             return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
//         }

//         const { user_id, product_id, name, email, description, rating_no } = req.body;

//         await pool.query(`UPDATE ${tableName} SET product_id = ?, description = ?, rating_no = ?, updated_at = NOW() WHERE id = ?`, [product_id, description, rating_no, id]);

//         // Retrieve the updated record
//         const [updatedRecord] = await getRecordById(id, tableName, 'id');

//         await activityLog(ine_rating_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

//         return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

//     } catch (error) {
//         return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
//     }
// });

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
            activityLog(ine_rating_ModuleID, currentRecord, null, 3, 0);
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