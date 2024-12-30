// src/routes/inventory_lookup.js
const express = require('express');
const pool = require('../utils/db');
const { ManageResponseStatus, sendResponse } = require('../commonFunctions')
const router = express.Router();

// Main Listing 01
router.post('/main1', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT r.id, r.batch_number, r.quantity as number_of_batches, r.quantity as total_pieces, d.model_number, d.title as designer_name, c.name as category_name FROM ine_replicator as r 
            LEFT JOIN ine_designer as d on d.model_number = r.designer_id
            LEFT JOIN ine_category as c on c.id = d.category_id 
            WHERE r.status = 1 and r.record_status = 2 ORDER BY r.ID DESC`);

        for (let item of query1) {


            const [query2] = await pool.query(`SELECT count(replicator_id) as stock_available, count(order_place_id) as sold_pieces FROM serial_number WHERE replicator_id = ?`, [item.id]);
            item.sold_pieces = query2[0]?.sold_pieces || 0;
            item.stock_available = (query2[0]?.stock_available || 0) - (query2[0]?.sold_pieces || 0);

            const [query3] = await pool.query(`SELECT * FROM serial_number WHERE replicator_id = ?`, [item.id]);
            item.serial_number_data = query3;
        }

        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 404);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Main Listing 02 - According to Doc
router.post('/main2', async (req, res) => {
    try {

        const [query1] = await pool.query(`SELECT wb.*, wr.name as rack_name, w.name as warehouse_name FROM warehouse_boxes as wb
            LEFT JOIN warehouse_racks as wr on wr.id = wb.rack_id 
            LEFT JOIN warehouse as w on w.id = wr.warehouse_id 
            WHERE wb.status = 1 ORDER BY ID DESC`);

        for (let i = 0; i < query1.length; i++) {
            const [warehouseBoxesData] = await pool.query(`SELECT * FROM warehouse_boxes_data WHERE warehouse_boxes_id = ? and status = 1`, [query1[i].id]);
            for (let j = 0; j < warehouseBoxesData.length; j++) {
                const [boxIdData] = await pool.query(`SELECT s.*, r.batch_number, d.title as designer_name, d.model_number, c.name as category_name, pp.request_id as packers_packing_request_id, pp.warehouse_box_status FROM serial_number as s 
                    LEFT JOIN ine_replicator as r on r.id = s.replicator_id
                    LEFT JOIN ine_designer as d on d.model_number = r.designer_id
                    LEFT JOIN ine_category as c on c.id = d.category_id 
                    LEFT JOIN packers_packing as pp on pp.id = s.packers_packing_id
                    WHERE s.packers_packing_id = ?`, [warehouseBoxesData[j].box_id]);
                    warehouseBoxesData[j].box_id_data = boxIdData;
            }
            query1[i].warehouse_boxes_data = warehouseBoxesData;
        }

        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 404);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Channel Type Users
router.post('/channel_type_users', async (req, res) => {
    try {
        const { role_id } = req.body;
        if (!role_id) { return sendResponse(res, { error: 'Role Id field is required', status: false }, 400); }

        const [query1] = await pool.query(`SELECT * FROM ine_users WHERE role_id = ? and status = 1 ORDER BY ID DESC`, [role_id]);
        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 404);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;