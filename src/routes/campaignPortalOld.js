const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, checkEmailExistOrNot, checkPhoneExistOrNot, processDocuments, activityLog, uploadToAzureBlob } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');
const multer = require('multer');

const router = express.Router();
// LINKS FOR THE STORAGE UPLOAD 
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });
// Table Name
const tableName = TABLE.CAMPAIGN;
const ine_campaign_ModuleID = TABLE.CAMPAIGN_MODULE_ID
const ine_manage_request_tablename = TABLE.MANAGE_REQUEST





router.get('/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 and id = ? ORDER BY ID DESC`, [id]);
            if ([results].length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        // const [results] = await getRecordById(null, tableName, 'id');
        const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// router.post('/', async (req, res) => {

//     try {
//         await authenticateToken(req);
//         const requestData = await req.body;

//         // Validate request data
//         const requiredFields = ['campaign_name', 'start_date', 'till_date'];
//         const missingFields = requiredFields.filter(field => !(field in requestData));
//         if (missingFields.length > 0) {
//             return sendResponse(res, { error: `Missing required fields: ${missingFields.join(', ')}`, status: false }, 400);
//         }

//         // Adjust the following lines
//         const image = await processDocuments(requestData?.banner_img); // Adjusted if needed
//         const categories = requestData.categories || null; // No join needed
//         const products = requestData.products || null; // No join needed

//         // Values to be inserted
//         const values = [
//             requestData.campaign_name,
//             image,
//             requestData.start_date,
//             requestData.till_date,
//             requestData.online_channel,
//             requestData.offline_channel || null,
//             requestData.number_of_redemptions || 0,
//             requestData.number_of_redemptions_single_user || 0,
//             requestData.discount_percentage || 0,
//             requestData.min_cart_value || 0,
//             requestData.min_cart_products || 0,
//             requestData.max_discount_in_price || 0,
//             categories,
//             products,
//             requestData.show_in_section || 1,
//             requestData.first_order_validity || 0,
//             requestData.campaign_url || null,
//             requestData.coupon_code || "",
//             requestData.description || "",
//             requestData.record_status || 1,
//             new Date(), // created_at
//             requestData.status || 1,
//             requestData.created_by || null
//         ];

//         // Insertion
//         const [insertResult] = await pool.query(`INSERT INTO ${tableName} (
//             campaign_name, banner_img, start_date, till_date, online_channel, offline_channel,
//             number_of_redemptions, number_of_redemptions_single_user, discount_percentage,
//             min_cart_value, min_cart_products, max_discount_in_price, categories, products,
//             show_in_section, first_order_validity, campaign_url, coupon_code,
//             description, record_status, created_at, status, created_by
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values);

//         const insertedRecordId = insertResult.insertId;
//         const [insertedRecord] = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

//         await pool.query(`INSERT INTO ${ine_manage_request_tablename} (module_id, row_id, request_status, comments, created_by) VALUES (?,?,?,?,?)`, [
//             ine_campaign_ModuleID, insertedRecordId, 1, null, 1
//         ]);
//         await activityLog(ine_campaign_ModuleID, null, insertedRecord, 1, requestData.apihitid); // Maintain Activity Log
//         return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

//     } catch (error) {
//         return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
//     }
// });

router.post('/', upload.single('image1'), async (req, res) => {
    try {
        // console.log(req.file); // Log file details
        // console.log(req.body); // Log form data
        const image1File = req.file; // Correct usage for single file upload
        let image1BlobName = null;
        // console.log("image1BlobName before", image1File);
        if (image1File) {
            image1BlobName = await uploadToAzureBlob(image1File);
        }
        // console.log("image1BlobName after", image1BlobName);

        const {
            campaign_name,
            start_date,
            till_date,
            categories,
            products,
            coupon_code,
            online_channel,
            offline_channel,
            description,
            number_of_redemptions,
            number_of_redemptions_single_user,
            discount_percentage,
            min_cart_value,
            min_cart_products,
            max_discount_in_price,
            show_in_section,
            first_order_validity,
            campaign_url,
            record_status,
            created_by
        } = req.body;

        // Validate request data
        const requiredFields = ['campaign_name', 'start_date', 'till_date'];
        const missingFields = requiredFields.filter(field => !(field in req.body));
        if (missingFields.length > 0) {
            return sendResponse(res, { error: `Missing required fields: ${missingFields.join(', ')}`, status: false }, 400);
        }

        const parseDate = (dateStr) => {
            const [day, month, year] = dateStr.split('-');
            return new Date(`${year}-${month}-${day}`).toISOString().split('T')[0];
        };

        const formattedStartDate = parseDate(start_date);
        const formattedTillDate = parseDate(till_date);

        // Prepare data for insertion
        const values = [
            campaign_name,
            image1BlobName,
            formattedStartDate,
            formattedTillDate,
            online_channel || '0',
            offline_channel || null,
            number_of_redemptions || 0,
            number_of_redemptions_single_user || 0,
            discount_percentage || 0,
            min_cart_value || 0,
            min_cart_products || 0,
            max_discount_in_price || 0,
            categories || null,
            products || null,
            show_in_section || 1,
            first_order_validity || 0,
            campaign_url || null,
            coupon_code || "",
            description || "",
            record_status || 1,
            new Date(), // created_at
            created_by || null
        ];

        // Insert into database
        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (
            campaign_name, banner_img, start_date, till_date, online_channel, offline_channel, 
            number_of_redemptions, number_of_redemptions_single_user, discount_percentage, 
            min_cart_value, min_cart_products, max_discount_in_price, categories, products, 
            show_in_section, first_order_validity, campaign_url, coupon_code, 
            description, record_status, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values);

        const insertedRecordId = insertResult.insertId;
        const [insertedRecord] = await getRecordById(insertedRecordId, tableName, 'id');

        await pool.query(`INSERT INTO ${ine_manage_request_tablename} (module_id, row_id, request_status, comments, created_by) VALUES (?,?,?,?,?)`, [
            ine_campaign_ModuleID, insertedRecordId, 1, null, 1
        ]);
        await activityLog(ine_campaign_ModuleID, null, insertedRecord, 1, req.body.apihitid);

        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        // console.error(`Error occurred: ${error.message}`); // Add logging for debugging
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.put('/:id', upload.single('image1'), async (req, res) => {
    try {
        await authenticateToken(req);
        // const id = getQueryParamId(new URL(req.url));
        const id = req.params.id || req.query.id;
        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }
        const [existingRecord] = await getRecordById(id, tableName, 'id');
        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        const requestData = await req.body;
        // Validate request data
        const requiredFields = ['campaign_name', 'start_date', 'till_date', 'online_channel'];
        const missingFields = requiredFields.filter(field => !(field in requestData));
        if (missingFields.length > 0) {
            return sendResponse(res, { error: `Missing required fields: ${missingFields.join(', ')}`, status: false }, 400);
        }

        const {
            campaign_name, start_date, till_date, online_channel, offline_channel,
            number_of_redemptions, number_of_redemptions_single_user, discount_percentage,
            min_cart_value, min_cart_products, max_discount_in_price, categories, products,
            show_in_section, first_order_validity, campaign_url, coupon_code,
            description, status, apihitid
        } = requestData;
        // const image = await processDocuments(requestData?.image1);

        const parseDate = (dateStr) => {
            const [day, month, year] = dateStr.split('-');
            return new Date(`${year}-${month}-${day}`).toISOString().split('T')[0];
        };

        const formattedStartDate = parseDate(start_date);
        const formattedTillDate = parseDate(till_date);

        // Convert categories and products arrays to comma-separated strings
        const updatedCategories = categories ? categories : null; // No join needed
        const updatedProducts = products ? products : null;

        const image1File = req.file; // Correct usage for single file upload
        let image1BlobName = existingRecord[0]?.banner_img;
        if (image1File) { image1BlobName = await uploadToAzureBlob(image1File); }
        
        await pool.query(`UPDATE ${tableName} SET 
            campaign_name = ?,banner_img =?, start_date = ?, till_date = ?, online_channel = ?, offline_channel = ?, 
            number_of_redemptions = ?, number_of_redemptions_single_user = ?, discount_percentage = ?, 
            min_cart_value = ?, min_cart_products = ?, max_discount_in_price = ?, categories = ?, products = ?, 
            show_in_section = ?, first_order_validity = ?, campaign_url = ?, coupon_code = ?, 
            description = ?, status = ?, updated_at = NOW(), record_status = 1 ,updated_by = ?
            WHERE id = ?`,
            [
                campaign_name, image1BlobName, formattedStartDate, formattedTillDate, online_channel, offline_channel || null,
                number_of_redemptions || 0, number_of_redemptions_single_user || 0, discount_percentage || 0,
                min_cart_value || 0, min_cart_products || 0, max_discount_in_price || 0, updatedCategories, // Use updatedCategories instead of categories
                updatedProducts, // Use updatedProducts instead of products
                show_in_section || 1, first_order_validity || 0, campaign_url || null,
                coupon_code || "", description || "", status || 1, apihitid || 0, id
            ]);

        const [checkRequestData] = await pool.query(`SELECT * FROM ${ine_manage_request_tablename} WHERE module_id = 98 and row_id = ?`, [id]);
        if(checkRequestData.length == 0) {
            // Make a request in the ine_request_table
            await pool.query(`INSERT INTO ${ine_manage_request_tablename} (module_id, row_id, request_status, comments, created_by) VALUES (?, ?, ?, ?, ?)`, [
                ine_campaign_ModuleID, id, 1, null, 1
            ]);
        }

        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, tableName, 'id');
        await activityLog(ine_campaign_ModuleID, existingRecord, updatedRecord, 2, apihitid); // Maintain Activity Log
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
