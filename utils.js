function isValidSession(req) {
  return req.session && req.session.authenticated;
}
module.exports = { isValidSession };
