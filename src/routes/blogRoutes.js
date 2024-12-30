// src/routes/blogRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog, generateUniqueSlug } = require('../commonFunctions')
const router = express.Router();

const tableName = TABLE.BLOG_CATEGORY;
const ine_blog_category_ModuleID = TABLE.BLOG_CATEGORY_MODULE_ID;
const tableName2 = TABLE.BLOG;
const ine_blog_ModuleID = TABLE.BLOG_MODULE_ID;
const blogFolderPath = 'public/assets/images/blog';

/****************** Blog Category Start ******************/

// Add
router.post('/categories', async (req, res) => {
    try {
        const { name, apihitid } = req.body;

        // Validate request data
        if (!name) {
            return sendResponse(res, { error: 'Name fields are required', status: false }, 400);
        }

        // Insertion
        const insertResult = await pool.query(`INSERT INTO ${tableName} (name,created_by) VALUES (?,?)`, [
            name,
            apihitid,
        ]);

        const insertedRecordId = insertResult.insertId;
        const insertedRecord = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

        await activityLog(ine_blog_category_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// All List & Specific List
router.get('/categories', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (id) {
            const [results] = await getRecordById(id, tableName, 'id');
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const [results] = await getRecordById(null, tableName, 'id');
        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }



});

// Update
router.put('/categories', async (req, res) => {
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

        const { name, apihitid } = await req.body;

        await pool.query(`UPDATE ${tableName} SET name = ?,updated_by=?, updated_at = NOW() WHERE id = ?`, [name, apihitid, id]);

        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, tableName, 'id');

        await activityLog(ine_blog_category_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Delete
router.delete('/categories', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));

        if (!deletedIds || deletedIds.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        await Promise.all(deletedIds.map(async (deletedId) => {
            const [currentRecord] = await getRecordById(deletedId, tableName, 'id');
            activityLog(ine_blog_category_ModuleID, currentRecord, null, 3, 0);
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

/****************** Blog Category End ******************/

/****************** Blog Start ******************/

// Add
router.post('/', async (req, res) => {
    try {
        const { title, image1, category_id, short_description, description, apihitid } = req.body;

        // Validate request data
        if (!title || !image1) {
            return sendResponse(res, { error: 'Title, Category and Image fields are required', status: false }, 400);
        }

        // await processDocument('image1', requestData, blogFolderPath);

        let newSlug = await generateUniqueSlug(tableName2, title);

        // Insertion
        const insertResult = await pool.query(`INSERT INTO ${tableName2} (title, category_id, slug, image1, short_description, description,created_by) VALUES (?, ?, ?, ?, ?, ?,?)`, [
            title,
            category_id,
            newSlug,
            image1,
            short_description,
            description,
            apihitid
        ]);

        const insertedRecordId = insertResult.insertId;
        const insertedRecord = await getRecordById(insertedRecordId, tableName2, 'id'); // Retrieve the inserted record

        await activityLog(ine_blog_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// All List & Specific List
router.get('/', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);
        const slug = url.searchParams.get('slug');
        const notslug = url.searchParams.get('notslug');
        const id = getQueryParamId(fullUrl);

        const page = parseInt(url.searchParams.get('page')) || 1; // Default to page 1 if not specified
        const pageSize = parseInt(url.searchParams.get('pageSize')) || 10; // Default page size to 10 if not specified

        // Calculate offset based on page number and page size
        const offset = (page - 1) * pageSize;

        let sql = `SELECT * FROM ${tableName2}`;
        const params = [];

        if (id) {
            sql += ` WHERE id = ?`;
            params.push(id);
        } else if (slug) {
            sql += ` WHERE slug = ?`;
            params.push(slug);
        } else if (notslug) {
            sql += ` WHERE slug != ?`;
            params.push(notslug);
        }

        sql += ` LIMIT ?, ?`;
        params.push(offset, pageSize);

        const [results] = await pool.query(sql, params);

        if (results.length > 0) {
            if (results.length == 1) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true, count: 1 }, 200);
            }
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

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (!id) {
            return sendResponse({ error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        // Check if the ID exists in the database and retrieve the existing record
        const [existingRecord] = await getRecordById(id, tableName2, 'id');

        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const { title, category_id, image1, short_description, description, apihitid } = req.body;

        var image1Data = ''; // await processImageUpload('image1', image1, blogFolderPath);

        let newSlug = await generateUniqueSlug(tableName2, title, id);

        await pool.query(`UPDATE ${tableName2} SET title = ?, category_id = ?, slug = ?, image1 = ?, short_description = ?, description = ?,updated_by=?, updated_at = NOW() WHERE id = ?`, [title, category_id, newSlug, image1Data, short_description, description, apihitid, id]);

        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, tableName2, 'id');

        await activityLog(ine_blog_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

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
            const [currentRecord] = await getRecordById(deletedId, tableName2, 'id');
            activityLog(ine_blog_category_ModuleID, currentRecord, null, 3, 0);
        }));

        const query = `UPDATE ${tableName2} SET status = 2, deleted_at = NOW() WHERE id IN (?)`;

        const [results] = await pool.query(query, [deletedIds]);
        if (results.affectedRows > 0) {
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****************** Blog End ******************/

module.exports = router;