import jwt from 'jsonwebtoken';

export const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

export const generateEmployeeToken = (employeeId) =>
  jwt.sign({ id: employeeId, type: 'employee' }, process.env.JWT_SECRET, {
    expiresIn: process.env.EMPLOYEE_JWT_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '30d',
  });
