// warehouse_boxes
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog, uploadToAzureBlob } = require('../commonFunctions')

const { authenticateToken } = require('../utils/authMiddleware');
const router = express.Router();

const tableName = TABLE.WAREHOUSE_BOXES;
const tableName2 = TABLE.WAREHOUSE_BOXES_DATA;
const tableName3 = TABLE.WAREHOUSE_RACKS;
const tableName4 = TABLE.WAREHOUSE_WAREHOUSE;
const tableName5 = TABLE.PACKERS_PACKING;

// Packers Packing Listing
router.get('/packers_packing_listing/:id?', async (req, res) => {
    try {
        const idParam = req.params.id;
        let query = `SELECT * FROM ${tableName5} WHERE warehouse_box_status = 1`;
        const queryParams = [];

        if (idParam) {
            const ids = idParam.split(',').map(Number).filter(id => !isNaN(id));
            if (ids.length > 0) {
                query += ` OR id IN (${ids.map(() => '?').join(',')})`;
                queryParams.push(...ids);
            }
        }

        query += ` ORDER BY ID DESC`;
        const [results] = await pool.query(query, queryParams);

        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Add
router.post('/', async (req, res) => {
    try {

        const { rack_id, box_id } = req.body;
        if (!rack_id || !box_id) { return sendResponse(res, { error: 'Rack ID and Box ID fields are required', status: false }, 400); }
        if (!Array.isArray(box_id)) {
            return sendResponse(res, { error: 'Box ID should be an array', status: false }, 400);
        }
        const [query1] = await pool.query(`INSERT INTO ${tableName} (rack_id) VALUES (?)`, [rack_id]);
        const insertedRecordId = query1.insertId;
        for (let box of box_id) {
            await pool.query(`INSERT INTO ${tableName2} (warehouse_boxes_id, box_id) VALUES (?,?)`, [insertedRecordId, box]);
            await pool.query(`UPDATE ${tableName5} SET warehouse_box_status = 2 WHERE id = ?`, [box]);
        }
        return sendResponse(res, { message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// All List & Specific List
router.get('/', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (id) {
            const [results] = await pool.query(`SELECT wb.*, wr.name as rack_name, w.name as warehouse_name FROM ${tableName} as wb
                LEFT JOIN ${tableName3} as wr on wr.id = wb.rack_id 
                LEFT JOIN ${tableName4} as w on w.id = wr.warehouse_id 
                WHERE wb.status = 1 and wb.id = ? ORDER BY ID DESC`, [id]);
            if (results.length > 0) {
                const [warehouseBoxesData] = await pool.query(`SELECT * FROM ${tableName2} WHERE warehouse_boxes_id = ? and status = 1`, [results[0].id]);
                results[0].warehouse_boxes_data = warehouseBoxesData;
                const [warehouseBoxesData1] = await pool.query(`SELECT GROUP_CONCAT(box_id) as ids FROM ${tableName2} WHERE warehouse_boxes_id = ? and status = 1`, [results[0].id]);
                results[0].warehouse_boxes_data_array = warehouseBoxesData1[0].ids;
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const [results] = await pool.query(`SELECT wb.*, wr.name as rack_name, w.name as warehouse_name FROM ${tableName} as wb
            LEFT JOIN ${tableName3} as wr on wr.id = wb.rack_id 
            LEFT JOIN ${tableName4} as w on w.id = wr.warehouse_id 
            WHERE wb.status = 1 ORDER BY ID DESC`);
        for (let i = 0; i < results.length; i++) {
            const [warehouseBoxesData] = await pool.query(`SELECT * FROM ${tableName2} WHERE warehouse_boxes_id = ? and status = 1`, [results[i].id]);
            results[i].warehouse_boxes_data = warehouseBoxesData;
        }

        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Update
router.put('/', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (!id) { return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400); }

        const existingRecord = await getRecordById(id, tableName, 'id');
        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const { rack_id, box_id } = req.body;
        if (!rack_id || !box_id) { return sendResponse(res, { error: 'Rack ID and Box ID fields are required', status: false }, 400); }
        if (!Array.isArray(box_id)) {
            return sendResponse(res, { error: 'Box ID should be an array', status: false }, 400);
        }

        await pool.query(`UPDATE ${tableName} SET rack_id = ?, updated_at = NOW() WHERE id = ?`, [rack_id, id]);

        const [query1] = await pool.query(`SELECT * FROM ${tableName2} WHERE warehouse_boxes_id = ? and status = 1`, [id]);
        if (query1.length) {
            for (let record of query1) {
                await pool.query(`UPDATE ${tableName2} SET status = 2 WHERE id = ?`, [record.id]);
                await pool.query(`UPDATE ${tableName5} SET warehouse_box_status = 1 WHERE id = ?`, [record.box_id]);
            }
        }

        for (let box of box_id) { 
            await pool.query(`INSERT INTO ${tableName2} (warehouse_boxes_id, box_id) VALUES (?,?)`, [id, box]);
            await pool.query(`UPDATE ${tableName5} SET warehouse_box_status = 2 WHERE id = ?`, [box]);
        }

        return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 200);

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
            await getRecordById(deletedId, tableName, 'id');
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