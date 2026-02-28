const validator = require('validator');

const getFieldValue = (req, field) => {
  if (req.body && req.body[field] !== undefined) {
    return req.body[field];
  }
  if (req.query && req.query[field] !== undefined) {
    return req.query[field];
  }
  if (req.params && req.params[field] !== undefined) {
    return req.params[field];
  }
  return undefined;
};

const normalizeToString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

const buildChain = (req, field, message) => {
  const addError = () => {
    req._validationErrors.push({
      msg: message,
      param: field,
      value: getFieldValue(req, field),
      location: 'body',
    });
  };

  return {
    notEmpty() {
      const value = normalizeToString(getFieldValue(req, field));
      if (value.trim().length === 0) {
        addError();
      }
      return this;
    },
    isEmail() {
      const value = normalizeToString(getFieldValue(req, field));
      if (!validator.isEmail(value)) {
        addError();
      }
      return this;
    },
    isLength(options = {}) {
      const value = normalizeToString(getFieldValue(req, field));
      if (!validator.isLength(value, options)) {
        addError();
      }
      return this;
    },
    isNumeric(options = {}) {
      const value = normalizeToString(getFieldValue(req, field));
      if (!validator.isNumeric(value, options)) {
        addError();
      }
      return this;
    },
  };
};

module.exports = function validatorCompat(req, res, next) {
  req._validationErrors = [];

  req.check = function check(field, message) {
    return buildChain(req, field, message);
  };

  req.validationErrors = function validationErrors() {
    return req._validationErrors.length ? req._validationErrors : false;
  };

  next();
};
