// src/routes/userRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog, validatePassword, checkEmailExistOrNot, checkPhoneExistOrNot, processImageUpload, generateUniqueUserId } = require('../commonFunctions')
const router = express.Router();

const tableName = TABLE.USERS;
const ine_customers_ModuleID = TABLE.CUSTOMER_MODULE_ID;
const tableName2 = TABLE.USERS_DETAILS;
const tableName3 = TABLE.ROLE;

// Add
router.post('/', async (req, res) => {
    try {
        // await authenticateToken(req);
        let { first_name, last_name, email, phone, password, address, country, state_id, district_id, pincode, avatar, record_status, date_of_birth, anniversary } = req.body;


        // Validate request data
        if (!first_name || !last_name || !email || !phone || !password) {
            return sendResponse(res, { error: 'First Name, Last Name, Email, Phone and Password field is required', status: false }, 400);
        }

        // Email Validation
        if (email) {
            const emailExists = await checkEmailExistOrNot(tableName, email);
            if (emailExists) {
                return sendResponse(res, { error: 'Email already exists', status: false }, 409);
            }
        }

        // Phone Validation
        if (phone) {
            if (phone.length !== 10) {
                return sendResponse(res, { error: 'Phone number must be 10 digits', status: false }, 400);
            }
            const phoneExists = await checkPhoneExistOrNot(tableName, phone);
            if (phoneExists) {
                return sendResponse(res, { error: 'Phone number already exists', status: false }, 409);
            }
        }

        // Password Validation
        if (!validatePassword(password)) {
            return sendResponse(res, { error: 'Password must be at least 9 characters long and contain at least one uppercase letter, one lowercase letter and one special character.', status: false }, 400);
        }

        // Hash the password
        const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

        // await processDocument('avatar', requestData, avatarFolderPath); // Avatar Document
        avatar = ''; // await processDocuments(avatar); // Avatar Document

        record_status = record_status === 'active' ? 1 : 2;

        // Generate Customer ID
        const customerId = await generateUniqueUserId();

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (role_id, first_name, customer_id, last_name, email, phone, password, avatar, status) VALUES (?,?,?,?,?,?,?,?,?)`, [
            9, first_name, customerId, last_name, email, phone, hashedPassword, avatar, record_status
        ]);

        const insertedRecordId = insertResult.insertId;
        let dob, anni;
        if(date_of_birth) {
            let year = date_of_birth.split('-')[0];
            let month = date_of_birth.split('-')[1];
            let day = date_of_birth.split('-')[2].slice(0, 2);
            dob = `${year}-${month}-${day}`;
        }
        if(anniversary) {
            let year = anniversary.split('-')[0];
            let month = anniversary.split('-')[1];
            let day = anniversary.split('-')[2].slice(0, 2);
            anni = `${year}-${month}-${day}`;
        }
        console.log(dob, anni);
        // User Details - Insertion
        await pool.query(`INSERT INTO ${tableName2} (user_id, address, state_id, district_id, pincode, date_of_birth, anniversary) VALUES (?,?,?,?,?,?,?)`, [
            insertedRecordId, address, state_id, district_id, pincode, dob, anni,
        ]);

        const [insertedRecord] = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

        await activityLog(ine_customers_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// List
router.get('/', async (req, res) => {
    try {
        // await authenticateToken(req);
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        const baseQuery = `SELECT u.*, u.status as record_status, ir.name as rolename, ud.date_of_birth, ud.anniversary, ud.gender, ud.address, ud.state_id, ud.district_id, ud.pincode, ud.govt_id_number, ud.govt_id_upload, ud.pan_number, ud.pan_upload FROM \`${tableName}\` as u LEFT JOIN \`${tableName2}\` as ud on ud.user_id = u.id LEFT JOIN \`${tableName3}\` as ir on ir.id = u.role_id where u.role_id = 9`;

        if (id) {
            const query1 = `${baseQuery} AND u.id = ? ORDER BY u.id DESC`;
            const [results] = await pool.query(query1, [id]);

            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const query2 = `${baseQuery} ORDER BY u.id DESC`;
        const [results] = await pool.query(query2);

        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }

        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Profile
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

        /*if (!existingRecord) {
            return sendResponse({ error: ManageResponseStatus('notFound'), status: false }, 404);
        }*/

        const { first_name, last_name, email, phone, password, address, state_id, district_id, pincode, avatar, date_of_birth, anniversary, record_status } = req.body;

        // Validate request data
        if (!first_name || !last_name || !email || !phone) {
            return sendResponse(res, { error: 'First Name, Last Name, Email and Phone field is required', status: false }, 400);
        }

        if (email) {
            const emailExists = await checkEmailExistOrNot(tableName, email, id);
            if (emailExists) {
                return sendResponse(res, { error: 'Email already exists', status: false }, 409);
            }
        }

        // Phone Validation
        if (phone) {
            if (phone.length !== 10) {
                return sendResponse(res, { error: 'Phone number must be 10 digits', status: false }, 400);
            }
            const phoneExists = await checkPhoneExistOrNot(tableName, phone, id);
            if (phoneExists) {
                return sendResponse(res, { error: 'Phone number already exists', status: false }, 409);
            }
        }

        // var aimg = await processImageUpload('avatar', avatar, avatarFolderPath);
        var aimg = ''; // await processDocuments(avatar); // Avatar Document

        var rstatus = record_status;
        if (rstatus) {
            if (rstatus == 'active') {
                rstatus = 1;
            } else {
                rstatus = 2;
            }
        }

        // Build the query and parameter array based on the presence of password value
        let updateQuery = `UPDATE ${tableName} SET first_name = ?, last_name = ?, email = ?, phone = ?, avatar = ?, status = ?, updated_at = NOW()`;
        let queryParams = [first_name, last_name, email, phone, aimg, rstatus];

        // Check if the password field has a value, if yes, include it in the update query
        if (password !== undefined && password !== "") {

            // Password Validation
            if (!validatePassword(password)) {
                return sendResponse(res, { error: 'Password must be at least 9 characters long and contain at least one uppercase letter, one lowercase letter and one special character.', status: false }, 400);
            }

            // Hash the password
            const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

            updateQuery += `, password = ?`;
            queryParams.push(hashedPassword);
        }

        updateQuery += ` WHERE id = ?`;
        queryParams.push(id);

        await pool.query(updateQuery, queryParams);

        await pool.query(`UPDATE ${tableName2} SET address = ?, state_id = ?, district_id = ?, pincode = ?, date_of_birth = ?, anniversary = ? WHERE user_id = ?`, [address, state_id, district_id, pincode, date_of_birth, anniversary, id]);

        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, tableName, 'id');

        await activityLog(ine_customers_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

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
            activityLog(ine_customers_ModuleID, currentRecord, null, 3, 0);
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