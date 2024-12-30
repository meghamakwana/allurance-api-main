// src/routes/mywishlistRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog } = require('../commonFunctions')
const router = express.Router();
const { authenticateToken } = require('../utils/authMiddleware');

const tableName = TABLE.MY_WISHLIST;
const ine_my_wishlist_ModuleID = TABLE.MY_WISHLIST_MODULE_ID;
const tableName2 = TABLE.PRODUCT;

// Add
router.post('/', async (req, res) => {
    try {

        await authenticateToken(req);

        const { product_id, user_id } = req.body;

        // Validate request data
        if (!product_id) {
            return sendResponse(res, { error: 'Product ID is required', status: false }, 400);
        }

        // Check for existing product
        const [existingProduct] = await pool.query(`
        SELECT * FROM ${tableName}
        WHERE user_id = ? AND product_id = ? AND status != 2
      `, [user_id, product_id]);

        if (existingProduct.length > 0) {
            await pool.query(`DELETE FROM ${tableName} WHERE id IN (?)`, [existingProduct[0].id]);
            return sendResponse(res, { data: 2, message: 'Product successfully removed into the wishlist', status: true }, 200);
        }

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (user_id, product_id) VALUES (?, ?)`, [
            user_id,
            product_id
        ]);

        const insertedRecordId = insertResult.insertId;
        const [insertedRecord] = await getRecordById(insertedRecordId, tableName, 'id');

        await activityLog(ine_my_wishlist_ModuleID, null, insertedRecord[0], 1, 0); // Maintain Activity Log

        // return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 200);
        return sendResponse(res, { data: 1, message: 'Product added to wishlist', status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// All List & Specific List
router.get('/', async (req, res) => {
    try {

        await authenticateToken(req);

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);
        const userId = url.searchParams.get('user_id');
        const categoryId = url.searchParams.get('category_id');
        const keyword = url.searchParams.get('keyword');

        if (!userId) {
            return sendResponse(res, { error: 'User ID is required' }, 400);
        }

        // Step 1: Fetch product IDs from wishlist based on user_id
        const wishlistQuery = `SELECT product_id FROM ine_wishlist WHERE user_id = ?`;
        const [wishlistResults] = await pool.query(wishlistQuery, [userId]);

        if (wishlistResults.length === 0) {
            return sendResponse({ error: 'No products found in wishlist', status: false }, 404);
        }

        const productIds = wishlistResults.map(item => item.product_id);

        // Step 2: Fetch product details based on the product IDs
        let queryStr = `SELECT p.*, 
                               d.id as designer_id,
                               d.model_number, 
                               d.sub_model_number, 
                               c.id as category_id,
                               c.name as category_name, 
                               r.id as resin_id,
                               r.name as resin_name, 
                               s.id as shape_id,
                               s.shape as shape_name,
                               b.id as bezel_material_id,
                               b.name as bezel_material,
                               bc.id as bezel_color_id,
                               bc.name as bezel_color,
                               im.id as inner_material_id,
                               im.name as inner_material_name,
                               iff.id as flower_id,
                               iff.name as flower_name,
                               cs.id as color_id,
                               cs.name as color_name,
                               w.id as wid
                        FROM ${tableName} w
                        LEFT JOIN ${tableName2} p ON w.product_id = p.id
                        LEFT JOIN ine_designer d ON p.designer_id = d.id
                        LEFT JOIN ine_category c ON d.category_id = c.id
                        LEFT JOIN ine_resin r ON d.resin_id = r.id
                        LEFT JOIN ine_shape s ON d.shape_id = s.id
                        LEFT JOIN ine_bezel_material b ON d.bezel_material_id = b.id
                        LEFT JOIN ine_bezel_color bc ON d.bezel_color_id = bc.id
                        LEFT JOIN ine_inner_material im ON d.inner_material_id = im.id
                        LEFT JOIN ine_flower iff ON d.flower_id = iff.id
                        LEFT JOIN ine_color_shade cs ON d.color_id = cs.id`;

        const queryParams = [];

        queryStr += ` WHERE w.status = 1 and p.id IN (${productIds.map(() => '?').join(',')})`;
        queryParams.push(...productIds);

        if (categoryId) {
            queryStr += ` AND c.id = ?`;
            queryParams.push(categoryId);
        } else if (keyword) {
            queryStr += ` AND (p.name LIKE ? OR p.short_description LIKE ? OR p.long_description LIKE ?)`;
            const keywordParam = `%${keyword}%`;
            queryParams.push(keywordParam, keywordParam, keywordParam);
        }

        const [results] = await pool.query(queryStr, queryParams);

        if (results.length > 0) {
            const responseData = [];

            for (const row of results) {
                let product = responseData.find(item => item.id === row.id);
                if (!product) {
                    product = {
                        wid: row.wid,
                        id: row.id,
                        designer_id: row.designer_id,
                        weight: row.weight,
                        model_number: row.model_number,
                        sub_model_number: row.sub_model_number,
                        product_name: row.name,
                        shape_id: row.shape_id,
                        shape: row.shape_name,
                        resin_id: row.resin_id,
                        resin: row.resin_name,
                        category_id: row.category_id,
                        category: row.category_name,
                        bezel_material_id: row.bezel_material_id,
                        bezel_material: row.bezel_material,
                        inner_material_id: row.inner_material_id,
                        inner_material_name: row.inner_material_name,
                        flower_id: row.flower_id,
                        flower_name: row.flower_name,
                        bezel_color_id: row.bezel_color_id,
                        bezel_color: row.bezel_color,
                        color_id: row.color_id,
                        color: row.color_name,
                        short_description: row.short_description,
                        long_description: row.long_description,
                        price: row.price,
                        discount_price: row.discount_price,
                        stock: row.stock,
                        sell_stock: row.sell_stock,
                        coming_soon: row.coming_soon,
                        created_at: row.created_at,
                        status: row.status,
                        images: [],
                        videos: []
                    };
                    responseData.push(product);
                }

                const [requestData4] = await pool.query('SELECT * FROM ine_marketing_media WHERE designer_id = ? AND status = ?', [product.designer_id, 1]);
                if (requestData4.length > 0) {
                    requestData4.forEach((media) => {
                        if (media.file_url) {
                            product.images.push({
                                url: media.file_url,
                                created_at: media.upload_datetime
                            });
                        }
                    });
                }
            }

            return sendResponse(res, { data: responseData, message: ManageResponseStatus('fetched'), status: true, count: responseData.length }, 200);
        }

        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        // console.error("Error occurred:", error.message);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Update
router.put('/', async (req, res) => {
    try {

        await authenticateToken(req);

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        // Check if the ID exists in the database and retrieve the existing record
        const [existingRecord] = await getRecordById(id, tableName, 'id');

        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const { user_id, product_id } = req.body;

        await pool.query(`UPDATE ${tableName} SET product_id = ?, updated_at = NOW() WHERE id = ?`, [product_id, id]);

        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, tableName, 'id');

        await activityLog(ine_my_wishlist_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Delete

router.delete('/', async (req, res) => {
    try {

        await authenticateToken(req);

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (!id || id.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
        if (results.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        await pool.query(`DELETE FROM ${tableName} WHERE id IN (?)`, [id]);
        return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;