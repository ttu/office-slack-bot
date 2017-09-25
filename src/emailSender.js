var nodemailer = require("nodemailer");

class EmailSender {
    constructor(mailConfig, subject, template, receiverEmail, senderEmail = '', senderName = '') {
        this.mailConfig = mailConfig;
        this.subject = subject;
        this.template = template;
        this.receiverEmail = receiverEmail;
        this.senderEmail = senderEmail;
        this.senderName = senderName;
    }

    getOpts(content, senderEmail = '', senderName = '') {
        return {
            to: this.receiverEmail,
            from: `${senderName || this.senderName} <${senderEmail || this.senderEmail}>`,
            bcc: senderEmail || this.senderEmail,
            replyTo: senderEmail || this.senderEmail,
            subject: this.subject,
            text: this.getContent(content, senderName)
        };
    }

    getContent(content, senderName = ''){
        return this.template
            .replace('{content}', content)
            .replace('{senderName}', senderName || this.senderName);
    }

    send(content, senderEmail = '', senderName = '') {
        const opts = this.getOpts(content, senderEmail, senderName);

        if (!opts.from)
            return Promise.resolve('No sender email defined');

        const transport = nodemailer.createTransport(this.mailConfig);

        return new Promise((resolve, reject) => {
            transport.sendMail(opts, (error, response) => {
                if (error) {
                    resolve(error);
                } else {
                    resolve(`Email sent`);
                }
            });
        });
    }
}

module.exports = EmailSender;