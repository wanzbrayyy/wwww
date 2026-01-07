const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'zanssxploit@gmail.com',
        pass: 'nsqn sioa rlfk tltz'
    }
});

const sendEmail = async (to, subject, htmlContent) => {
    const template = `
    <!DOCTYPE html>
    <html>
    <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            body { font-family: 'Poppins', sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
            .header { background: #3b82f6; padding: 30px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 40px; text-align: center; }
            .code { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #3b82f6; background: rgba(59,130,246,0.1); padding: 20px; border-radius: 12px; margin: 20px 0; display: inline-block; }
            .footer { background: #0f172a; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1><i class="fa-solid fa-bolt"></i> WANZOFC SHOP</h1>
            </div>
            <div class="content">
                ${htmlContent}
            </div>
            <div class="footer">
                <p>&copy; 2024 Wanzofc Shop. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    await transporter.sendMail({
        from: '"WANZOFC SHOP" <berlianawan498@gmail.com>',
        to: to,
        subject: subject,
        html: template
    });
};

module.exports = { sendEmail };