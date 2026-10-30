export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.error('[DEV ERROR LOG]', err);
  }

  return res.status(statusCode).json({
    status: 'error',
    message: err.isOperational || !isProduction ? err.message : 'Ocurrió un error interno en el servidor.',
    code: err.code || 'INTERNAL_ERROR'
  });
};
