const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, processDocuments, activityLog } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');

const router = express.Router();

// Table Name
const tableName = TABLE.WAREHOUSE;
const tableName2 = TABLE.WAREHOUSE_RACKS_OLD;
const tableName3 = TABLE.PACKER_CARTONS;
const role = TABLE.ROLES

router.get('/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;

        const warehouseQuery = id ? `SELECT * FROM ${tableName} WHERE status = 1 AND id = ?` : `SELECT * FROM ${tableName} WHERE status = 1`;
        const [warehouses] = await pool.query(warehouseQuery, id ? [id] : []);
        if (warehouses.length === 0) { return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404); }

        const warehouseIds = warehouses.map(warehouse => warehouse.id);
        const [racks] = await pool.query(`SELECT * FROM ine_warehouse_racks_old WHERE rack_id IN (?)`, [warehouseIds]);

        const mergedResults = warehouses.map(warehouse => {
            const associatedRacks = racks.filter(rack => rack.rack_id === warehouse.id);
            return { ...warehouse, racks: associatedRacks };
        });

        return sendResponse(res, { data: mergedResults, message: ManageResponseStatus('fetched'), status: true, count: mergedResults.length }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.post('/', async (req, res) => {
    try {
        await authenticateToken(req);
        const requestData = await req.body;

        // Validate request data
        if (!requestData.rack_title || !requestData.rack_code || !requestData.cartons) {
            return sendResponse(res, { error: 'Rack title, rack code, and cartons are required', status: false }, 400);
        }

        // Insert rack details into the main table
        const [insertRackResult] = await pool.query(`INSERT INTO ${tableName} (rack_title, rack_code, created_by) VALUES (?, ?, ?)`, [
            requestData.rack_title,
            requestData.rack_code,
            requestData.apihitid
        ]);

        const insertedRackId = insertRackResult.insertId;

        // Insert associations between rack and cartons into the linking table
        for (const cartonId of requestData.cartons) {
            await pool.query(`INSERT INTO ${tableName2} (rack_id, carton_id ,created_by) VALUES (?, ?, ?)`, [
                insertedRackId,
                cartonId,
                requestData.apihitid
            ]);

            // Update tablename3 to set rack_status with the rack_id for the specified box_id
            await pool.query(`UPDATE ${tableName3} SET rack_status = ?, updated_by= ? WHERE id = ?`, [
                insertedRackId,
                requestData.apihitid,
                cartonId,
            ]);
        }

        return sendResponse(res, { data: insertRackResult, message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


router.put('/:id', async (req, res) => {
    try {
        await authenticateToken(req);
        const requestData = await req.body

        // Validate request data
        if (!requestData.rack_title || !requestData.rack_code || !requestData.cartons) {
            return sendResponse(res, { error: 'Rack title, rack code, and cartons are required', status: false }, 400);
        }
        const id = req.params.id || req.query.id;
        if (id) {

            const [results] = await pool.query(`SELECT * FROM ${tableName2} WHERE status = 1 and rack_id = ?`, [id]); //await getRecordById(id, tableName, 'id');
            if (results.length == 0) {
                return sendResponse(res, { error: 'Sorry, Record nout found.', status: false }, 400);
            }

            // Update and insert records based on carton_id
            for (const cartonId of requestData.cartons) {

                await pool.query(`UPDATE ${tableName2} SET is_deleted = 1 ,updated_by = ? WHERE carton_id = ? and rack_id = ?`, [requestData.apihitid, cartonId, id]);

                // Insert new association between rack and carton into tableName2
                await pool.query(`INSERT INTO ${tableName2} (rack_id, carton_id, created_by, is_deleted) VALUES (?, ?, ?, 0)`, [
                    id,
                    cartonId,
                    requestData.apihitid
                ]);

                // Update tableName3 to set rack_status with the rack_id for the specified box_id
                await pool.query(`UPDATE ${tableName3} SET rack_status = ?,updated_by=?  WHERE id = ?`, [
                    id,
                    requestData.apihitid,
                    cartonId
                ]);
            }
            const [updatedRackRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
            return sendResponse(res, { data: updatedRackRecord, message: ManageResponseStatus('updated'), status: true }, 200);
        }
        return sendResponse(res, { error: 'Rack ID is required in the URL', status: false }, 400);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const idParam = req.params.id;
        const deletedIds = idParam ? idParam.split(',') : [];
        if (deletedIds.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }
        await Promise.all(deletedIds.map(async (deletedId) => {
            await getRecordById(deletedId, tableName, 'id');
        }));
        const deleteRacksQuery = `UPDATE ${tableName2} SET status = 2 WHERE rack_id IN (?)`;
        await pool.query(deleteRacksQuery, [deletedIds]);
        const deleteWarehouseQuery = `UPDATE ${tableName} SET status = 2 WHERE id IN (?)`;
        const [warehouseResults] = await pool.query(deleteWarehouseQuery, [deletedIds]);
        const deletePackerCartonQuery = `UPDATE ${tableName3} SET rack_status = 0 WHERE rack_status IN (?)`;
        await pool.query(deletePackerCartonQuery, [deletedIds]);
        if (warehouseResults.affectedRows > 0) {
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.get('/fetchdashboarddetail/:id?', async (req, res) => {
    try {
        await authenticateToken(req);
        const id = req.params.id || req.query.id;
        const [results] = await pool.query(`
            SELECT t.*, 
                   COALESCE(c.count, 0) AS count, 
                   c.assigned_channel_id, 
                   r.name AS assigned_channel_name,
                   carton.title AS carton_name
            FROM ${tableName} t
            LEFT JOIN (
                SELECT rack_id, COUNT(*) AS count, assigned_channel_id, carton_id
                FROM ${tableName2}
                GROUP BY rack_id, assigned_channel_id, carton_id
            ) c ON t.id = c.rack_id
            LEFT JOIN ${role} r ON c.assigned_channel_id = r.id
            LEFT JOIN ${tableName3} carton ON c.carton_id = carton.id
        `);
        return sendResponse(res, {
            data: results,
            message: ManageResponseStatus('fetched'),
            status: true,
            count: results.length
        }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;