const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, processDocuments, activityLog, getUserByPhoneNumber, checkEmailExistOrNot, checkPhoneExistOrNot } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');

const router = express.Router();


const tableName = TABLE.DESIGNER;
const tableName2 = TABLE.MARKETING;
const tableName3 = TABLE.INE_ASSETS;
const tableName4 = TABLE.REPLICATOR;

// Table Names
const ORDERS = TABLE.ORDERS;
const USERS = TABLE.USERS
const USER_ADDRESS = TABLE.USER_ADDRESSES
const SERIAL_NUMBERS = TABLE.SERIAL_NUMBER
const REPLICATOR = TABLE.REPLICATOR
const MARKETING_TABLE = TABLE.MARKETING
const DESIGNER_TABLE = TABLE.DESIGNER
const ORDER_PRODUCTS = TABLE.ORDER_PRODUCTS
const PRODUCTS = TABLE.PRODUCTS
const MY_ADDRESSES = TABLE.MY_ADDRESSES
const GIFTCARD_GENERATE = TABLE.GIFTCARD_GENERATE_TABLE
const ROLES = TABLE.ROLES
const CAMPAIGN = TABLE.CAMPAIGN

router.get('/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        const modelNumber = req.url.split('=')[1]; // Extract model number from query string

        if (id || modelNumber) {
            if (modelNumber) {
                const [replicatorResult] = await pool.query("SELECT * FROM `ine_replicator` WHERE `designer_id` = ? ORDER BY ID", [modelNumber]);
                if (!replicatorResult) {
                    return sendResponse(res, { error: 'Model number not found', status: false }, 404);
                }
                const { quantity, id: replicatorId } = replicatorResult;
                const [query2] = await pool.query(`
                SELECT isn.*, isn.batch_sequence_no as batch_number, isn.serial_number, 
                       ipb.id as ipbid, ipb.title as box_name, 
                       ice.carton_id as icecarton_id, ice.box_id as icebox_id, ice.id as iceid, 
                       ipca.title as ipcatitle, ios.id as iosid,
                       ipc.title as carton_title  -- Selecting carton title from ine_packers_cartons
                FROM \`ine_serial_number\` as isn 
                LEFT JOIN \`ine_packers_boxes\` as ipb ON ipb.serial_number_id = isn.id
                LEFT JOIN \`ine_carton_elements\` as ice ON ice.box_id = ipb.id 
                LEFT JOIN \`ine_packers_cartons\` as ipca ON ipca.id = ice.carton_id
                LEFT JOIN \`ine_offline_sales\` as ios ON ios.carton_id = ice.carton_id
                LEFT JOIN \`ine_packers_cartons\` as ipc ON ipc.id = ice.carton_id  -- Joining ine_packers_cartons again
                WHERE isn.\`replicator_id\` = ? AND isn.id = ipb.serial_number_id AND ipb.status = 1
            `, [replicatorId]);
                const totalRecords = query2.length;
                const records = query2.map(listdata2 => ({
                    serial_rowid: listdata2.id,
                    batch_number: listdata2.batch_number,
                    serial_number: listdata2.serial_number,
                    ipbid: listdata2.ipbid,
                    box_name: listdata2.box_name,
                    icecarton_id: listdata2.icecarton_id,
                    icebox_id: listdata2.icebox_id,
                    iceid: listdata2.iceid,
                    ipcatitle: listdata2.ipcatitle,
                    iosid: listdata2.iosid,
                    carton_title: listdata2.carton_title,  // Adding carton title to the result
                    totalRecords: totalRecords
                }));
                return sendResponse(res, { data: records, message: ManageResponseStatus('fetched'), status: true }, 200);
            } else {
                const [results] = await pool.query(`
                    SELECT m.*, d.model_number, d.sub_model_number, d.in_pair
                    FROM ${tableName2} m
                    JOIN ${tableName} d ON m.designer_id = d.id
                    WHERE m.record_status=2 AND m.status = 1 AND m.id = ?
                `, [id]);
                if (results.length > 0) {
                    const enhancedResults = await Promise.all(results.map(async (record) => {
                        const [assetRecords] = await pool.query(`
                            SELECT *
                            FROM ${tableName3}
                            WHERE m_id = ? AND created_at = (
                                SELECT MAX(created_at) 
                                FROM ${tableName3} 
                                WHERE m_id = ? AND meta_key IN ('video', 'image')
                            )
                        `, [record.id, record.id]);
                        record.images = [];
                        record.videos = [];
                        assetRecords.forEach(asset => {
                            if (asset.meta_key === 'image') {
                                record.images.push(asset.meta_value);
                            } else if (asset.meta_key === 'video') {
                                record.videos.push(asset.meta_value);
                            }
                        });
                        return record;
                    }));
                    return sendResponse(res, { data: enhancedResults, message: ManageResponseStatus('fetched'), status: true, count: enhancedResults.length }, 200);
                }
            }
        }
        else {
            const [results] = await pool.query(`
                SELECT m.*, d.model_number, d.sub_model_number, d.in_pair
                FROM ${tableName2} m
                JOIN ${tableName} d ON m.designer_id = d.id
                WHERE m.record_status=2 AND m.status = 1
            `);
            if (results.length > 0) {
                const enhancedResults = await Promise.all(results.map(async (record) => {
                    const [assetRecords] = await pool.query(`
                        SELECT *
                        FROM ${tableName3}
                        WHERE m_id = ? AND created_at = (
                            SELECT MAX(created_at) 
                            FROM ${tableName3} 
                            WHERE m_id = ? AND meta_key IN ('video', 'image')
                        )
                    `, [record.id, record.id]);
                    const [replicatorResult] = await pool.query("SELECT * FROM `ine_replicator` WHERE `designer_id` = ? ORDER BY ID", [record.model_number]);
                    if (!replicatorResult) {
                        return sendResponse(res, { error: 'Model number not found', status: false }, 404);
                    }
                    const { quantity, id: replicatorId } = replicatorResult;
                    const [query2] = await pool.query(`
                    SELECT isn.*, isn.batch_sequence_no as batch_number, isn.serial_number, 
                           ipb.id as ipbid, ipb.title as box_name, 
                           ice.carton_id as icecarton_id, ice.box_id as icebox_id, ice.id as iceid, 
                           ipca.title as ipcatitle, ios.id as iosid,
                           ipc.title as carton_title  -- Selecting carton title from ine_packers_cartons
                    FROM \`ine_serial_number\` as isn 
                    LEFT JOIN \`ine_packers_boxes\` as ipb ON ipb.serial_number_id = isn.id
                    LEFT JOIN \`ine_carton_elements\` as ice ON ice.box_id = ipb.id 
                    LEFT JOIN \`ine_packers_cartons\` as ipca ON ipca.id = ice.carton_id
                    LEFT JOIN \`ine_offline_sales\` as ios ON ios.carton_id = ice.carton_id
                    LEFT JOIN \`ine_packers_cartons\` as ipc ON ipc.id = ice.carton_id  -- Joining ine_packers_cartons again
                    WHERE isn.\`replicator_id\` = ? AND isn.id = ipb.serial_number_id AND ipb.status = 1
                `, [replicatorId]);
                    record.quantity = query2.length;
                    record.images = [];
                    record.videos = [];

                    assetRecords.forEach(asset => {
                        if (asset.meta_key === 'image') {
                            record.images.push(asset.meta_value);
                        } else if (asset.meta_key === 'video') {
                            record.videos.push(asset.meta_value);
                        }
                    });
                    return record;
                }));
                return sendResponse(res, { data: enhancedResults, message: ManageResponseStatus('fetched'), status: true, count: enhancedResults.length }, 200);
            }
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
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

// GET ORDERS
// router.get('/orders/:id?', async (req, res) => {
//     try {
//         const id = req.params.id || req.query.id;
//         console.log("Received ID:", id); // Log the ID for debugging

//         if (id) {
//             // Handle request with ID
//             console.log("Fetching order with ID:", id);
//             const [results] = await pool.query(`
//                 SELECT t1.*, u.phone, u.first_name, u.last_name, u.email, a.id as address_id,
//                     ad.first_name as assisted_by_first_name, ad.last_name as assisted_by_last_name,
//                     a.address_1 as address_line_1, a.address_2 as address_line_2, a.landmark, a.pincode, a.district, a.state, a.country
//                 FROM ${ORDERS} t1
//                 LEFT JOIN ${USERS} u ON t1.customer_id = u.id
//                 LEFT JOIN ${USERS} ad ON t1.assisted_by = ad.prefix_id
//                 LEFT JOIN ${USER_ADDRESS} a ON t1.address_id = a.id
//                 WHERE t1.id = ?`, [id]);

//             console.log("Order results:", results); // Log the query result

//             if (results.length > 0) {
//                 const result = results[0];
//                 const [serialNumberResults] = await pool.query(`
//                     SELECT serial_number, is_returned
//                     FROM ${ORDER_PRODUCTS}
//                     WHERE order_id = ?`, [id]);

//                 console.log("Serial number results:", serialNumberResults); // Log the serial number results

//                 if (serialNumberResults.length > 0) {
//                     const serialNumbers = serialNumberResults.map(row => ({
//                         serial_number: row.serial_number ? row.serial_number.trim() : null,
//                         is_returned: row.is_returned
//                     }));

//                     const lineSerialNumbers = await Promise.all(serialNumbers.map(async ({ serial_number, is_returned }) => {
//                         if (serial_number) {
//                             const [products] = await pool.query(`
//                                 SELECT s.batch_sequence_no as batch_number, s.serial_number, s.l_serial_number, s.r_serial_number, d.model_number, m2.*, ? as is_returned
//                                 FROM ${SERIAL_NUMBERS} s
//                                 LEFT JOIN ${REPLICATOR} r ON s.replicator_id = r.id
//                                 LEFT JOIN ${DESIGNER_TABLE} d ON r.designer_id = d.model_number
//                                 LEFT JOIN ${MARKETING_TABLE} m2 ON d.id = m2.designer_id
//                                 WHERE s.serial_number = ?`, [is_returned, serial_number]);
//                             return products;
//                         } else {
//                             return []; // Return empty array if serial_number is null
//                         }
//                     }));

//                     const products = lineSerialNumbers.flat(); // Flatten the array of arrays

//                     // Aggregate products based on model number and calculate total quantity
//                     const aggregatedProducts = {};
//                     products.forEach(product => {
//                         if (aggregatedProducts[product.model_number]) {
//                             aggregatedProducts[product.model_number].quantity++;
//                         } else {
//                             aggregatedProducts[product.model_number] = { ...product, quantity: 1 };
//                         }
//                     });

//                     result.Products = Object.values(aggregatedProducts);

//                     return sendResponse(res, {
//                         data: result,
//                         message: ManageResponseStatus('fetched'),
//                         status: true
//                     }, 200);
//                 } else {
//                     return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
//                 }
//             }

//             return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
//         } else {
//             // Handle request without ID (fetch all orders)
//             console.log("Fetching all orders");
//             const [results] = await pool.query(`
//                 SELECT t1.*, u.phone, u.first_name, u.last_name, u.email, a.id as address_id,
//                     a.address_1 as address_line_1, a.address_2 as address_line_2, a.landmark,
//                     a.pincode, a.district, a.state, a.country
//                 FROM ${ORDERS} t1
//                 LEFT JOIN ${USERS} u ON t1.customer_id = u.id
//                 LEFT JOIN ${USER_ADDRESS} a ON t1.address_id = a.id
//             `);

//             console.log("All orders results:", results); // Log the results

//             if (results.length > 0) {
//                 return sendResponse(res, {
//                     data: results,
//                     message: ManageResponseStatus('fetched'),
//                     status: true,
//                     count: results.length
//                 }, 200);
//             }

//             return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
//         }
//     } catch (error) {
//         console.error("Error occurred:", error.message); // Log the error message
//         return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
//     }
// });

router.get('/orders/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        // console.log("Received ID:", id); // Log the ID for debugging

        if (id) {
            // Handle request with ID
            const [results] = await pool.query(`
                SELECT t1.*, u.phone, u.first_name, u.last_name, u.email, a.id as address_id, 
                    ad.first_name as assisted_by_first_name, ad.last_name as assisted_by_last_name,  
                    a.address_1 as address_line_1, a.address_2 as address_line_2, a.landmark, a.pincode, a.district, a.state, a.country
                FROM ${ORDERS} t1
                LEFT JOIN ${USERS} u ON t1.customer_id = u.id
                LEFT JOIN ${USERS} ad ON t1.assisted_by = ad.prefix_id
                LEFT JOIN ${USER_ADDRESS} a ON t1.address_id = a.id
                WHERE t1.id = ?`, [id]);

            if (results.length > 0) {
                const result = results[0];
                const [serialNumberResults] = await pool.query(`
                    SELECT serial_number, is_returned
                    FROM ${ORDER_PRODUCTS}
                    WHERE order_id = ?`, [id]);

                // console.log("Serial number results:", serialNumberResults); // Log the serial number results

                if (serialNumberResults.length > 0) {
                    const serialNumbers = serialNumberResults.map(row => ({
                        serial_number: row.serial_number ? row.serial_number.trim() : null,
                        is_returned: row.is_returned
                    }));

                    const lineSerialNumbers = await Promise.all(serialNumbers.map(async ({ serial_number, is_returned }) => {
                        if (serial_number) {
                            const [products] = await pool.query(`
                                SELECT s.batch_sequence_no as batch_number, s.serial_number, s.l_serial_number, s.r_serial_number, d.model_number, m2.*, ? as is_returned
                                FROM ${SERIAL_NUMBERS} s
                                LEFT JOIN ${REPLICATOR} r ON s.replicator_id = r.id
                                LEFT JOIN ${DESIGNER_TABLE} d ON r.designer_id = d.model_number
                                LEFT JOIN ${MARKETING_TABLE} m2 ON d.id = m2.designer_id
                                WHERE s.serial_number = ?`, [is_returned, serial_number]);
                            return products;
                        } else {
                            return []; // Return empty array if serial_number is null
                        }
                    }));

                    const products = lineSerialNumbers.flat(); // Flatten the array of arrays

                    // Aggregate products based on model number and calculate total quantity
                    const aggregatedProducts = {};
                    products.forEach(product => {
                        if (aggregatedProducts[product.model_number]) {
                            aggregatedProducts[product.model_number].quantity++;
                        } else {
                            aggregatedProducts[product.model_number] = { ...product, quantity: 1 };
                        }
                    });

                    result.Products = Object.values(aggregatedProducts);

                    // console.log("Aggregated products:", result.Products); // Log the aggregated products

                    return sendResponse(res, {
                        data: result,
                        message: ManageResponseStatus('fetched'),
                        status: true
                    }, 200);
                } else {
                    // If no serial numbers found, include this order in the all orders response
                    const [allOrders] = await pool.query(`
                        SELECT t1.*, u.phone, u.first_name, u.last_name, u.email, a.id as address_id,
                            a.address_1 as address_line_1, a.address_2 as address_line_2, a.landmark,
                            a.pincode, a.district, a.state, a.country
                        FROM ${ORDERS} t1
                        LEFT JOIN ${USERS} u ON t1.customer_id = u.id
                        LEFT JOIN ${USER_ADDRESS} a ON t1.address_id = a.id
                    `);

                    if (allOrders.length > 0) {
                        return sendResponse(res, {
                            data: allOrders,
                            message: ManageResponseStatus('fetched'),
                            status: true,
                            count: allOrders.length
                        }, 200);
                    }

                    return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
                }
            } else {
                // If no order found by ID, fetch all orders
                const [allOrders] = await pool.query(`
                    SELECT t1.*, u.phone, u.first_name, u.last_name, u.email, a.id as address_id,
                        a.address_1 as address_line_1, a.address_2 as address_line_2, a.landmark,
                        a.pincode, a.district, a.state, a.country
                    FROM ${ORDERS} t1
                    LEFT JOIN ${USERS} u ON t1.customer_id = u.id
                    LEFT JOIN ${USER_ADDRESS} a ON t1.address_id = a.id
                `);

                // console.log("All orders results:", allOrders); // Log the results

                if (allOrders.length > 0) {
                    return sendResponse(res, {
                        data: allOrders,
                        message: ManageResponseStatus('fetched'),
                        status: true,
                        count: allOrders.length
                    }, 200);
                }

                return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
            }
        } else {
            const [allOrders] = await pool.query(`
                SELECT t1.*, u.phone, u.first_name, u.last_name, u.email, a.id as address_id,
                    a.address_1 as address_line_1, a.address_2 as address_line_2, a.landmark,
                    a.pincode, a.district, a.state, a.country
                FROM ${ORDERS} t1
                LEFT JOIN ${USERS} u ON t1.customer_id = u.id
                LEFT JOIN ${USER_ADDRESS} a ON t1.address_id = a.id
            `);
            if (allOrders.length > 0) {
                return sendResponse(res, {
                    data: allOrders,
                    message: ManageResponseStatus('fetched'),
                    status: true,
                    count: allOrders.length
                }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        // console.error("Error occurred:", error.message); // Log the error message
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.get('/invoice/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        const modelNumber = req.url.split('=')[1]; // Extract model number from query string

        if (id || modelNumber) {
            if (modelNumber) {
                const [replicatorResult] = await pool.query("SELECT * FROM `ine_replicator` WHERE `designer_id` = ? ORDER BY ID", [modelNumber]);
                if (!replicatorResult) {
                    return sendResponse(res, { error: 'Model number not found', status: false }, 404);
                }
                const { quantity, id: replicatorId } = replicatorResult;
                const [query2] = await pool.query(`
                SELECT isn.*, isn.batch_sequence_no as batch_number, isn.serial_number, 
                       ipb.id as ipbid, ipb.title as box_name, 
                       ice.carton_id as icecarton_id, ice.box_id as icebox_id, ice.id as iceid, 
                       ipca.title as ipcatitle, ios.id as iosid,
                       ipc.title as carton_title  -- Selecting carton title from ine_packers_cartons
                FROM \`ine_serial_number\` as isn 
                LEFT JOIN \`ine_packers_boxes\` as ipb ON ipb.serial_number_id = isn.id
                LEFT JOIN \`ine_carton_elements\` as ice ON ice.box_id = ipb.id 
                LEFT JOIN \`ine_packers_cartons\` as ipca ON ipca.id = ice.carton_id
                LEFT JOIN \`ine_offline_sales\` as ios ON ios.carton_id = ice.carton_id
                LEFT JOIN \`ine_packers_cartons\` as ipc ON ipc.id = ice.carton_id  -- Joining ine_packers_cartons again
                WHERE isn.\`replicator_id\` = ? AND isn.id = ipb.serial_number_id AND ipb.status = 1
            `, [replicatorId]);
                const totalRecords = query2.length;
                const records = query2.map(listdata2 => ({
                    serial_rowid: listdata2.id,
                    batch_number: listdata2.batch_number,
                    serial_number: listdata2.serial_number,
                    ipbid: listdata2.ipbid,
                    box_name: listdata2.box_name,
                    icecarton_id: listdata2.icecarton_id,
                    icebox_id: listdata2.icebox_id,
                    iceid: listdata2.iceid,
                    ipcatitle: listdata2.ipcatitle,
                    iosid: listdata2.iosid,
                    carton_title: listdata2.carton_title,  // Adding carton title to the result
                    totalRecords: totalRecords
                }));
                return sendResponse(res, { data: records, message: ManageResponseStatus('fetched'), status: true }, 200);
            } else {
                const [results] = await pool.query(`
                    SELECT m.*, d.model_number, d.sub_model_number, d.in_pair
                    FROM ${tableName2} m
                    JOIN ${tableName} d ON m.designer_id = d.id
                    WHERE m.record_status=2 AND m.status = 1 AND m.id = ?
                `, [id]);
                if (results.length > 0) {
                    const enhancedResults = await Promise.all(results.map(async (record) => {
                        const [assetRecords] = await pool.query(`
                            SELECT *
                            FROM ${tableName3}
                            WHERE m_id = ? AND created_at = (
                                SELECT MAX(created_at) 
                                FROM ${tableName3} 
                                WHERE m_id = ? AND meta_key IN ('video', 'image')
                            )
                        `, [record.id, record.id]);
                        record.images = [];
                        record.videos = [];
                        assetRecords.forEach(asset => {
                            if (asset.meta_key === 'image') {
                                record.images.push(asset.meta_value);
                            } else if (asset.meta_key === 'video') {
                                record.videos.push(asset.meta_value);
                            }
                        });
                        return record;
                    }));
                    return sendResponse(res, { data: enhancedResults, message: ManageResponseStatus('fetched'), status: true, count: enhancedResults.length }, 200);
                }
            }
        }
        else {
            const [results] = await pool.query(`
                SELECT m.*, d.model_number, d.sub_model_number, d.in_pair
                FROM ${tableName2} m
                JOIN ${tableName} d ON m.designer_id = d.id
                WHERE m.record_status=2 AND m.status = 1
            `);
            if (results.length > 0) {
                const enhancedResults = await Promise.all(results.map(async (record) => {
                    const [assetRecords] = await pool.query(`
                        SELECT *
                        FROM ${tableName3}
                        WHERE m_id = ? AND created_at = (
                            SELECT MAX(created_at) 
                            FROM ${tableName3} 
                            WHERE m_id = ? AND meta_key IN ('video', 'image')
                        )
                    `, [record.id, record.id]);
                    const [replicatorResult] = await pool.query("SELECT * FROM `ine_replicator` WHERE `designer_id` = ? ORDER BY ID", [record.model_number]);
                    if (!replicatorResult) {
                        return sendResponse(res, { error: 'Model number not found', status: false }, 404);
                    }
                    const { quantity, id: replicatorId } = replicatorResult;
                    const [query2] = await pool.query(`
                    SELECT isn.*, isn.batch_sequence_no as batch_number, isn.serial_number, 
                           ipb.id as ipbid, ipb.title as box_name, 
                           ice.carton_id as icecarton_id, ice.box_id as icebox_id, ice.id as iceid, 
                           ipca.title as ipcatitle, ios.id as iosid,
                           ipc.title as carton_title  -- Selecting carton title from ine_packers_cartons
                    FROM \`ine_serial_number\` as isn 
                    LEFT JOIN \`ine_packers_boxes\` as ipb ON ipb.serial_number_id = isn.id
                    LEFT JOIN \`ine_carton_elements\` as ice ON ice.box_id = ipb.id 
                    LEFT JOIN \`ine_packers_cartons\` as ipca ON ipca.id = ice.carton_id
                    LEFT JOIN \`ine_offline_sales\` as ios ON ios.carton_id = ice.carton_id
                    LEFT JOIN \`ine_packers_cartons\` as ipc ON ipc.id = ice.carton_id  -- Joining ine_packers_cartons again
                    WHERE isn.\`replicator_id\` = ? AND isn.id = ipb.serial_number_id AND ipb.status = 1
                `, [replicatorId]);
                    record.quantity = query2.length;
                    record.images = [];
                    record.videos = [];

                    assetRecords.forEach(asset => {
                        if (asset.meta_key === 'image') {
                            record.images.push(asset.meta_value);
                        } else if (asset.meta_key === 'video') {
                            record.videos.push(asset.meta_value);
                        }
                    });
                    return record;
                }));
                return sendResponse(res, { data: enhancedResults, message: ManageResponseStatus('fetched'), status: true, count: enhancedResults.length }, 200);
            }
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.post('/invoice/searchuser', async (req, res) => {
    try {
        const requestData = await req.body;
        if (!requestData.phone_number) {
            return sendResponse(res, { error: 'Phone number is required', status: false }, 400);
        }
        const user = await getUserByPhoneNumber(requestData.phone_number, USERS);
        if (user[0]) {
            return sendResponse(res, { data: user[0], message: 'User found', status: true }, 200);
        }
        // Return response with user details if found
        return sendResponse(res, { error: 'User not found', status: false }, 404);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
});

router.get('/invoice/searchbyserialnumber/:id', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            const [results] = await pool.query(`
                SELECT isn.*, ir.designer_id as irdesignerid, ir.id as irid, id.id as designer_id, ip.name as ptitle, ip.price as pbaseprice , ip.discount_price as pdiscountprice, ip.id as id
                FROM ine_serial_number AS isn
                LEFT JOIN ${REPLICATOR} AS ir ON ir.id = isn.replicator_id
                LEFT JOIN ${DESIGNER_TABLE} AS id ON id.model_number = ir.designer_id
                LEFT JOIN ${PRODUCTS} AS ip ON ip.designer_id = id.id
                WHERE serial_number = ?`, [id]);
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        const [results] = await pool.query(`SELECT * FROM ${USER_ADDRESS}`);
        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
})

// GET ADDRESS
router.get('/invoice/searchaddress/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            const [results] = await pool.query(`SELECT * FROM ${MY_ADDRESSES} WHERE user_id = ?`, [id]);

            if (results.length > 0) {
                return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const [results] = await pool.query(`SELECT * FROM ${MY_ADDRESSES}`);
        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
})

// CREATE ADDRESS
router.post('/invoice/searchaddress', async (req, res) => {
    try {
        const requestData = await req.body;
        // Validate request data
        const { address_1, address_2, landmark, pincode, state, country, prefix_id } = requestData;
        if (!address_1 || !pincode || !state || !country || !prefix_id) {
            return sendResponse(res, { error: 'Address details are incomplete', status: false }, 400);
        }

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${MY_ADDRESSES} (address_1, address_2, landmark, pincode, state, country, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            address_1,
            address_2 || null, // Optional field, if not provided, insert NULL
            landmark || null, // Optional field, if not provided, insert NULL
            pincode,
            state,
            country,
            prefix_id
        ]);

        const insertedRecordId = insertResult.insertId;
        const [insertedRecord] = await getRecordById(insertedRecordId, MY_ADDRESSES, 'id'); // Retrieve the inserted record
        return sendResponse(res, { data: insertedRecord, message: 'Address created successfully', status: true }, 201);

    } catch (error) {
        console.error('Error occurred:', error);
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
})

// GET ADDRESS
router.get('/invoice/giftcard/verification/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            const [results] = await pool.query(`SELECT * FROM ${GIFTCARD_GENERATE} WHERE gift_card_number = ?`, [id]);

            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const [results] = await pool.query(`SELECT * FROM ${GIFTCARD_GENERATE}`);
        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
})

// OTP VERIFICATION
router.post('/invoice/giftcard/otpverification/:id?', async (req, res) => {
    try {
        const requestData = await req.body;
        return sendResponse(res, { data: requestData, message: 'OTP Verified successfully', status: true }, 200);
    } catch (error) {
        console.error('Error occurred:', error);
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
})

// CREATE USER 
router.post('/invoice/createuser', async (req, res) => {
    try {
        const requestData = await req.body;

        // Validate request data
        const { firstName, lastName, email, phone_number } = requestData;
        if (!firstName || !lastName || !email || !phone_number) {
            return sendResponse(res, { error: 'First Name, Last Name, Email, Phone fields are required', status: false }, 400);
        }

        // Generate Prefix
        // Generate PreFix
        const [result1] = await pool.query(`SELECT prefix FROM \`${ROLES}\` WHERE id = ? LIMIT 1`, [9]);
        const rolePrefixName = result1?.prefix || ''; // Logic to retrieve role prefix name, assuming it's obtained elsewhere
        const [result] = await pool.query(`SELECT COUNT(*) as count FROM ${USERS}`);
        const formattedNumber = String(result.count + 1).padStart(4, '0');
        const newPrefix = `${rolePrefixName}${formattedNumber}`;

        // Email Validation
        if (await checkEmailExistOrNot(USERS, email)) {
            return sendResponse(res, { error: 'Email already exists', status: false }, 409);
        }

        // Phone Validation
        if (phone_number.length !== 10) {
            return sendResponse(res, { error: 'Phone number must be 10 digits', status: false }, 400);
        }
        if (await checkPhoneExistOrNot(USERS, phone_number)) {
            return sendResponse(res, { error: 'Phone number already exists', status: false }, 409);
        }

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${USERS} (role_id, first_name, last_name, email, phone, prefix_id) VALUES (?, ?, ?, ?, ?, ?)`, [
            9, // Set role_id to static value 9
            firstName,
            lastName,
            email,
            phone_number,
            newPrefix
        ]);

        const insertedRecordId = insertResult.insertId;
        const [insertedRecord] = await getRecordById(insertedRecordId, USERS, 'id'); // Retrieve the inserted record

        return sendResponse(res, { data: insertedRecord, message: 'User created successfully', status: true }, 201);

    } catch (error) {
        console.error('Error occurred:', error);
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
})

// GET COUPON
router.get('/invoice/coupons/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            const [results] = await pool.query(`SELECT * FROM ${CAMPAIGN} WHERE coupon_code = ? AND offline_channel = 1`, [id]);
            if (results.length > 0) {
                return sendResponse(res, { data: results[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        const [results] = await pool.query(`SELECT * FROM ${CAMPAIGN} WHERE show_in_section = 2 AND record_status = 2 AND offline_channel = 1 AND till_date >= NOW()`);
        return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
})

module.exports = router;