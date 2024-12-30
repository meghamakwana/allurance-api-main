// src/routes/sizeforshape_rawmasterRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog } = require('../commonFunctions')
const router = express.Router();

const tableName = TABLE.SIZEFORSHAPE;
const ine_size_for_shape_ModuleID = TABLE.SIZEFORSHAPE_MODULE_ID;
const tableName2 = TABLE.SHAPE;

// Add
router.post('/', async (req, res) => {
    try {
        // await authenticateToken(req);
        const { length, breadth, shape_id, description, apihitid } = req.body;

        // Validate request data
        if (!length || !breadth || !shape_id) {
            return sendResponse({ error: 'Shape ID, Length and Breadth fields are required', status: false }, 400);
        }

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (length, description, breadth, shape_id,created_by) VALUES (?, ?, ?, ?,?)`, [
            length,
            description || null, // Use null for optional fields
            breadth,
            shape_id,
            apihitid
        ]);

        const insertedRecordId = insertResult.insertId;
        const insertedRecord = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

        await activityLog(ine_size_for_shape_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// All List & Specific List
router.get('/', async (req, res) => {
    try {
        // await authenticateToken(req);

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        const baseQuery = `SELECT sfs.*, s.sequence_number, s.shape as shape_name FROM \`${tableName}\` as sfs LEFT JOIN \`${tableName2}\` as s on s.id = sfs.shape_id WHERE sfs.status = 1`;

        if (id) {
            const query1 = `${baseQuery} AND sfs.id = ? ORDER BY sfs.id DESC`;
            const [results] = await pool.query(query1, [id]);

            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const query2 = `${baseQuery} ORDER BY sfs.id DESC`;
        const [results] = await pool.query(query2);

        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }

        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Update
router.put('/', async (req, res) => {
    try {
        // await authenticateToken(req);

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

        const { length, description, breadth, shape_id, apihitid } = req.body;

        await pool.query(`UPDATE ${tableName} SET length = ?, description = ?, breadth = ?, shape_id = ?,updated_by=?, updated_at = NOW() WHERE id = ?`, [length, description, breadth, shape_id, apihitid, id]);

        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, tableName, 'id');

        await activityLog(ine_size_for_shape_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

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
            const [currentRecord] = await getRecordById(deletedId, tableName, 'id');
            activityLog(ine_size_for_shape_ModuleID, currentRecord, null, 3, 0);
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