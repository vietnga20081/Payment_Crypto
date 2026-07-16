import { body } from 'express-validator';

export const loginValidator = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().isLength({ min: 6 }),
];

export const refreshValidator = [
  body('refreshToken').notEmpty(),
];

export const changePasswordValidator = [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
];
