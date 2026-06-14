import nodemailer from 'nodemailer';

const transporters = {};

const config = (kind) => {
  if (kind === 'booking') {
    return {
      host: process.env.BOOKING_SMTP_HOST || process.env.SMTP_HOST,
      port: Number(process.env.BOOKING_SMTP_PORT || process.env.SMTP_PORT || 587),
      user: process.env.BOOKING_SMTP_USER || process.env.SMTP_USER,
      pass: process.env.BOOKING_SMTP_PASS || process.env.SMTP_PASS,
      from: process.env.BOOKING_SMTP_FROM || 'Bowline Stays <bowlinestays@gmail.com>',
    };
  }

  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  };
};

export const isEmailConfigured = (kind = 'admin') => {
  const { host, user, pass } = config(kind);
  return Boolean(host && user && pass);
};

const getTransporter = (kind) => {
  if (!transporters[kind]) {
    const { host, port, user, pass } = config(kind);

    transporters[kind] = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  return transporters[kind];
};

export const sendMail = async ({ to, subject, text, html, attachments, kind = 'admin' }) => {
  if (!isEmailConfigured(kind)) {
    throw new Error('Email is not configured');
  }

  const { from } = config(kind);

  return getTransporter(kind).sendMail({
    from: from.includes('<') ? from : `Bowline Nature Stay <${from}>`,
    to,
    subject,
    text,
    html,
    attachments,
  });
};
