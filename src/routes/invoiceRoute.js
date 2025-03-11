const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getRecordById, ManageResponseStatus, sendResponse, getUserByPhoneNumber, checkEmailExistOrNot, checkPhoneExistOrNot } = require('../commonFunctions');

const router = express.Router();

const tableName = TABLE.DESIGNER;
const tableName2 = TABLE.MARKETING;
const tableName3 = TABLE.INE_ASSETS;
const tableName4 = TABLE.REPLICATOR;

// Table Names
const ORDERS = TABLE.ORDERS;
const USERS = TABLE.USERS
const USER_ADDRESS = TABLE.USER_ADDRESSES
const REPLICATOR = TABLE.REPLICATOR
const MARKETING_TABLE = TABLE.MARKETING
const DESIGNER_TABLE = TABLE.DESIGNER
const MY_ADDRESSES = TABLE.MY_ADDRESSES
const GIFTCARD_GENERATE = TABLE.GIFTCARD_GENERATE_TABLE
const ROLES = TABLE.ROLES
const CAMPAIGN = TABLE.CAMPAIGN
router.post('/searchuser', async (req, res) => {
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

router.get('/searchbyserialnumber/:id', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            const [results] = await pool.query(`
                SELECT isn.*, ir.designer_id as irdesignerid, ir.id as irid, id.id as designer_id, ip.name as ptitle, ip.price as pbaseprice , ip.discount_price as pdiscountprice, ip.id as id
                ,ic.hsn,ic.gstPercentage FROM ine_serial_number AS isn
                LEFT JOIN ${REPLICATOR} AS ir ON ir.id = isn.replicator_id
                LEFT JOIN ${DESIGNER_TABLE} AS id ON id.model_number = ir.designer_id
                LEFT JOIN ${MARKETING_TABLE} AS ip ON ip.designer_id = id.id
                LEFT JOIN ${TABLE.CATEGORY} AS ic ON ic.id = id.category_id
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
        console.log(error)
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
})

// GET ADDRESS
router.get('/searchaddress/:id?', async (req, res) => {
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
router.post('/searchaddress', async (req, res) => {
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
// GET ADDRESS
router.get('/giftcard/verification/:id?', async (req, res) => {
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
router.post('/giftcard/otpverification/:id?', async (req, res) => {
    try {
        const requestData = await req.body;
        return sendResponse(res, { data: requestData, message: 'OTP Verified successfully', status: true }, 200);
    } catch (error) {
        console.error('Error occurred:', error);
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
})

// CREATE USER 
router.post('/createuser', async (req, res) => {
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
router.get('/searchbymodelnumber/:id', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            const [results] = await pool.query(`
                SELECT 
                ip.*,
                    ip.id AS id, 
                    ip.name AS ptitle, 
                    ip.price AS pbaseprice, 
                    ip.discount_price AS pdiscountprice,
                    id.model_number,
                    GROUP_CONCAT(DISTINCT isn.serial_number) AS serial_numbers,ic.hsn,ic.gstPercentage
                FROM ${MARKETING_TABLE} AS ip 
                LEFT JOIN ${DESIGNER_TABLE} AS id ON id.id = ip.designer_id
                LEFT JOIN ${REPLICATOR} AS ir ON ir.designer_id = id.model_number
                LEFT JOIN ine_serial_number AS isn ON ir.id = isn.replicator_id
                LEFT JOIN ${TABLE.CATEGORY} AS ic ON ic.id = id.category_id
                WHERE id.model_number = ?
                GROUP BY ip.id
            `, [id]);
                       
            if (results.length > 0) {
                return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        const [results] = await pool.query(`SELECT * FROM ${USER_ADDRESS}`);
        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        console.log(error)
        return sendResponse(res, { error: `Error occurred: ${error.message}`, status: false }, 500);
    }
})
// GET COUPON
router.get('/coupons/:id?', async (req, res) => {
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