const success = (res, data = {}, message = 'OK', statusCode = 200) => res.status(statusCode).json({ success: true, message, data });
const created = (res, data = {}, message = 'Created') => success(res, data, message, 201);

const error = (res, message = 'An error occured', statusCode = 400, errors = null) => res.status(statusCode).json({ success: false, message, ...(errors && { errors }) });
const notFound = (res, message = 'Not found') => error(res, message, 404);

const unauthorized = (res, message = 'Unauthorized') => error(res, message, 401);
const forbidden = (res, message = 'Forbidden') => error(res, message, 403);

const serverError = (res, message = 'Internal server error') => error(res, message, 500);
const paginate = (res, data, total, page, limit, message = 'OK') => res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
    },
});

module.exports = { success, created, error, notFound, unauthorized, forbidden, serverError, paginate };