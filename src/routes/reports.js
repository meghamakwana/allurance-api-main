// reports
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const fastCsv = require('fast-csv');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const multer = require('multer');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog, uploadToAzureBlob, requestIDNumber } = require('../commonFunctions')

const { authenticateToken } = require('../utils/authMiddleware');

const router = express.Router();
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

const CSV_HEADER = ['Serial Number', 'Quality Check', 'Packed', 'Quality Request Id', 'Box Id', 'Model Number', 'Batch Number', 'Category Name', 'Rack Code'];

// All List & Specific List
router.get('/', async (req, res) => {
    try {

        const { box_id, model_number } = req.query;
        const filteredResults = [];

        let replicatorQuery = `SELECT r.id, r.designer_id as model_number, r.batch_number, r.quantity, r.is_quality_checked as is_quality_checked_replicator, r.is_packed as is_packed_replicator, d.category_id, c.name as category_name FROM ine_replicator as r 
        LEFT JOIN ine_designer as d on d.model_number = r.designer_id
        LEFT JOIN ine_category as c on c.id = d.category_id
        WHERE r.status = 1`;

        const queryParams1 = [];
        if (model_number) {
            replicatorQuery += ` AND designer_id = ?`;
            queryParams1.push(model_number);
        }
        replicatorQuery += ` ORDER BY ID DESC`;

        const [result1] = await pool.query(replicatorQuery, queryParams1);
        for (let i = 0; i < result1.length; i++) {

            let serialNumberQuery = `SELECT sn.*, pq.request_id as quality_request_id, pp.request_id as packing_request_id, wbd.warehouse_boxes_id, wb.rack_id, wr.name as rack_name
            FROM serial_number as sn 
                LEFT JOIN packers_quality as pq ON pq.id = sn.packers_quality_id
                LEFT JOIN packers_packing as pp ON pp.id = sn.packers_packing_id
                LEFT JOIN warehouse_boxes_data as wbd on wbd.box_id = sn.packers_packing_id
                LEFT JOIN warehouse_boxes as wb on wb.id = wbd.warehouse_boxes_id
                LEFT JOIN warehouse_racks as wr on wr.id = wb.rack_id
                WHERE sn.replicator_id = ?`;

            const queryParams2 = [result1[i].id];
            if (box_id) {
                serialNumberQuery += ` AND pp.request_id = ?`;
                queryParams2.push(box_id);
            }

            const [result2] = await pool.query(serialNumberQuery, queryParams2);
            result1[i].serial_number_data = result2;

            if (!box_id || (box_id && result2.length > 0)) {
                filteredResults.push(result1[i]);
            }
        }

        return sendResponse(res, { data: filteredResults, message: ManageResponseStatus('fetched'), status: true, count: filteredResults.length }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// CSV: All List & Specific List
router.get('/csv', async (req, res) => {
    try {

        const { box_id, model_number } = req.query;
        const filteredResults = [];

        let replicatorQuery = `SELECT r.id, r.designer_id as model_number, r.batch_number, r.quantity, r.is_quality_checked as is_quality_checked_replicator, r.is_packed as is_packed_replicator, d.category_id, c.name as category_name FROM ine_replicator as r 
        LEFT JOIN ine_designer as d on d.model_number = r.designer_id
        LEFT JOIN ine_category as c on c.id = d.category_id
        WHERE r.status = 1`;

        const queryParams1 = [];

        const modelNumbers = model_number ? model_number.split(',').map(num => num.trim()) : [];
        if (modelNumbers.length > 0) {
            const placeholders = modelNumbers.map(() => '?').join(', ');
            replicatorQuery += ` AND designer_id IN (${placeholders})`;
            queryParams1.push(...modelNumbers);
        }

        replicatorQuery += ` ORDER BY ID DESC`;

        const [result1] = await pool.query(replicatorQuery, queryParams1);

        const boxIds = box_id ? box_id.split(',').map(id => id.trim()) : [];

        for (let i = 0; i < result1.length; i++) {

            let serialNumberQuery = `SELECT sn.*, pq.request_id as quality_request_id, pp.request_id as packing_request_id FROM serial_number as sn 
                LEFT JOIN packers_quality as pq ON pq.id = sn.packers_quality_id
                LEFT JOIN packers_packing as pp ON pp.id = sn.packers_packing_id
                WHERE sn.replicator_id = ?`;

            const queryParams2 = [result1[i].id];
            if (boxIds.length > 0) {
                const placeholders = boxIds.map(() => '?').join(', ');
                serialNumberQuery += ` AND pp.request_id IN (${placeholders})`;
                queryParams2.push(...boxIds);
            }

            const [result2] = await pool.query(serialNumberQuery, queryParams2);
            result1[i].serial_number_data = result2;

            if (!box_id || (box_id && result2.length > 0)) {
                filteredResults.push(result1[i]);
            }
        }

        return sendResponse(res, { data: filteredResults, message: ManageResponseStatus('fetched'), status: true, count: filteredResults.length }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Generate CSV: All List & Specific List
router.get('/generatecsv', async (req, res) => {
    try {
        const { box_id, model_number } = req.query;
        const filteredResults = [];

        let replicatorQuery = `SELECT r.id, r.designer_id as model_number, r.batch_number, r.quantity, r.is_quality_checked as is_quality_checked_replicator, r.is_packed as is_packed_replicator, d.category_id, c.name as category_name FROM ine_replicator as r 
        LEFT JOIN ine_designer as d on d.model_number = r.designer_id
        LEFT JOIN ine_category as c on c.id = d.category_id
        WHERE r.status = 1`;

        const queryParams1 = [];

        const modelNumbers = model_number ? model_number.split(',').map(num => num.trim()) : [];
        if (modelNumbers.length > 0) {
            const placeholders = modelNumbers.map(() => '?').join(', ');
            replicatorQuery += ` AND designer_id IN (${placeholders})`;
            queryParams1.push(...modelNumbers);
        }

        replicatorQuery += ` ORDER BY ID DESC`;

        const [result1] = await pool.query(replicatorQuery, queryParams1);

        const boxIds = box_id ? box_id.split(',').map(id => id.trim()) : [];

        for (let i = 0; i < result1.length; i++) {

            let serialNumberQuery = `SELECT sn.*, pq.request_id as quality_request_id, pp.request_id as packing_request_id, wbd.warehouse_boxes_id, wb.rack_id, wr.name as rack_name 
            FROM serial_number as sn 
                LEFT JOIN packers_quality as pq ON pq.id = sn.packers_quality_id
                LEFT JOIN packers_packing as pp ON pp.id = sn.packers_packing_id
                LEFT JOIN warehouse_boxes_data as wbd on wbd.box_id = sn.packers_packing_id
                LEFT JOIN warehouse_boxes as wb on wb.id = wbd.warehouse_boxes_id
                LEFT JOIN warehouse_racks as wr on wr.id = wb.rack_id
                WHERE sn.replicator_id = ?`;

            const queryParams2 = [result1[i].id];
            if (boxIds.length > 0) {
                const placeholders = boxIds.map(() => '?').join(', ');
                serialNumberQuery += ` AND pp.request_id IN (${placeholders})`;
                queryParams2.push(...boxIds);
            }

            const [result2] = await pool.query(serialNumberQuery, queryParams2);
            result1[i].serial_number_data = result2;

            if (!box_id || (box_id && result2.length > 0)) {
                filteredResults.push(result1[i]);
            }
        }

        // Save data to CSV file
        const csvPath = path.join(__dirname, 'report.csv');
        const csvStream = fastCsv.format({ headers: CSV_HEADER });
        const writableStream = fs.createWriteStream(csvPath);
        csvStream.pipe(writableStream);

        filteredResults.forEach(row => {
            row.serial_number_data.forEach(record => {
                const csvRow = [
                    `="${record.serial_number}"`, // Serial Number
                    `="${record.is_quality_checked}"`, // Quality Check
                    `="${record.is_packed}"`, // Packed
                    `="${record.quality_request_id}"`, // Quality Request Id
                    `="${record.packing_request_id}"`, // Box Id
                    row.model_number, // Model Number
                    row.batch_name, // Batch Name
                    row.category_name, // Category Name
                    `="${record.rack_name}"`, // Rack Nam
                    
                ];
                csvStream.write(csvRow);
            });
        });

        csvStream.end();
        writableStream.on('finish', async () => {
            const file = { originalname: 'report.csv', buffer: fs.readFileSync(csvPath), mimetype: 'text/csv' };

            try {
                const blobUrlWithSAS = await uploadToAzureBlob(file);
                fs.unlinkSync(csvPath);
                const request_id = requestIDNumber();
                await pool.query(`INSERT INTO report_links (request_id, file1) VALUES (?, ?)`, [request_id, blobUrlWithSAS]);
                return sendResponse(res, { data: filteredResults, csv_url: blobUrlWithSAS, message: ManageResponseStatus('fetched and saved to CSV'), status: true, count: filteredResults.length }, 200);
            } catch (error) {
                console.error('Error uploading CSV to Azure:', error);
                return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
            }
        });
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


module.exports = router;