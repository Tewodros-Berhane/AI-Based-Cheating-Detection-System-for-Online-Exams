const nodemailer = require("nodemailer");
var config = require('config');

let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: config.get('mail-credentials.userid'),
        pass: config.get('mail-credentials.password')
    }
});

let sendmail = (toid,sub,text,html,attachments)=>{
    return transporter.sendMail({
        from: '"Exam Sheild"<ExamSheild@gmail.com>',
        to: toid,
        subject: sub,
        text: text,
        html: html || null,
        attachments: attachments
    });
}

module.exports = {sendmail}