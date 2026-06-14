import nodemailer from 'nodemailer';

let transporter = null;

export const isEmailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
};

export const sendMail = async ({ to, subject, text, html, attachments }) => {
  if (!isEmailConfigured()) {
    throw new Error('Email is not configured');
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  return getTransporter().sendMail({
    from: `Bowline Nature Stay <${from}>`,
    to,
    subject,
    text,
    html,
    attachments,
  });
};
