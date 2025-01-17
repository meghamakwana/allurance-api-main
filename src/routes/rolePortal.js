const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, checkEmailExistOrNot, checkPhoneExistOrNot, processDocuments, activityLog } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');
const router = express.Router();
// Table Name
const tableName = TABLE.ROLES;
const tableName2 = TABLE.MODULES_TABLE;
const tableName3 = TABLE.PERMISSIONS_TABLE;
const ine_roles_ModuleID = TABLE.ROLE_MODULE


// ROLE CRUD 
router.get('/:id?', async (req, res) => {
    try {
        await authenticateToken(req);
        const id = req.params.id || req.query.id;
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

router.post('/', async (req, res) => {
    try {
        await authenticateToken(req);
        const requestData = await req.body;

        // Validate request data
        if (!requestData.name || !requestData.prefix) {
            return sendResponse(res, { error: 'Name and Prefix fields are required', status: false }, 400);
        }

        const [existingPrefix] = await pool.query(`SELECT * FROM ${tableName} WHERE prefix = ?`, [requestData.prefix]);
        if (existingPrefix.length > 0) {
            return sendResponse(res, { error: 'Prefix must be unique', status: false }, 400);
        }

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (name, prefix,created_by) VALUES (?,?,?)`, [
            requestData.name, requestData.prefix, requestData.apihitid
        ]);

        const insertedRecordId = insertResult.insertId;
        const [insertedRecord] = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

        // Add modules based on Role
        const [existingData] = await pool.query(`SELECT * FROM \`${tableName2}\` WHERE status = ?`, [1]);
        if (existingData && existingData.length > 0) {
            for (const module of existingData) {
                if (existingData.length > 0) {
                    const permissionsData = {
                        role_id: insertedRecordId,
                        module_id: module.id,
                        read_access: module.id === 1 ? 1 : 0,
                        add_access: module.id === 1 ? 1 : 0,
                        update_access: module.id === 1 ? 1 : 0,
                        delete_access: module.id === 1 ? 1 : 0,
                    };

                    await pool.query(
                        `INSERT INTO ${tableName3} (role_id, module_id, read_access, add_access, update_access, delete_access) VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            permissionsData.role_id,
                            permissionsData.module_id,
                            permissionsData.read_access,
                            permissionsData.add_access,
                            permissionsData.update_access,
                            permissionsData.delete_access
                        ]
                    );
                }
            }
        }
        await activityLog(ine_roles_ModuleID, null, insertedRecord, 1, 0);
        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.put('/:id', async (req, res) => {
    try {
        await authenticateToken(req);
        const id = req.params.id || req.query.id;

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

        await activityLog(ine_roles_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await authenticateToken(req);
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = req.params.id || req.query.id;
        const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));
        if (!deletedIds || deletedIds.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }
        await Promise.all(deletedIds.map(async (deletedId) => {
            const [currentRecord] = await getRecordById(deletedId, tableName, 'id');
            //activityLog(ine_tickets_ModuleID, currentRecord, null, 3, 0);
        }));
        const query = `UPDATE ${tableName} SET status = 2, deleted_at = NOW() WHERE id IN (?)`;
        const formattedQuery = mysql.format(query, [deletedIds]);
        const [results] = await pool.query(query, [deletedIds]);
        if (results.affectedRows > 0) {
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// ROLE PERMISSION MODULE
router.get('/permission/:id?', async (req, res) => {
    try {
        const role_id = req.params.id || req.query.id;
        // const role_id = getQueryParamId(new URL(req.url));
        const baseQuery = `SELECT ip.*, im.name FROM \`${tableName3}\` as ip LEFT JOIN \`${tableName2}\` as im on im.id = ip.module_id WHERE ip.status = 1`;

        if (role_id) {
            const query1 = `${baseQuery} AND ip.role_id = ? ORDER BY ip.id ASC`;
            const [results] = await pool.query(query1, [role_id]);
            if (results.length > 0) {
                return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
            }
            return sendResponse(res,{ error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const query2 = `${baseQuery} ORDER BY ip.id ASC`;
        const [results] = await pool.query(query2);

        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }

        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// POST METHOD FOR PERMISSION
router.post('/permission', async (req, res) => {
    try {
        await authenticateToken(req);
        // const requestData = await req.body;
        const requestData = Object.values(req.body);
        for (const item of requestData) {
            const { id, read_access, add_access, update_access, delete_access } = item;
            const [existingData] = await pool.query(`SELECT * FROM \`${tableName3}\` WHERE id = ?`, [id]);
            if (existingData) {
                existingData.read_access = read_access;
                existingData.add_access = add_access;
                existingData.update_access = update_access;
                existingData.delete_access = delete_access;
                await pool.query(`UPDATE \`${tableName3}\` SET read_access = ?, add_access = ?, update_access = ?, delete_access = ? WHERE id = ?`, [read_access, add_access, update_access, delete_access, id]);
            }
        }

        return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
})

// MODULE PERMSSION
router.get('/module/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            const [results] = await getRecordById(id, tableName2, 'id');
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        const [results] = await getRecordById(null, tableName2, 'id');
        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;