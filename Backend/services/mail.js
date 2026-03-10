const nodemailer = require("nodemailer");
var config = require('config');

const MAIL_NOT_CONFIGURED_CODE = 'MAIL_NOT_CONFIGURED';

const getConfigValue = (path) => {
    try {
        return config.get(path);
    } catch (error) {
        return '';
    }
};

const getMailCredentials = () => ({
    user: ((process.env.MAIL_USER || getConfigValue('mail-credentials.userid') || '') + '').trim(),
    pass: ((process.env.MAIL_PASSWORD || getConfigValue('mail-credentials.password') || '') + '').trim()
});

const isMailConfigured = () => {
    const { user, pass } = getMailCredentials();
    return Boolean(user && pass);
};

const buildMailConfigurationError = () => {
    const error = new Error('Email delivery is not configured on the server.');
    error.code = MAIL_NOT_CONFIGURED_CODE;
    return error;
};

const createTransporter = () => {
    const { user, pass } = getMailCredentials();
    if (!user || !pass) {
        throw buildMailConfigurationError();
    }

    return nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user,
            pass
        }
    });
};

let sendmail = (toid, sub, text, html, attachments) => {
    try {
        const transporter = createTransporter();
        return transporter.sendMail({
            from: '"Exam Shield"<ExamShield@gmail.com>',
            to: toid,
            subject: sub,
            text: text,
            html: html || null,
            attachments: attachments
        });
    } catch (error) {
        return Promise.reject(error);
    }
};

module.exports = { sendmail, isMailConfigured, MAIL_NOT_CONFIGURED_CODE };
