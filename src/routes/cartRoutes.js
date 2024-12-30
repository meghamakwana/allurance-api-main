// src/routes/cartRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog, deleteRecords } = require('../commonFunctions')
const router = express.Router();

const tableName = TABLE.CART;
const tableName2 = TABLE.PRODUCT;
const tableName3 = TABLE.DESIGNER;
const tableName4 = TABLE.CATEGORY;

// Add
router.post('/', async (req, res) => {
    try {
        const { product_id, quantity, affiliate_id, user_id, mock_id } = req.body;

        // Validate request data
        if (!product_id || !quantity) {
            return sendResponse(res, { error: 'Product ID and Quantity fields are required', status: false }, 400);
        }

        let insertedRecordId;
        const affiliateId = affiliate_id ? affiliate_id : '';

        // Determine whether to use user_id or mock_id
        let existingRecord;
        if (user_id) {
            [existingRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 AND user_id = ? AND product_id = ?`, [
                user_id,
                product_id,
            ]);
        } else if (mock_id) {
            [existingRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 AND mock_id = ? AND product_id = ?`, [
                mock_id,
                product_id,
            ]);
        }

        if (existingRecord && existingRecord.length > 0) {
            // If record exists, check if quantity is different
            const currentQuantity = existingRecord[0].quantity;
            if (currentQuantity === quantity) {
                // Quantity is the same
                return sendResponse(res, { data: { product_id, mock_id }, message: 'Product already in cart', status: true }, 200);
            } else {
                // Quantity is different, update the quantity
                const [newQuantity] = [quantity];
                await pool.query(`UPDATE ${tableName} SET quantity = ? WHERE id = ?`, [
                    newQuantity,
                    existingRecord[0].id,
                ]);
                insertedRecordId = existingRecord[0].id;
                return sendResponse(res, { data: { id: insertedRecordId, product_id, mock_id, quantity: newQuantity }, message: 'Cart updated', status: true }, 200);
            }
        } else {
            // If record doesn't exist, insert new record
            const [insertResult] = await pool.query(`INSERT INTO ${tableName} (user_id, mock_id, product_id, quantity, affiliate_id) VALUES (?, ?, ?, ?, ?)`, [
                user_id || null,
                mock_id || null,
                product_id,
                quantity,
                affiliateId
            ]);
            insertedRecordId = insertResult.insertId;
            return sendResponse(res, { data: { id: insertedRecordId, product_id, mock_id, quantity }, message: 'Product added to cart', status: true }, 201);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.get('/', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);
        const userId = url.searchParams.get('user_id');
        const mockId = url.searchParams.get('mock_id');
        const id = getQueryParamId(url);

        let results;
        if (id) {
            [results] = await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 and id = ?  ORDER BY ID desc`, [id]);
        } else if (userId) {
            [results] = await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 and user_id = ? ORDER BY ID desc`, [userId]);
        } else if (mockId) {
            [results] = await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 and mock_id = ? ORDER BY ID desc`, [mockId]);
        } else {
            [results] = await pool.query(`SELECT * FROM ${tableName} WHERE status = 1 ORDER BY ID desc`);
        }
        if (results.length > 0) {
            const products = await Promise.all(results.map(async (record) => {
                const [productDetails] = await pool.query(`SELECT p.*,d.model_number as model_number,
                                                  c.id as category_id ,c.name as category
                                                    FROM ${tableName2} p
                                                    LEFT JOIN ${tableName3} d ON p.designer_id = d.id
                                                    LEFT JOIN ${tableName4} c ON d.category_id = c.id 
                                                    WHERE p.id = ? and p.stock > p.sell_stock and p.coming_soon = 2`, [record.product_id]);
                if (productDetails.length > 0) {
                    const productData = {
                        cartid: record.id,
                        id: productDetails[0].id,
                        // marketing_id: productDetails[0].marketing_id,
                        model_number: productDetails[0].model_number,
                        category: productDetails[0].category,
                        designer_id: productDetails[0].designer_id,
                        product_name: productDetails[0].name,
                        name: productDetails[0].name,
                        short_description: productDetails[0].short_description,
                        long_description: productDetails[0].long_description,
                        price: productDetails[0].price,
                        weight: productDetails[0].weight,
                        discount_price: productDetails[0].discount_price,
                        stock: productDetails[0].stock,
                        sell_stock: productDetails[0].sell_stock,
                        coming_soon: productDetails[0].coming_soon,
                        created_by: productDetails[0].created_by,
                        created_at: productDetails[0].created_at,
                        updated_by: productDetails[0].updated_by,
                        updated_at: productDetails[0].updated_at,
                        deleted_by: productDetails[0].deleted_by,
                        deleted_at: productDetails[0].deleted_at,
                        status: productDetails[0].status,
                        product_id: productDetails[0].id,
                        quantity: record.quantity,
                        affiliate_id: record.affiliate_id,
                        images: [],
                        videos: [],
                    };

                    for (let product of productDetails) {
                        const [requestData4] = await pool.query('SELECT file_url, upload_datetime FROM ine_marketing_media WHERE designer_id = ? AND status = 1', [product.designer_id]);
                        productData.images = requestData4.map(media => ({ url: media.file_url, created_at: media.upload_datetime }));
                    }

                    return productData;
                }

                return null;
            }));

            const filteredProducts = products?.filter(product => product !== null);

            // Remove ine_assets fields from each product in filteredProducts
            const cleanedProducts = filteredProducts.map(product => {
                delete product.asset_type;
                delete product.asset_url;
                delete product.asset_created_at;
                return product;
            });

            return sendResponse(res, {
                data: {
                    products: cleanedProducts,
                    message: ManageResponseStatus('fetched'),
                    status: true,
                    count: cleanedProducts.length,
                },
            }, 200);
        }

        return sendResponse(res, {
            error: ManageResponseStatus('notFound'),
            status: false,
        }, 404);
    } catch (error) {
        return sendResponse(res, {
            error: `Error occurred: ${error.message}`,
        }, 500);
    }
});

// Sync
router.put('/sync', async (req, res) => {
    try {
        const { mockID, userID = 3 } = req.body;

        if (!mockID) {
            return sendResponse(res, { error: 'Mock ID is required', status: false }, 400);
        }

        // Check if mockID exists
        const [existingRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE mock_id = ?`, [mockID]);

        if (existingRecord.length === 0) {
            return sendResponse(res, { error: 'Mock ID not found', status: false }, 404);
        }

        // Update userID for the mockID and nullify the mock_id
        await pool.query(`UPDATE ${tableName} SET user_id = ?, mock_id = NULL WHERE mock_id = ?`, [userID, mockID]);

        // Fetch the records with the updated userID
        const [records] = await pool.query(`SELECT * FROM ${tableName} WHERE user_id = ? AND mock_id IS NULL ORDER BY ID DESC`, [userID]);

        const processedProductIds = new Set();

        for (const record of records) {
            const { product_id, id, quantity, status } = record;
            if (status === 1) {
                if (processedProductIds.has(product_id)) {
                    // Update quantity for existing product_id with the same status
                    await pool.query(`UPDATE ${tableName} SET quantity = quantity + ? WHERE user_id = ? AND product_id = ? AND status = ?`, [quantity, userID, product_id, status]);
                    // Delete the old entry
                    await pool.query(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
                } else {
                    processedProductIds.add(product_id);
                }
            }
        }

        return sendResponse(res, { message: 'Cart Successfully Synced', status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.put('/sync-old', async (req, res) => {
    try {
        const { mockID, userID } = req.body;

        if (!mockID) {
            return sendResponse(res, { error: 'Mock ID is required', status: false }, 400);
        }

        // Check if mockID exists
        const [existingRecord] = await pool.query(`SELECT * FROM ${tableName} WHERE mock_id = ?`, [mockID]);

        if (existingRecord.length === 0) {
            return sendResponse(res, { error: 'Mock ID not found', status: false }, 404);
        }

        // Update userID for the mockID
        await pool.query(`UPDATE ${tableName} SET user_id = ?, mock_id = NULL WHERE mock_id = ?`, [userID, mockID]);

        return sendResponse(res, { message: 'Cart Successfully Synced', status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Delete
router.delete('/', async (req, res) => {
    try {
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

// Delete
router.delete('/old', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);

        const id = getQueryParamId(url);
        const deletedIds = id ? [id] : getQueryParamIds(url);
        const userId = url.searchParams.get('user_id');
        const mockId = url.searchParams.get('mock_id');

        if (userId) {
            const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE user_id = ?`, [userId]);
            if (results.length === 0) {
                return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
            }
            const userDeletedIds = results.map(record => record.id);
            await deleteRecords(userDeletedIds, tableName);
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
        }

        if (mockId) {
            const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE mock_id = ?`, [mockId]);
            if (results.length === 0) {
                return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
            }
            const mockDeletedIds = results.map(record => record.id);
            await deleteRecords(mockDeletedIds, tableName);
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
        }

        if (!deletedIds || deletedIds.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        await deleteRecords(deletedIds, tableName);

        return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;