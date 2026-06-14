import Employee from '../models/Employee.js';
import { generateEmployeeToken } from '../utils/token.js';

const formatEmployee = (employee) => ({
  id: employee._id,
  name: employee.name,
  phone: employee.phone,
  email: employee.email,
  role: employee.role,
  active: employee.active,
  joinDate: employee.joinDate,
});

export const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      res.status(400);
      throw new Error('Phone and password are required');
    }

    const employee = await Employee.findOne({ phone });

    if (!employee || !(await employee.comparePassword(password))) {
      res.status(401);
      throw new Error('Invalid phone number or password');
    }

    if (!employee.active) {
      res.status(403);
      throw new Error('Your account has been deactivated. Contact the admin.');
    }

    res.json({
      token: generateEmployeeToken(employee._id),
      employee: formatEmployee(employee),
    });
  } catch (error) {
    next(error);
  }
};
