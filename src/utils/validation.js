const Joi = require('joi');

const orderItemSchema = Joi.object({
  productId: Joi.string().required(),
  qty: Joi.number().integer().min(1).default(1),
  options: Joi.array().items(Joi.object({
    optionId: Joi.string().required()
  })).default([])
});

const orderSchema = Joi.object({
  type: Joi.string().valid('dine_in', 'pickup', 'delivery').required(),
  tableId: Joi.string().allow(null, ''),
  customerName: Joi.string().allow('', null),
  customerPhone: Joi.string().allow('', null),
  address: Joi.object().when('type', {
    is: 'delivery',
    then: Joi.object({
      cep: Joi.string().min(8).max(9).required(),
      street: Joi.string().required(),
      number: Joi.string().required(),
      complement: Joi.string().allow('', null),
      neighborhood: Joi.string().allow('', null),
      city: Joi.string().allow('', null),
      state: Joi.string().allow('', null)
    }).required(),
    otherwise: Joi.optional()
  }),
  items: Joi.array().items(orderItemSchema).min(1).required(),
  notes: Joi.string().allow('', null),
  totals: Joi.object({
    subtotal: Joi.number().integer().required(),
    deliveryFee: Joi.number().integer().required(),
    packagingFee: Joi.number().integer().required(),
    discount: Joi.number().integer().required(),
    total: Joi.number().integer().required()
  }).required()
});

module.exports = { orderSchema };