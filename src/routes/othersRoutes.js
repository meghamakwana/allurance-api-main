// src/routes/othersRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, activityLog } = require('../commonFunctions')
const router = express.Router();

const tableName = TABLE.ACTIVITYLOG;
const tableName2 = TABLE.COUNTRIES;
const tableName3 = TABLE.PRODUCT;
const tableName4 = TABLE.SETTINGS;
const ine_settings_ModuleID = TABLE.SETTINGS_MODULE_ID;
const tableName5 = TABLE.STATE_DISTRICT;

/****************** Activity Log Start ******************/

// List
router.get('/activitylog', async (req, res) => {
    try {
        const [results] = await pool.query(`SELECT o.*, m.name as module_name FROM ine_other_activity as o LEFT JOIN ine_modules as m on m.id = o.module_id`);
        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****************** Activity Log End ******************/

/****************** Country Start ******************/

// List
router.get('/country', async (req, res) => {
    try {
        const [results] = await pool.query(`SELECT * FROM \`${tableName2}\``);
        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****************** Country End ******************/

/****************** Searchbar Start ******************/

// List
router.get('/searchbar', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);
        const keywords = url.searchParams.get('keywords');

        if (keywords) {
            const [results] = await pool.query(`SELECT * FROM ${tableName3} WHERE name LIKE ? OR short_description LIKE ?`, [`%${keywords}%`, `%${keywords}%`]);
            if (results.length > 0) {
                return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        return sendResponse(res, { error: 'Keyboard parameter is required', status: false }, 400);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****************** Searchbar End ******************/

/****************** Site Setting Start ******************/

// List
router.get('/sitesetting', async (req, res) => {
    try {

        const query1 = `SELECT * FROM ${tableName4} WHERE id = 1;`;
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
router.put('/sitesetting', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        // Retrieve the existing record
        const existingRecordQuery = `SELECT * FROM ${tableName4} WHERE id = ?`;
        const [existingRecordResults] = await pool.query(existingRecordQuery, [id]);

        // Ensure that existingRecordResults is an array and get the first item
        if (existingRecordResults.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        const existingRecord = existingRecordResults[0];

        const { site_title, site_logo, smtp_host, smtp_username, smtp_password, smtp_port } = req.body;

        await pool.query(`UPDATE ${tableName4} SET site_title = ?, site_logo = ?, smtp_host = ?, smtp_username = ?, smtp_password = ?, smtp_port = ?, updated_at = NOW() WHERE id = ?`, [site_title, site_logo, smtp_host, smtp_username, smtp_password, smtp_port, id]);

        // Create the updated record object
        const updatedRecord = {
            id,
            site_title,
            site_logo,
            smtp_host,
            smtp_username,
            smtp_password,
            smtp_port,
            updated_at: new Date().toISOString()
        };

        await activityLog(ine_settings_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****************** Site Setting End ******************/

/****************** State - Endpoint1 Start ******************/

// List
router.get('/state_district/endpoint1', async (req, res) => {
    try {
        const [results] = await pool.query(`SELECT 
                id as id, 
                name as StateName, 
                0 as district_count
            FROM \`${TABLE.STATE_TABLE}\`
            `);
        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }
        return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****************** State - Endpoint1 End ******************/

/****************** District - Endpoint2 Start ******************/

// List
router.post('/state_district/endpoint2', async (req, res) => {
    try {
        const { StateName } = req.body;

        // Validate request data
        if (!StateName) {
            return sendResponse(res, { error: 'StateName fields are required', status: false }, 400);
        }

        let stateQuery = `SELECT  MIN(id) AS id, District FROM \`${tableName5}\` WHERE state_id = ? GROUP BY District`;
        // console.log('stateQuerystateQuery',stateQuery);
        const [results] = await pool.query(stateQuery, [StateName]);
        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }
        return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****************** District - Endpoint2 End ******************/

/****************** Pincode - Endpoint3 Start ******************/

// List
router.post('/state_district/endpoint3', async (req, res) => {
    try {
        const { District } = req.body;

        // Validate request data
        if (!District) {
            return sendResponse({ error: 'District fields are required', status: false }, 400);
        }

        const [results] = await pool.query(`SELECT * FROM \`${tableName5}\` WHERE District = ?`, [District]);
        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }
        return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****************** Pincode - Endpoint3 End ******************/

module.exports = router;