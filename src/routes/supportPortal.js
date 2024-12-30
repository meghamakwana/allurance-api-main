const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, checkEmailExistOrNot, checkPhoneExistOrNot, processDocuments, activityLog } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');

const tableName = TABLE.ORDER_RETURN;
const orderTableName = TABLE.ORDERS;
const orderDetailsTableName = TABLE.ORDER_RETURN;
const order_products_table = TABLE.ORDER_PRODUCTS

const router = express.Router();

router.get('/orderreturn/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            const [results] = await pool.query(`
                SELECT 
                    o.*, 
                    r.id AS return_id, 
                    r.serial_number, 
                    r.refund_amount,
                    r.image_1,
                    r.image_2,
                    r.image_3,
                    r.image_4,
                    r.image_5
                FROM ${orderTableName} o
                LEFT JOIN ${orderDetailsTableName} r ON o.id = r.order_id
                WHERE o.id = ?
            `, [id]);

            if (results.length > 0) {
                const order = {
                    ...results[0], // Dynamically include all order fields
                };

                const returns = results.map(row => ({
                    return_id: row.return_id,
                    serial_number: row.serial_number,
                    refund_amount: row.refund_amount
                })).filter(returnRecord => returnRecord.return_id); // Filter out rows without return records

                const data = { order, returns };

                return sendResponse(res, { data: data, message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        // Fetch all orders and their associated return records using LEFT JOIN
        const [results] = await pool.query(`
            SELECT 
                o.*, 
                r.id AS return_id, 
                r.serial_number, 
                r.refund_amount 
            FROM ${orderTableName} o
            LEFT JOIN ${orderDetailsTableName} r ON o.id = r.order_id
        `);

        const ordersMap = results.reduce((acc, row) => {
            if (!acc[row.id]) {
                acc[row.id] = {
                    ...row, // Dynamically include all order fields
                    returns: []
                };
            }
            if (row.return_id) {
                acc[row.id].returns.push({
                    return_id: row.return_id,
                    serial_number: row.serial_number,
                    refund_amount: row.refund_amount
                });
            }
            return acc;
        }, {});

        const data = Object.values(ordersMap);

        return sendResponse(res, { data: data, message: ManageResponseStatus('fetched'), status: true, count: data.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


router.post('/orderreturn', async (req, res) => {
    try {

        await authenticateToken(req);

        const requestData = await req.body;
        if (!requestData.order_id || !requestData.invoice_id || !requestData.returnproduct || !Array.isArray(requestData.returnproduct)) {
            return sendResponse(res, { error: 'Order ID, Invoice ID, and returnproduct array are required', status: false }, 400);
        }
        const imagePaths = [];
        if (requestData.images && Array.isArray(requestData.images)) {
            for (let i = 0; i < Math.min(requestData.images.length, 5); i++) {
                const imagePath = requestData.images[i].path || null; // Get image path
                imagePaths.push(imagePath);
            }
        }
        // Insert data into the database
        let insertedRecordsCount = 0;
        for (const product of requestData.returnproduct) {
            const { serial_number, retail_price } = product;
            const serialNumbers = [serial_number].filter(Boolean);
            for (const serial of serialNumbers) {
                const [existingRecord] = await pool.query(`SELECT COUNT(*) AS count FROM ${tableName} WHERE order_id = ? AND invoice_id = ? AND serial_number = ?`, [requestData.id, requestData.invoice_id, serial]);
                const count = existingRecord[0].count;
                if (count === 0) {
                    const sql = `
                        INSERT INTO ${tableName} (
                            order_id,
                            invoice_id,
                            serial_number,
                            refund_amount,
                            image_1,
                            image_2,
                            image_3,
                            image_4,
                            image_5,
                            created_by
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?)
                    `;
                    await pool.query(sql, [
                        requestData.id,
                        requestData.invoice_id,
                        serial,
                        retail_price || 0, // Use retail_price as refund_amount; default to 0 if not provided
                        ...imagePaths, // Spread image paths into the query parameters
                        null, // Set remaining image columns to null if not provided
                        null,
                        null,
                        null,
                        requestData.apihitid
                    ]);
                    insertedRecordsCount++; // Increment inserted records count
                }
                const updateSql = `
                UPDATE ${order_products_table}
                SET is_returned = 1
                WHERE serial_number = ?`;
                await pool.query(updateSql, [serial]);

            }
        }
        const [insertedRecords] = await pool.query(`SELECT * FROM ${tableName} WHERE order_id = ? AND invoice_id = ?`, [requestData.order_id, requestData.invoice_id]);
        if (insertedRecordsCount === 0) {
            return sendResponse(res, { error: 'Sorry, Product not found for return', status: false }, 202);
        } else {
            return sendResponse(res, { data: insertedRecords, message: ManageResponseStatus('created'), status: true }, 201);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;