// src/routes/frontendproductsRoutes.js
const express = require('express');
const TABLE = require('../utils/tables')
const pool = require('../utils/db');
const { getQueryParamId, getRecordById, ManageResponseStatus, sendResponse, getQueryParamIds, activityLog } = require('../commonFunctions')
const router = express.Router();

const tableName = TABLE.MARKETING;

// Products: All List & Specific List
router.get('/', async (req, res) => {
    try {

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const id = getQueryParamId(fullUrl);
        const url = new URL(fullUrl);
        const categoryId = url.searchParams.get('category_id');
        const bestseller = url.searchParams.get('bestseller');
        const lifestyle = url.searchParams.get('lifestyle');
        const keyword = url.searchParams.get('keyword');

        let queryStr = `SELECT p.*, 
                               d.id as designer_id,
                               d.model_number, 
                               d.sub_model_number, 
                               c.id as category_id,
                               c.name as category_name, 
                               r.id as resin_id,
                               r.name as resin_name, 
                               s.id as shape_id,
                               s.shape as shape_name,
                               b.id as bezel_material_id,
                               b.name as bezel_material,
                               bc.id as bezel_color_id,
                               bc.name as bezel_color,
                               im.id as inner_material_id,
                               im.name as inner_material_name,
                               iff.id as flower_id,
                               iff.name as flower_name,
                               sn.serial_number as serial_number,
                               cs.id as color_id,
                               cs.name as color_name
                        FROM ${tableName} p
                        LEFT JOIN ine_designer d ON p.designer_id = d.id
                        LEFT JOIN ine_category c ON d.category_id = c.id
                        LEFT JOIN ine_resin r ON d.resin_id = r.id
                        LEFT JOIN ine_shape s ON d.shape_id = s.id
                        LEFT JOIN ine_bezel_material b ON d.bezel_material_id = b.id
                        LEFT JOIN ine_bezel_color bc ON d.bezel_color_id = bc.id
                        LEFT JOIN ine_inner_material im ON d.inner_material_id = im.id
                        LEFT JOIN ine_flower iff ON d.flower_id = iff.id
                        LEFT JOIN ine_serial_number sn ON d.serial_number_id = sn.id
                        LEFT JOIN ine_color_shade cs ON d.color_id = cs.id`;

        const queryParams = [];

        if (id) {
            queryStr += ` WHERE p.id = ?`;
            queryParams.push(id);
        } else if (categoryId) {
            queryStr += ` WHERE c.id = ?`;
            queryParams.push(categoryId);
        } else if (bestseller) {
            queryStr += ` WHERE p.bestseller = ?`;
            queryParams.push(bestseller);
        } else if (lifestyle) {
            queryStr += ` WHERE p.lifestyle = ?`;
            queryParams.push(lifestyle);
        } else if (keyword) {
            queryStr += ` WHERE p.name LIKE ? OR p.short_description LIKE ? OR p.long_description LIKE ?`;
            const keywordParam = `%${keyword}%`;
            queryParams.push(keywordParam, keywordParam, keywordParam);
        }

        const [results] = await pool.query(queryStr, queryParams);

        if (results.length > 0) {
            const responseData = [];

            for (const row of results) {
                let product = responseData.find(item => item.id === row.id);
                if (!product) {
                    product = {
                        id: row.id,
                        designer_id: row.designer_id,
                        weight: row.weight,
                        model_number: row.model_number,
                        sub_model_number: row.sub_model_number,
                        product_name: row.name,
                        shape_id: row.shape_id,
                        shape: row.shape_name,
                        resin_id: row.resin_id,
                        resin: row.resin_name,
                        category_id: row.category_id,
                        category: row.category_name,
                        bezel_material_id: row.bezel_material_id,
                        bezel_material: row.bezel_material,
                        inner_material_id: row.inner_material_id,
                        inner_material_name: row.inner_material_name,
                        flower_id: row.flower_id,
                        flower_name: row.flower_name,
                        bezel_color_id: row.bezel_color_id,
                        bezel_color: row.bezel_color,
                        color_id: row.color_id,
                        color: row.color_name,
                        short_description: row.short_description,
                        long_description: row.long_description,
                        price: row.price,
                        discount_price: row.discount_price,
                        stock: row.stock,
                        sell_stock: row.sell_stock,
                        coming_soon: row.coming_soon,
                        created_at: row.created_at,
                        status: row.status,
                        bestseller: row.bestseller,
                        lifestyle: row.lifestyle,
                        images: [],
                        videos: []
                    };
                    responseData.push(product);
                }
                const [requestData4] = await pool.query('SELECT * FROM ine_marketing_media WHERE designer_id = ? AND status = ?', [product.designer_id, 1]);
                if (requestData4.length > 0) {
                    requestData4.forEach((media) => {
                        if (media.file_url) {
                            product.images.push({
                                url: media.file_url,
                                created_at: media.upload_datetime
                            });
                        }
                    });
                }

            }
            return sendResponse(res, {
                data: responseData,
                message: ManageResponseStatus('fetched'),
                status: true,
                count: responseData.length
            }, 200);
        }

        return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
    } catch (error) {
        // console.error("Error occurred:", error.message);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;