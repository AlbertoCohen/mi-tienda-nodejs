import { AppError } from '../utils/AppError.js';

export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    const errorMsg = err.errors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') || 'Validación fallida';
    next(new AppError(errorMsg, 400));
  }
};
