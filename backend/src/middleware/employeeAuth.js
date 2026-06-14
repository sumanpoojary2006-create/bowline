import jwt from 'jsonwebtoken';
import Employee from '../models/Employee.js';

export const protectEmployee = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'employee') {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const employee = await Employee.findById(decoded.id).select('-password');

    if (!employee || !employee.active) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.employee = employee;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Session expired. Please log in again.' });
  }
};
