const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { ManageResponseStatus, sendResponse } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');
const router = express.Router();

// Table Name
const tableName = TABLE.PACKERS_SERIAL_NUMBER;
const tableName2 = TABLE.REPLICATOR;
const tableName3 = TABLE.DESIGNER;
const tableName4 = TABLE.BEZELMATERIAL;
const tableName5 = TABLE.CATEGORY;
const tableName6 = TABLE.PACKERS_QUALITY;
const tableName7 = TABLE.PACKERS_PACKING;

// Quality Check: Fetch Serial Number Based on Batch Number 
router.post('/get_quality_serial_based_on_batch', async (req, res) => {
    try {
        const { batch_number } = await req.body;
        const [query1] = await pool.query(`SELECT * FROM ${tableName2} WHERE batch_number = ? and status = 1 and record_status = 2`, [batch_number]);
        if (query1.length > 0) {
            const replicator_id = query1[0]['id'];
            const [query2] = await pool.query(`SELECT * FROM ${tableName} WHERE replicator_id = ? and is_quality_checked = 'No'`, [replicator_id]);
            return sendResponse(res, { data: query2, message: ManageResponseStatus('fetched'), status: true }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Quality Check: Update Serial Number 
router.post('/update_quality_serial_number', async (req, res) => {
    try {
        const { serial_numbers } = req.body;
        if (!Array.isArray(serial_numbers)) {
            return sendResponse(res, { error: 'Inputs must be an array', status: false }, 400);
        }
        let results = [];
        let notFoundSerialNumbers = [];

        const request_id = qualityCheckedNumber();
        let packers_quality_id = '';

        async function insertQualityPacking() {
            const [query3] = await pool.query(`INSERT INTO ${tableName6} (request_id) VALUES (?)`, [request_id]);
            return query3.insertId;
        }

        var replicatorid = '';
        for (const serial_number of serial_numbers) {
            const quality_checked_number = qualityCheckedNumber();
            const [query1] = await pool.query(`SELECT * FROM ${tableName} WHERE serial_number = ? AND is_quality_checked = 'No'`, [serial_number]);
            if (query1.length > 0) {

                if (!packers_quality_id) {
                    packers_quality_id = await insertQualityPacking();
                }

                await pool.query(`UPDATE ${tableName} SET is_quality_checked = 'Yes', packers_quality_id = ?, quality_checked_number = ?, quality_checked_updated_at = NOW() WHERE serial_number = ?`, [packers_quality_id, quality_checked_number, serial_number]);

                const [query2] = await pool.query(`SELECT psn.serial_number, psn.serial_number_left, psn.serial_number_right, psn.quality_checked_number, ir.batch_number, ir.designer_id AS model_number, ibm.name AS metal_name, ic.name AS category_name FROM ${tableName} AS psn
                    LEFT JOIN ${tableName2} AS ir ON ir.id = psn.replicator_id
                    LEFT JOIN ${tableName3} AS id ON id.model_number = ir.designer_id
                    LEFT JOIN ${tableName4} AS ibm ON ibm.id = id.bezel_material_id
                    LEFT JOIN ${tableName5} AS ic ON ic.id = id.category_id
                    WHERE psn.serial_number = ?`, [serial_number]);

                results = results.concat(query2);

                replicatorid = query1[0]['replicator_id'];
            } else {
                notFoundSerialNumbers.push(serial_number);
            }
        }

        // CALL UpdateQualityCheck('replicatorid');
        await pool.query(`CALL UpdateQualityCheck(?)`, [replicatorid]);

        if (results.length > 0) {
            const message = notFoundSerialNumbers.length > 0 ? `${ManageResponseStatus('fetched')} - Warning: Some records were not found: ${notFoundSerialNumbers.join(', ')}` : ManageResponseStatus('fetched');
            return sendResponse(res, { data: results, message, status: true }, 200);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
});

// Quality Check: Get Reports  
router.get('/get_quality_reports', async (req, res) => {
    try {
        const [qualityPackings] = await pool.query(`SELECT pqp.id AS packingId, pqp.request_id, pqp.created_at, COUNT(psn.id) AS numer_of_request, ir.batch_number, ir.designer_id as model_number FROM ${tableName6} AS pqp 
            LEFT JOIN ${tableName} AS psn ON pqp.id = psn.packers_quality_id 
            LEFT JOIN ${tableName2} as ir on ir.id = psn.replicator_id
            GROUP BY pqp.id`);

        if (qualityPackings.length > 0) {
            let results = [];

            for (const packing of qualityPackings) {
                const { packingId, request_id, numer_of_request, batch_number, model_number, created_at } = packing;

                const [serialNumbers] = await pool.query(`SELECT psn.serial_number, psn.serial_number_left, psn.serial_number_right, psn.quality_checked_number, ir.batch_number, ir.designer_id AS model_number, ibm.name AS metal_name, ic.name AS category_name FROM ${tableName} AS psn
                INNER JOIN ${tableName2} AS ir ON ir.id = psn.replicator_id
                LEFT JOIN ${tableName3} AS id ON id.model_number = ir.designer_id
                LEFT JOIN ${tableName4} AS ibm ON ibm.id = id.bezel_material_id
                LEFT JOIN ${tableName5} AS ic ON ic.id = id.category_id
                WHERE psn.packers_quality_id = ?`, [packingId]);

                results.push({ packingId, request_id, numer_of_request, batch_number, model_number, created_at, records: serialNumbers });
            }
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
});

// Packing: Get Serial Number Based on Batch Number 
router.post('/get_packing_serial_based_on_batch', async (req, res) => {
    try {
        const { batch_number } = await req.body;
        const [query1] = await pool.query(`SELECT * FROM ${tableName2} WHERE batch_number = ? and status = 1 and record_status = 2`, [batch_number]);
        if (query1.length > 0) {
            const replicator_id = query1[0]['id'];
            const [query2] = await pool.query(`SELECT * FROM ${tableName} WHERE replicator_id = ? and is_quality_checked = 'Yes' and is_packed = 'No'`, [replicator_id]);
            return sendResponse(res, { data: query2, message: ManageResponseStatus('fetched'), status: true }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Packing: Update Serial Number 
router.post('/update_packing_serial_number', async (req, res) => {
    try {
        const { serial_numbers } = await req.body;
        if (!Array.isArray(serial_numbers)) {
            return sendResponse(res, { error: 'Inputs must be an array', status: false }, 400);
        }
        let results = [];
        let notFoundSerialNumbers = [];

        const request_id = qualityCheckedNumber();
        let packers_packing_id = '';

        async function insertPackersPacking() {
            const [query3] = await pool.query(`INSERT INTO ${tableName7} (request_id) VALUES (?)`, [request_id]);
            return query3.insertId;
        }

        var replicatorid = '';
        for (const serial_number of serial_numbers) {
            const [query1] = await pool.query(`SELECT * FROM ${tableName} WHERE serial_number = ? and is_quality_checked = 'Yes' and is_packed = 'No'`, [serial_number]);
            if (query1.length > 0) {

                if (!packers_packing_id) {
                    packers_packing_id = await insertPackersPacking();
                }

                await pool.query(`UPDATE ${tableName} SET is_packed = 'Yes', packers_packing_id = ?, packing_checked_updated_at = now() WHERE serial_number = ?`, [packers_packing_id, serial_number]);

                const [query2] = await pool.query(`SELECT psn.serial_number, psn.serial_number_left, psn.serial_number_right, psn.quality_checked_number, ir.batch_number, ir.designer_id as model_number, ibm.name as  metal_name, ic.name as category_name FROM ${tableName} as psn
                    LEFT JOIN ${tableName2} as ir on ir.id = psn.replicator_id
                    LEFT JOIN ${tableName3} as id on id.model_number = ir.designer_id
                    LEFT JOIN ${tableName4} as ibm on ibm.id = id.bezel_material_id
                    LEFT JOIN ${tableName5} as ic on ic.id = id.category_id
                    WHERE psn.serial_number = ?`, [serial_number]);

                results = results.concat(query2);

                replicatorid = query1[0]['replicator_id'];                
            } else {
                results.push({ query: [], serial_number, status: 'Not Found or Already Packed' });
            }
        }

        // CALL UpdatePackingCheck('replicatorid');
        await pool.query(`CALL UpdatePackingCheck(?)`, [replicatorid]);

        if (results.length > 0) {
            const message = notFoundSerialNumbers.length > 0 ? `${ManageResponseStatus('fetched')} - Warning: Some records were not found: ${notFoundSerialNumbers.join(', ')}` : ManageResponseStatus('fetched');
            return sendResponse(res, { data: results, message, status: true }, 200);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Packing: Get Reports  
router.get('/get_packing_reports', async (req, res) => {
    try {
        const [packersPackings] = await pool.query(`SELECT pqp.id AS packingId, pqp.request_id, pqp.created_at, COUNT(psn.id) AS numer_of_request, ir.batch_number, ir.designer_id as model_number FROM ${tableName7} AS pqp 
            LEFT JOIN ${tableName} AS psn ON pqp.id = psn.packers_packing_id 
            LEFT JOIN ${tableName2} as ir on ir.id = psn.replicator_id
            GROUP BY pqp.id,ir.batch_number,ir.designer_id`);

        if (packersPackings.length > 0) {
            let results = [];
            for (const packing of packersPackings) {
                const { packingId, request_id, numer_of_request, batch_number, model_number, created_at } = packing;

                const [serialNumbers] = await pool.query(`SELECT psn.serial_number, psn.serial_number_left, psn.serial_number_right, psn.quality_checked_number, ir.batch_number, ir.designer_id AS model_number, ibm.name AS metal_name, ic.name AS category_name FROM ${tableName} AS psn
                INNER JOIN ${tableName2} AS ir ON ir.id = psn.replicator_id
                LEFT JOIN ${tableName3} AS id ON id.model_number = ir.designer_id
                LEFT JOIN ${tableName4} AS ibm ON ibm.id = id.bezel_material_id
                LEFT JOIN ${tableName5} AS ic ON ic.id = id.category_id
                WHERE psn.packers_packing_id = ?`, [packingId]);

                results.push({ packingId, request_id, numer_of_request, batch_number, model_number, created_at, records: serialNumbers });
            }
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
});

// Quality Check and Packing: Verify Serial Number
router.post('/verify_serial_number', async (req, res) => {
    try {
        const { serial_number } = await req.body;
        const [query1] = await pool.query(`SELECT * FROM ${tableName} WHERE (serial_number = ? OR RIGHT(serial_number, 6) = ?) and is_quality_checked = 'No'`, [serial_number, serial_number.slice(-6)]);
        if (query1.length > 0) {
            return sendResponse(res, { matched_serial_number: query1[0].serial_number, message: "This serial number is valid", status: true }, 201);
        } else {
            return sendResponse(res, { message: "Not Found or Already Checked", status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Quality Checked Number (Authenticity Number)
const qualityCheckedNumber = () => {
    const characters = '0123456789'; //'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 16;
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

module.exports = router;