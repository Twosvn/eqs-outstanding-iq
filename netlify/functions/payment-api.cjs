const { createApp } = require('../../server/payment.cjs');
exports.handler = createApp().handler;
