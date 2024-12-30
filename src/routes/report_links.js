// src/routes/report_links.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const multer = require('multer');
const path = require('path');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog, uploadToAzureBlob, requestIDNumber } = require('../commonFunctions')
const router = express.Router();

const tableName = TABLE.REPORT_LINKS;

// LINKS FOR THE STORAGE UPLOAD 
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

router.post('/', upload.fields([{ name: 'file1' }]), async (req, res) => {
    try {

        const { name } = req.body;

        if (!name) { return sendResponse(res, { error: 'Name field are required', status: false }, 400); }

        const file1File = req.files['file1'] ? req.files['file1'][0] : null;
        if (!file1File) {
            return sendResponse(res, { error: 'File is required', status: false }, 400);
        }
        
        const fileExtension = path.extname(file1File.originalname).toLowerCase();
        if (fileExtension !== '.csv') {
            return sendResponse(res, { error: 'Only .csv files are allowed', status: false }, 400);
        }

        let file1BlobName = await uploadToAzureBlob(file1File);

        const request_id = requestIDNumber();

        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (name, request_id, file1) VALUES (?, ?, ?)`, [name, request_id, file1BlobName]);

        const insertedRecordId = insertResult.insertId;
        const insertedRecord = await getRecordById(insertedRecordId, tableName, 'id');

        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        // console.error(`Error occurred: ${error.message}`); // Add logging for debugging
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// All List & Specific List
router.get('/', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);
        // console.log('idid',id);
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

module.exports = router;