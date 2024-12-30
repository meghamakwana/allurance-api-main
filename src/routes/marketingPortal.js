const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const path = require('path');
// const multer = require('multer');
const mysql = require('mysql2/promise');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, checkEmailExistOrNot, checkPhoneExistOrNot, processDocuments, activityLog, writeVideoToFile, writeImageToFile, uploadToAzureBlob, checkFileType, initRequestforAdmin } = require('../commonFunctions');
const { authenticateToken } = require('../utils/authMiddleware');

const multer = require("multer");

// LINKS FOR THE STORAGE UPLOAD
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

const router = express.Router();

// LINKS FOR THE STORAGE UPLOAD 
// const storage = multer.memoryStorage(); // Store files in memory for aws 
// this is for folder
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, 'public/uploads/'); 
//     },
//     filename: function (req, file, cb) {
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//     }
// });
// const upload = multer({ storage: storage });

// Table Name
const tableName = TABLE.DESIGNER;
const tableName2 = TABLE.MARKETING_PENDING;
const module_id = TABLE.MARKETING_MODULE_ID;
const ine_manage_request_tablename = TABLE.MANAGE_REQUEST;


router.get('/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;

        const baseQuery = `
            SELECT 
                t1.*, 
                COALESCE(t2.status, 0) AS marketing_product_record_status,
                t3.name AS category_name,
                t4.name AS resin_name,
                t5.shape AS shape_name,
                t6.length AS size_length,
                t6.breadth AS size_breadth,
                t7.name AS bezel_material_name,
                t8.name AS bezel_color_name,
                t9.name AS inner_material_name,
                t10.name AS flower_name,
                t11.name AS color_name,
                t2.created_at as created_at, t2.id as t2id
            FROM ${tableName} t1
            LEFT JOIN ${tableName2} t2 ON t1.id = t2.designer_id
            LEFT JOIN ine_category t3 ON t1.category_id = t3.id
            LEFT JOIN ine_resin t4 ON t1.resin_id = t4.id
            LEFT JOIN ine_shape t5 ON t1.shape_id = t5.id
            LEFT JOIN ine_size_for_shape t6 ON t1.size_id = t6.id
            LEFT JOIN ine_bezel_material t7 ON t1.bezel_material_id = t7.id
            LEFT JOIN ine_bezel_color t8 ON t1.bezel_color_id = t8.id
            LEFT JOIN ine_inner_material t9 ON t1.inner_material_id = t9.id
            LEFT JOIN ine_flower t10 ON t1.flower_id = t10.id
            LEFT JOIN ine_color_shade t11 ON t1.color_id = t11.id
            WHERE t1.record_status = 2 AND t1.status = 1`;

        if (id) {
            const query1 = `SELECT * from ${tableName2} where id = ? ORDER BY id DESC`;
            const [results] = await pool.query(query1, [id]);
            if (results.length > 0) {
                const foundRecord = results[0];
                const marketingId = foundRecord.id;
                const [results2] = await pool.query(`SELECT * from ${tableName2} where id = ?`, [marketingId]);

                const q2 = `${baseQuery} and t1.id = ? ORDER BY id DESC LIMIT 1`;
                const [r2] = await pool.query(q2, [foundRecord.designer_id]);
                results2[0].design_information = r2[0];

                const [results3] = await pool.query(`SELECT * from ${TABLE.MARKETING_PENDING_META_TABLE} where ine_marketing_pending_id = ? and status = 1`, [marketingId]);
                if (results3.length > 0) {
                    // results2[0].files = results3.map(media => media.file_url);
                    results2[0].files = results3.map(media => ({
                        id: media.id,
                        file: media.file_url  // File URL path
                    }));
                } else {
                    results2[0].files = [];
                }

                /*
                const query2 = `SELECT * from ${TABLE.MARKETING_MEDIA_TABLE} where ine_marketing_pending_id = ? AND created_at = (
                    SELECT MAX(created_at) 
                    FROM ${TABLE.MARKETING_MEDIA_TABLE} 
                    WHERE ine_marketing_pending_id = ? AND meta_key = 'image')`;
                const [metaResults] = await pool.query(query2, [marketingId, marketingId]);

                metaResults.forEach(result => {
                    foundRecord[result.meta_key] = result.meta_value;
                });

                const imageQuery = `
                SELECT meta_value 
                FROM ${TABLE.MARKETING_MEDIA_TABLE} 
                WHERE ine_marketing_pending_id = ? 
                  AND (meta_key = 'image' OR meta_key = 'video')
                  AND created_at = (
                    SELECT MAX(created_at) 
                    FROM ${TABLE.MARKETING_MEDIA_TABLE} 
                    WHERE ine_marketing_pending_id = ? 
                      AND (meta_key = 'image' OR meta_key = 'video')
                  )`;
                const [imageResults] = await pool.query(imageQuery, [marketingId, marketingId]);
                const imagePaths = imageResults.map(result => result.meta_value);
                if (imagePaths.length > 0) {
                    foundRecord.images = imagePaths;
                }
                */

                return sendResponse(res, { data: results2[0], message: ManageResponseStatus('fetched'), status: true }, 200);
            } else {
                return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
            }
        } else {

            const query2 = `${baseQuery} ORDER BY id DESC`;
            const [results] = await pool.query(query2);
            if (results.length > 0) {
                return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
            } else {
                return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
            }
        }
    } catch (error) {
        // console.error("Error occurred:", error.message);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

router.post('/', upload.any(), async (req, res) => {
    try {
        const requestData = await req.body;

        if (!req.files || req.files.length === 0) {
            throw new Error('No files uploaded');
        }

        // Insert into database
        const [insertResult] = await pool.query(
            `INSERT INTO ${TABLE.MARKETING_PENDING} 
            (designer_id, title, base_price, retail_price, bulk_price, weight, description, collection, similar_options, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
            [
                requestData.designer_id || '',
                requestData.name || '',
                requestData.base_price || 0,
                requestData.retail_price || 0,
                requestData.bulk_price || 0,
                requestData.weight || 0,
                requestData.description || '',
                requestData.collection || '',
                requestData.similar_options || '',
                requestData.user_id || '',
            ]
        );
        const insertedRecordId = insertResult.insertId;

        if (req.files.length > 0) {
            const fileUploadPromises = req.files.map(async (file) => {
                const fileUrl = await uploadToAzureBlob(file);
                return pool.query(`INSERT INTO ${TABLE.MARKETING_PENDING_META_TABLE} (designer_id, ine_marketing_pending_id, media_type, file_url, user_id) VALUES (?, ?, ?, ?, ?)`, [requestData.designer_id, insertedRecordId, '', fileUrl, requestData.user_id]);
            });
            await Promise.all(fileUploadPromises);
        }

        await initRequestforAdmin({ module_id, insertedRecordId });

        // Send success response
        return sendResponse(res, { data: { id: insertedRecordId }, message: 'Data inserted successfully', status: true }, 200);
    } catch (error) {
        console.error('Error occurred:', error.message);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});



// router.put('/:id', upload.array('files'), async (req, res) => {
//     try {
//         const id = req.params.id;
//         const requestData = req.body;

//         // Check if files were uploaded
//         if (!req.files || req.files.length === 0) {
//             throw new Error('No files uploaded');
//         }

//         // Extract file information and upload to Azure Blob Storage
//         const fileRecords = await Promise.all(req.files.map(async (file) => {
//             const fileType = file.mimetype.startsWith('video') ? 'video' : 'image';
//             const blobName = await uploadToAzureBlob(file);
//             return {
//                 type: fileType,
//                 blobName,
//                 path: file.path // If you still need to save the local path
//             };
//         }));

//         // Update the record in the database
//         await pool.query(
//             `UPDATE ${tableName2} SET 
//             similar_options = ?, 
//             designer_id = ?, 
//             title = ?, 
//             base_price = ?, 
//             retail_price = ?, 
//             bulk_price = ?, 
//             weight = ?, 
//             description = ?, 
//             collection = ?, 
//             record_status = ?, 
//             updated_by = ?, 
//             updated_at = NOW(), 
//             status = ? 
//             WHERE id = ?`,
//             [
//                 requestData.similar_options || '',
//                 requestData.designer_id || '',
//                 requestData.name || '',
//                 requestData.base_price || '',
//                 requestData.retail_price || '',
//                 requestData.bulk_price || '',
//                 requestData.weight || '',
//                 requestData.description || '',
//                 requestData.collection || '',
//                 1,
//                 requestData.user_id || '',
//                 1,
//                 id
//             ]
//         );

//         // Save file records in the database
//         for (const fileRecord of fileRecords) {
//             await insertMetaData(id, fileRecord.type, fileRecord.blobName);
//         }

//         // Additional metadata update
//         await insertMetaData(id, 'update', 1);
//         for (const [key, value] of Object.entries(requestData)) {
//             if (key !== 'designer_id' && key !== 'user_id' && key !== 'files' && key !== 'id') {
//                 await insertMetaData(id, key, value);
//             }
//         }

//         // Insert into management request table
//         await pool.query(`INSERT INTO ${ine_manage_request_tablename} (module_id, row_id, request_status, comments, created_by) VALUES (?,?,?,?,?)`, [
//             module_id, id, 1, null, 1
//         ]);

//         // Send success response
//         return sendResponse(res, { message: 'Data updated successfully', status: true }, 200);
//     } catch (error) {
//         console.error('Error occurred:', error.message);
//         return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
//     }
// });


router.put('/:id', upload.any(), async (req, res) => {
    try {
        const id = req.params.id;
        const requestData = req.body;

        const [results] = await pool.query(`SELECT * from ${tableName2} where id = ?`, [id]);
        const mrkpdgstatus = results[0].status;

        if (mrkpdgstatus == 1) {

            const [insertResult] = await pool.query(
                `INSERT INTO ${TABLE.MARKETING_PENDING} 
                (designer_id, title, base_price, retail_price, bulk_price, weight, description, collection, similar_options, created_by, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?)`,
                [
                    requestData.designer_id || '',
                    requestData.name || '',
                    requestData.base_price || 0,
                    requestData.retail_price || 0,
                    requestData.bulk_price || 0,
                    requestData.weight || 0,
                    requestData.description || '',
                    requestData.collection || '',
                    requestData.similar_options || '',
                    requestData.user_id || '',
                    2
                ]
            );
            const insertedRecordId = insertResult.insertId;

            if (req.files.length > 0) {
                const fileUploadPromises = req.files.map(async (file) => {
                    const fileUrl = await uploadToAzureBlob(file);
                    return pool.query(`INSERT INTO ${TABLE.MARKETING_PENDING_META_TABLE} (designer_id, ine_marketing_pending_id, media_type, file_url, user_id) VALUES (?, ?, ?, ?, ?)`, [requestData.designer_id, insertedRecordId, '', fileUrl, requestData.user_id]);
                });
                await Promise.all(fileUploadPromises);
            }

        } else {

            // Update the record in the database
            await pool.query(
                `UPDATE ${TABLE.MARKETING_PENDING} SET 
            similar_options = ?, 
            designer_id = ?, 
            title = ?, 
            base_price = ?, 
            retail_price = ?, 
            bulk_price = ?, 
            weight = ?, 
            description = ?, 
            collection = ?, 
            status = ?, 
            updated_by = ?, 
            updated_at = NOW()
            WHERE id = ?`,
                [
                    requestData.similar_options || '',
                    requestData.designer_id || '',
                    requestData.name || '',
                    requestData.base_price || 0,
                    requestData.retail_price || 0,
                    requestData.bulk_price || 0,
                    requestData.weight || 0,
                    requestData.description || '',
                    requestData.collection || '',
                    2,
                    requestData.user_id || '',
                    id
                ]
            );

            if (req.files.length > 0) {
                const fileUploadPromises = req.files.map(async (file) => {
                    const fileUrl = await uploadToAzureBlob(file);
                    return pool.query(`INSERT INTO ${TABLE.MARKETING_PENDING_META_TABLE} (designer_id, ine_marketing_pending_id, media_type, file_url, user_id) VALUES (?, ?, ?, ?, ?)`, [requestData.designer_id, id, '', fileUrl, requestData.user_id]);
                });
                await Promise.all(fileUploadPromises);
            }

        }

        const [results1] = await pool.query(`SELECT * from ${tableName2} where designer_id = ? ORDER BY ID ASC LIMIT 1`, [results[0].designer_id]);
        await pool.query(`UPDATE ${TABLE.MANAGE_REQUEST} SET request_status = 1, updated_at = NOW() WHERE module_id = 94 and row_id = ?`, [results1[0].id]);

        // Additional metadata update (if needed)
        // await initRequestforAdmin({ module_id, id });

        // Send success response
        return sendResponse(res, { message: 'Data updated successfully', status: true }, 200);
    } catch (error) {
        // console.error('Error occurred:', error.message);
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

// Function to determine the file type based on the file preview URL or data
function determineFileType(file) {
    if (file.preview && file.preview.includes('.mp4')) {
        return 'video';
    } else if (file.preview && (file.preview.includes('.png') || file.preview.includes('.jpg') || file.preview.includes('.jpeg'))) {
        return 'image';
    } else if (file.imageData) {
        // You can implement more sophisticated checks here based on the imageData content
        return 'image'; // Assume it's an image if no other matches found
    } else {
        return null; // File type cannot be determined
    }
}

// Define a reusable function to insert meta data
const insertMetaData = async (mId, metaKey, metaValue) => {
    await pool.query(
        `INSERT INTO ine_marketing_meta 
                (m_id, meta_key, meta_value, created_at) 
                VALUES (?, ?, ?, NOW())`,
        [mId, metaKey, metaValue]
    );
};

// router.get('/mymarketing/:id?', async (req, res) => {
//     try {
//         const id = req.params.id || req.query.id;
//         if (id) {
//             const query1 = `
//                 SELECT ${tableName2}.*, ${tableName}.model_number
//                 FROM ${tableName2}
//                 LEFT JOIN ${tableName} ON ${tableName2}.designer_id = ${tableName}.id
//                 WHERE ${tableName2}.id = ?
//                 ORDER BY ${tableName2}.created_at DESC;
//             `;
//             const [results] = await pool.query(query1, [id]);
//             console.log('resultsresultsresultsresultsresultsresults', results);
//             if (results.length > 0) {
//                 const foundRecord = results[0];
//                 const marketingId = foundRecord.id;
//                 const modelNumber = foundRecord.model_number;

//                 const query2 = ` SELECT * FROM ine_marketing_pending_media  WHERE ine_marketing_pending_id  = ?`;
//                 const [metaResults] = await pool.query(query2, [marketingId]);
//                 if (metaResults.length > 0) {
//                     const transformedRecord = metaResults.reduce((acc, record) => {
//                         if (record.meta_key === 'name') {
//                             acc['title'] = record.file_url;
//                         } else if (record.media_type === 'image') {
//                             if (!acc.images) {
//                                 acc.images = [];
//                             }
//                             acc.images.push(record.file_url);
//                         } else if (record.media_type === 'video') {
//                             if (!acc.videos) {
//                                 acc.videos = [];
//                             }
//                             acc.videos.push(record.file_url);
//                         } else {
//                             acc[record.media_type] = record.file_url;
//                         }
//                         return acc;
//                     }, {});
//                     transformedRecord.id = marketingId;
//                     transformedRecord.model_number = modelNumber;
//                     transformedRecord.mainData = foundRecord;

//                     console.log("transformedRecordtransformedRecordtransformedRecordtransformedRecord", transformedRecord);
//                     return sendResponse(res, { data: transformedRecord, message: ManageResponseStatus('fetched'), status: true }, 200);
//                 }
//             }
//             return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
//         }
//         return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
//     } catch (error) {
//         return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
//     }
// });

router.get('/mymarketing/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            // const query1 = `
            //     SELECT ${tableName2}.*, ${tableName}.model_number
            //     FROM ${tableName2}
            //     LEFT JOIN ${tableName} ON ${tableName2}.designer_id = ${tableName}.id
            //     WHERE ${tableName2}.id = ?
            //     ORDER BY ${tableName2}.created_at DESC;
            // `;
            // const [results] = await pool.query(query1, [id]);

            const [results1] = await pool.query(`SELECT * FROM ${tableName2} WHERE id = ?`, [id]);
            const designerid = results1[0].designer_id;

            const [results] = await pool.query(`SELECT mp.*, d.model_number FROM ${tableName2} as mp LEFT JOIN ${tableName} as d on d.id = mp.designer_id WHERE mp.designer_id = ? ORDER BY ID ASC`, [designerid]);

            if (results.length > 0) {
                for (const record of results) {
                    record.images = [];
                    // let foundRecord;
                    // const marketingId = foundRecord.id;

                    // const query2 = `SELECT * FROM ine_marketing_pending_media WHERE ine_marketing_pending_id = ?`;
                    // const [metaResults] = await pool.query(query2, [marketingId]);

                    // Initialize the arrays for images and videos
                    const [results3] = await pool.query(`SELECT * from ${TABLE.MARKETING_PENDING_META_TABLE} where ine_marketing_pending_id = ? and status = 1`, [record.id]);
                    if (results3.length > 0) {
                        record.images = results3.map(media => media.file_url);
                    }
                    // if (results3.length > 0) {
                    //     foundRecord.images = results3.map(media => media.file_url);
                    // } else {
                    //     foundRecord.images = [];
                    // }

                    // foundRecord.images = [];
                    // foundRecord.videos = [];

                    // metaResults.forEach(record => {
                    //     if (record.media_type === 'image') {
                    //         foundRecord.images.push(record.file_url);
                    //     } else if (record.media_type === 'video') {
                    //         foundRecord.videos.push(record.file_url);
                    //     }
                    // });
                }
                return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Final Product
router.get('/finalproduct/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (id) {
            const [results] = await pool.query(`SELECT imr.row_id, im.* FROM ${TABLE.MANAGE_REQUEST} as imr 
                LEFT JOIN ${TABLE.MARKETING_PENDING} as imp on imp.id = imr.row_id 
                LEFT JOIN ${TABLE.MARKETING} as im on im.designer_id = imp.designer_id 
                WHERE imr.id = ?`, [id]);
                // console.log("results", results);
                
            const designerid = results[0].designer_id;
            if (results.length > 0) {
                for (const record of results) {
                    record.images = [];
                    const [results3] = await pool.query(`SELECT * from ${TABLE.MARKETING_PENDING_META_TABLE} where designer_id = ? and status = 1`, [designerid]);
                    if (results3.length > 0) {
                        record.images = results3.map(media => media.file_url);
                    }
                }
                return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true }, 200);
            }
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Remove Marketing Images
router.delete('/marketingimg/:id', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        if (!id) {
            return sendResponse(res, { error: ManageResponseStatus('RowIdRequired'), status: false }, 400);
        }
        const query = `UPDATE ${TABLE.MARKETING_PENDING_META_TABLE} SET status = 0 WHERE id IN (?)`;
        const [results] = await pool.query(query, [id]);
        if (results.affectedRows > 0) {
            return sendResponse(res, { message: ManageResponseStatus('deleted'), status: true }, 200);
        }
        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;