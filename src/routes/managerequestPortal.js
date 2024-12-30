const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, checkEmailExistOrNot, checkPhoneExistOrNot, processDocuments, activityLog } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');
const { getRequestDetail } = require('../utils/designerDetail');

const router = express.Router();

// Table Name
const tableName = TABLE.CAMPAIGN;
const ine_campaign_ModuleID = TABLE.CAMPAIGN_MODULE_ID
const ine_manage_request_tablename = TABLE.MANAGE_REQUEST

router.get('/:id?', async (req, res) => {
//    await authenticateToken(req);
    try {
        const id = req.params.id || req.query.id;
        return await getRequestDetail(id, req, res);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.post('/', async (req, res) => {
    try {
        await authenticateToken(req);
        const requestData = await req.body;

        // Validate request data
        const requiredFields = ['campaign_name', 'start_date', 'till_date'];
        const missingFields = requiredFields.filter(field => !(field in requestData));
        if (missingFields.length > 0) {
            return sendResponse(res, { error: `Missing required fields: ${missingFields.join(', ')}`, status: false }, 400);
        }

        // Adjust the following lines
        const image = await processDocuments(requestData?.banner_img); // Adjusted if needed
        const categories = requestData.categories || null; // No join needed
        const products = requestData.products || null; // No join needed

        // Values to be inserted
        const values = [
            requestData.campaign_name,
            image,
            requestData.start_date,
            requestData.till_date,
            requestData.online_channel,
            requestData.offline_channel || null,
            requestData.number_of_redemptions || 0,
            requestData.number_of_redemptions_single_user || 0,
            requestData.discount_percentage || 0,
            requestData.min_cart_value || 0,
            requestData.min_cart_products || 0,
            requestData.max_discount_in_price || 0,
            categories,
            products,
            requestData.show_in_section || 1,
            requestData.first_order_validity || 0,
            requestData.campaign_url || null,
            requestData.coupon_code || "",
            requestData.description || "",
            requestData.record_status || 1,
            new Date(), // created_at
            requestData.status || 1,
            requestData.created_by || 0
        ];

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (
            campaign_name, banner_img, start_date, till_date, online_channel, offline_channel, 
            number_of_redemptions, number_of_redemptions_single_user, discount_percentage, 
            min_cart_value, min_cart_products, max_discount_in_price, categories, products, 
            show_in_section, first_order_validity, campaign_url, coupon_code, 
            description, record_status, created_at, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`, values);

        const insertedRecordId = insertResult.insertId;
        const [insertedRecord] = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

        await pool.query(`INSERT INTO ${ine_manage_request_tablename} (module_id, row_id, request_status, comments, created_by) VALUES (?,?,?,?,?)`, [
            ine_campaign_ModuleID, insertedRecordId, 1, null, 1
        ]);
        await activityLog(ine_campaign_ModuleID, null, insertedRecord, 1, requestData.apihitid); // Maintain Activity Log
        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        const [existingRecord] = await getRecordById(id, ine_manage_request_tablename, 'id');

        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const { comments } = await req.body;

        await pool.query(`UPDATE ${ine_manage_request_tablename} SET comments = ?, updated_at = NOW() WHERE id = ?`, [comments, id]);


        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, ine_manage_request_tablename, 'id');

        await activityLog('', existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await authenticateToken(req);
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = req.params.id || req.query.id;
        const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));
        if (!deletedIds || deletedIds.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }
        await Promise.all(deletedIds.map(async (deletedId) => {
            const [currentRecord] = await getRecordById(deletedId, tableName, 'id');
            //activityLog(ine_tickets_ModuleID, currentRecord, null, 3, 0);
        }));
        const query = `UPDATE ${tableName} SET status = 2, deleted_at = NOW() WHERE id IN (?)`;
        const formattedQuery = mysql.format(query, [deletedIds]);
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