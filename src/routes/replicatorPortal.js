const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, checkEmailExistOrNot, checkPhoneExistOrNot, processDocuments, activityLog, getRecordBydesignerId, getRecordsByReplicatorId, getRecordByuserId } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');

const router = express.Router();


// Table Name
const tableName = TABLE.REPLICATOR;
const tableName2 = TABLE.MANAGE_REQUEST;
const tableName3 = TABLE.PACKERS_SERIAL_NUMBER;
const ine_replicator_moduleID = TABLE.REPLICATOR_MODULE
const tableName4 = TABLE.DESIGNER

router.get('/:id?', async (req, res) => {
    try {
        await authenticateToken(req);
        const id = req.params.id || req.query.id;
        if (id) {
            const [results] = await getRecordById(id, tableName, 'id');
            if (results) {
                // Check if record_status is 2
                if (results.record_status === 2) {
                    // Execute raw SQL query to fetch serial numbers
                    const [approvedrecords] = await getRecordsByReplicatorId(id, tableName3, 'id');
                    if (approvedrecords.length > 0) {
                        results.approvedrecords = approvedrecords;
                    }
                    const [marketingData] = await pool.query(`SELECT m.*, d.category_id, c.name as category_name FROM ${TABLE.MARKETING} as m 
                    LEFT JOIN ${TABLE.DESIGNER} as d on d.id = m.designer_id
                    LEFT JOIN ${TABLE.CATEGORY} as c on c.id = d.category_id
                    WHERE m.designer_id = ?`, [id]);
                    if (marketingData.length > 0) {
                        results.marketingrecords = marketingData;
                    }
                }
                return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        // const results = await getRecordById(null, tableName, 'id');
        // const results = await query(`SELECT * FROM ${tableName}`)
        let sqltmp = `
            SELECT 
              a.*, 
              ine_users.first_name as created_by_first_name, 
              ine_users.last_name as created_by_last_name
            FROM ${tableName} AS a
            LEFT JOIN ine_users ON a.created_by = ine_users.id
          `
        const [results] = await pool.query(sqltmp);

        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


router.post('/', async (req, res) => {
    try {
        await authenticateToken(req);
        const requestData = await req.body;

        // Validate request data
        if (!requestData.designer_id || !requestData.quantity) {
            return sendResponse(res, { error: 'Model Id and quantity fields are required', status: false }, 400);
        }

        const [insertedRecord] = await getRecordBydesignerId(requestData?.designer_id, tableName4, 'id');

        // Check if a record exists in tableName4
        if (insertedRecord != [] && !insertedRecord.length > 0) {
            return sendResponse(res, { error: 'Model ID does not exist or is not approved yet', status: false }, 404);
        }

        // Insert a record into tableName if a record exists in tableName4
        const [insertResult] = await pool.query(`
            INSERT INTO ${tableName} (designer_id, quantity, created_by) 
            VALUES (?, ?, ?)`, [
            requestData.designer_id,
            requestData.quantity,
            requestData.created_by
        ]);

        // Retrieve the inserted record
        const insertedRecordId = insertResult.insertId;
        const [insertedRecordDetails] = await getRecordById(insertedRecordId, tableName, 'id');

        // Check if the insertion was successful
        if (insertResult) {
            // Insert a record into tableName2 with the generated batch number
            await pool.query(`
                INSERT INTO ${tableName2} (module_id, row_id, request_status, comments, created_by) 
                VALUES (?, ?, ?, ?, ?)`, [
                ine_replicator_moduleID,
                insertedRecordId,
                1, // Assuming 1 represents a successful request status
                null,
                requestData.created_by, // Assuming 1 represents the ID of the user who created the record
                // Insert the generated batch number
            ]);
        }

        // Maintain Activity Log
        await activityLog(ine_replicator_moduleID, null, insertedRecordDetails, 1, 0);
        return sendResponse(res, { data: insertedRecordDetails[0], message: ManageResponseStatus('created'), status: true }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.get('/getbyid/:id?', async (req, res) => {
    try {
        await authenticateToken(req);
        const id = req.params.id || req.query.id;
        if (id) {
            const [results] = await getRecordByuserId(id, tableName, 'id');
            if (results.length > 0) {
                return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        // return sendResponse({ data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


module.exports = router;