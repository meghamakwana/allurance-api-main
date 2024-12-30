// src/routes/manage_batches.js
const express = require('express');
const pool = require('../utils/db');
const { ManageResponseStatus, sendResponse } = require('../commonFunctions')
const router = express.Router();

// Get Serial Number Based On Batch Number
router.post('/', async (req, res) => {
    try {
        const { batch_number } = req.body;
        if (!batch_number) { return sendResponse(res, { error: 'Batch Number fields are required', status: false }, 400); }

        const [query1] = await pool.query(`SELECT id FROM ine_replicator WHERE status = 1 and record_status = 2 and batch_number = ?`, [batch_number]);
        if (query1.length > 0) {
            const replicator_id = query1[0].id;
            const [query2] = await pool.query(`SELECT * FROM serial_number WHERE replicator_id = ? ORDER BY ID ASC`, [replicator_id]);

            const responseData = query2.map((record) => ({
                id: record.id,
                serial_number: record.serial_number,
                is_quality_checked: record.is_quality_checked || 'No',
                is_packed: record.is_packed || 'No',
                serial_place_status: record.serial_place_status || 'No',
                order_place_status: record.order_place_status || 'No',
            }));

            // let serial_number_status = 'Pending';
            // const responseData = query2.map((record) => {
            //     if (record.is_quality_checked === 'Yes') {
            //         serial_number_status = 'Order Quality checked';
            //     } else if (record.is_packed === 'Yes') {
            //         serial_number_status = 'Packing';
            //     } else if (record.serial_place_status === 'Yes') {
            //         serial_number_status = 'Order Placed';
            //     } else if (record.order_place_status === 'Yes') {
            //         serial_number_status = 'Order Booked';
            //     }
            //     return { ...record, serial_number_status };
            // });

            return sendResponse(res, { data: responseData, message: ManageResponseStatus('fetched'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;