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
const tableName = TABLE.GIFTCARD_TABLE;
const tableName2 = TABLE.GIFTCARD_CALCULATE_TABLE;
const tableName3 = TABLE.GIFTCARD_GENERATE_TABLE;
const ine_giftcard_ModuleID = TABLE.GIFTCARD_MODULE_ID;
const ine_manage_request_tablename = TABLE.MANAGE_REQUEST;


function generateGiftCardNumber() {
    const randomNumber = Math.floor(Math.random() * (999999999999 - 1) + 1);
    const numberString = randomNumber.toString().padStart(12, '0'); // Ensure the number has 12 digits
    return numberString.replace(/(\d{4})(?=\d)/g, '$1-');
}

async function generateUniqueGiftCardNumber() {
    let giftCardNumber;
    let isUnique = false;
    while (!isUnique) {
        giftCardNumber = generateGiftCardNumber();
        const [existingRecord] = await pool.query(`SELECT * FROM ${tableName3} WHERE gift_card_number = ?`, [giftCardNumber]);
        if (existingRecord.length === 0) {
            isUnique = true;
        }
    }
    return giftCardNumber;
}

function generatePinNumber() {
    const alphanumericCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let pin = '';
    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * alphanumericCharacters.length);
        pin += alphanumericCharacters[randomIndex];
    }
    return pin;
}
// Genrate unique number for gift card 
async function generateUniquePinNumber() {
    let pin_number;
    let isUnique = false;
    while (!isUnique) {
        pin_number = generatePinNumber();
        const [existingRecord] = await pool.query(`SELECT * FROM ${tableName3} WHERE pin_number = ?`, [pin_number]);
        if (existingRecord.length === 0) {
            isUnique = true;
        }
    }
    return pin_number;
}

