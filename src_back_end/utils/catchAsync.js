// src/utils/catchAsync.js
/*Este pequeño utilitario es un estándar en Node.js profesional. 
Envuelve tus funciones asíncronas y, si fallan, pasa el error automáticamente al 
middleware global. ¡Adiós a escribir try-catch 50 veces!*/

module.exports = fn => {
    return (req, res, next) => {
        // Si la función falla, .catch(next) envía el error al Global Error Handler
        fn(req, res, next).catch(next);
    };
};