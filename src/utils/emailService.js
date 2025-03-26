const { EmailClient } = require("@azure/communication-email");
require("dotenv").config();
const crypto = require("crypto");
const pool = require("./db");

const connectionString = process.env.AZURE_EMAIL_CONNECTION_STRING; // Azure Connection String
const senderAddress = process.env.AZURE_EMAIL_SENDER; // Verified Sender Email

const emailClient = new EmailClient(connectionString);
const TABLE = require('../utils/tables')
const userTable = TABLE.USERS; // Table name in your database 

/**
 * Send an email using Azure Communication Services (ACS)
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body (plain text or HTML)
 * @param {boolean} isHtml - Set to true if body is HTML
 * @returns {Promise<string>} - Returns Operation ID if successful
 */
 const sendEmail = async (to, subject, body, isHtml = false) => {
    try {
        const message = {
            senderAddress,
            recipients: {
                to: to.map(email => ({ address: email })) // Convert array to required format
            },
            content: {
                subject,
                [isHtml ? "html" : "plainText"]: body
            }
        };

        const poller = await emailClient.beginSend(message);
        const result = await poller.pollUntilDone();

        console.log(`✅ Email Sent Successfully! Operation ID: ${result.id}`);
        return result.id;
    } catch (error) {
        throw new Error('Failed to send email');
    }
}
async function generateUnsubscribeToken(email) {
    const userhash= crypto.createHash("sha256").update(email + Date.now()).digest("hex");
    await pool.query(
        `UPDATE ${userTable} SET 
        userhash = ?
         WHERE email = ?`,
        [userhash, email]
    );
    return userhash;
}
 const sendPersonalizedEmail = async (recipients, subject, body, isHtml = false)=> {

        try {
            const results=[];
            const BASE_UNSUBSCRIBE_URL = process.env.FRONTEND_URL + "/unsubscribe?userhash=";
            // Prepare all emails with unique content per recipient
            const emailRequests = recipients.map(async (email) => {
                const token = await generateUnsubscribeToken(email);
                const unsubscribeUrl = `${BASE_UNSUBSCRIBE_URL}${token}`;
    
                //console.log(`Generated Unsubscribe URL for ${email}: ${unsubscribeUrl}`);
    
                // Personalize the email body
                const personalizedBody = isHtml
                    ? `${body}<p>If you wish to unsubscribe, <a href="${unsubscribeUrl}">click here</a>.</p>`
                    : `${body}\n\nUnsubscribe: ${unsubscribeUrl}`;
    
                // Create email message for this recipient
                const message = {
                    senderAddress,
                    recipients: { to: [{ address: email }] }, // Sending separately for each recipient
                    content: {
                        subject,
                        [isHtml ? "html" : "plainText"]: personalizedBody
                    }
                };
    
                // Send email
                const poller = await emailClient.beginSend(message);
                const result = await poller.pollUntilDone();
                results.push(result);
                console.log(`✅ Email sent to ${email} (Operation ID: ${result.id})`);
            });
    
            // Wait for all emails to be sent
            await Promise.all(emailRequests);
        return results;
    } catch (error) {
        console.error("❌ Error sending email:", error);
        throw error;
    }
}
module.exports =  { sendEmail, sendPersonalizedEmail };
