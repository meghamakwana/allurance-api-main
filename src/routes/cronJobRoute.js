const express = require('express');
const router = express.Router();
const { send_bday_anniversary_email, send_restock_and_cart_reminder_email } = require('../utils/cronJobsEmails');
const cron = require('node-cron');
const pool = require('../utils/db');
const { sendResponse } = require('../commonFunctions');
router.get('/run', async (req, res) => {
    try {
        //Run Birthday anniversary email every day at 9:00 AM UTC
        cron.schedule("0 9 * * *", () => {
            send_bday_anniversary_email();
        }, {
            timezone: "UTC",
        });

        // Run restocked product email every 30 minutes
        cron.schedule("* * * * *", () => {
            console.log("⏳ Running Restocked Product Email Cron...");
            send_restock_and_cart_reminder_email();
        });
        return sendResponse(res, { message: "Cron Job Running", status: true }, 200);
    } catch (error) {
        console.error('Error sending email:', error);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});
module.exports = router;
