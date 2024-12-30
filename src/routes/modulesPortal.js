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
// Table Name
const tableName = TABLE.INE_MODULES_TABLE;
const tableName2 = TABLE.PERMISSIONS_TABLE;


router.post('/', async (req, res) => {
    try {
        const { role_id } = await req.body;
        const id = req.params.id || req.query.id;
        if (!role_id) {
            return sendResponse(res, { error: 'Role ID is required' }, 400);
        }

        let query1;
        let queryParams = [role_id];

        if (id) {
            query1 = `
                SELECT m.*, p.role_id
                FROM ${tableName} m
                JOIN ${tableName2} p ON m.index_of = p.module_id
                WHERE p.role_id = ? AND m.index_of = ?`;
            queryParams.push(id);
        } else {
            query1 = `
                SELECT m.*
                FROM ${tableName} m
                JOIN ${tableName2} p ON m.index_of = p.module_id
                WHERE m.index_of = 0 AND p.role_id = ?`;
        }

        const [results] = await pool.query(query1, queryParams);

        if (results.length > 0) {
            // Fetch additional permissions for each module
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const additionalPermissions = await fetchAdditionalPermissions(role_id, result.id);
                // Merge additional permissions with the main result
                results[i] = { ...result, ...additionalPermissions };
            }

            // Filter the results based on the specified conditions
            const filteredResults = results.filter(result => {
                // Check if read_access is 0 and path is empty
                if (!result.path) {
                    return true;
                }
                // Check if name is not 'List' or 'Create' and path is empty
                if ((result.name !== 'List' && result.name !== 'Create') && !result.path) {
                    return false;
                }
                return true; // Include this object in the results
            });
            return sendResponse(res, { data: filteredResults, message: ManageResponseStatus('fetched'), status: true, count: filteredResults.length }, 200);
        }

        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


router.put('/:id', async (req, res) => {
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
        const image = await processDocuments(requestData?.image1);

        // Convert categories and products arrays to comma-separated strings
        const updatedCategories = categories ? categories : null; // No join needed
        const updatedProducts = products ? products : null;

        await pool.query(`UPDATE ${tableName} SET 
            campaign_name = ?,banner_img =?, start_date = ?, till_date = ?, online_channel = ?, offline_channel = ?, 
            number_of_redemptions = ?, number_of_redemptions_single_user = ?, discount_percentage = ?, 
            min_cart_value = ?, min_cart_products = ?, max_discount_in_price = ?, categories = ?, products = ?, 
            show_in_section = ?, first_order_validity = ?, campaign_url = ?, coupon_code = ?, 
            description = ?, status = ?, updated_at = NOW(), record_status = 1 ,updated_by = ?
            WHERE id = ?`,
            [
                campaign_name, image, start_date, till_date, online_channel, offline_channel || null,
                number_of_redemptions || 0, number_of_redemptions_single_user || 0, discount_percentage || 0,
                min_cart_value || 0, min_cart_products || 0, max_discount_in_price || 0, updatedCategories, // Use updatedCategories instead of categories
                updatedProducts, // Use updatedProducts instead of products
                show_in_section || 1, first_order_validity || 0, campaign_url || null,
                coupon_code || "", description || "", status || 1, apihitid || 0, id
            ]);

        // Make a request in the ine_request_table
        await pool.query(`INSERT INTO ${ine_manage_request_tablename} (module_id, row_id, request_status, comments, created_by) VALUES (?, ?, ?, ?, ?)`, [
            ine_campaign_ModuleID, id, 1, null, 1
        ]);
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


// Function to fetch additional permissions for a given module ID
const fetchAdditionalPermissions = async (role_id, moduleId) => {
    const query2 = `
        SELECT read_access, add_access, update_access, delete_access
        FROM ${tableName2}
        WHERE role_id =? AND module_id = ?`;
    const [queryParams2] = await [await role_id, await moduleId];
    const permissions = await pool.query(query2, queryParams2);
    if (permissions.length > 0) {
        return permissions[0];
    }
    // Return default permissions if no additional permissions found
    return { add_access: 0, update_access: 0, delete_access: 0, read_access: 0 };
};


router.post('/particularmodulecheck', async (req, res) => {
    try {
        const { role_id } = await req.body;
        const id = req.params.id || req.query.id;
        if (!role_id) {
            return sendResponse(res, { error: 'Role ID is required' }, 400);
        }

        let query1;
        let queryParams = [role_id];

        if (id) {
            query1 = `
                SELECT m.*, p.role_id ,p.read_access ,p.add_access,p.update_access,p.delete_access
                FROM ${tableName} m
                JOIN ${tableName2} p ON m.index_of = p.module_id
                WHERE p.role_id = ? AND m.index_of = ?`;
            queryParams.push(id);
        } else {
            query1 = `
                SELECT m.*
                FROM ${tableName} m
                JOIN ${tableName2} p ON m.index_of = p.module_id
                WHERE m.index_of = 0 AND p.role_id = ?`;
        }

        const [results] = await pool.query(query1, queryParams);

        if (results.length > 0) {
            // Check if the path field exists
            const hasPath = results.some(result => result.path);
            if (!hasPath) {
                // Fetch additional permissions for each module
                for (let i = 0; i < results.length; i++) {
                    const result = results[i];
                    const additionalPermissions = await fetchAdditionalPermission(role_id, result.id);
                    // Merge additional permissions with the main result
                    results[i] = { ...result, ...additionalPermissions };
                }
            }

            // Filter the results based on specified conditions
            const filteredResults = results.filter(result => {
                // Check if name is 'Create' and add_access is 1
                if (result.name === 'Create' && result.add_access === 1) {
                    return true;
                }
                // Check if name is 'List' and read_access is 1
                if (result.name === 'List' && result.read_access === 1) {
                    return true;
                }
                // Check if read_access is 1 and the name is not 'List' or 'Create'
                if (result.read_access === 1 && result.name !== 'List' && result.name !== 'Create') {
                    return true;
                }
                return false; // Exclude this object from the results
            });

            return sendResponse(res, { data: filteredResults, message: ManageResponseStatus('fetched'), status: true, count: filteredResults.length }, 200);
        }

        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// // Function to fetch additional permissions for a given module ID
const fetchAdditionalPermission = async (roleid, moduleId) => {
    const query2 = `
        SELECT read_access, add_access, update_access, delete_access
        FROM ${tableName2}
        WHERE role_id = ? AND module_id = ?`;
    const queryParams2 = [roleid, moduleId];
    const [permissions] = await pool.query(query2, queryParams2);

    if (permissions.length > 0) {
        // Return additional permissions
        return permissions[0];
    }
    // Return default permissions if no additional permissions found
    return { add_access: 0, update_access: 0, delete_access: 0, read_access: 0 };
};



module.exports = router;