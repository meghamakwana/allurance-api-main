const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, checkEmailExistOrNot, validatePassword, checkPhoneExistOrNot, processDocuments, activityLog, requestIDNumber } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');

const { v4: uuidv4 } = require('uuid');
const uniqueId = uuidv4();

const API_SECRET_KEY = process.env.API_SECRET_KEY;
const API_TOKEN_EXPIRESIN = process.env.API_TOKEN_EXPIRESIN;

const router = express.Router();

// Table Names
const tableName = TABLE.ORDERS;
const tableName2 = TABLE.MARKETING;
const module_id = TABLE.OFFLINE_SALES_MODULE_ID;
const tablname3 = TABLE.USERS
const tablename5 = TABLE.SERIAL_NUMBER
const tablename6 = TABLE.REPLICATOR
const tablename7 = TABLE.MARKETING
const tablename8 = TABLE.DESIGNER
const tablename9 = TABLE.ORDER_PRODUCTS
const tablename10 = TABLE.INE_ASSETS
const campaigntable = TABLE.CAMPAIGN;

const tableName12 = TABLE.USERS_DETAILS;
const tableName13 = TABLE.ROLE;
const tableName16 = TABLE.MY_ADDRESS;

const tableName17 = TABLE.USER_CART;
const tableName18 = TABLE.USER_CHECKOUT;

