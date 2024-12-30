const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, checkEmailExistOrNot, checkPhoneExistOrNot, processDocuments, activityLog } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');

const router = express.Router();

// Table Name
const tableName = TABLE.INVENTORY;
const tableName2 = TABLE.ROLES;
const tableName3 = TABLE.GIFTCARD_GENERATE_TABLE;
const tableName4 = TABLE.SERIAL_NUMBER;
const tableName5 = TABLE.WAREHOUSE_RACKS_OLD;
const tableName6 = TABLE.CARTON_ELEMENTS;
const tableName7 = TABLE.PACKERS_BOXES;

router.get('/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            // Fetch data for the specific ID including prefix
            const [results] = await pool.query(`SELECT * FROM ${tableName2} WHERE show_stock_status = 'Y' AND id = ?`, [id]);

            if (results.length > 0) {
                const detailedResults = await getDetailedWarehouseDetails(results);
                return sendResponse(res, {
                    data: detailedResults[0],
                    message: ManageResponseStatus('fetched'),
                    status: true
                }, 200);
            } else {
                const [prefixResult] = await pool.query(`SELECT prefix FROM ${tableName2} WHERE id = ?`, [id]);
                return sendResponse(res, {
                    prefix: prefixResult.length > 0 ? prefixResult[0].prefix : null,
                    message: ManageResponseStatus('notFound'),
                    status: false
                }, 404);
            }
        } else {
            // Fetch data for all channels and return only unsold product counts
            const [results] = await pool.query(`SELECT * FROM ${tableName2} WHERE show_stock_status = 'Y'`);
            const detailedResults = await getDetailedWarehouseDetails(results);

            return sendResponse(res,{
                data: detailedResults,
                message: ManageResponseStatus('fetched'),
                status: true,
                count: detailedResults.length
            }, 200);
        }
    } catch (error) {
        return sendResponse(res,{ error: `Error occurred: ${error.message}` }, 500);
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
        const insertedRecord = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

        await pool.query(`INSERT INTO ${ine_manage_request_tablename} (module_id, row_id, request_status, comments, created_by) VALUES (?,?,?,?,?)`, [
            ine_campaign_ModuleID, insertedRecordId, 1, null, 1
        ]);
        await activityLog(ine_campaign_ModuleID, null, insertedRecord, 1, requestData.apihitid); // Maintain Activity Log
        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Helper function to get detailed warehouse details
const getDetailedWarehouseDetails = async (results) => {
    if (!results) return [];
    return Promise.all(results.map(async (result) => {
        if (!result.id) return result;
        const [warehouseDetails] = await pool.query(`SELECT * FROM ${tableName5} WHERE assigned_channel_id = ?`, [result.id]);
        const detailedWarehouseDetails = await fetchCartonElements(warehouseDetails);
        return {
            ...result,
            warehouseDetails: detailedWarehouseDetails,
            quantity: detailedWarehouseDetails.flatMap(detail => detail.boxElements || [])
                .filter(element => element.serial_number_id) // Ensure only valid boxes are counted
                .length
        };
    }));
};

// Helper function to fetch carton elements and group boxes by carton_id
const fetchCartonElements = async (warehouseDetails) => {
    if (!warehouseDetails) return [];

    // Use a map to group carton elements by carton_id
    const cartonMap = new Map();

    await Promise.all(warehouseDetails.map(async (detail) => {
        if (!detail.carton_id) return;
        const [cartonElements] = await pool.query(`SELECT * FROM ${tableName6} WHERE carton_id = ?`, [detail.carton_id]);

        await Promise.all(cartonElements.map(async (element) => {
            if (!element.box_id) return;
            const [packerBoxResults] = await pool.query(`SELECT * FROM ${tableName7} WHERE id = ?`, [element.box_id]);
            const packerBox = packerBoxResults.length > 0 ? packerBoxResults[0] : null;
            const detailedPackerBox = await fetchSerialNumbers(packerBox);

            // Ensure each carton_id is only included once with all boxElements and their packerBoxes
            if (!cartonMap.has(detail.carton_id)) {
                cartonMap.set(detail.carton_id, {
                    id: detail.id,
                    carton_id: detail.carton_id,
                    created_at: detail.created_at,
                    created_by: detail.created_by,
                    boxElements: []
                });
            }
            cartonMap.get(detail.carton_id).boxElements.push({
                ...element,
                ...detailedPackerBox
            });
        }));
    }));

    // Helper function to fetch serial numbers for packer boxes
    const fetchSerialNumbers = async (packerBox) => {
        if (!packerBox.serial_number_id) return packerBox;
        const [serialNumbers] = await pool.query(`SELECT * FROM ${tableName4} WHERE id = ? AND is_sold = 0`, [packerBox.serial_number_id]);
        const serialNumber = serialNumbers.length > 0 ? serialNumbers[0] : null;
        return { ...packerBox, ...serialNumber };
    };

    // Convert map to array
    return Array.from(cartonMap.values());
};


module.exports = router;