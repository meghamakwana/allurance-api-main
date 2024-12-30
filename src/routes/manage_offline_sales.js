// src/routes/manage_offline_sales.js
const express = require('express');
const bcrypt = require('bcryptjs');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { ManageResponseStatus, sendResponse, requestIDNumber, checkEmailExistOrNot, checkPhoneExistOrNot } = require('../commonFunctions')
const router = express.Router();

/****** Step1: Channel Process ******/

// List: Select Channel
router.post('/selectchannel', async (req, res) => {
    try {
        const [results] = await pool.query(`SELECT * FROM ine_users WHERE role_id = 8`);
        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Submit: Selected Channel
router.post('/submitselectedchannel', async (req, res) => {
    try {
        const { sales_user_id } = req.body;
        const request_id = requestIDNumber();
        if (!sales_user_id) { return sendResponse(res, { error: 'Sales Channel ID fields are required', status: false }, 400); }
        const [query1] = await pool.query(`INSERT INTO ine_orders (sales_user_id, request_id, channel_mode) VALUES (?,?,?)`, [sales_user_id, request_id, 2]);
        const row_id = query1.insertId;
        const orderid = 'ORD' + row_id;
        await pool.query(`UPDATE ine_orders SET order_id = ?, updated_at = NOW() WHERE id = ?`, [orderid, row_id]);
        return sendResponse(res, { data: [{ request_id: request_id }], message: ManageResponseStatus('created'), status: true }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****** Step2: User Process ******/

// Check Mobile Number & Fetch address based on number
router.post('/checkuser', async (req, res) => {
    try {
        const { request_id, phone_number } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length == 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }

        if (!phone_number) { return sendResponse(res, { message: "Phone Number must be required", status: false }, 400); }

        const [query1] = await pool.query(`SELECT * FROM ine_users WHERE phone = ? and status = 1`, [phone_number]);
        if (query1.length > 0) {
            const user_id = query1[0]['id'];
            await pool.query(`UPDATE ine_orders SET customer_id = ?, updated_at = NOW() WHERE request_id = ?`, [user_id, request_id]);
            return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Add New User, If they does not exist
router.post('/addnewuser', async (req, res) => {
    try {
        const { request_id, first_name, last_name, email, phone } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length == 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }

        if (!first_name || !last_name || !email || !phone) {
            return sendResponse(res, { error: 'First Name, Last Name, Email and Phone fields are required', status: false }, 400);
        }

        if (email) {
            const emailExists = await checkEmailExistOrNot('ine_users', email);
            if (emailExists) { return sendResponse(res, { error: 'Email already exists', status: false }, 409); }
        }

        if (phone) {
            const phoneExists = await checkPhoneExistOrNot('ine_users', phone);
            if (phoneExists) { return sendResponse(res, { error: 'Phone already exists', status: false }, 409); }
        }

        const role_id = 9;
        const password = requestIDNumber();
        const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

        // Generate PreFix
        const [result1] = await pool.query(`SELECT prefix FROM ine_roles WHERE id = ? LIMIT 1`, [role_id]);
        const rolePrefixName = result1[0]?.prefix || '';
        const [result2] = await pool.query(`SELECT COUNT(*) as count FROM ine_users WHERE role_id = ?`, [role_id]);
        const formattedNumber = String(result2[0]?.count + 1).padStart(4, '0');
        const newPrefix = `${rolePrefixName}A${formattedNumber}`;

        const [insertResult1] = await pool.query(`INSERT INTO ine_users (role_id, prefix_id, first_name, last_name, email, phone, password) VALUES (?, ?, ?, ?, ?, ?, ?)`, [role_id, newPrefix, first_name, last_name, email, phone, hashedPassword]);
        const user_id = insertResult1.insertId;

        await pool.query(`UPDATE ine_orders SET customer_id = ?, updated_at = NOW() WHERE request_id = ?`, [user_id, request_id]);

        const [result3] = await pool.query(`SELECT * FROM ine_users WHERE id = ?`, [user_id]);

        return sendResponse(res, { data: { user_data: result3 }, message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****** Step3: Billing/Address Process ******/

// Add New Address, If they want to add or not exist
router.post('/addnewaddress', async (req, res) => {
    try {
        const { request_id, first_name, last_name, email, phone, address_1, country, state, district, landmark, pincode } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length == 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }
        const user_id = query3[0].customer_id;

        if (!first_name || !last_name || !email || !phone || !address_1) {
            return sendResponse(res, { error: 'First Name, Last Name, Email, Phone and Address fields are required', status: false }, 400);
        }

        if (email) {
            const emailExists = await checkEmailExistOrNot('ine_my_address', email);
            if (emailExists) { return sendResponse(res, { error: 'Email already exists', status: false }, 409); }
        }

        if (phone) {
            const phoneExists = await checkPhoneExistOrNot('ine_my_address', phone);
            if (phoneExists) { return sendResponse(res, { error: 'Phone already exists', status: false }, 409); }
        }

        const [result4] = await pool.query(`SELECT * FROM ine_my_address WHERE user_id = ?`, [user_id]);
        if (result4.length > 0) {
            await pool.query(`UPDATE ine_my_address SET is_default = 0 WHERE user_id = ?`, [user_id]);
        }

        const [insertResult1] = await pool.query(`INSERT INTO ine_my_address (user_id, first_name, last_name, email, phone, address_1, country, state, district, landmark, pincode, is_default, a_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [user_id, first_name, last_name, email, phone, address_1, country, state, district, landmark, pincode, 1, 1]);

        const address_id = insertResult1.insertId;

        await pool.query(`UPDATE ine_orders SET address_id = ?, updated_at = NOW() WHERE request_id = ?`, [address_id, request_id]);

        const [result3] = await pool.query(`SELECT * FROM ine_my_address WHERE id = ?`, [address_id]);

        return sendResponse(res, { data: { address_data: result3 }, message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Fetch Add Address Based on User ID
router.post('/fetchaddress', async (req, res) => {
    try {
        const { request_id } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length == 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }
        const user_id = query3[0].customer_id;

        const [query1] = await pool.query(`SELECT * FROM ine_my_address WHERE user_id = ? and status = 1`, [user_id]);
        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Submit Address
router.post('/submitaddress', async (req, res) => {
    try {
        const { request_id, address_id } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length == 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }

        if (!address_id) { return sendResponse(res, { message: "Address Id must be required", status: false }, 400); }

        await pool.query(`UPDATE ine_orders SET address_id = ? WHERE request_id = ?`, [address_id, request_id]);
        return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Delete Address
router.post('/deleteaddress', async (req, res) => {
    try {
        const { request_id, address_id } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length == 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }

        if (!address_id) { return sendResponse(res, { message: "Address Id must be required", status: false }, 400); }

        const [query1] = await pool.query(`SELECT * FROM ine_my_address WHERE status = 1 and id = ?`, [address_id]);
        if (query1.length > 0) {
            await pool.query(`UPDATE ine_my_address SET status = 0 WHERE id = ?`, [address_id]);
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****** Step4: Types Of Orders ******/

// Update Order Type
router.post('/updateordertype', async (req, res) => {
    try {
        const { request_id, order_type } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length == 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }

        if (!order_type) { return sendResponse(res, { message: "Order Type must be required", status: false }, 400); }

        await pool.query(`UPDATE ine_orders SET order_type = ? WHERE request_id = ?`, [order_type, request_id]);
        return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****** Step5: Products ******/

// Add Serial Number
router.post('/add_serial_number', async (req, res) => {
    try {
        const { request_id, serial_number } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length == 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }
        const order_id = query3[0].id;

        if (!serial_number) { return sendResponse(res, { message: "Serial Number must be required", status: false }, 400); }

        const [query1] = await pool.query(`SELECT sn.*, r.designer_id as model_number, r.batch_number, d.category_id, c.name as category_name, m.name as product_name, m.short_description as product_short_description, m.price as product_price, m.discount_price as product_discount_price, m.weight as product_weight
            FROM serial_number as sn 
                LEFT JOIN ine_replicator as r on r.id = sn.replicator_id
                LEFT JOIN ine_designer as d on d.model_number = r.designer_id
                LEFT JOIN ine_category as c on c.id = d.category_id
                LEFT JOIN ine_marketing as m on m.designer_id = d.id
                WHERE sn.serial_number = ? and sn.serial_place_status = 'No' and sn.order_place_status = 'No'`, [serial_number]);

        if (query1.length > 0) {
            await pool.query(`UPDATE serial_number SET serial_place_status = 'Yes' WHERE serial_number = ?`, [serial_number]);
            await pool.query(`INSERT INTO ine_offline_sales_serial_number (serial_number_id, order_id) VALUES (?,?)`, [serial_number, order_id]);
            return sendResponse(res, { data: query1, message: ManageResponseStatus('created'), status: true }, 201);
        } else {
            return sendResponse(res, { message: 'Sorry, Serial number not found or already placed!', status: false }, 400);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Remove Serial Number
router.post('/remove_serial_number', async (req, res) => {
    try {
        const { request_id, serial_number } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length == 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }
        const order_id = query3[0].id;

        if (!serial_number) { return sendResponse(res, { message: "Serial Number must be required", status: false }, 400); }

        const [query4] = await pool.query(`SELECT * FROM ine_offline_sales_serial_number WHERE serial_number_id = ? and order_id = ?`, [serial_number, order_id]);
        if (query4.length > 0) {
            await pool.query(`UPDATE ine_offline_sales_serial_number SET status = 0 WHERE serial_number_id = ? and order_id = ?`, [serial_number, order_id]);
            await pool.query(`UPDATE serial_number SET serial_place_status = 'No' WHERE serial_number = ?`, [serial_number]);
        }

        return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// List Serial Number
router.post('/list_serial_number', async (req, res) => {
    try {
        const { request_id } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length == 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }
        const order_row_id = query3[0].id;

        const [query1] = await pool.query(`SELECT ossn.order_id, ossn.serial_number_id, 
            sn.*, r.designer_id as model_number, r.batch_number, d.category_id, c.name as category_name, m.name as product_name, m.short_description as product_short_description, m.price as product_price, m.discount_price as product_discount_price, m.weight as product_weight, d.id as designer_id
            FROM ine_offline_sales_serial_number as ossn
                LEFT JOIN serial_number as sn on sn.serial_number = ossn.serial_number_id
                LEFT JOIN ine_replicator as r on r.id = sn.replicator_id
                LEFT JOIN ine_designer as d on d.model_number = r.designer_id
                LEFT JOIN ine_category as c on c.id = d.category_id
                LEFT JOIN ine_marketing as m on m.designer_id = d.id
                WHERE ossn.order_id = ? and r.designer_id != '' and ossn.status = 1`, [order_row_id]);

        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****** Step6: Product Preview ******/

// Product Preview
router.post('/product_preview', async (req, res) => {
    try {
        const { request_id } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length == 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }
        const order_id = query3[0].id;

        const [query1] = await pool.query(`SELECT ossn.order_id, ossn.serial_number_id, 
            sn.*, r.designer_id as model_number, r.batch_number, d.category_id, c.name as category_name, m.id as product_id, m.name as product_name, m.short_description as product_short_description, m.price as product_price, m.discount_price as product_discount_price, m.weight as product_weight, d.id as designer_id
            FROM ine_offline_sales_serial_number as ossn
                LEFT JOIN serial_number as sn on sn.serial_number = ossn.serial_number_id
                LEFT JOIN ine_replicator as r on r.id = sn.replicator_id
                LEFT JOIN ine_designer as d on d.model_number = r.designer_id
                LEFT JOIN ine_category as c on c.id = d.category_id
                LEFT JOIN ine_marketing as m on m.designer_id = d.id
                WHERE ossn.order_id = ? and r.designer_id != '' and ossn.status = 1`, [order_id]);

        if (query1.length > 0) {
            const result = query1.map(record => ({
                ...record,
                images: query1
                    .filter(item => item.designer_id === record.designer_id).map(media => ({
                        url: media.designer_image_url,
                        created_at: media.image_upload_datetime
                    }))
            }));

            const totalDiscountPrice = query1.reduce((sum, item) => sum + (item.product_discount_price || 0), 0);
            const formattedTotalAmount = parseFloat(totalDiscountPrice).toFixed(2);

            await pool.query(`UPDATE ine_orders SET total_amount = ?, total_items = ? WHERE request_id = ?`, [formattedTotalAmount, query1.length, request_id]);
            return sendResponse(res, { data: result, total_discount_price: formattedTotalAmount, message: ManageResponseStatus('fetched'), status: true }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****** Step7: Payment Confirmation ******/

// Payment Confirmation
router.post('/payment_confirmation', async (req, res) => {
    try {
        const { request_id, payment_type } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length === 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }
        const order_row_id = query3[0].id;
        const total_amount = query3[0].total_amount;

        if (!payment_type) { return sendResponse(res, { message: "Payment Type must be required", status: false }, 400); }

        await pool.query(`UPDATE ine_orders SET payment_type = ? WHERE request_id = ?`, [payment_type, request_id]);

        // Once the payment confirm
        const [query1] = await pool.query(`SELECT * FROM ine_offline_sales_serial_number WHERE order_id = ? and status = 1`, [order_row_id]);
        if (query1.length === 0) {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }
        const serialNumbers = query1.map(record => record.serial_number_id);

        for (const serial_number_id of serialNumbers) {
            await pool.query(`UPDATE serial_number SET order_place_status = 'Yes', order_place_id = ? WHERE serial_place_status = 'Yes' and serial_number = ?`, [order_row_id, serial_number_id]);
        }

        const payment_id = requestIDNumber();
        const invoice_id = 'INV' + order_row_id;
        await pool.query(`UPDATE ine_orders SET order_status = 2, payment_status = 2, payment_id = ?, payment_by_customer = ?, invoice_id = ?, invoice_date = NOW() WHERE request_id = ?`, [payment_id, total_amount, invoice_id, request_id]);

        return sendResponse(res, { message: "Payment Successfully Confirmed", status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****** Step8: Complete Order Details After Payment ******/

// Complete order details after payment confirm
router.post('/order_details_after_payment', async (req, res) => {
    try {
        const { request_id } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length === 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }
        const order_data = query3[0];
        const order_id = order_data.id;
        const customer_id = order_data.customer_id;
        const address_id = order_data.address_id;

        let user_data = [];
        let address_data = [];

        const [query2] = await pool.query(`SELECT * FROM ine_users WHERE id = ?`, [customer_id]);
        if (query2.length > 0) { user_data = query2[0]; }

        const [query4] = await pool.query(`SELECT * FROM ine_my_address WHERE id = ? and status = 1`, [address_id]);
        if (query4.length > 0) { address_data = query4[0]; }

        const [query1] = await pool.query(`SELECT ossn.order_id, ossn.serial_number_id, 
            sn.*, r.designer_id as model_number, r.batch_number, d.category_id, c.name as category_name, m.name as product_name, m.short_description as product_short_description, m.price as product_price, m.discount_price as product_discount_price, m.weight as product_weight, d.id as designer_id
            FROM ine_offline_sales_serial_number as ossn
                LEFT JOIN serial_number as sn on sn.serial_number = ossn.serial_number_id
                LEFT JOIN ine_replicator as r on r.id = sn.replicator_id
                LEFT JOIN ine_designer as d on d.model_number = r.designer_id
                LEFT JOIN ine_category as c on c.id = d.category_id
                LEFT JOIN ine_marketing as m on m.designer_id = d.id
                WHERE ossn.order_id = ? and r.designer_id != '' and ossn.status = 1`, [order_id]);

        let product_data = [];
        if (query1.length > 0) {
            product_data = query1.map(record => ({
                ...record,
                images: query1
                    .filter(item => item.designer_id === record.designer_id).map(media => ({
                        url: media.designer_image_url,
                        created_at: media.image_upload_datetime
                    }))
            }));
        }

        const combinedData = { order_data, user_data, address_data, product_data };
        return sendResponse(res, { data: combinedData, message: ManageResponseStatus('fetched'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****** Step9: Product Listing ******/

// Fetch all products
router.post('/fetch_all_products', async (req, res) => {
    try {
        const { request_id } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length === 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }

        const [query1] = await pool.query(`SELECT p.*, d.id as designer_id, d.model_number, d.sub_model_number, c.id as category_id, c.name as category_name, r.id as resin_id, r.name as resin_name, s.id as shape_id, s.shape as shape_name, b.id as bezel_material_id, b.name as bezel_material, bc.id as bezel_color_id, bc.name as bezel_color, im.id as inner_material_id, im.name as inner_material_name, iff.id as flower_id, iff.name as flower_name, cs.id as color_id, cs.name as color_name FROM ine_marketing p
        LEFT JOIN ine_designer d ON p.designer_id = d.id
        LEFT JOIN ine_category c ON d.category_id = c.id
        LEFT JOIN ine_resin r ON d.resin_id = r.id
        LEFT JOIN ine_shape s ON d.shape_id = s.id
        LEFT JOIN ine_bezel_material b ON d.bezel_material_id = b.id
        LEFT JOIN ine_bezel_color bc ON d.bezel_color_id = bc.id
        LEFT JOIN ine_inner_material im ON d.inner_material_id = im.id
        LEFT JOIN ine_flower iff ON d.flower_id = iff.id
        LEFT JOIN ine_color_shade cs ON d.color_id = cs.id ORDER BY p.id DESC`);

        for (let product of query1) {
            const [requestData4] = await pool.query('SELECT file_url, upload_datetime FROM ine_marketing_media WHERE designer_id = ? AND status = 1', [product.designer_id]);
            product.images = requestData4.map(media => ({ url: media.file_url, created_at: media.upload_datetime }));
        }

        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Get Serial Number based on add to cart
router.post('/get_serial_number_based_on_product', async (req, res) => {
    try {
        const { request_id, product_id } = req.body;

        const [query3] = await pool.query(`SELECT * FROM ine_orders WHERE request_id = ?`, [request_id]);
        if (query3.length === 0) {
            return sendResponse(res, { message: "Sorry, the Channel ID does not exist. Please go back to Step 1 and try again.", status: false }, 400);
        }
        const order_id = query3[0].id;

        if (!product_id) { return sendResponse(res, { message: "Product ID must be required", status: false }, 400); }

        const [query1] = await pool.query(`SELECT im.*, id.model_number, ir.id as replicator_id FROM ine_marketing as im
            LEFT JOIN ine_designer as id on id.id = im.designer_id
            LEFT JOIN ine_replicator as ir on ir.designer_id = id.model_number
            WHERE im.id = ?`, [product_id]);

        if (query1.length > 0) {
            const replicator_id = query1[0].replicator_id;
            const [query2] = await pool.query(`SELECT * FROM serial_number where replicator_id = ? and serial_place_status = 'No' and order_place_status = 'No' ORDER BY ID ASC`, [replicator_id]);
            if (query2.length > 0) {
                const sn_id = query2[0].id;
                const sn_serial_number = query2[0].serial_number;
                await pool.query(`UPDATE serial_number SET serial_place_status = 'Yes' WHERE id = ?`, [sn_id]);
                await pool.query(`INSERT INTO ine_offline_sales_serial_number (serial_number_id, order_id) VALUES (?,?)`, [sn_serial_number, order_id]);
                return sendResponse(res, { message: ManageResponseStatus('created'), status: true, count: query2.length }, 201);
            } else {
                return sendResponse(res, { message: "Sorry, Serial number not found or already placed!", status: false, count: 0 }, 400);
            }
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****** Offline Sales Listing ******/

router.post('/offline_sales_listing', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT o.request_id, o.order_type, o.order_id, o.invoice_id, o.invoice_date, o.total_amount, o.order_status, o.payment_type, o.payment_id, o.payment_status, o.created_at, u.first_name as sales_first_name, u.last_name as sales_last_name, u2.first_name as user_first_name, u2.last_name as user_last_name FROM ine_orders as o
            LEFT JOIN ine_users as u on u.id = o.sales_user_id
            LEFT JOIN ine_users as u2 on u2.id = o.customer_id
            WHERE o.channel_mode = 2
            ORDER BY o.ID DESC`);

        // const [query1] = await pool.query(`SELECT o.*, u.first_name as sales_first_name, u.last_name as sales_last_name, u2.first_name as user_first_name, u2.last_name as user_last_name FROM ine_orders as o
        //         LEFT JOIN ine_users as u on u.id = o.sales_user_id
        //         LEFT JOIN ine_users as u2 on u2.id = o.customer_id
        //         WHERE o.channel_mode = 2
        //         ORDER BY o.ID DESC`);

        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

/****** Edit Offline Sales ******/

module.exports = router;