// ORDER DETAILS
router.get('/:id?', async (req, res) => {
    try {

        await authenticateToken(req);

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);
        const userId = url.searchParams.get('user_id');
        const channelMode = url.searchParams.get('channel_mode');
        const id = req.params.id || req.query.id;
        // const userId = req.query.customer_id;

        if (id) {
            // Fetch main record details
            const [results] = await pool.query(`
                SELECT t1.*, u.phone, u.first_name, u.last_name, u.customer_id, u.email, a.id as address_id, ad.first_name as assisted_by_first_name, ad.last_name as assisted_by_last_name,  
                a.address_1 as address_line_1, a.address_2 as address_line_2, a.landmark, a.pincode, a.district, a.state, a.country
                FROM ${tableName} t1
                LEFT JOIN ${tablname3} u ON t1.customer_id = u.id
                LEFT JOIN ${tablname3} ad ON t1.assisted_by = ad.prefix_id
                LEFT JOIN ${tableName16} a ON t1.address_id = a.id
                WHERE t1.id = ? and t1.customer_id = ? ORDER BY t1.id DESC`, [id, userId]);

            if (results.length > 0) {
                const result = results[0];

                const [serialNumberResults] = await pool.query(`
                    SELECT serial_number, is_returned
                    FROM ${tablename9}
                    WHERE order_id = ? AND serial_number IS NOT NULL`, [result.id]);

                if (serialNumberResults.length > 0) {
                    const serialNumbers = serialNumberResults.map(row => row.serial_number?.trim());

                    // Fetch products details with images and videos
                    const lineSerialNumbers = await Promise.all(serialNumbers.map(async (serialNumber) => {
                        // Query to fetch product details and marketing ID
                        const [productResults] = await pool.query(
                            `SELECT s.batch_sequence_no as batch_number, s.serial_number, s.l_serial_number, s.r_serial_number, d.model_number, m2.*, m2.marketing_id
                            FROM ${tablename5} s
                            LEFT JOIN ${tablename6} r ON s.replicator_id = r.id
                            LEFT JOIN ${tablename8} d ON r.designer_id = d.model_number
                            LEFT JOIN ${tablename7} m2 ON d.id = m2.designer_id
                            WHERE s.serial_number = ?`,
                            [serialNumber]
                        );

                        // Fetch images and videos for each product
                        const productsWithMedia = await Promise.all(productResults.map(async (product) => {
                            const marketingId = product.marketing_id;

                            // Fetch all images
                            const [imageResults] = await pool.query(`
                                SELECT meta_value
                                FROM ${tablename10}
                                WHERE m_id = ? AND meta_key = 'image'
                                ORDER BY created_at DESC
                            `, [marketingId]);

                            const images = imageResults.map(row => row.meta_value);

                            // Fetch all videos
                            const [videoResults] = await pool.query(`
                                SELECT meta_value
                                FROM ${tablename10}
                                WHERE m_id = ? AND meta_key = 'video'
                            `, [marketingId]);

                            const videos = videoResults.map(row => row.meta_value);
                            return {
                                ...product,
                                images,
                                videos
                            };
                        }));
                        return productsWithMedia;
                    }));

                    const products = lineSerialNumbers.flat();
                    const aggregatedProducts = {};

                    // Aggregate products by model number
                    products.forEach(product => {
                        if (aggregatedProducts[product.model_number]) {
                            aggregatedProducts[product.model_number].quantity++;
                        } else {
                            aggregatedProducts[product.model_number] = { ...product, quantity: 1 };
                        }
                    });

                    result.Products = Object.values(aggregatedProducts);

                    return sendResponse(res, {
                        data: result,
                        message: ManageResponseStatus('fetched'),
                        status: true
                    }, 200);
                }
                else {
                    const [ProductResults] = await pool.query(`
                        SELECT serial_number, is_returned ,product_model_number as model_number,product_id
                        FROM ${tablename9}
                        WHERE order_id = ?`, [result.id]);
                    // Fetch products details with images and videos
                    const lineProducts = await Promise.all(ProductResults.map(async (product) => {

                        // Query to fetch product details and marketing ID
                        const [productResults] = await pool.query(
                            `SELECT * FROM ${tablename7}`,
                            [product.product_id]
                        );

                        // Fetch images and videos for each product
                        const productsWithMedia = await Promise.all(productResults.map(async (product) => {
                            const marketingId = product.marketing_id;

                            // Fetch all images
                            const [imageResults] = await pool.query(`
                                    SELECT meta_value
                                    FROM ${tablename10}
                                    WHERE m_id = ? AND meta_key = 'image'
                                    ORDER BY created_at DESC
                                `, [marketingId]);

                            const images = imageResults.map(row => row.meta_value);

                            // Fetch all videos
                            const [videoResults] = await pool.query(`
                                    SELECT meta_value
                                    FROM ${tablename10}
                                    WHERE m_id = ? AND meta_key = 'video'
                                `, [marketingId]);

                            const videos = videoResults.map(row => row.meta_value);

                            return {
                                ...product,
                                images,
                                videos
                            };
                        }));

                        return productsWithMedia;
                    }));

                    const products = lineProducts.flat();
                    const aggregatedProducts = {};

                    // Aggregate products by model number
                    products.forEach(product => {
                        if (aggregatedProducts[product.model_number]) {
                            aggregatedProducts[product.model_number].quantity++;
                        } else {
                            aggregatedProducts[product.model_number] = { ...product, quantity: 1 };
                        }
                    });

                    result.Products = Object.values(aggregatedProducts);

                    return sendResponse(res, {
                        data: result,
                        message: ManageResponseStatus('fetched'),
                        status: true
                    }, 200);
                }
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        else if (userId) {
            const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE customer_id = ? and channel_mode = ? ORDER BY id DESC`, [userId, channelMode]);
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
        } else {
            // Fetch all records if no specific ID or user ID is provided
            const [results] = await pool.query(`
                SELECT t1.*, u.phone, u.first_name, u.customer_id, u.last_name, u.email, a.id as address_id,
                a.address_1 as address_line_1, a.address_2 as address_line_2, a.landmark,
                a.pincode, a.district, a.state, a.country
                FROM ${tableName} t1
                LEFT JOIN ${tablname3} u ON t1.customer_id = u.id
                LEFT JOIN ${tableName16} a ON t1.address_id = a.id
                WHERE t1.channel_mode = ${channelMode} ORDER BY t1.id DESC
            `);
            if (results.length > 0) {
                return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Order Details - Product
router.post('/detail', async (req, res) => {
    try {

        await authenticateToken(req);

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(fullUrl);
        const userId = url.searchParams.get('user_id');
        const rowId = url.searchParams.get('id');

        const [query1] = await pool.query(`SELECT * FROM ${tableName} WHERE customer_id = ? and id = ?`, [userId, rowId]);
        if (query1.length > 0) {
            const channel_mode = query1[0].channel_mode;
            if (channel_mode == 1) {
                const [query2] = await pool.query(`SELECT iop.*, ip.*, iop.price as iop_price, iuc.subtotal, iuc.taxamount, iuc.CGST, iuc.IGST, iuc.SGST, iuc.totalamount FROM ${tablename9} as iop 
                LEFT JOIN ${tablename7} as ip on ip.id = iop.product_id 
                LEFT JOIN ${tableName18} as iuc on iuc.id = iop.checkout_id 
                WHERE iop.order_id = ?`, [rowId]);
                return sendResponse(res, { data: query2, message: ManageResponseStatus('fetched'), status: true }, 200);
            } else {
                const [query3] = await pool.query(`SELECT ossn.order_id, ossn.serial_number_id, 
                    sn.*, r.designer_id as model_number, r.batch_number, d.category_id, c.name as category_name, m.name as product_name, m.short_description as product_short_description, m.price as product_price, m.discount_price as product_discount_price, m.weight as product_weight, d.id as designer_id
                    FROM ine_offline_sales_serial_number as ossn
                        LEFT JOIN serial_number as sn on sn.serial_number = ossn.serial_number_id
                        LEFT JOIN ine_replicator as r on r.id = sn.replicator_id
                        LEFT JOIN ine_designer as d on d.model_number = r.designer_id
                        LEFT JOIN ine_category as c on c.id = d.category_id
                        LEFT JOIN ine_marketing as m on m.designer_id = d.id
                        WHERE ossn.order_id = ? and r.designer_id != '' and ossn.status = 1`, [rowId]);

                let product_data = [];
                if (query3.length > 0) {
                    product_data = query3.map(record => ({
                        ...record,
                        images: query3
                            .filter(item => item.designer_id === record.designer_id).map(media => ({
                                url: media.designer_image_url,
                                created_at: media.image_upload_datetime
                            }))
                    }));
                }
                return sendResponse(res, { data: product_data, message: ManageResponseStatus('fetched'), status: true }, 201);
            }
        }
        return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
    }
    catch (error) {
        console.warn("ERROR ", error);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

//CHANGE ORDER STATE 
router.post('/', async (req, res) => {
    const id = req.params.id || req.query.id;
    const requestData = await req.body;
    const { order_state } = requestData;
    try {
        await pool.query(`UPDATE ${tableName} SET order_status = ? WHERE id = ?`, [order_state, id]);
        return sendResponse(res, { message: ManageResponseStatus('updated'), status: true }, 200);
    }
    catch (error) {
        console.warn("ERROR ", error);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

const generateUniqueOrderNumber = async () => {
    let orderNumber;
    let isUnique = false;

    while (!isUnique) {
        orderNumber = 'ORD' + Math.floor(Math.random() * 1000000);
        const [result] = await pool.query(`SELECT COUNT(*) as count FROM ${tableName} WHERE order_id = ?`, [orderNumber]);
        if (result[0].count === 0) {
            isUnique = true;
        }
    }
    return orderNumber;
};

// Function to generate a unique invoice number
const generateUniqueInvoiceNumber = async () => {
    let invoiceNumber;
    let isUnique = false;

    while (!isUnique) {
        invoiceNumber = 'INV' + Math.floor(Math.random() * 1000000);
        const [result] = await pool.query(`SELECT COUNT(*) as count FROM ${tableName} WHERE invoice_id = ?`, [invoiceNumber]);
        if (result[0].count === 0) {
            isUnique = true;
        }
    }
    return invoiceNumber;
};

// CREATE ORDER
router.post('/createorder', async (req, res) => {
    try {
        const requestData = await req.body;

        // Validate request data
        const requiredFields = ['cartproducts', 'address', 'finalamount', 'channel_mode'];
        for (const field of requiredFields) {
            if (!requestData[field]) {
                return sendResponse(res, { error: `${field} field is required`, status: false }, 400);
            }
        }

        // Generate unique order number and invoice number
        const orderNumber = await generateUniqueOrderNumber();
        const invoiceNumber = await generateUniqueInvoiceNumber();

        // Insertion into orders table
        const [insertOrderResult] = await pool.query(`INSERT INTO ${tableName} (total_amount,base_amount,assisted_by,tax_amount,payment_status,payment_by_customer,order_status, channel_mode, notes, order_id, invoice_id, invoice_date, total_items, customer_id, address_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW(),?,?,?)`, [
            requestData?.finalamount,
            requestData?.baseAmount || 0,
            requestData?.assisted_by || null,
            requestData?.taxAmount,
            requestData?.payment_status,
            requestData?.payment_by_customer || requestData?.finalamount,
            requestData?.order_status || 0,
            requestData?.channel_mode,
            requestData?.notes || '',
            orderNumber,
            invoiceNumber,
            requestData?.cartproducts?.length,
            requestData?.user_id || requestData?.userDetails.id,
            requestData?.addressId,
        ]);

        const insertedOrderId = insertOrderResult.insertId;

        // Insertion into order products table
        for (const product of requestData.cartproducts) {
            await pool.query(`INSERT INTO ${tablename9} (order_id, invoice_id, product_id, product_model_number,serial_number, quantity, price) VALUES (?, ?, ?, ?,?, ?,?)`, [
                insertedOrderId,
                invoiceNumber, // Associate the same invoice number
                product.id,
                product.model_number || product.irdesignerid,
                product.serial_number || null,
                product.quantity,
                product.price
            ]);
        }

        // Remove products from the cart table
        /*
        for (const product of requestData.cartproducts) {
            await pool.query(`DELETE FROM ${cartTableName} WHERE user_id = ? AND product_id = ? AND status = 1`, [
                requestData?.user_id,
                product.id
            ]);
        }

        await pool.query(`DELETE FROM ${tableName11} WHERE user_id = ? and status = 1`, [
            requestData?.user_id,
        ]);
        */

        return sendResponse(res, { message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        console.error("ERROR", error);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// CHECK COUPON
router.get('/checkcoupon/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        const currentDate = new Date().toISOString().split('T')[0];
        if (id) {
            const [results] = await pool.query(`SELECT * FROM ${campaigntable} WHERE id = ? `, [id])
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const [results] = await pool.query(`SELECT * FROM ${campaigntable} WHERE till_date >= ? `, [currentDate])
        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// PLACE ORDER
router.post('/placeorder', async (req, res) => {
    try {

        const { user_id, first_name, last_name, email, phone, password, address, landmark, state, district, pincode, a_type, mockid, coupon_code, delivery_charge } = req.body;
        const role_id = 9;
        let userID = user_id;
        let token = '';

        // Validate request data
        if (!first_name || !last_name || !email || !phone || !address || !landmark || !state || !district || !pincode) {
            return sendResponse(res, { error: 'First Name, Last Name, Email, Phone, Address, Landmark, State, District and Pincode field is required', status: false }, 400);
        }

        if (!userID || userID === '') {

            // Generate PreFix
            const [result1] = await pool.query(`SELECT prefix FROM \`${tableName13}\` WHERE id = ? LIMIT 1`, [role_id]);
            const rolePrefixName = result1[0]?.prefix || '';
            const [result2] = await pool.query(`SELECT COUNT(*) as count FROM \`${tablname3}\` WHERE role_id = ?`, [role_id]);
            const formattedNumber = String(result2[0]?.count + 1).padStart(4, '0');
            const newPrefix = `${rolePrefixName}A${formattedNumber}`;

            // Email Validation
            if (email) {
                const emailExists = await checkEmailExistOrNot(tablname3, email);
                if (emailExists) { return sendResponse(res, { message: 'Email already exists', status: false }, 200); }
            }

            // Phone Validation
            if (phone) {
                const phoneExists = await checkPhoneExistOrNot(tablname3, phone);
                if (phoneExists) { return sendResponse(res, { message: 'Phone already exists', status: false }, 200); }
            }

            // Password Validation
            if (!validatePassword(password)) {
                return sendResponse(res, { message: 'Password must be at least 9 characters long and contain at least one uppercase letter, one lowercase letter and one special character.', status: false }, 200);
            }
            // Hash the password
            const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

            // Generate unique referral code
            const uniqueCode = uniqueId.slice(0, 8); // Generate a short UUID
            const randomCode = Math.floor(100 + Math.random() * 900);
            const referralCode = `${first_name}-${last_name}-${uniqueCode}${randomCode}`;

            // User
            const [insertResult] = await pool.query(`INSERT INTO ${tablname3} (role_id, first_name, last_name, email, phone, password, prefix_id) VALUES (?,?,?,?,?,?,?)`, [role_id, first_name, last_name, email, phone, hashedPassword, newPrefix]);

            const insertedRecordId = insertResult.insertId;
            userID = insertedRecordId;

            // Address
            await pool.query(`INSERT INTO ${tableName16} (user_id, first_name, last_name, email, phone, address_1, state, district, landmark, pincode, is_default, a_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [insertedRecordId, first_name, last_name, email, phone, address, state, district, landmark, pincode, 1, a_type]);

            // User Details
            await pool.query(`INSERT INTO ${tableName12} (user_id, my_referral_code) VALUES (?,?)`, [insertedRecordId, referralCode]);

            // Login
            const [results] = await pool.query(`SELECT * FROM ${tablname3} WHERE email = ?`, [email]);
            const storedHashedPassword = await results[0].password;
            const passwordMatch = await bcrypt.compareSync(password, storedHashedPassword);
            if (passwordMatch) {
                const user = {
                    id: results[0].id,
                    first_name: results[0].first_name,
                    last_name: results[0].last_name,
                    prefix_id: results[0].prefix_id,
                    phone: results[0].phone,
                    email: results[0].email,
                };
                token = jwt.sign({ data: user }, API_SECRET_KEY, { expiresIn: API_TOKEN_EXPIRESIN });
            }

        }

        // Manage Orders
        const requestData = await req.body;

        // Validate request data
        const requiredFields = ['cartproducts', 'address', 'finalamount', 'channel_mode'];
        for (const field of requiredFields) {
            if (!requestData[field]) {
                return sendResponse(res, { message: `${field} field is required`, status: false }, 200);
            }
        }

        // Insertion into orders table
        const [insertOrderResult] = await pool.query(`INSERT INTO ${tableName} (base_amount,delivery_charge,total_amount,assisted_by,tax_amount,payment_by_customer, channel_mode, notes, total_items, customer_id, address_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [
            requestData?.discountedAmount,
            requestData?.delivery_charge || 0,
            requestData?.finalamount,
            // requestData?.baseAmount || 0,
            requestData?.assisted_by || null,
            requestData?.taxAmount,
            requestData?.payment_by_customer || requestData?.finalamount,
            requestData?.channel_mode,
            requestData?.notes || '',
            requestData?.cartproducts?.length,
            userID,
            requestData?.addressId,
        ]);

        const insertedOrderId = insertOrderResult.insertId;

        const invoiceNumber = 'INV' + insertedOrderId;
        const order_number = 'ORD' + insertedOrderId;
        const payment_id = requestIDNumber();

        for (const product of requestData.cartproducts) {
            let insertOrderResult2;

            // Order Products
            [insertOrderResult2] = await pool.query(`INSERT INTO ${tablename9} (order_id, invoice_id, product_id, product_model_number,serial_number, quantity, price) VALUES (?, ?, ?, ?,?, ?,?)`, [
                insertedOrderId, invoiceNumber, product.id, product.model_number || product.irdesignerid, product.serial_number || null, product.quantity, product.price]);

            // Update Cart and Checkout
            if (mockid) {
                await pool.query(`UPDATE ${tableName17} SET user_id = ?, status = 2, mock_id = NULL WHERE mock_id = ? and status = 1 and id = ?`, [userID, mockid, product.cartid]);
                await pool.query(`UPDATE ${tableName18} SET user_id = ?, status = 2, mock_id = NULL WHERE mock_id = ? and status = 1`, [userID, mockid]);
            } else {
                await pool.query(`UPDATE ${tableName17} SET status = 2 WHERE status = 1 and user_id = ? and id = ?`, [userID, product.cartid]);
                await pool.query(`UPDATE ${tableName18} SET status = 2 WHERE status = 1 and user_id = ? ORDER BY ID DESC LIMIT 1`, [userID]);
            }

            const [result] = await pool.query(`SELECT id FROM ${tableName18} WHERE user_id = ? and status = 2 ORDER BY ID DESC LIMIT 1`, [userID]);
            const checkoutID = result[0].id;

            const lastID = insertOrderResult2.insertId;
            await pool.query(`UPDATE ${tablename9} SET checkout_id = ? WHERE id = ?`, [checkoutID, lastID]);

        }

        await pool.query(`UPDATE ${tableName} SET payment_id = ?, order_id = ?, invoice_id = ?, payment_status = ?, order_status = ?, payment_type = ?, invoice_date = NOW() WHERE id = ?`, [payment_id, order_number, invoiceNumber, 2, 2, 1, insertedOrderId]);

        // Affiliate Program Start
        const [newquery2] = await pool.query(`SELECT * FROM ine_orders WHERE id = ?`, [insertedOrderId]);
        const order_payment_status = newquery2[0].payment_status;

        if (order_payment_status == 2 && requestData.affiliate) {
            const [result1] = await pool.query(`SELECT * FROM ine_affiliate_program WHERE url = ? and status = 1 and record_status = 2`, [requestData.affiliate]);
            if (result1.length > 0) {

                const affiliateResult = result1[0];
                const affiliateId = affiliateResult.id;

                await pool.query(`UPDATE ine_orders SET affiliate_id = ? WHERE id = ?`, [affiliateId, insertedOrderId]);

                const affiliate_commission1 = affiliateResult.commission1; // Range 0-10k - Per Order (%)
                const affiliate_commission2 = affiliateResult.commission2; // Range 10k-20k - Per Order (%)
                const affiliate_commission3 = affiliateResult.commission3; // Range 20k-more - Per Order (%)	

                const finalAmt = Number(requestData.finalamount) || 0;

                let apply_commission = 0;
                let commission_amount = 0;

                // Commission logic based on order value
                if (finalAmt <= 10000) { // Range between 0 to 10000
                    apply_commission = affiliate_commission1;
                    commission_amount = finalAmt * apply_commission / 100;
                }
                else if (finalAmt > 10000 && finalAmt <= 20000) { // Range between 10001 to 20000
                    apply_commission = affiliate_commission2;
                    commission_amount = finalAmt * apply_commission / 100;
                }
                else if (finalAmt > 20000) { // Range more than 20000
                    apply_commission = affiliate_commission3;
                    commission_amount = finalAmt * apply_commission / 100;
                }

                await pool.query(`INSERT INTO ine_affiliate_program_history (affiliate_id, order_id, place_order_amount, applied_commission, get_commission_amount) VALUES (?,?,?,?,?)`, [affiliateId, insertedOrderId, finalAmt, apply_commission, commission_amount]);

                const [newquery1] = await pool.query(`SELECT sum(get_commission_amount) as get_commission_amount, count(id) as sum_orders FROM ine_affiliate_program_history WHERE affiliate_id = ? and status = 1`, affiliateId);
                if (newquery1.length > 0) {
                    const sum_commission_amount = newquery1[0].get_commission_amount;
                    const sum_orders = newquery1[0].sum_orders;
                    const rounded_commission_amount = sum_commission_amount.toFixed(2);
                    await pool.query(`UPDATE ine_affiliate_program SET total_orders = ?, total_revenu = ? WHERE id = ?`, [sum_orders, rounded_commission_amount, affiliateId]);
                }
            }
        }
        // Affiliate Program End

        // Campaign Coupon Code Start
        const [newquery4] = await pool.query(`SELECT * FROM ine_campaign_coupon WHERE coupon_code = ? and coupon_status = 1 and status = 1`, [coupon_code]);
        if (newquery4.length === 1) {
            await pool.query(`UPDATE ine_campaign_coupon SET coupon_used_user_id = ?, coupon_status = ?, updated_at = NOW() WHERE coupon_code = ?`, [userID, 2, coupon_code]);
            const [newquery3] = await pool.query(`SELECT * FROM ine_campaign WHERE id = ?`, [newquery4[0].campaign_id]);
            let no_of_redeemed = newquery3[0].no_of_redeemed;
            const no_of_valid_redemptions = newquery3[0].no_of_valid_redemptions;
            if (no_of_redeemed < no_of_valid_redemptions) {
                no_of_redeemed += 1;
                await pool.query(`UPDATE ine_campaign SET no_of_redeemed = ? WHERE id = ?`, [no_of_redeemed, newquery4[0].campaign_id]);
                await pool.query(`UPDATE ine_orders SET coupon_id = ? WHERE id = ?`, [newquery4[0].id, insertedOrderId]);
            }
        }
        // Campaign Coupon Code End

        return sendResponse(res, { message: "Order has been successfully placed", ...(token ? { accessToken: token } : {}), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }


});




module.exports = router;