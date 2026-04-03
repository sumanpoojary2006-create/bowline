import Notification from '../models/Notification.js';
import User from '../models/User.js';

export const createNotification = async ({ userId, title, message, type = 'system' }) => {
  return Notification.create({
    user: userId,
    title,
    message,
    type,
  });
};

export const notifyAdmins = async ({ title, message, type = 'system' }) => {
  const admins = await User.find({ role: 'admin' }).select('_id');

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
};
