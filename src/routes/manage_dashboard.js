const express = require('express');
const pool = require('../utils/db');
const { ManageResponseStatus, sendResponse } = require('../commonFunctions');
const router = express.Router();


// Designer Panel: Users
router.post('/designer-users', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_users WHERE role_id = 2 and status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Designer Panel: Records
router.post('/designer-records', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT d.*, c.name as category_name, r.name as resin_name FROM ine_designer as d 
            LEFT JOIN ine_category as c on c.id = d.category_id 
            LEFT JOIN ine_resin as r on r.id = d.resin_id
            WHERE d.status = 1 ORDER BY d.id DESC`);
        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Replicator Panel: Users
router.post('/replicator-users', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_users WHERE role_id = 3 and status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Replicator Panel: Records
router.post('/replicator-records', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT r.*, d.title as designer_name FROM ine_replicator as r 
            LEFT JOIN ine_designer as d on d.model_number = r.designer_id
            WHERE r.status = 1 ORDER BY r.id DESC`);
        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Packer Panel: Users
router.post('/packer-users', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_users WHERE role_id = 4 and status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Packer Panel: Records
router.post('/packer-records', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM serial_number ORDER BY ID DESC`);
        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Warehouse Panel: Users
router.post('/warehouse-users', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_users WHERE role_id = 5 and status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Warehouse Panel: Records
router.post('/warehouse-records', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM warehouse ORDER BY ID DESC`);
        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Marketing Panel: Users
router.post('/marketing-users', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_users WHERE role_id = 6 and status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Marketing Panel: Records
router.post('/marketing-records', async (req, res) => {
    try {
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
            const [query2] = await pool.query('SELECT file_url, upload_datetime FROM ine_marketing_media WHERE designer_id = ? AND status = 1', [product.designer_id]);
            product.images = query2.map(media => ({ url: media.file_url, created_at: media.upload_datetime }));
        }

        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
        } else {
            return sendResponse(res, { message: ManageResponseStatus('notFound'), status: false }, 400);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Support Panel: Users
router.post('/support-users', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_users WHERE role_id = 7 and status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Support Panel: Records
router.post('/support-records', async (req, res) => {
    try {
        let [query1] = await pool.query(`SELECT t.*, ts.title as subject_name, u.first_name as user_first_name, u.last_name as user_last_name FROM ine_tickets as t 
                LEFT JOIN ine_ticket_subject as ts on ts.id = t.subject_id 
                LEFT JOIN ine_users as u on u.id = t.user_id
                WHERE t.status = 1 ORDER BY id DESC`);
        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 200);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Offline Sales Panel: Users
router.post('/offline-sales-users', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_users WHERE role_id = 8 and status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Offline Sales Panel: Records
router.post('/offline-sales-records', async (req, res) => {
    try {
        let [query1] = await pool.query(`SELECT ios.id as ios_id, ios.serial_number_id as ios_serial_number_id, o.* FROM ine_offline_sales_serial_number as ios 
            LEFT JOIN ine_orders as o on o.id = ios.order_id 
            WHERE ios.status = 1 ORDER BY ios.id DESC`);
        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 200);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Affiliation Panel: Users
router.post('/affiliation-users', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_users WHERE role_id = 14 and status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Affiliation Panel: Records
router.post('/affiliation-records', async (req, res) => {
    try {
        const [results] = await pool.query(`SELECT * FROM ine_affiliate_program WHERE status = 1 ORDER BY ID DESC`);
        if (results.length > 0) {
            for (let i = 0; i < results.length; i++) {
                const affiliate = results[i];
                const [historyResults] = await pool.query(`SELECT a.*, o.channel_mode as order_channel_mode, o.order_id as order_orde_id, o.invoice_id as order_invoice_id, o.payment_type as order_payment_type FROM ine_affiliate_program_history as a 
                LEFT JOIN ine_orders as o on o.id = a.order_id
                WHERE a.affiliate_id = ? and a.status = 1`, [affiliate.id]);
                affiliate.affiliate_history = historyResults;
            }
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }

    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


// Admin Panel: Users
router.post('/admin-all-users', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_users WHERE status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Admin Panel: Roles
router.post('/admin-roles', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_roles WHERE status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Admin Panel: Orders
router.post('/admin-orders', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT o.*, u.first_name as user_first_name, u.last_name as user_last_name FROM ine_orders as o 
            LEFT JOIN ine_users as u on u.id = o.customer_id 
            ORDER BY o.ID DESC`);
        if (query1.length > 0) {
            return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Admin Panel: Blogs
router.post('/admin-blogs', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT b.*, bc.name as blog_name FROM ine_blogs as b 
            LEFT JOIN ine_blog_category as bc on bc.id = b.category_id 
            WHERE b.status = 1 ORDER BY b.ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Admin Panel: Contact Inquiry
router.post('/admin-contact-inquiry', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_contact_inquiry WHERE status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Admin Panel: FAQs
router.post('/admin-faqs', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_faqs WHERE status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Admin Panel: Gift Card
router.post('/admin-giftcard', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_giftcard WHERE status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Admin Panel: Rating
router.post('/admin-rating', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT r.*, u.first_name, u.last_name, m.name as product_name FROM ine_rating as r 
            LEFT JOIN ine_users as u on u.id = r.user_id
            LEFT JOIN ine_marketing as m on m.id = r.product_id
            WHERE r.status = 1 ORDER BY r.ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Admin Panel: Campaign
router.post('/admin-campaign', async (req, res) => {
    try {
        const [query1] = await pool.query(`SELECT * FROM ine_campaign WHERE status = 1 ORDER BY ID DESC`);
        return sendResponse(res, { data: query1, message: ManageResponseStatus('fetched'), status: true, count: query1.length }, 201);
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});


module.exports = router;