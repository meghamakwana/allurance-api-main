const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { sendResponse } = require('../commonFunctions')
const router = express.Router();
const tableName = TABLE.SERIAL_NUMBER
const tableName2 = TABLE.REPLICATOR

router.post('/', async (req, res) => {
    try {
        const requestData = req.body;
        const { serial_number, model_number, batch_number } = requestData;
        if (!serial_number || !model_number || !batch_number) {
            return sendResponse(res, { error: 'serial_number, model_number, and batch_number fields are required' }, 400);
        }

        const serialQuery = `SELECT replicator_id FROM ${tableName} WHERE serial_number = ? AND batch_sequence_no = ?`;
        const [serialResults] = await pool.query(serialQuery, [serial_number, batch_number]);

        if (serialResults.length === 0) {
            return sendResponse(res, { error: 'Product is not genuine' }, 404);
        }
        const { replicator_id } = serialResults[0];
        const replicatorQuery = `SELECT designer_id FROM ${tableName2} WHERE id = ?`;
        const [replicatorResults] = await pool.query(replicatorQuery, [replicator_id]);
        if (replicatorResults.length === 0) {
            return sendResponse(res, { error: 'Model number not found' }, 404);
        }
        const { designer_id } = replicatorResults[0];
        if (designer_id) {
            return sendResponse(res, { message: 'The product is genuine', status: true }, 200);
        } else {
            return sendResponse(res, { error: 'Model number does not match' }, 400);
        }
    } catch (error) {
        // console.error("Error occurred:", error);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;