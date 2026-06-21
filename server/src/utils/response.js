export function ok(res, data = {}) {
  return res.json({
    success: true,
    data
  });
}

export function fail(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    code,
    message
  });
}