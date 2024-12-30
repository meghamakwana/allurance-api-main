const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const mysql = require('mysql2/promise');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, checkEmailExistOrNot, checkPhoneExistOrNot, processDocuments, activityLog, generateUniqueUserId } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');
const router = express.Router();

// Table Name
const tableName = TABLE.PACKERS;
const ine_packers_ModuleID = TABLE.PACKER_MODULE_ID
const ine_manage_request_tablename = TABLE.MANAGE_REQUEST
const tableName2 = TABLE.REPLICATOR;
const tableName3 = TABLE.SERIAL_NUMBER;
const tablepacker = TABLE.PACKERS_BOXES
const tableName4 = TABLE.CARTON_ELEMENTS
const tableName5 = TABLE.PACKER_CARTONS
const tableName6 = TABLE.DESIGNER
const tableName7 = TABLE.CATEGORY
const serial_verification = TABLE.SERIAL_VERIFICATION

// BOX PACK
router.get('/boxpack/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            const queryWithId = `
                SELECT
                    ip.*
                FROM ${tablepacker} AS ip
                    WHERE
                    ip.id = ? AND ip.is_packed = 1;
            `
            const [resultsWithId] = await pool.query(queryWithId, [id]);
            return sendResponse(res, { data: resultsWithId, message: ManageResponseStatus('fetched'), status: true }, 200)
        }

        const queryWithoutId = `
            SELECT
                ip.*
            FROM
                ${tablepacker} AS ip
                WHERE
                ip.is_packed = 1;
        `;
        const [resultsWithoutId] = await pool.query(queryWithoutId);
        return sendResponse(res, { data: resultsWithoutId, message: ManageResponseStatus('fetched'), status: true, count: resultsWithoutId.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// MANAGE BOX PACK - LISTS
router.get('/manage_boxpack/:box_id?', async (req, res) => {
    try {
        const { box_id } = req.params;

        // Step 1: Fetch unique box_id with their count
        let query = `
            SELECT mb.box_id, COUNT(mb.request_id) AS record_count 
            FROM ine_manage_box mb 
            LEFT JOIN ine_packers_boxes pb ON mb.request_id = pb.title
        `;
        let queryParams = [];

        if (box_id) {
            query += `WHERE mb.box_id = ? GROUP BY mb.box_id`;
            queryParams.push(box_id);
        } else {
            query += `GROUP BY mb.box_id`;
        }

        const [boxIds] = await pool.query(query, queryParams);

        // Step 2: Fetch details for each box_id with join and add them to the result
        const results = await Promise.all(boxIds.map(async (box) => {
            const [records] = await pool.query(`SELECT imb.box_id, imb.request_id, imb.created_at, imb.status, ipb.serial_number_id, ipb.authenticity_number, isn.serial_number, isn.l_serial_number, 
                isn.r_serial_number, isn.batch_sequence_no, isn.replicator_id, ir.designer_id as model_no, id.category_id, id.bezel_material_id, ibm.name as metal_name, ic.name as category_name FROM ine_manage_box as imb
            LEFT JOIN ine_packers_boxes as ipb on ipb.title = imb.request_id
            LEFT JOIN ine_serial_number as isn on isn.id = ipb.serial_number_id
            LEFT JOIN ine_replicator as ir on ir.id = isn.replicator_id
            LEFT JOIN ine_designer as id on id.model_number = ir.designer_id 
            LEFT JOIN ine_bezel_material as ibm on ibm.id = id.bezel_material_id
            LEFT JOIN ine_category as ic on ic.id = id.category_id
            WHERE imb.box_id = ?`, [box.box_id]);

            return {
                box_id: box.box_id,
                record_count: box.record_count,
                records: records
            };
        }));

        return sendResponse(res, {
            data: results,
            message: ManageResponseStatus('fetched'),
            status: true,
            count: results.length
        }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// BOX PACK REPORT
router.post('/boxpack/report/:id?', async (req, res) => {
    try {
        await authenticateToken(req);
        const [groupedResults] = await pool.query(`SELECT ipb.title, ipb.created_at, COUNT(*) AS record_count, isn.batch_sequence_no as batch_number, isn.replicator_id, r.designer_id as model_number, d.category_id, c.name as category_title FROM ${tablepacker} as ipb 
            LEFT JOIN ${tableName3} as isn ON isn.id = ipb.serial_number_id 
            LEFT JOIN ${tableName2} as r on r.id = isn.replicator_id
            LEFT JOIN ${tableName6} as d on d.model_number = r.designer_id
            LEFT JOIN ${tableName7} as c on c.id = d.category_id
            GROUP BY ipb.title`);

        for (let i = 0; i < groupedResults.length; i++) {
            const [detailedRecords] = await pool.query(`SELECT tp.*, isn.serial_number FROM ${tablepacker} as tp 
                LEFT JOIN ${tableName3} as isn on isn.id = tp.serial_number_id 
                WHERE tp.title = ?`, [groupedResults[i].title]);
            groupedResults[i].records = detailedRecords;
        }

        return sendResponse(res, { data: groupedResults, message: ManageResponseStatus('Record Successfully Fetched'), status: true, count: groupedResults.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// CARTON PACK
router.get('/cartonpack/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;

        if (id) {
            const queryWithId = `
                SELECT
                    ip.*,
                    (SELECT COUNT(*) FROM ${tableName4} WHERE carton_id = ip.id) AS totalCount
                FROM
                    ${tableName5} AS ip
                WHERE
                    ip.id = ?;
            `;
            const [resultsWithId] = await pool.query(queryWithId, [id, id]);
            return sendResponse(res, { data: resultsWithId, message: ManageResponseStatus('fetched'), status: true }, 200);
        }

        const queryWithoutId = `
            SELECT
                ip.*,
                (SELECT COUNT(*) FROM ${tableName4} WHERE carton_id = ip.id) AS totalCount
            FROM
                ${tableName5} AS ip
        `;
        const [resultsWithoutId] = await pool.query(queryWithoutId);
        return sendResponse(res, { data: resultsWithoutId, message: ManageResponseStatus('fetched'), status: true, count: resultsWithoutId.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// CARTON PACK
router.get('/cartonpack-old/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;

        if (id) {
            const queryWithId = `
                SELECT
                    ip.*,
                    (SELECT COUNT(*) FROM ${tableName4} WHERE box_id = ?) AS totalCount
                FROM
                    ${tableName} AS ip
                WHERE
                    ip.id = ?;
            `;
            const [resultsWithId] = await pool.query(queryWithId, [id, id]);
            return sendResponse(res, { data: resultsWithId, message: ManageResponseStatus('fetched'), status: true }, 200);
        }

        const queryWithoutId = `
            SELECT
                ip.*,
                (SELECT COUNT(*) FROM ${tableName4} WHERE carton_id = ip.id) AS totalCount
            FROM
                ${tableName} AS ip
        `;
        const [resultsWithoutId] = await pool.query(queryWithoutId);
        return sendResponse(res, { data: resultsWithoutId, message: ManageResponseStatus('fetched'), status: true, count: resultsWithoutId.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.get('/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            const queryWithId = `
                SELECT
                    ip.*,
                    r.designer_id AS model_number,
                    r.batch_number,
                    r.quantity
                FROM
                    ${tableName} AS ip
                LEFT JOIN
                    ${tableName2} AS r ON ip.replicator_id = r.id
                WHERE
                    ip.id = ?;
            `;
            const [resultsWithId] = await pool.query(queryWithId, [id]);
            if (resultsWithId) {
                // Fetch data from tableName3 for the provided id
                const queryTable3 = `
                    SELECT *
                    FROM ${tableName3} 
                    WHERE replicator_id = ? AND is_packed =1;
                `;
                const [resultsTable3] = await pool.query(queryTable3, [resultsWithId?.replicator_id]);

                // Add results from tableName3 to resultsWithId
                resultsWithId.serialnumbers = resultsTable3;
                return sendResponse(res, { data: resultsWithId, message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        const queryWithoutId = `
            SELECT
                ip.*,
                r.designer_id AS model_number,
                r.batch_number,
                r.quantity
            FROM
                ${tableName} AS ip
            LEFT JOIN
                ${tableName2} AS r ON ip.replicator_id = r.id;
        `;
        const [resultsWithoutId] = await pool.query(queryWithoutId);
        return sendResponse(res, { data: resultsWithoutId, message: ManageResponseStatus('fetched'), status: true, count: resultsWithoutId.length }, 200);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


router.post('/', async (req, res) => {
    try {
        const requestData = await req.body;

        // Validate request data
        if (!requestData.title || !requestData.status) {
            return sendResponse(res, { error: 'Title and status fields are required', status: false }, 400);
        }

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (title, status) VALUES (?, ?)`, [
            requestData.title,
            requestData.status
        ]);

        const insertedRecordId = insertResult.insertId;
        const [insertedRecord] = await getRecordById(insertedRecordId, tableName, 'id'); // Retrieve the inserted record

        await activityLog(ine_packers_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (!id) {
            return sendResponse({ error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }

        const requestData = await req.body;
        const { title, status } = requestData;

        // Check if the ID exists in the database and retrieve the existing record
        const [existingRecord] = await getRecordById(id, tableName, 'id');

        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

        // Update the record with the provided data
        await pool.query(`UPDATE ${tableName} SET title = ?, status = ?, updated_at = NOW() WHERE id = ?`, [title, status, id]);

        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, tableName, 'id');

        // Maintain Activity Log
        await activityLog(ine_packers_ModuleID, existingRecord, updatedRecord, 2, 0);

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



// BOX PACK 
router.post('/boxpack', async (req, res) => {
    try {
        const { products } = await req.body;
        if (!Array.isArray(products)) {
            return sendResponse(res, { error: 'Products must be an array', status: false }, 400);
        }
        const createdBoxes = [];

        // Generate Customer ID
        const boxId = await generateUniqueUserId();

        for (const product of products) {
            // Check if required fields are present in each product
            const { authenticity_card, serial_number, product_id } = product;
            if (!authenticity_card || !serial_number || !product_id) {
                return sendResponse(res, { error: 'All fields are required for each product', status: false }, 400);
            }

            const insertProductQuery = `INSERT INTO ${tablepacker} (title, authenticity_number, serial_number_id) VALUES (?, ?, ?)`;
            const [insertResult] = await pool.query(insertProductQuery, [
                boxId,
                authenticity_card,
                product_id
            ]);

            const updateStatusQuery = `UPDATE ${tableName3} SET is_packed = ? WHERE id = ?`;
            await pool.query(updateStatusQuery, [2, product_id]);
            const [existingRecord] = await pool.query(`
                SELECT 
                  t3.id,
                  t3.serial_number,
                  t3.l_serial_number,
                  t3.r_serial_number,
                  t3.batch_sequence_no,
                  d.model_number,
                  c.name AS category_name,
                  p.price,
                  ibm.name as metal_name,
                  p.discount_price,
                  p.weight
                FROM 
                  ${tableName3} t3
                LEFT JOIN 
                  ine_replicator r ON t3.replicator_id = r.id
                LEFT JOIN 
                  ine_designer d ON r.designer_id = d.model_number
                LEFT JOIN
                  ine_bezel_material ibm ON d.bezel_material_id = ibm.id
                LEFT JOIN 
                  ine_category c ON d.category_id = c.id
                LEFT JOIN 
                  ine_products p ON d.id = p.designer_id
                WHERE 
                  t3.id = ?;
              `, [product_id]);

            // Prepare the box object
            const box = {
                ...product,
                id: existingRecord[0].id,
                serial_number: existingRecord[0].serial_number,
                l_serial_number: existingRecord[0].l_serial_number,
                r_serial_number: existingRecord[0].r_serial_number,
                batch_number: existingRecord[0].batch_sequence_no,
                model_number: existingRecord[0].model_number,
                category_name: existingRecord[0].category_name,
                metal_name: existingRecord[0].metal_name,
                price: existingRecord[0].price !== null && existingRecord[0].price !== undefined ? existingRecord[0].price : 0,
                discount_price: existingRecord[0].discount_price !== null && existingRecord[0].discount_price !== undefined ? existingRecord[0].discount_price : 0,
                weight: existingRecord[0].weight // Add more resources as needed
            };
            // Add the created box object to the response array
            createdBoxes.push(box);
        }

        // Prepare and send the response with all created boxes
        return sendResponse(res, { data: createdBoxes, message: `${createdBoxes.length} boxes created successfully`, status: true }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

async function isUniqueRandomString(randomString) {
    const [existingRecord] = await pool.query(`SELECT * FROM  ${tableName3} WHERE authentication_key = ?`, [randomString]);
    return !existingRecord;
}

async function generateUniqueRandomString() {
    let randomString;
    do {
        randomString = generateRandomString(8);
    } while (!(await isUniqueRandomString(randomString)));
    return randomString;
}

// CARTON PACK API 
router.post('/cartonpack', async (req, res) => {
    try {
        await authenticateToken(req);
        const requestData = await req.body;
        if (!requestData.title) {
            return sendResponse(res, { error: 'Title field required', status: false }, 400);
        }
        if (!requestData.boxIds || requestData.boxIds.length === 0) {
            return sendResponse(res, { error: 'At least one box must be selected', status: false }, 400);
        }
        const [insertResult] = await pool.query(`INSERT INTO ${tableName5} (title) VALUES (?)`, [
            requestData.title
        ]);
        const insertedRecordId = insertResult.insertId;
        for (const boxId of requestData.boxIds) {
            // Insert box ID along with the ID of the inserted record into the secondary table
            await pool.query(`INSERT INTO ${tableName4} (carton_id, box_id) VALUES (?, ?)`, [
                insertedRecordId,
                boxId
            ]);
            await pool.query(`UPDATE ${tablepacker} SET is_packed = 2 WHERE id = ?`, [boxId]);
        }
        const [insertedRecord] = await pool.query(`SELECT * FROM ${tableName5} WHERE id=?`, [insertedRecordId])
        await activityLog(ine_packers_ModuleID, null, insertResult, 1, 0);
        return sendResponse(res, { data: insertedRecord, message: ManageResponseStatus('created'), status: true }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});



// PACKERS VERIFICATION
router.post('/verification', async (req, res) => {
    try {
        await authenticateToken(req);
        const requestData = await req.body;
        if (!Array.isArray(requestData.authenticationdetails) || requestData.authenticationdetails.length === 0) {
            return sendResponse(res, {
                error: 'Authenticationdetails fields are required, and authenticationdetails must be a non-empty array',
                status: false
            }, 400);
        }
        const { batch_number, authenticationdetails } = requestData;
        const responses = [];
        for (const serialNumberObj of authenticationdetails) {
            const { index, serialNumber, batchNumber } = serialNumberObj;
            if (!serialNumber || !batchNumber) {
                responses.push({
                    index,
                    serialNumber,
                    status: false,
                    message: 'Each serial number object must include index, serialNumber, and batchNumber.'
                });
                continue;
            }
            const [results] = await pool.query(
                `SELECT * FROM ${tableName3} WHERE (serial_number = ? OR RIGHT(serial_number, 6) = ?) AND batch_sequence_no = ?`,
                [serialNumber, serialNumber, batchNumber]
            );

            if (results && results.length > 0) {
                const existingRecord = results[0];
                const productId = existingRecord.id;
                let status;
                let authKey = null;

                if (existingRecord.is_packed === 1) {
                    let isUnique = false;
                    while (!isUnique) {
                        authKey = generateRandomAuthKey();
                        
                        const [authRecord] = await pool.query(`SELECT * FROM ${tablepacker} WHERE authenticity_number = ?`, [authKey]);
                        if (authRecord.length === 0) {
                            isUnique = true;
                        }
                    }
                    status = 1;
                } else if (existingRecord.is_packed === 2) {
                    status = 2;
                } else {
                    status = 0;
                }

                responses.push({
                    index,
                    serialNumber,
                    status,
                    authKey,
                    productId,
                    message: status === 1 ? 'The product is genuine' : (status === 2 ? 'The product is genuine but already packed' : 'Invalid product status')
                });
            } else {
                responses.push({
                    index,
                    serialNumber,
                    status: 3,
                    message: 'Authentication failed: serial number or batch number is invalid'
                });
            }
        }

        for (const response of responses) {
            await pool.query(
                `INSERT INTO ${serial_verification} (serial_number, batch_number, auth_status) VALUES (?, ?, ?)`,
                [response.serialNumber, batch_number, response.status]  // Make sure these columns match your table schema
            );
        }

        const successfulResponses = responses.filter(response => response.status === 1);
        return sendResponse(res, {
            data: successfulResponses,
            status: true,
            message: 'Processed all serial numbers'
        }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


const generateRandomAuthKey = () => {
    const characters = '0123456789'; //'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 16;
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

// Get Serial Number Based On Batch Number
router.get('/getsrnobasedonbatch/:batchid', async (req, res) => {
    try {
        const batchid = req.params.batchid || req.query.batchid;
        const [query1] = await pool.query(`SELECT * FROM ${tableName3} WHERE batch_sequence_no = ?`, [batchid])
        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true }, 200);
        }
        return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// MANAGE BOX PACK - VERIFY REQUEST ID
router.post('/manage_boxpack_verify_request', async (req, res) => {
    try {
        // await authenticateToken(req);
        const { request_id } = req.body;
        const [checkResult] = await pool.query(`SELECT * FROM ine_packers_boxes WHERE title = ?`, [request_id]);
        if (checkResult.length === 0 || checkResult[0].status === 0) {
            return sendResponse(res, { data: [], message: 'Sorry, Request ID does not exist', status: false }, 400);
        } else {
            return sendResponse(res, { data: [{'request_id': request_id}], message: 'Request id exist', status: true }, 200);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// MANAGE BOX PACK - ADD
router.post('/manage_boxpack_add', async (req, res) => {
    try {
        // await authenticateToken(req);
        const { request_ids } = req.body;
        if (!Array.isArray(request_ids)) {
            return sendResponse(res, { error: 'request_ids must be an array', status: false }, 400);
        }
        const boxId = await generateUniqueUserId();
        const validRequestIds = [];
        for (const request_id of request_ids) {
            const [checkResult] = await pool.query(`SELECT status FROM ine_manage_box WHERE request_id = ?`, [request_id]);
            if (checkResult.length === 0 || checkResult[0].status === 0) {
                await pool.query(`INSERT INTO ine_manage_box (box_id, request_id, created_at) VALUES (?, ?, NOW())`, [boxId, request_id]);
                validRequestIds.push(request_id);
            } else {
                return sendResponse(res, { data: [], message: 'Data already exists or something is wrong', status: false }, 400);
            }
        }
        const responseData = { box_id: boxId, request_ids: validRequestIds };
        return sendResponse(res, { data: [responseData], message: `${validRequestIds.length} boxes created successfully`, status: true }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});



module.exports = router;