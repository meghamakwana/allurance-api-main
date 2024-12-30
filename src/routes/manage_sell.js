// src/routes/manage_sell.js
const express = require('express');
const TABLE = require('../utils/tables');
const pool = require('../utils/db');
const { ManageResponseStatus, sendResponse } = require('../commonFunctions')
const router = express.Router();

// Order: Listing
router.post('/', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT o.*, u.first_name as user_first_name, u.last_name as user_last_name FROM ine_orders as o 
            LEFT JOIN ine_users as u on u.id = o.customer_id 
            ORDER BY o.ID DESC`);
        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true }, 201);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Order: Detail
router.post('/detail', async (req, res) => {
    try {

        const order_id = req.query.order_id;

        const [query1] = await pool.query(`SELECT * FROM ine_orders WHERE id = ?`, [order_id]);
        if (query1.length > 0) {

            const order_data = query1[0];
            const customer_id = order_data.customer_id;
            const address_id = order_data.address_id;
            const channel_mode_type = order_data.channel_mode;

            let user_data = [];
            let address_data = [];
            let product_data = [];
            let combinedData;

            const [query3] = await pool.query(`SELECT * FROM ine_users WHERE id = ?`, [customer_id]);
            if (query3.length > 0) { user_data = query3[0]; }

            const [query4] = await pool.query(`SELECT * FROM ine_my_address WHERE id = ? and status = 1`, [address_id]);
            if (query4.length > 0) { address_data = query4[0]; }

            // Online List
            if (channel_mode_type === 1) {
                const [query2] = await pool.query(`SELECT iop.*, ip.*, iop.price as iop_price, iuc.subtotal, iuc.taxamount, iuc.CGST, iuc.IGST, iuc.SGST, iuc.totalamount FROM ine_order_products as iop 
                    LEFT JOIN ine_marketing as ip on ip.id = iop.product_id 
                    LEFT JOIN ine_users_checkout as iuc on iuc.id = iop.checkout_id 
                    WHERE iop.order_id = ?`, [order_id]);

                product_data = query2;
                combinedData = { order_data, user_data, address_data, product_data };
                return sendResponse(res, { data: combinedData, message: ManageResponseStatus('fetched'), status: true }, 201);

            } else {
                // Offline List
                const [query5] = await pool.query(`SELECT ossn.order_id, ossn.serial_number_id, 
                sn.*, r.designer_id as model_number, r.batch_number, d.category_id, c.name as category_name, m.name as product_name, m.short_description as product_short_description, m.price as product_price, m.discount_price as product_discount_price, m.weight as product_weight, d.id as designer_id
                FROM ine_offline_sales_serial_number as ossn
                    LEFT JOIN serial_number as sn on sn.serial_number = ossn.serial_number_id
                    LEFT JOIN ine_replicator as r on r.id = sn.replicator_id
                    LEFT JOIN ine_designer as d on d.model_number = r.designer_id
                    LEFT JOIN ine_category as c on c.id = d.category_id
                    LEFT JOIN ine_marketing as m on m.designer_id = d.id
                    WHERE ossn.order_id = ? and r.designer_id != '' and ossn.status = 1`, [order_id]);

                if (query5.length > 0) {
                    product_data = query5.map(record => ({
                        ...record,
                        images: query5
                            .filter(item => item.designer_id === record.designer_id).map(media => ({
                                url: media.designer_image_url,
                                created_at: media.image_upload_datetime
                            }))
                    }));
                }

                combinedData = { order_data, user_data, address_data, product_data };
                return sendResponse(res, { data: combinedData, message: ManageResponseStatus('fetched'), status: true }, 201);
            }
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;