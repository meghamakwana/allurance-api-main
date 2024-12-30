// src/routes/desktopmastheadRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog } = require('../commonFunctions')
const router = express.Router();

const tableName = TABLE.DESKTOP_MASTHEAD;
const ine_desktop_masthead_ModuleID = TABLE.DESKTOP_MASTHEAD_MODULE_ID;
const mastheadFolderPath = 'public/assets/images/masthead/dmasthead';

// Add
router.post('/', async (req, res) => {
    try {
        const { title, image1, button_name, button_link, button_target, description, apihitid } = req.body;

        // Validate request data
        if (!title || !image1) {
            return sendResponse({ error: 'Title and Image fields are required', status: false }, 400);
        }

        // await processDocument('image1', requestData, mastheadFolderPath);

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (title, button_name, button_link, button_target, image1, description,created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            title,
            button_name,
            button_link,
            button_target,
            image1,
            description,
            apihitid,
        ]);

        const insertedRecordId = insertResult.insertId;
        const insertedRecord = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

        await activityLog(ine_desktop_masthead_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

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
            const results = await getRecordById(id, tableName, 'id');
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const results = await getRecordById(null, tableName, 'id');
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

        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        // Check if the ID exists in the database and retrieve the existing record
        const [existingRecord] = await getRecordById(id, tableName, 'id');

        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const { title, button_name, button_link, button_target, image1, description, apihitid } = req.body;

        var image1Data = ''; //await processImageUpload('image1', image1, mastheadFolderPath);

        await pool.query(`UPDATE ${tableName} SET title = ?, button_name = ?, button_link = ?, button_target = ?, image1 = ?, description = ?, updated_by=?, updated_at = NOW() WHERE id = ?`, [title, button_name, button_link, button_target, image1Data, description, apihitid, id]);

        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, tableName, 'id');

        await activityLog(ine_desktop_masthead_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

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
            activityLog(ine_desktop_masthead_ModuleID, currentRecord, null, 3, 0);
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