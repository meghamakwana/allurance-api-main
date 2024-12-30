// src/routes/ticketRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, generateSeriesId, activityLog } = require('../commonFunctions')
const router = express.Router();
const { authenticateToken } = require('../utils/authMiddleware');

const tableName = TABLE.TICKET_SUBJECT;
const tableName2 = TABLE.TICKET;
const tableName3 = TABLE.USERS;
const tableName4 = TABLE.TICKET_NEW_USER;
const tableName5 = TABLE.TICKET_RESPONSE;
const ine_tickets_ModuleID = TABLE.TICKET_MODULE_ID;


// Manage Subject: Add
router.post('/subject', async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) { return sendResponse(res, { error: 'Title fields are required', status: false }, 400); }

        const insertResult = await pool.query(`INSERT INTO ${tableName} (title) VALUES (?)`, [title]);

        const insertedRecordId = insertResult[0].insertId;
        const insertedRecord = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

        await activityLog(ine_tickets_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: false }, 201);

    } catch (error) {
        return sendResponse(res, { error: 'Error occurred', status: false }, 500);
    }
});

// Manage Subject: All List & Specific List
router.get('/subject', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);
        if (id) {
            const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 and id = ?`, [id]);
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 ORDER BY title ASC`);
        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }
        return sendResponse(res, { data: [], message: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Manage Subject: Update
router.put('/subject', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        const [existingRecord] = await getRecordById(id, tableName, 'id');

        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const { title } = await req.body;

        await pool.query(`UPDATE ${tableName} SET title = ?, updated_at = NOW() WHERE id = ?`, [title, id]);

        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, tableName, 'id');

        await activityLog(ine_tickets_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Manage Subject: Delete
router.delete('/subject', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));

        if (!deletedIds || deletedIds.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        await Promise.all(deletedIds.map(async (deletedId) => {
            const [currentRecord] = await getRecordById(deletedId, tableName, 'id');
            activityLog(ine_tickets_ModuleID, currentRecord, null, 3, 0);
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


// Manage Ticket: Add
router.post('/', async (req, res) => {
    try {

        // const { subject_id, title, description, user_id, first_name, last_name, email, phone } = req.body;
        const { subject_id, title, description, user_id } = req.body;
        // let newuserRecord = null;
        // let user_type = 1;
        // let userID = '';

        if (!subject_id || !title || !description || !user_id) {
            return sendResponse(res, { error: 'Subject, Title, Description and User ID fields are required', status: false }, 400);
        }

        // if (email) {
        //     const [existingRecord] = await pool.query(`SELECT * FROM ${tableName3} WHERE email = ?`, [email]);
        //     if (existingRecord.length === 0) {
        //         const [existingRecord1] = await pool.query(`SELECT * FROM ${tableName4} WHERE email = ?`, [email]);
        //         if (existingRecord1.length === 0) {
        //             [newuserRecord] = await pool.query(`INSERT INTO ${tableName4} (first_name, last_name, email, phone) VALUES (?,?,?,?)`, [
        //                 first_name,
        //                 last_name,
        //                 email,
        //                 phone,
        //             ]);
        //             user_type = 2;
        //             userID = newuserRecord.insertId;
        //         } else {
        //             userID = existingRecord1[0].id;
        //         }
        //     } else {
        //         userID = existingRecord[0].id;
        //     }
        // }

        var ticketID = generateSeriesId('TKT');
        await pool.query(`INSERT INTO ${tableName2} (ticket_id, subject_id, user_type, user_id, title, description) VALUES (?,?,?,?,?,?)`, [ticketID, subject_id, 1, user_id, title, description]);
        return sendResponse(res, { message: ManageResponseStatus('created'), status: false }, 201);

    } catch (error) {
        return sendResponse(res, { error: 'Error occurred', status: false }, 500);
    }
});

// Manage Ticket: All List & Specific List
router.get('/', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);
        const url = new URL(fullUrl);
        const userId = url.searchParams.get('user_id');

        let query = `SELECT t.*, ts.title as subject_name, u.first_name as user_first_name, u.last_name as user_last_name FROM ine_tickets as t 
                LEFT JOIN ine_ticket_subject as ts on ts.id = t.subject_id 
                LEFT JOIN ine_users as u on u.id = t.user_id
                WHERE t.status = 1`;
        let queryParams = [];

        if (id) {
            query += ` AND t.id = ?`;
            queryParams.push(id);
        }

        if (userId) {
            query += ` AND t.user_id = ?`;
            queryParams.push(userId);
        }

        query += ` ORDER BY id DESC`;

        const [results] = await pool.query(query, queryParams);
        if (results.length > 0) {
            return sendResponse(res, { data: id ? results[0] : results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Manage Ticket: Update
router.put('/', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        const { title, description } = await req.body;

        if (!id || !title || !description) { return sendResponse(res, { error: "Row ID, Title and Description fields are required", status: false }, 400); }

        const [query1] = await pool.query(`SELECT * FROM ine_tickets WHERE id = ? AND status = 1`, [id]);
        if (query1.length > 0) {
            await pool.query(`UPDATE ${tableName2} SET title = ?, description = ?, updated_at = NOW() WHERE id = ?`, [title, description, id]);
            return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 200);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Manage Ticket: Delete
router.delete('/', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));

        if (!deletedIds || deletedIds.length === 0) {
            return sendResponse({ error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        await Promise.all(deletedIds.map(async (deletedId) => {
            const [currentRecord] = await getRecordById(deletedId, tableName2, 'id');
            activityLog(ine_tickets_ModuleID, currentRecord, null, 3, 0); // Maintain Activity Log
        }));

        const query = `UPDATE ${tableName2} SET status = 2, deleted_at = NOW() WHERE id IN (?)`;

        const [results] = await pool.query(query, [deletedIds]);
        if (results.affectedRows > 0) {
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
        }

        return sendResponse({ error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse({ error: `Error occurred: ${error.message}` }, 500);
    }
});


// Ticket Response: Add
router.post('/response', async (req, res) => {
    try {
        const { ticket_id, response_type, message, response_from, response_to } = req.body;

        if (!ticket_id || !response_type || !message) {
            return sendResponse(res, { error: 'Ticket ID, Type and Message fields are required', status: false }, 400);
        }

        const [query2] = await pool.query(`SELECT * FROM ine_tickets WHERE id = ? AND status = 1 and ticket_status != 2`, [ticket_id]);
        if (query2.length == 0) {
            return sendResponse(res, { error: "Sorry, Ticket Not Found or already closed.", status: false }, 404);
        }

        await pool.query(`INSERT INTO ${tableName5} (ticket_id, response_from, response_to, response_type, message) VALUES (?,?,?,?,?)`, [ticket_id, response_from, response_to, response_type, message]);
        return sendResponse(res, { message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Ticket Response: All List & Specific List
router.get('/response', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);
        const url = new URL(fullUrl);
        const ticketId = url.searchParams.get('ticket_id');

        let query = `SELECT tr.*, u1.first_name as response_from_first_name, u1.last_name as response_from_last_name, u2.first_name as response_to_first_name, u2.last_name as response_to_last_name FROM ine_ticket_response as tr 
        LEFT JOIN ine_users as u1 on u1.id = tr.response_from
        LEFT JOIN ine_users as u2 on u2.id = tr.response_to
        WHERE tr.status = 1`;
        let queryParams = [];

        if (ticketId) {
            query += ` AND tr.ticket_id = ?`;
            queryParams.push(ticketId);
        }

        query += ` ORDER BY tr.id ASC`;

        const [results] = await pool.query(query, queryParams);
        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Ticket Response: Update
router.put('/response', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (!id) { return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400); }

        const { ticket_id, response_from, response_type, message } = await req.body;

        if (!ticket_id || !response_type || !message) {
            return sendResponse(res, { error: 'Ticket ID, Type and Message fields are required', status: false }, 400);
        }

        const [query2] = await pool.query(`SELECT * FROM ine_tickets WHERE id = ? AND status = 1 and ticket_status != 2`, [ticket_id]);
        if (query2.length === 0) {
            return sendResponse(res, { error: "Sorry, Ticket Not Found or already closed.", status: false }, 404);
        }

        const [query1] = await pool.query(`SELECT * FROM ine_ticket_response WHERE id = ? AND status = 1`, [id]);
        if (query1.length > 0) {
            await pool.query(`UPDATE ine_ticket_response SET response_from = ?, response_type = ?, message = ?, updated_at = NOW() WHERE id = ?`, [response_from, response_type, message, id]);
            return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 200);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Ticket Response: Delete
router.delete('/response', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));

        if (!deletedIds || deletedIds.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        await Promise.all(deletedIds.map(async (deletedId) => {
            await getRecordById(deletedId, tableName2, 'id');
        }));

        const query = `UPDATE ${tableName5} SET status = 2, deleted_at = NOW() WHERE id IN (?)`;

        const [results] = await pool.query(query, [deletedIds]);
        if (results.affectedRows > 0) {
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
        }

        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Ticket Verify: List
router.get('/verify', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);
        const ticketID = url.searchParams.get('ticket_id');
        const userId = url.searchParams.get('user_id');

        if (!ticketID || !userId) {
            return sendResponse(res, { error: 'Ticket ID and User ID fields are required', status: false }, 400);
        }

        const [results] = await pool.query(`SELECT * FROM ${tableName2} WHERE id = ? AND user_id = ? and status = 1 `, [ticketID, userId]);
        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Ticket Assign: Update
router.put('/assignticket', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (!id) { return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400); }

        const { operate_by, assign_by } = await req.body;

        if (!operate_by || !assign_by) {
            return sendResponse(res, { error: 'Ticket ID, Operate BY and Assign By ID fields are required', status: false }, 400);
        }

        const [query2] = await pool.query(`SELECT * FROM ine_tickets WHERE id = ? AND status = 1 and ticket_status != 2`, [id]);
        if (query2.length === 0) {
            return sendResponse(res, { error: "Sorry, Ticket Not Found.", status: false }, 404);
        }

        await pool.query(`UPDATE ine_tickets SET operate_by = ?, assign_by = ?, updated_at = NOW() WHERE id = ?`, [operate_by, assign_by, id]);
        return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Ticket Front Users List
router.post('/ticket-front-users', async (req, res) => {
    try {
        const [quer1] = await pool.query(`SELECT * FROM ine_users WHERE status = 1 and role_id = 9 ORDER BY ID DESC`);
        if (quer1.length > 0) {
            return sendResponse(res, { data: quer1, message: ManageResponseStatus('fetched'), status: true, count: quer1.length }, 200);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Ticket Assign Users List
router.post('/ticket-assign-users', async (req, res) => {
    try {
        const [quer1] = await pool.query(`SELECT * FROM ine_users WHERE status = 1 and role_id = 7 ORDER BY ID DESC`);
        if (quer1.length > 0) {
            return sendResponse(res, { data: quer1, message: ManageResponseStatus('fetched'), status: true, count: quer1.length }, 200);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Ticket Close
router.post('/ticket-close', async (req, res) => {
    try {
        const { ticket_id, user_id } = await req.body;
        if (!ticket_id || !user_id) { return sendResponse(res, { error: 'Ticket ID and User ID fields are required', status: false }, 400); }

        const [quer1] = await pool.query(`SELECT * FROM ine_tickets WHERE status = 1 and ticket_status = 1 and id = ?`, [ticket_id]);
        if (quer1.length > 0) {
            await pool.query(`UPDATE ine_tickets SET ticket_status = 2, closed_by = ?, closed_date = NOW() WHERE id = ?`, [user_id, ticket_id]);
            return sendResponse(res, { message: "Ticket Successfully Closed", status: true }, 200);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


module.exports = router;