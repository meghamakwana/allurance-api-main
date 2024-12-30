// src/routes/emailRoutes.js
const express = require('express');
const router = express.Router();
const { sendResponse } = require('../commonFunctions');
const nodemailer = require('nodemailer');
const multer = require('multer');

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Basic Email Configuration
const basicEmailConfiguration = async (files = []) => {
    const adminMail = 'jayesh@ineinfotech.com';
    const adminPass = '';
    const transporter = nodemailer.createTransport({
        host: 'smtpout.secureserver.net',
        port: 465,
        secure: true,
        auth: {
            user: adminMail,
            pass: adminPass,
        },
    });
    const attachments = files.length > 0 ? files.map(file => ({
        filename: file.originalname,
        content: file.buffer,
        encoding: 'base64',
    })) : [];
    return [adminMail, transporter, attachments];
};

// Account Register
router.post('/account-register', async (req, res) => {
    try {
        const { name, email } = req.body;
        
        if (!name || !email) {
            return sendResponse(res, { error: 'Name, Email is required' }, 400);
        }

        const [adminMail, transporter, attachments] = await basicEmailConfiguration();

        // ADMIN EMAIL
        const adminmailOptions = {
            from: adminMail,
            to: adminMail,
            subject: `New Account Registered (User ID: #${userId}) - INE InfoTech`,
            text: `Hello Admin,\nA A new account has been registered in our system. Please review the details below:\n\n- Name: ${name}\n- Email: ${email}\n\nPlease ensure to follow up as required.\n\nTeam INE InfoTech,\nThank you`,
            attachments
        };

        // USER EMAIL
        const usermailOptions = {
            from: adminMail,
            to: email,
            subject: `Account Registration Confirmation - INE InfoTech`,
            text: `Hello ${name},\n\nThank you for registering with us! Your account has been successfully created.\n\nHere are your registration details:\n- Name: ${name}\n- Email: ${email}\n\nYou can now log in and start using our services. If you have any questions or need further assistance, please do not hesitate to contact us.\n\nTeam INE InfoTech,\nThank you`,
            attachments
        };

        // Send email
        await transporter.sendMail(adminmailOptions);
        await transporter.sendMail(usermailOptions);

        return sendResponse(res, { message: "Email Successfully Sent", status: true }, 200);

    } catch (error) {
        console.error('Error sending email:', error);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Account Deactivation
router.post('/account-deactivate', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return sendResponse(res, { error: 'Email is required' }, 400);
        }

        const [adminMail, transporter] = await basicEmailConfiguration();

        // USER EMAIL
        const usermailOptions = {
            from: adminMail,
            to: email,
            subject: `Account Deactivation Confirmation - INE InfoTech`,
            text: `Hello,\n\nYour account has been successfully deactivated.\n\nIf this was a mistake or if you have any questions, please contact our support team.\n\nTeam INE InfoTech,\nThank you`,
        };

        // Send email
        await transporter.sendMail(usermailOptions);

        return sendResponse(res, { message: "Account deactivated and email notifications sent.", status: true }, 200);

    } catch (error) {
        console.error('Error deactivating account:', error);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Profile Update
router.post('/profile-update', async (req, res) => {
    try {
        const { name, email, newEmail } = req.body;

        if (!name || !email) {
            return sendResponse(res, { error: 'Name, Email are required' }, 400);
        }

        // Email configuration (if needed)
        const [adminMail, transporter] = await basicEmailConfiguration(); // No attachments here

        // USER EMAIL
        const usermailOptions = {
            from: adminMail,
            to: newEmail,
            subject: `Profile Update Confirmation - INE InfoTech`,
            text: `Hello ${name},\n\nYour profile has been successfully updated.\n\nIf you did not request this update or if you have any questions, please contact our support team.\n\nTeam INE InfoTech,\nThank you`,
        };

        // Send email
        await transporter.sendMail(usermailOptions);

        return sendResponse(res, { message: "Profile updated and email notifications sent.", status: true }, 200);

    } catch (error) {
        console.error('Error updating profile:', error);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

// Order Placed
router.post('/order-placed', upload.array('files'), async (req, res) => {
    try {
        const { name, email, orderid } = req.body;
        const files = req.files;

        if (!name || !email) {
            return sendResponse(res, { error: 'Name, Email is required' }, 400);
        }

        const [adminMail, transporter, attachments] = await basicEmailConfiguration(files);

        // ADMIN EMAIL
        const adminmailOptions = {
            from: adminMail,
            to: adminMail,
            subject: `New Order Received (Order ID: #${orderid}) - INE InfoTech`,
            text: `Hello Admin,\nA new order has been placed in our system. Please review the order details and update its status accordingly.\n\nName: ${name}\nEmail: ${email}\n\nTeam INE InfoTech,\nThank you`,
            attachments
        };

        // USER EMAIL
        const usermailOptions = {
            from: adminMail,
            to: email,
            subject: `Order Confirmation (Order ID: #${orderid}) - INE InfoTech`,
            text: `Hello ${name},\nThank you for placing an order with us. Your order has been successfully received and is now being processed. We will notify you once your order has been dispatched.\n\nTeam INE InfoTech,\nThank you`,
            attachments
        };

        // Send email
        await transporter.sendMail(adminmailOptions);
        await transporter.sendMail(usermailOptions);

        return sendResponse(res, { message: "Email Successfully Sent", status: true }, 200);

    } catch (error) {
        console.error('Error sending email:', error);
        return sendResponse(res, { error: `Error occurred: ${error.message}` }, 500);
    }
});

module.exports = router;
