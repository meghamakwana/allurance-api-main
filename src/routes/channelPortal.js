const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables');
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');
const router = express.Router();

// Table Names
const tableName = TABLE.WAREHOUSE_RACKS_OLD;
const tableName1 = TABLE.OFFLINE_SALES;
const tableName2 = TABLE.ONLINE_SALES;
const tableName3 = TABLE.PACKERS_BOXES;
const tableName4 = TABLE.SERIAL_NUMBER;
const tableName5 = TABLE.REPLICATOR;
const tableName6 = TABLE.CARTON_ELEMENTS;
const tableName7 = TABLE.PRODUCTS;
const tableName8 = TABLE.DESIGNER;
const tableName10 = TABLE.ROLES;
const warehouseTableName = TABLE.WAREHOUSE; // Warehouse table name
const cartonsTableName = TABLE.PACKER_CARTONS; // Cartons table name

// GET METHOD 
router.get('/', async (req, res) => {
    try {
        await authenticateToken(req);
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);
        if (id) {
            const [results] = await getRecordById(id, tableName, 'id');
            if (results.length > 0) {
                const enrichedResults = await enrichData(results);
                return sendResponse(res, { data: enrichedResults[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        const [results] = await pool.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);
        const enrichedResults = await enrichData(results);
        return sendResponse(res, { data: enrichedResults, message: ManageResponseStatus('fetched'), status: true, count: enrichedResults.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


const enrichData = async (records) => {
    const enrichedRecords = await Promise.all(
        records.map(async (record) => {
            try {
                const [rackDetails] = await pool.query(`SELECT rack_title, rack_code FROM ${warehouseTableName} WHERE id = ?`, [record.rack_id]);
                const [cartonDetails] = await pool.query(`SELECT title FROM ${cartonsTableName} WHERE id = ?`, [record.carton_id]);
                return {
                    ...record,
                    rack_title: rackDetails.length ? rackDetails[0].rack_title : null,
                    rack_code: rackDetails.length ? rackDetails[0].rack_code : null,
                    carton_title: cartonDetails.length ? cartonDetails[0].title : null,
                };
            } catch (error) {
                // Handle individual record enrichment errors
                console.error(`Error enriching record with ID ${record.id}: ${error.message}`);
                return record; // Return record as-is if error occurs
            }
        })
    );
    return enrichedRecords;
};


// UPDATE INTO THE TABLES OF QUANTITIES 
router.put('/', async (req, res) => {
    try {
        await authenticateToken(req);
        const { cartons, channels, apihitid } = await req.body;
        if (!cartons || cartons.length === 0) {
            return sendResponse({ error: 'Cartons array is required and cannot be empty' }, 400);
        }
        const modelNumberCounts = new Map();
        for (const cartonId of cartons) {
            await pool.query(
                `UPDATE ${tableName} SET is_shipped = ?, assigned_channel_id = ?, updated_by = ? , updated_at = NOW() WHERE carton_id = ?`,
                [1, channels, apihitid, cartonId]
            );
            if (channels == 8) {
                await pool.query(
                    `INSERT INTO ${tableName1} (carton_id, status, created_at) VALUES (?, ?, NOW())`,
                    [cartonId, 1]
                );
            }
            if (channels == 9) {
                await pool.query(
                    `INSERT INTO ${tableName2} (carton_id, status, created_by, created_at) VALUES (?, ?, ?, NOW())`,
                    [cartonId, 1, apihitid]
                );
                const [cartonElements] = await pool.query(
                    `SELECT * FROM ${tableName6} WHERE carton_id = ?`,
                    [cartonId]
                );
                for (const element of cartonElements) {
                    const [designerIdResult] = await pool.query(
                        `SELECT r.designer_id
                            FROM ${tableName3} pb
                            INNER JOIN ${tableName4} sn ON pb.serial_number_id = sn.id
                            INNER JOIN ${tableName5} r ON sn.replicator_id = r.id
                            WHERE pb.id = ?`,
                        [element.box_id]
                    );
                    const designerId = designerIdResult.length > 0 ? designerIdResult[0].designer_id : null;
                    if (designerId) {
                        const [designerInfo] = await pool.query(
                            `SELECT model_number FROM ${tableName8} WHERE model_number = ?`,
                            [designerId]
                        );
                        if (designerInfo.length > 0) {
                            const [modelNumber] = designerInfo[0].model_number;

                            if (modelNumberCounts.has(modelNumber)) {
                                modelNumberCounts.set(modelNumber, modelNumberCounts.get(modelNumber) + 1);
                            } else {
                                modelNumberCounts.set(modelNumber, 1);
                            }
                        }
                    }
                }
            }
        }

        // Update product stock based on modelNumberCounts
        for (const [modelNumber, count] of modelNumberCounts.entries()) {
            await pool.query(
                `UPDATE ${tableName7} p
                    INNER JOIN ${tableName8} d ON p.designer_id = d.id
                    SET p.stock = p.stock + ?
                    WHERE d.model_number = ?`,
                [count, modelNumber]
            );
        }

        return sendResponse(res, { message: 'Carton statuses and product stock updated successfully' }, 200);
    } catch (error) {
        // console.error("Error occurred:", error.message);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
})

// GET THE ROLE DETIALS
router.get('/roledetails', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);
        if (id) {
            // Ensure ID is a valid number or format for your database query
            const [results] = await getRecordById(id, tableName10, 'id');
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        let [results] = await getRecordById(null, tableName10, 'id');
        // Filter results to include only those with id 8 and 9
        results = results[0].filter(record => record.id === 8 || record.id === 9);
        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        // console.error(`Error occurred: ${error.message}`); // Debug: Log error details
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// FETCH THE BOXES FROM THE RACKS 
router.get('/fetchboxfromracks', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);
        if (id) {
            const [results] = await getRecordById(id, tableName, 'id');
            if (results.length > 0) {
                const enrichedResults = await enrichData(results);
                return sendResponse(res, { data: enrichedResults[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE is_shipped =0 AND is_deleted = 0 ORDER BY created_at DESC`);
        const enrichedResults = await enrichData(results);
        return sendResponse(res, { data: enrichedResults, message: ManageResponseStatus('fetched'), status: true, count: enrichedResults.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});



module.exports = router;
