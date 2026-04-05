import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { generateToken } from '../utils/token.js';

const formatAuthResponse = (user) => ({
  token: generateToken(user._id),
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    avatar: user.avatar,
    preferences: user.preferences,
  },
});

const googleClient = new OAuth2Client();

const getAllowedGoogleClientIds = () =>
  String(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const signup = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Name, email, and password are required');
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(400);
      throw new Error('User already exists with this email');
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
    });

    res.status(201).json(formatAuthResponse(user));
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    res.json(formatAuthResponse(user));
  } catch (error) {
    next(error);
  }
};

export const googleLogin = async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400);
      throw new Error('Google credential is required');
    }

    const allowedClientIds = getAllowedGoogleClientIds();
    if (!allowedClientIds.length) {
      res.status(500);
      throw new Error('Google login is not configured on the server');
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: allowedClientIds,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.email_verified) {
      res.status(401);
      throw new Error('Google account email is not verified');
    }

    let user = await User.findOne({ email: payload.email.toLowerCase() });

    if (!user) {
      user = await User.create({
        name: payload.name || payload.email.split('@')[0],
        email: payload.email.toLowerCase(),
        password: `google-${crypto.randomUUID()}`,
        avatar: payload.picture || '',
      });
    } else {
      const updates = {};
      if (!user.name && payload.name) updates.name = payload.name;
      if (!user.avatar && payload.picture) updates.avatar = payload.picture;

      if (Object.keys(updates).length) {
        Object.assign(user, updates);
        await user.save();
      }
    }

    res.json(formatAuthResponse(user));
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req, res) => {
  res.json({ user: req.user });
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    user.name = req.body.name ?? user.name;
    user.phone = req.body.phone ?? user.phone;
    user.avatar = req.body.avatar ?? user.avatar;
    user.preferences = {
      ...user.preferences,
      ...(req.body.preferences || {}),
    };

    if (req.body.password) {
      user.password = req.body.password;
    }

    await user.save();
    res.json(formatAuthResponse(user));
  } catch (error) {
    next(error);
  }
};
