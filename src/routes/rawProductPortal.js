const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, checkEmailExistOrNot, checkPhoneExistOrNot, processDocuments, activityLog, getQueryParamCategoryIds } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');

const router = express.Router();

const tableName = TABLE.DESIGNER;
const tableName2 = TABLE.MARKETING;
const tableName3 = TABLE.PACKER_CARTONS;
const ine_packers_ModuleID = TABLE.PACKER_MODULE_ID;

router.get('/fetchrawcartons/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            var queryWithId;
            var resultsWithId;
            queryWithId = `SELECT * FROM ${tableName3} WHERE rack_status = ?`;
            [resultsWithId] = await pool.query(queryWithId, [id]);
            if(resultsWithId.length == 0) {
                queryWithId = `SELECT * FROM ${tableName3} WHERE rack_status = 0 and rack_status = ?`;
                [resultsWithId] = await pool.query(queryWithId, [id]);
            }
            return sendResponse(res, {
                data: resultsWithId,
                message: ManageResponseStatus('fetched'),
                status: true
            }, 200);
        } else {
            // Fetch all records with rack_status = 0
            const queryWithoutId = `SELECT * FROM ${tableName3} WHERE rack_status = 0`;
            const [resultsWithoutId] = await pool.query(queryWithoutId);
            return sendResponse(res, {
                data: resultsWithoutId,
                message: ManageResponseStatus('fetched'),
                status: true,
                count: resultsWithoutId.length
            }, 200);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.get('/:id?', async (req, res) => {
    try {
        // Extract categoryIds from the query parameters
        const categories = getQueryParamCategoryIds(new URL(req.url));
        const id = req.params.id || req.query.id;

        // Construct the SQL query to fetch products by category IDs
        let query1 = `
            SELECT im.*, id.title as dtitle, id.category_id
            FROM ${tableName2} as im
            LEFT JOIN ${tableName} as id on id.id = im.designer_id
            WHERE im.status = 1
        `;

        // Update the query to fetch data from the ine_marketing table if no categories are provided
        if (!categories || categories.length === 0) {
            query1 = `
                SELECT *
                FROM ine_marketing
                WHERE status = 1
            `;
        }

        // Execute the query to fetch products
        let [products] = await pool.query(query1); // Implement this function to execute the SQL query

        // Filter products to include only those matching the provided category IDs
        if (categories?.length > 0) {
            products = products.filter(product => categories.includes(product.category_id));
        }

        // Check if filtered products are found
        if (products.length > 0) {
            // Return filtered products with a success message
            return sendResponse(res, { data: products, message: ManageResponseStatus('fetched'), status: true }, 200);
        } else {
            // Return a not found error if no matching products are found
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        // Return an error response if any error occurs
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.put('/fetchrawcartons/:id', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }
        const requestData = await req.body;
        const { title, status } = requestData;
        const [existingRecord] = await getRecordById(id, tableName, 'id');
        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        await pool.query(`UPDATE ${tableName} SET title = ?, status = ?, updated_at = NOW() WHERE id = ?`, [title, status, id]);
        const [updatedRecord] = await getRecordById(id, tableName, 'id');
        await activityLog(ine_packers_ModuleID, existingRecord, updatedRecord, 2, 0);
        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);
    } catch (error) {
        return sendResponse({ error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;