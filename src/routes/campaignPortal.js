const express = require('express');
const TABLE = require('../utils/tables');
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, initRequestforAdmin, generateRandomCode } = require('../commonFunctions');
const router = express.Router();

// Table Name
const module_id = TABLE.CAMPAIGN_MODULE_ID;

const parseDate = (dateStr) => {
    const [day, month, year] = dateStr.split('-');
    return new Date(`${year}-${month}-${day}`).toISOString().split('T')[0];
};

// Create
router.post('/', async (req, res) => {
    try {
        const { name, start_date, end_date, categories, products, coupon_code, no_of_valid_redemptions, min_cart_value, max_discount_value, show_on_channel, off_type, off_type_flat, off_type_percentage, unique_code_for_all_customer, channel_mode, description, terms_conditions } = req.body;

        if (!name || !start_date || !end_date || !no_of_valid_redemptions || !min_cart_value || !unique_code_for_all_customer) {
            return sendResponse(res, { error: 'Name, Start Date, End Date, No. of Valid Redemption, Min Cart Value and Unique Code For All Customer fields are required', status: false }, 400);
        }

        const formattedStartDate = parseDate(start_date);
        const formattedTillDate = parseDate(end_date);

        const [insertResult] = await pool.query(`INSERT INTO ine_campaign (name, start_date, end_date, no_of_valid_redemptions, min_cart_value, max_discount_value, show_on_channel, off_type, off_type_flat, off_type_percentage, unique_code_for_all_customer, channel_mode, description, terms_conditions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [name, formattedStartDate, formattedTillDate, no_of_valid_redemptions, min_cart_value, max_discount_value, show_on_channel, off_type, off_type_flat, off_type_percentage, unique_code_for_all_customer, channel_mode, description, terms_conditions]);

        const insertedRecordId = insertResult.insertId;

        // Categories
        if (Array.isArray(categories) && categories.length > 0) {
            const categoryInsertPromises = categories.map(category_id =>
                pool.query(`INSERT INTO ine_campaign_category (campaign_id, category_id) VALUES (?, ?)`, [insertedRecordId, category_id])
            );
            await Promise.all(categoryInsertPromises);
        }

        // Products
        if (Array.isArray(products) && products.length > 0) {
            const productInsertPromises = products.map(product_id =>
                pool.query(`INSERT INTO ine_campaign_product (campaign_id, product_id) VALUES (?, ?)`, [insertedRecordId, product_id])
            );
            await Promise.all(productInsertPromises);
        }

        // Coupons
        for (let i = 0; i < Number(no_of_valid_redemptions); i++) {
            if (Number(unique_code_for_all_customer) === 2) { // 1.Yes 2.No
                await pool.query(`INSERT INTO ine_campaign_coupon (campaign_id, coupon_code) VALUES (?, ?)`, [insertedRecordId, coupon_code])
            }
        }

        await initRequestforAdmin({ module_id, insertedRecordId });

        return sendResponse(res, { message: ManageResponseStatus('created'), status: true }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// All List & Specific List
router.get('/', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        if (id) {
            const [campaignResults] = await pool.query(`SELECT * FROM ine_campaign WHERE status = 1 and id = ?`, [id]);
            if (campaignResults.length === 0) {
                return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
            }
            const [couponResults] = await pool.query(`SELECT cc.*, u.first_name as user_first_name, u.last_name as user_last_name FROM ine_campaign_coupon as cc LEFT JOIN ine_users as u on u.id = cc.coupon_used_user_id WHERE cc.campaign_id = ? AND cc.status = 1`, [id]);

            const [categoryResults] = await pool.query(`SELECT * FROM ine_campaign_category WHERE campaign_id = ? and status = 1`, [id]);
            const [catNameResults] = await pool.query(`SELECT GROUP_CONCAT(c.name) as category_names FROM ine_campaign_category as cc LEFT JOIN ine_category as c on c.id = cc.category_id WHERE cc.status = 1 and cc.campaign_id IN (?)`, [id]);
            const categoryNameResults = catNameResults[0].category_names;

            const [productResults] = await pool.query(`SELECT cp.*, m.name as product_nme FROM ine_campaign_product as cp LEFT JOIN ine_marketing as m on m.id = cp.product_id WHERE cp.campaign_id = ? and cp.status = 1`, [id]);
            const [prdNameResults] = await pool.query(`SELECT GROUP_CONCAT(m.name) as product_names FROM ine_campaign_product as cp LEFT JOIN ine_marketing as m on m.id = cp.product_id WHERE cp.campaign_id = ? and cp.status = 1`, [id]);
            const productNameResults = prdNameResults[0].product_names;

            const campaign = { ...campaignResults[0], categories: categoryResults, coupons: couponResults, categoryNameResults, products: productResults, productNameResults };
            return sendResponse(res, { data: campaign, message: ManageResponseStatus('fetched'), status: true }, 200);
        }

        const [campaignResults] = await pool.query(`SELECT * FROM ine_campaign WHERE status = 1 ORDER BY ID DESC`);
        if (campaignResults.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const campaignIds = campaignResults.map(campaign => campaign.id);
        const [categoryResults] = await pool.query(`SELECT * FROM ine_campaign_category WHERE status = 1 and campaign_id IN (?)`, [campaignIds]);
        const [couponResults] = await pool.query(`SELECT cc.*, u.first_name as user_first_name, u.last_name as user_last_name FROM ine_campaign_coupon as cc LEFT JOIN ine_users as u on u.id = cc.coupon_used_user_id WHERE cc.status = 1 AND cc.campaign_id IN (?)`, [campaignIds]);
        const [productResults] = await pool.query(`SELECT cp.*, m.name as product_name FROM ine_campaign_product as cp LEFT JOIN ine_marketing as m on m.id = cp.product_id WHERE cp.status = 1 and cp.campaign_id IN (?)`, [campaignIds]);

        const campaignsWithCategories = campaignResults.map(campaign => {
            const categories = categoryResults.filter(category => category.campaign_id === campaign.id);
            const coupons = couponResults.filter(coupon => coupon.campaign_id === campaign.id);
            const products = productResults.filter(product => product.campaign_id === campaign.id);
            return { ...campaign, categories, coupons, products };
        });

        return sendResponse(res, { data: campaignsWithCategories, message: ManageResponseStatus('fetched'), status: true, count: campaignsWithCategories.length, }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Update
router.put('/', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        const { name, start_date, end_date, categories, products, coupon_code, no_of_valid_redemptions, min_cart_value, max_discount_value, show_on_channel, off_type, off_type_flat, off_type_percentage, unique_code_for_all_customer, channel_mode, description, terms_conditions } = req.body;

        if (!id) { return sendResponse({ error: ManageResponseStatus('RowIdRequired'), status: false }, 400); }

        if (!name || !start_date || !end_date || !no_of_valid_redemptions || !min_cart_value || !unique_code_for_all_customer) {
            return sendResponse(res, { error: 'Name, Start Date, End Date, No. of Valid Redemption, Min Cart Value and Unique Code For All Customer fields are required', status: false }, 400);
        }

        const formattedStartDate = parseDate(start_date);
        const formattedTillDate = parseDate(end_date);

        const [existingRecord] = await pool.query(`SELECT * FROM ine_campaign WHERE status = 1 and id = ?`, [id]);
        if (existingRecord.length > 0) {
            await pool.query(`UPDATE ine_campaign SET name = ?, start_date = ?, end_date = ?, no_of_valid_redemptions = ?, min_cart_value = ?, max_discount_value = ?, show_on_channel = ?,  off_type = ?, off_type_flat = ?, off_type_percentage = ?, unique_code_for_all_customer = ?, channel_mode = ?, description = ?, description = ?, record_status = 1, updated_at = NOW() WHERE id = ?`, [name, formattedStartDate, formattedTillDate, no_of_valid_redemptions, min_cart_value, max_discount_value, show_on_channel, off_type, off_type_flat, off_type_percentage, unique_code_for_all_customer, channel_mode, description, terms_conditions, id]);

            // Categories
            await pool.query(`UPDATE ine_campaign_category SET status = 2 WHERE campaign_id = ?`, [id]);
            if (Array.isArray(categories) && categories.length > 0) {
                const categoryInsertPromises = categories.map(category_id =>
                    pool.query(`INSERT INTO ine_campaign_category (campaign_id, category_id) VALUES (?, ?)`, [id, category_id])
                );
                await Promise.all(categoryInsertPromises);
            }

            // Products
            await pool.query(`UPDATE ine_campaign_product SET status = 2 WHERE campaign_id = ?`, [id]);
            if (Array.isArray(products) && products.length > 0) {
                const productInsertPromises = products.map(product_id =>
                    pool.query(`INSERT INTO ine_campaign_product (campaign_id, product_id) VALUES (?, ?)`, [id, product_id])
                );
                await Promise.all(productInsertPromises);
            }

            // Coupons
            await pool.query(`UPDATE ine_campaign_coupon SET status = 2 WHERE campaign_id = ?`, [id]);
            for (let i = 0; i < Number(no_of_valid_redemptions); i++) {
                if (Number(unique_code_for_all_customer) === 2) { // 1.Yes 2.No
                    await pool.query(`INSERT INTO ine_campaign_coupon (campaign_id, coupon_code) VALUES (?, ?)`, [id, coupon_code]);
                }
            }

            await initRequestforAdmin({ module_id, insertedRecordId: id });

            return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Delete
router.delete('/', async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);

        const deletedIds = id ? [id] : getQueryParamIds(new URL(fullUrl));

        if (!deletedIds || deletedIds.length === 0) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        await Promise.all(deletedIds.map(async (deletedId) => {
            await getRecordById(deletedId, 'ine_campaign', 'id');
            await getRecordById(deletedId, 'ine_campaign_category', 'campaign_id');
        }));

        const query = `UPDATE ine_campaign SET status = 2, deleted_at = NOW() WHERE id IN (?)`;
        const query1 = `UPDATE ine_campaign_category SET status = 2 WHERE campaign_id IN (?)`;

        const [results] = await pool.query(query, [deletedIds]);
        await pool.query(query1, [deletedIds]);
        if (results.affectedRows > 0) {
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Fetch Coupon Data - Frontend / Admin
router.post('/fetch-coupon', async (req, res) => {
    try {

        const { channel_mode } = req.body;

        if (!channel_mode) { return sendResponse(res, { error: 'Channel Mode must be required', status: false }, 400); }

        const today = new Date().toISOString().split('T')[0];
        const [query1] = await pool.query(`SELECT id, name, start_date, end_Date, min_cart_value, max_discount_value, show_on_channel, unique_code_for_all_customer, off_type, off_type_flat, off_type_percentage FROM ine_campaign WHERE record_status = 2 and status = 1 and no_of_valid_redemptions > no_of_redeemed and ? BETWEEN start_date AND end_date and channel_mode = ?`, [today, channel_mode]);
        if (query1.length > 0) {
            for (let i = 0; i < query1.length; i++) {
                const campaign = query1[i];
                const [query2] = await pool.query(`SELECT * FROM ine_campaign_coupon WHERE status = 1 and coupon_status = 1 and campaign_id = ?`, [campaign.id]);
                campaign.coupon_code_data = query2;
                const [query4] = await pool.query(`SELECT * FROM ine_campaign_product WHERE status = 1 and campaign_id = ?`, [campaign.id]);
                campaign.product_data = query4;
                const [query3] = await pool.query(`SELECT GROUP_CONCAT(category_id) as category_id FROM ine_campaign_category WHERE status = 1 and campaign_id = ?`, [campaign.id]);
                campaign.categories_data = query3[0]?.category_id ? query3[0].category_id.split(',').map(id => parseInt(id, 10)) : [];
            }
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Apply Coupon Code
router.post('/apply-coupon', async (req, res) => {
    try {
        const { coupon_code, categories } = req.body;
        if (!coupon_code) { return sendResponse(res, { error: 'Coupon Code field is required', status: false }, 400); }

        const [query1] = await pool.query(`SELECT * FROM ine_campaign_coupon WHERE coupon_code = ? AND status = 1 AND coupon_status = 1`, [coupon_code]);
        if (query1.length > 0) {
            const campaign_id = query1[0].campaign_id;

            if (Array.isArray(categories) && categories.length > 0) {
                const placeholders = categories.map(() => '?').join(',');
                const queryParams = [campaign_id, ...categories];
                const [query3] = await pool.query(`SELECT category_id FROM ine_campaign_category WHERE campaign_id = ? AND category_id IN (${placeholders}) AND status = 1`, queryParams);
                if (query3.length > 0) {
                    return sendResponse(res, { message: "Coupon applied successfully.", status: true }, 201);
                } else {
                    return sendResponse(res, { message: "Invalid coupon or no matching categories found for this coupon.", status: false }, 400);
                }
            } else {
                return sendResponse(res, { error: 'Categories are required and must be an array.', status: false }, 400);
            }
        } else {
            return sendResponse(res, { message: "Invalid coupon or the coupon has already been used.", status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Fetch Products Based On Model Number
router.post('/fetchproductbasedonmodel', async (req, res) => {
    try {
        const { model_number } = req.body;
        if (!model_number) { return sendResponse(res, { error: 'Model Code field is required', status: false }, 400); }

        const [query1] = await pool.query(`SELECT d.id as designer_id, d.title as designer_title, d.model_number, m.* FROM ine_designer as d 
        LEFT JOIN ine_marketing as m on m.designer_id = d.id 
        WHERE d.status = 1 and m.status = 1 and m.record_status = 2 and d.model_number = ?`, [model_number]);

        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;