router.get('/:id?', async (req, res) => {
    try {
        await authenticateToken(req);

        const type = req.query.type;
        const id = req.query.id;

        let conditions = 'status = 1';
        let params = [];

        if (id) {
            conditions += ' AND id = ?';
            params.push(id);
        }

        if (type) {
            conditions += ' AND type = ?';
            params.push(type);
        }

        const query = `SELECT * FROM ${tableName} WHERE ${conditions} ORDER BY id DESC`;
        const [results] = await pool.query(query, params);

        if (results.length > 0) {
            for (const result of results) {
                const [denominationArray] = await pool.query(
                    `SELECT id, denomination as value, multiplication FROM ine_giftcard_calc WHERE status = 0 AND giftcard_id = ?`,
                    [result.id]
                );
                result['Rows'] = denominationArray;
            }
            return sendResponse(res, { data: id ? results[0] : results, message: ManageResponseStatus('fetched'), status: true }, 200);
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
        if (!requestData.type || !requestData.name || !requestData.email) {
            return sendResponse(res, { error: 'Type, Name and Email fields are required', status: false }, 400);
        }

        // Insertion
        const [insertResult] = await pool.query(`INSERT INTO ${tableName} (type, name, company_name, email, description,created_by) VALUES (?, ?, ?, ?, ?,?)`, [
            requestData.type,
            requestData.name,
            requestData.company_name,
            requestData.email,
            requestData.description || null,
            requestData.apihitid || null,
        ]);

        const insertedRecordId = insertResult.insertId;
        const [insertedRecord] = await getRecordById(insertedRecordId, tableName, 'id');

        await pool.query(`INSERT INTO ${ine_manage_request_tablename} (module_id, row_id, request_status, comments, created_by) VALUES (?,?,?,?,?)`, [
            ine_giftcard_ModuleID, insertedRecordId, 1, null, requestData.apihitid
        ]);

        let totalAmount = 0;
        let cardCount = 0;

        let expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        expiryDate.setHours(23, 59, 59, 999);

        if (requestData.type === 1) {
            for (const denomination of requestData.denominations) {
                totalAmount += (denomination.value * denomination.multiplication);
                // cardCount++;
                const [insertResultNew] = await pool.query(`INSERT INTO ${tableName2} (giftcard_id, denomination, multiplication) VALUES (?, ?, ?)`, [
                    insertedRecordId,
                    denomination.value,
                    denomination.multiplication,
                ]);
                cardCount += denomination.multiplication;
            }
        }

        else if (requestData.type === 2) {
            if (!Array.isArray(requestData.csvdata)) {
                return;
            }

            const csvData = requestData.csvdata;
            if (csvData.length > 0 && csvData[0].name === "Name" && csvData[0].email === "Email" && csvData[0].phone === "Phone" && csvData[0].amount === "Amount") {
                csvData.shift(); // Remove the first row
            }

            for (const mydata of csvData) {
                totalAmount += parseFloat(mydata.amount);
                cardCount++;

                await pool.query(`INSERT INTO ${tableName2} (giftcard_id, denomination, multiplication, status) VALUES (?, ?, ?, ?)`, [
                    insertedRecordId,
                    mydata.amount,
                    1,
                    0,
                ]);

            }
        }

        else {
            totalAmount = requestData.amount;
            cardCount = 1;
            await pool.query(`INSERT INTO ${tableName2} (giftcard_id, denomination, multiplication, status) VALUES (?, ?, ?, ?)`, [
                insertedRecordId,
                requestData.amount,
                1,
                0,
            ]);
        }

        let chooseTemplateValue = requestData.type === 2 ? requestData.choose_template : 0;
        await pool.query(`UPDATE ${tableName} SET total_amount = ?, total_giftcard = ?, choose_template = ? WHERE id = ?`, [totalAmount, cardCount, chooseTemplateValue, insertedRecordId]);
        await activityLog(ine_giftcard_ModuleID, null, insertedRecord, 1, 0); // Maintain Activity Log

        return sendResponse(res, { data: insertedRecord[0], message: ManageResponseStatus('created'), status: true }, 201);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


router.put('/:id?', async (req, res) => {
    try {
        await authenticateToken(req);
        const id = req.params.id || req.query.id;
        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }
        
        // Check if the ID exists in the database and retrieve the existing record
        const [existingRecord] = await getRecordById(id, tableName, 'id');
        if (!existingRecord) {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        const { name, company_name, email, description, denominations, type, choose_template, csvdata, amount, apihitid } = await req.body;
        await pool.query(`UPDATE ${tableName} SET name = ?, company_name = ?, email = ?, description = ?,updated_by=?, updated_at = NOW() WHERE id = ?`, [name, company_name, email, description, apihitid, id]);
        // Add New Records
        let totalAmount = 0;
        let cardCount = 0;

        let expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        expiryDate.setHours(23, 59, 59, 999);

        if (type === 1 && denominations) {
            await pool.query(`UPDATE ${tableName2} SET status = 1, deleted_at = NOW() WHERE giftcard_id IN (?)`, [id]);
            await pool.query(`UPDATE ${tableName3} SET status = 1, deleted_at = NOW() WHERE giftcard_id IN (?)`, [id]);
            for (const denomination of denominations) {
                const [insertResultNew] = await pool.query(`INSERT INTO ${tableName2} (giftcard_id, denomination, multiplication) VALUES (?, ?, ?)`, [
                    id,
                    denomination.value,
                    denomination.multiplication,
                ]);
                const insertedRecordIdNew = insertResultNew.insertId;

                for (let i = 0; i < denomination.multiplication; i++) {
                    totalAmount += denomination.value;
                    cardCount++;
                    /*const giftCardNumber = await generateUniqueGiftCardNumber();
                    const pin_number = await generateUniquePinNumber();
                    await pool.query(`INSERT INTO ${tableName3} (giftcard_id, giftcard_calc_id, gift_card_number,pin_number, amount, expiry_date, name, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        id,
                        insertedRecordIdNew,
                        giftCardNumber,
                        pin_number,
                        denomination.value,
                        expiryDate,
                        '',
                        '',
                        ''
                    ]);*/
                }

            }
        } else if (type === 2 && csvdata) {
            await pool.query(`UPDATE ${tableName2} SET status = 1, deleted_at = NOW() WHERE giftcard_id IN (?)`, [id]);
            await pool.query(`UPDATE ${tableName3} SET status = 1, deleted_at = NOW() WHERE giftcard_id IN (?)`, [id]);
            if (typeof csvdata[Symbol.iterator] === 'function') {

                if (!Array.isArray(csvdata)) {
                    return;
                }

                const csvData = csvdata;
                if (csvData.length > 0 && csvData[0].name === "Name" && csvData[0].email === "Email" && csvData[0].phone === "Phone" && csvData[0].amount === "Amount") {
                    csvData.shift(); // Remove the first row
                }

                for (const mydata of csvData) {
                    totalAmount += parseFloat(mydata.amount);
                    cardCount++;
    
                    await pool.query(`INSERT INTO ${tableName2} (giftcard_id, denomination, multiplication, status) VALUES (?, ?, ?, ?)`, [
                        id,
                        mydata.amount,
                        1,
                        0,
                    ]);
                }

                /*for (const mydata of csvData) {
                    const giftCardNumber = await generateUniqueGiftCardNumber();
                    totalAmount += parseFloat(mydata.amount);
                    cardCount++;

                    await pool.query(`INSERT INTO ${tableName3} (giftcard_id, giftcard_calc_id, gift_card_number, amount, expiry_date, name, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                        id,
                        0,
                        giftCardNumber,
                        mydata.amount,
                        expiryDate,
                        mydata.name,
                        mydata.email,
                        mydata.phone
                    ]);
                }*/

            }
        } else if (type === 3) {
            await pool.query(`UPDATE ${tableName2} SET status = 1, deleted_at = NOW() WHERE giftcard_id IN (?)`, [id]);
            await pool.query(`UPDATE ${tableName3} SET status = 1, deleted_at = NOW() WHERE giftcard_id IN (?)`, [id]);
            const giftCardNumber = await generateUniqueGiftCardNumber();
            totalAmount = amount;
            cardCount = 1;

            await pool.query(`INSERT INTO ${tableName2} (giftcard_id, denomination, multiplication, status) VALUES (?, ?, ?, ?)`, [
                id,
                amount,
                1,
                0,
            ]);

            /*await pool.query(`INSERT INTO ${tableName3} (giftcard_id, giftcard_calc_id, gift_card_number, amount, expiry_date) VALUES (?, ?, ?, ?, ?)`, [
                id,
                0,
                giftCardNumber,
                amount,
                expiryDate
            ]);*/
        }

        let chooseTemplateValue = type === 2 ? choose_template : 0;
        await pool.query(`UPDATE ${tableName} SET total_amount = ?, total_giftcard = ?, choose_template = ? WHERE id = ?`, [totalAmount, cardCount, chooseTemplateValue, id]);
        
        // Retrieve the updated record
        const [updatedRecord] = await getRecordById(id, tableName, 'id');

        await activityLog(ine_giftcard_ModuleID, existingRecord, updatedRecord, 2, 0); // Maintain Activity Log

        return sendResponse(res, { data: updatedRecord, message: ManageResponseStatus('updated'), status: true }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.delete('/:id?', async (req, res) => {
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

router.get('/fetchgiftcarddetails/:id?', async (req, res) => {
    try {
        await authenticateToken(req);
        const url = req.url;
        if (!url) {
            return sendResponse(res, { error: 'URL is missing', status: false }, 400);
        }
        try {
            // const id = new URL(url).searchParams.get('id');
            const id = req.params.id || req.query.id;
            if (!id) {
                return sendResponse(res, { error: 'ID is missing', status: false }, 400);
            }
            // Query the first table (t1) and join with the second table (t2)
            const [results] = await pool.query(`
                SELECT t1.*, t2.denomination AS value, t2.multiplication
                FROM ${tableName} AS t1
                LEFT JOIN ${tableName2} AS t2 ON t1.id = t2.giftcard_id
                WHERE t1.id = ? AND t1.status = 1 and t2.status = 0
                ORDER BY t1.id DESC`, [id]);
            if (results.length > 0) {
                const responseData = { ...results[0] };
                const secondTableData = results.map(result => ({
                    denomination: result.value,
                    multiplication: result.multiplication
                }));
                responseData['Rows'] = secondTableData;
                for (const result of results) {
                    // Fetch data from the third table where the IDs match
                    const [thirdTableData] = await pool.query(`
                        SELECT *
                        FROM ine_giftcard_generate
                        WHERE giftcard_id = ? AND giftcard_calc_id IN (
                            SELECT id
                            FROM ine_giftcard_calc
                            WHERE giftcard_id = ?
                        )
                    `, [result.id, result.id]);
                    // Add the fetched data to the result object under the 'giftcards' key
                    responseData['giftcards'] = thirdTableData;
                }
                // Return the response
                return sendResponse(res, { data: responseData, message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        } catch (error) {
            return sendResponse(res, { error: `Error parsing URL: ${error.message}`, status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.get('/coupons/:id?', async (req, res) => {
    try {
        const url = req.url;
        if (!url) {
            return sendResponse(res, { error: 'URL is missing', status: false }, 400);
        }
        try {
            const id = req.params.id || req.query.id;
            let condition = id ? 'AND giftcard_id = ?' : '';
            let params = id ? [id] : [];
            const [results] = await pool.query(`SELECT * FROM ${tableName3} WHERE status = 0  ${condition} ORDER BY id DESC`, params);
            if (results.length > 0) {
                return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        } catch (error) {
            return sendResponse(res, { error: `Error parsing URL: ${error.message}`, status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


module.exports = router;