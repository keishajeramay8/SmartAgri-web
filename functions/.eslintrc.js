module.exports = {
  env: {
    node: true,
    es2021: true
  },
  parserOptions: {
    ecmaVersion: 12
  },
  rules: {
    "no-undef": "off",        // ignore 'require' and 'module' errors
    "no-unused-vars": "off"   // ignore unused variable warnings
  }
};