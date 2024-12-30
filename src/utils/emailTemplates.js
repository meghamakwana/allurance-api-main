// src/utils/emailTemplates.js

// Frontend - Contact Form (User)
const getContactUsUserMailOptions = (name, email, description) => {
    return {
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Thank you for your inquiry',
        text: `Hello ${name},\n\nThank you for reaching out! We have received your inquiry and will get back to you soon.\n\nDescription: ${description}\n\nThank you`,
    };
};

// Frontend - Contact Form (Admin)
const getContactUsAdminMailOptions = (name, email, phone, description) => {
    return {
        from: process.env.SMTP_USER,
        to: process.env.ADMIN_EMAIL,
        subject: 'New Contact Inquiry',
        text: `Hello Admin,\n\nNew inquiry received from contact form:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nDescription: ${description}\n\nThank you`,
    };
};

module.exports = {
    getContactUsUserMailOptions,
    getContactUsAdminMailOptions,
};
