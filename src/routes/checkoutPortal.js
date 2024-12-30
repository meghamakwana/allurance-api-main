const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getRecordById, ManageResponseStatus, sendResponse, getQueryParamId, getQueryParamIds, processDocuments, activityLog, formatToTwoDecimals } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');

const router = express.Router();

// Table Name
const tableName = TABLE.USER_CHECKOUT;

router.get('/:id?', async (req, res) => {
    try {
        const userId = req.query.user_id;
        const mockId = req.query.mock_id;
        let results;
        if (userId) {
            [results] = await pool.query(`SELECT * FROM ${tableName} WHERE user_id = ?`, [userId]);
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        } else if (mockId) {
            [results] = await pool.query(`SELECT * FROM ${tableName} WHERE mock_id = ?`, [mockId]);
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        return sendResponse(res, { data: [], message: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
});

// Sync
router.put('/sync', async (req, res) => {
    try {
        const { mockID, userID } = req.body;

        if (!mockID) {
            return sendResponse(res, { error: 'Mock ID is required', status: false }, 400);
        }

        // Check if mockID exists
        const [existingRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE mock_id = ?`, [mockID]);

        if (existingRecord.length === 0) {
            return sendResponse(res, { error: 'Mock ID not found', status: false }, 404);
        }

        // Update userID for the mockID
        await pool.query(`UPDATE ${tableName} SET user_id = ?, mock_id = NULL WHERE mock_id = ?`, [userID, mockID]);

        return sendResponse(res, { message: 'Checkout Successfully Synced', status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.post('/', async (req, res) => {
    try {
        const requestData = req.body;

        // Format the numbers
        const formattedTaxamount = formatToTwoDecimals(requestData.taxamount);
        const formattedSubtotal = formatToTwoDecimals(requestData.subtotal);
        const formattedTotalamount = formatToTwoDecimals(requestData.totalamount);
        const formattedCGST = formatToTwoDecimals(requestData.CGST);
        const formattedSGST = formatToTwoDecimals(requestData.SGST);
        const formattedIGST = formatToTwoDecimals(requestData.IGST);

        if (!formattedTaxamount) {
            return sendResponse(res, { error: ' taxamount fields are required', status: false }, 400);
        }
        let existingRecord;
        let queryResult;
        let newRecordId;

        if (requestData.mock_Id) {
            [existingRecord] = await pool.query(
                `SELECT * FROM ${tableName} WHERE mock_id = ?`,
                [requestData.mock_Id]
            );

            if (existingRecord.length > 0) {
                [queryResult] = await pool.query(
                    `UPDATE ${tableName} SET taxamount = ?, CGST=?, SGST=?, IGST=?, subtotal = ?, totalamount = ?, updated_by = ?, affiliate_id = ?, updated_at = NOW() WHERE mock_id = ?`,
                    [
                        formattedTaxamount,
                        formattedCGST,
                        formattedSGST,
                        formattedIGST,
                        formattedSubtotal,
                        formattedTotalamount || 0,
                        requestData.mock_Id,
                        requestData.affiliate_id || null,
                        requestData.mock_Id,
                    ]
                );
                newRecordId = existingRecord[0].id;
            } else {
                [queryResult] = await pool.query(
                    `INSERT INTO ${tableName} (mock_id, taxamount, CGST, SGST, IGST, subtotal, totalamount, created_at, affiliate_id, created_by ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
                    [
                        requestData.mock_Id,
                        formattedTaxamount,
                        formattedCGST,
                        formattedSGST,
                        formattedIGST,
                        formattedSubtotal,
                        formattedTotalamount || 0,
                        requestData.affiliate_id || null,
                        requestData.mock_Id,
                    ]
                );
                newRecordId = queryResult.insertId;
            }
        }

        if (requestData.user_id) {
            [existingRecord] = await pool.query(
                `SELECT * FROM ${tableName} WHERE user_id = ? and status = 1`,
                [requestData.user_id]
            );

            if (existingRecord.length > 0) {
                [queryResult] = await pool.query(
                    `UPDATE ${tableName} SET taxamount = ?, CGST=?, SGST=?, IGST=?, subtotal = ?, totalamount = ?, updated_by = ?, affiliate_id = ?, updated_at = NOW() WHERE user_id = ?`,
                    [
                        formattedTaxamount,
                        formattedCGST,
                        formattedSGST,
                        formattedIGST,
                        formattedSubtotal,
                        formattedTotalamount || 0,
                        requestData.user_id,
                        requestData.affiliate_id || null,
                        requestData.user_id,
                    ]
                );
                newRecordId = existingRecord[0].id;
            } else {
                [queryResult] = await pool.query(
                    `INSERT INTO ${tableName} (user_id, taxamount, CGST, SGST, IGST,subtotal, totalamount, created_at, affiliate_id, created_by ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
                    [
                        requestData.user_id,
                        formattedTaxamount,
                        formattedCGST,
                        formattedSGST,
                        formattedIGST,
                        formattedSubtotal,
                        formattedTotalamount || 0,
                        requestData.affiliate_id || null,
                        requestData.user_id,
                    ]
                );
                newRecordId = queryResult.insertId;
            }

            // Check for duplicate records
            const [duplicateCheck] = await pool.query(`SELECT id FROM ${tableName} WHERE user_id = ? AND subtotal = ? AND taxamount = ? AND CGST = ? AND SGST = ? AND IGST = ? AND status = 1 ORDER BY id ASC`,
                [requestData.user_id, formattedSubtotal, formattedTaxamount, formattedCGST, formattedSGST, formattedIGST]);

            if (duplicateCheck.length > 1) {  
                const idsToDelete = duplicateCheck.slice(0, -1).map(record => record.id);
                
                if (idsToDelete.length > 0) {
                    await pool.query(`DELETE FROM ${tableName} WHERE id IN (?)`, [idsToDelete]);
                }
            }
        }

        return sendResponse(res, { data: queryResult, message: ManageResponseStatus(existingRecord.length > 0 ? 'updated' : 'created'), status: true }, 201);
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

        if (!id || id.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
        if (results.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        await pool.query(`DELETE FROM ${tableName} WHERE id IN (?)`, [id]);
        return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// router.delete('/:id', async (req, res) => {
//     try {
//         await authenticateToken(req);
//         const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
//         const id = req.params.id || req.query.id;
//         const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));
//         if (!deletedIds || deletedIds.length === 0) {
//             return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
//         }
//         await Promise.all(deletedIds.map(async (deletedId) => {
//             const [currentRecord] = await getRecordById(deletedId, tableName, 'id');
//             //activityLog(ine_tickets_ModuleID, currentRecord, null, 3, 0);
//         }));
//         const query = `UPDATE ${tableName} SET status = 2, deleted_at = NOW() WHERE id IN (?)`;
//         const formattedQuery = mysql.format(query, [deletedIds]);
//         const [results] = await pool.query(query, [deletedIds]);
//         if (results.affectedRows > 0) {
//             return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
//         }
//         return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
//     } catch (error) {
//         return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
//     }
// });

module.exports = router;