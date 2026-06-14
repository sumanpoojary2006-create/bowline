import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { isEmailConfigured, sendMail } from './email.js';

export const createNotification = async ({ userId, title, message, type = 'system' }) => {
  return Notification.create({
    user: userId,
    title,
    message,
    type,
  });
};

export const notifyAdmins = async ({ title, message, type = 'system' }) => {
  const admins = await User.find({ role: 'admin' }).select('_id email');

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin._id,
        title,
        message,
        type,
      })
    )
  );

  if (isEmailConfigured()) {
    const extraRecipients = (process.env.REPORT_EMAIL_RECIPIENTS || '')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);

    const recipients = [...new Set([...admins.map((admin) => admin.email).filter(Boolean), ...extraRecipients])];

    if (recipients.length) {
      try {
        await sendMail({
          to: recipients.join(','),
          subject: `Bowline Admin: ${title}`,
          text: message,
        });
      } catch (error) {
        console.error('Failed to send admin notification email', error);
      }
    }
  }
};
