// src/routes/contactusRoutes.js
const express = require('express');
const nodemailer = require('nodemailer');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, activityLog } = require('../commonFunctions')
const router = express.Router();
const { sendEmail } = require('../utils/emailService');
const { getContactUsUserMailOptions, getContactUsAdminMailOptions } = require('../utils/emailTemplates');

const tableName = TABLE.CONTACT_US;
const ine_contact_us_ModuleID = TABLE.CONTACT_US_MODULE_ID;
const tableName2 = TABLE.CONTACT_INQUIRY;
const ine_contact_inquiry_ModuleID = TABLE.CONTACT_INQUIRY_MODULE_ID;

/****************** Contact Us Start ******************/

// All List & Specific List
router.get('/', async (req, res) => {
    try {
        const query1 = `SELECT * FROM ${tableName} WHERE id = 1;`;
        const [results] = await pool.query(query1);
        if (results.length > 0) {
            return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
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
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        const existingRecordQuery = `SELECT * FROM ${tableName} WHERE id = ?`;
        const [existingRecord] = await pool.query(existingRecordQuery, [id]);

        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const { address, email, contact1, contact2, apihitid } = req.body;

        await pool.query(
            `UPDATE ${tableName} SET address = ?, email = ?, contact1 = ?, contact2 = ?, updated_by = ?, updated_at = NOW() WHERE id = ?`,
            [address, email, contact1, contact2, apihitid, id]
        );

        // Retrieve the updated record
        const updatedRecord = {
            id,
            address,
            email,
            contact1,
            contact2,
            updated_by: apihitid,
            updated_at: new Date().toISOString()
        };

        await activityLog(ine_contact_us_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****************** Contact Us End ******************/

/****************** Contact Inquiry Start ******************/

// Add
router.post('/inquiry', async (req, res) => {
    try {
        const { name, email, phone, description } = req.body;

        // Validate request data
        if (!name || !email || !phone || !description) {
            return sendResponse(res, { error: 'Name, Email, Phone and Description fields are required', status: false }, 400);
        }

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${tableName2} (name, email, phone, description) VALUES (?, ?, ?, ?)`, [
            name,
            email,
            phone,
            description,
        ]);

        const insertedRecordId = insertResult.insertId;
        const [insertedRecord] = await getRecordById(insertedRecordId, tableName2, 'id'); // Retrieve the inserted record

        await activityLog(ine_contact_inquiry_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

        // Email Send
        const userMailOptions = getContactUsUserMailOptions(name, email, description);
        const adminMailOptions = getContactUsAdminMailOptions(name, email, phone, description);
        await sendEmail(userMailOptions);
        await sendEmail(adminMailOptions);

        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// All List & Specific List
router.get('/inquiry', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

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

/****************** Contact Inquiry End ******************/

module.exports = router;