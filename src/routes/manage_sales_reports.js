// src/routes/manage_sales_reports.js
const express = require('express');
const pool = require('../utils/db');
const { ManageResponseStatus, sendResponse } = require('../commonFunctions')
const router = express.Router();

const formatDateToISO = (date) => {
    const [day, month, year] = date.split('-');
    return `${year}-${month}-${day}`;
};

// Manage Sales Reports
router.post('/', async (req, res) => {
    try {

        // const { order_id, start_date, end_date, order_status, payment_type, payment_status, report_type } = req.body;
        const { report_type } = req.body;

        let query = `SELECT * FROM ine_orders WHERE 1=1`;
        let queryParams = [];

        // // Order ID
        // if (order_id && order_id.trim() !== "") {
        //     query += ` AND order_id = ?`;
        //     queryParams.push(order_id);
        // }

        // // Start Date and End Date
        // if (start_date && end_date && start_date.trim() !== "" && end_date.trim() !== "") {
        //     const formattedStartDate = formatDateToISO(start_date);
        //     const formattedEndDate = formatDateToISO(end_date);
        //     query += ` AND invoice_date BETWEEN ? AND ?`;
        //     queryParams.push(formattedStartDate, formattedEndDate);
        // }

        // // Order Status (1.Pending 2.Placed 3.Packed 4.Shipped 5.Delivered 6.Cancelled)
        // if (order_status && order_status.trim() !== "") {
        //     query += ` AND order_status = ?`;
        //     queryParams.push(order_status);
        // }

        // // Payment Type (1.Cash 2.UPI 3.Credit/Debit)
        // if (payment_type && payment_type.trim() !== "") {
        //     query += ` AND payment_type = ?`;
        //     queryParams.push(payment_type);
        // }

        // // Payment Status (1.Pending 2.Success 3.Failed)
        // if (payment_status && payment_status.trim() !== "") {
        //     query += ` AND payment_status = ?`;
        //     queryParams.push(payment_status);
        // }

        // Report Type (Monthly, Quarterly, Half-Yearly, Yearly)
        if (report_type && report_type.trim() !== "") {
            switch (parseInt(report_type)) {
                case 1:
                    query += ` AND MONTH(invoice_date) = MONTH(CURRENT_DATE()) AND YEAR(invoice_date) = YEAR(CURRENT_DATE())`;
                    break;
                case 3:
                    query += ` AND QUARTER(invoice_date) = QUARTER(CURRENT_DATE()) AND YEAR(invoice_date) = YEAR(CURRENT_DATE())`;
                    break;
                case 6:
                    query += ` AND invoice_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)`;
                    break;
                case 12:
                    query += ` AND YEAR(invoice_date) = YEAR(CURRENT_DATE())`;
                    break;
                default:
                    break;
            }
        }

        query += ` ORDER BY id DESC`;

        const [results] = await pool.query(query, queryParams);
        if (results.length > 0) {
            return sendResponse(res, { data: results, message: ManageResponseStatus('fetched'), status: true, count: results.length }, 200);
        } else {
            return sendResponse(res, { error: ManageResponseStatus('notFound'), status: false }, 404);
        }
    } catch (error) {
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;