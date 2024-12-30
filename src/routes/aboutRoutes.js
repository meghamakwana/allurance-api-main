// src/routes/aboutRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { ManageResponseStatus, sendResponse, activityLog, processImageUpload } = require('../commonFunctions')
const router = express.Router();

const tableName = TABLE.ABOUT;
const ine_about_ModuleID = TABLE.ABOUT_MODULE_ID;
const blogFolderPath = 'public/assets/images/blog';

// List
router.get('/', async (req, res) => {
    try {
        var [results] = await pool.query(`SELECT * FROM ${tableName} WHERE id = ?`, [1]);
        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Update
router.put('/', async (req, res) => {
    try {
        const { title, short_description, long_description, image1, apihitid } = await req.body;

        var image1Data = await processImageUpload('image1', image1, blogFolderPath);

        await pool.query(`UPDATE ${tableName} SET title = ?, short_description = ?, long_description = ?, image1 = ?,updated_by=?, updated_at = NOW() WHERE id = ?`, [title, short_description, long_description, image1Data, apihitid, 1]);

        // Retrieve the updated record
        const [updatedRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE id = ?`, [1]);

        await activityLog(ine_about_ModuleID, updatedRecord, updatedRecord, 2, 0); // Maintain Activity Log

        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;