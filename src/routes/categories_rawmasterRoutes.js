// src/routes/categories_rawmasterRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const multer = require('multer');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog, uploadToAzureBlob } = require('../commonFunctions')
const router = express.Router();

const tableName = TABLE.CATEGORY;
const ine_category_ModuleID = TABLE.CATEGORY_MODULE_ID;

// LINKS FOR THE STORAGE UPLOAD 
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });


router.post('/', upload.fields([{ name: 'image1' }, { name: 'image2' }]), async (req, res) => {
    try {
        // console.log(req.files); // Add logging to see if files are received
        // console.log('req.bodyreq.body',req.body)
        const { name, description, code, pair, apihitid } = req.body;

        // Validate request data
        if (!name || !code) {
            return sendResponse(res, { error: 'Name and code fields are required', status: false }, 400);
        }

        const image1File = req.files['image1'] ? req.files['image1'][0] : null;
        const image2File = req.files['image2'] ? req.files['image2'][0] : null;
        let image1BlobName = null;
        let image2BlobName = null;

        if (image1File) {
            image1BlobName = await uploadToAzureBlob(image1File);
        }
        if (image2File) {
            image2BlobName = await uploadToAzureBlob(image2File);
        }

        
        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (name, description, code, pair, image1, image2, created_by) VALUES (?, ?, ?, ?, ?, ?,?)`, [
            name,
            description || null,
            code,
            pair || 'No',
            image1BlobName,
            image2BlobName,
            apihitid
        ]);

        const insertedRecordId = insertResult.insertId;
        const insertedRecord = await getRecordById(insertedRecordId, tableName, 'id');
        await activityLog(ine_category_ModuleID, null, insertedRecord, 1, 0);

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
router.put('/', upload.fields([{ name: 'image1' }, { name: 'image2' }]),  async (req, res) => {
    try {
        // await authenticateToken(req);
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);
        

        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        // Check if the ID exists in the database and retrieve the existing record
        const existingRecord = await getRecordById(id, tableName, 'id');
        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        
        
        const { name, description, code, pair, image1, image2, apihitid } = req.body;
        

        // var image1Data = await processImageUpload('image1', image1, categoriesFolderPath);
        // var image2Data = await processImageUpload('image2', image2, categoriesFolderPath);

        const image1File = req.files['image1'] ? req.files['image1'][0] : null;
        const image2File = req.files['image2'] ? req.files['image2'][0] : null;
        let image1Data = existingRecord[0]?.image1;
        let image2Data = existingRecord[0]?.image2;

        if (image1File) {
            image1Data = await uploadToAzureBlob(image1File);
        }
        if (image2File) {
            image2Data = await uploadToAzureBlob(image2File);
        }

        await pool.query(`UPDATE ${tableName} SET name = ?, description = ?, code = ?, pair = ?, image1 = ?, image2 = ?,updated_by=? , updated_at = NOW() WHERE id = ?`, [name, description, code, pair, image1Data, image2Data, apihitid, id]);

        // Retrieve the updated record
        const updatedRecord = await getRecordById(id, tableName, 'id');

        await activityLog(ine_category_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

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
            activityLog(ine_category_ModuleID, currentRecord, null, 3, 0);
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