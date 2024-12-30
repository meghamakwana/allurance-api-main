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
const tableName = TABLE.CAMPAIGN;
const tableName3 = TABLE.PRODUCTS;


router.get('/:id?', async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        let campaignData = null;

        // Fetch campaign data based on campaignIdentifier if provided
        if (campaignIdentifier) {
            const [results] = await pool.query(`SELECT * FROM ${tableName} WHERE campaign_url LIKE ?`, [`%${campaignIdentifier}`]);
            if (results.length > 0) {
                campaignData = results[0];
            } else {
                return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
            }
        } else {
            const [results] = await getRecordById(null, tableName, 'id');
            if (results.length > 0) {
                campaignData = results[0];
            } else {
                return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
            }
        }

        // Extract product IDs from the campaign data
        const productIDs = campaignData.products.split(',');

        // Query to fetch detailed product data
        const productQuery = `
            SELECT 
                p.*, 
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
                cs.id as color_id,
                cs.name as color_name,
                ia.id as asset_id,
                ia.meta_key as asset_type,
                ia.meta_value as asset_url,
                ia.created_at as asset_created_at
            FROM ${tableName3} p
            LEFT JOIN ine_designer d ON p.designer_id = d.id
            LEFT JOIN ine_category c ON d.category_id = c.id
            LEFT JOIN ine_resin r ON d.resin_id = r.id
            LEFT JOIN ine_shape s ON d.shape_id = s.id
            LEFT JOIN ine_bezel_material b ON d.bezel_material_id = b.id
            LEFT JOIN ine_bezel_color bc ON d.bezel_color_id = bc.id
            LEFT JOIN ine_inner_material im ON d.inner_material_id = im.id
            LEFT JOIN ine_flower iff ON d.flower_id = iff.id
            LEFT JOIN ine_color_shade cs ON d.color_id = cs.id
            LEFT JOIN ine_assets ia ON p.marketing_id = ia.m_id
            WHERE p.marketing_id IN (${productIDs.map(() => '?').join(', ')})
        `;

        const [products] = await pool.query(productQuery, productIDs);

        // Map to store unique products by ID
        const productMap = new Map();

        // Format product data and group images/videos
        products.forEach(row => {
            if (!productMap.has(row.id)) {
                // Initialize product with basic details
                productMap.set(row.id, {
                    ...row,
                    images: [],
                    videos: []
                });
            }

            // Add image or video to the respective product
            const product = productMap.get(row.id);
            if (row.asset_type && row.asset_url) {
                if (row.asset_type === 'image') {
                    product.images.push({
                        url: row.asset_url,
                        created_at: row.asset_created_at
                    });
                } else if (row.asset_type === 'video') {
                    product.videos.push({
                        url: row.asset_url,
                        created_at: row.asset_created_at
                    });
                }
            }
        });

        // Convert map values to array of products
        const formattedProducts = Array.from(productMap.values());

        // Include products array in the main campaignData object
        campaignData.products = formattedProducts;

        // Return the combined response with campaignData containing products array
        return sendResponse(res, {
            data: campaignData,
            message: ManageResponseStatus('fetched'),
            status: true
        }, 200);

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;