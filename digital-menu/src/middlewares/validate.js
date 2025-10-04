const Joi = require('joi');

const orderItemOptionSchema = Joi.object({
  optionId: Joi.number().integer().required(),
  nameSnapshot: Joi.string().required(),
  price: Joi.number().integer().min(0).required()
});

const orderItemSchema = Joi.object({
  productId: Joi.number().integer().required(),
  nameSnapshot: Joi.string().required(),
  unitPrice: Joi.number().integer().min(0).required(),
  qty: Joi.number().integer().min(1).required(),
  options: Joi.array().items(orderItemOptionSchema).default([])
});

const orderSchema = Joi.object({
  type: Joi.string().valid('dine_in', 'pickup', 'delivery').required(),
  tableId: Joi.number().integer().allow(null),
  customerName: Joi.string().allow('', null),
  customerPhone: Joi.string().allow('', null),
  address: Joi.object({
    cep: Joi.string().allow('', null),
    street: Joi.string().allow('', null),
    number: Joi.string().allow('', null),
    complement: Joi.string().allow('', null),
    neighborhood: Joi.string().allow('', null),
    city: Joi.string().allow('', null),
    state: Joi.string().allow('', null),
    notes: Joi.string().allow('', null)
  }).allow(null),
  couponCode: Joi.string().allow('', null),
  items: Joi.array().items(orderItemSchema).min(1).required()
});

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ error: 'Validação falhou', details: error.details });
    req.body = value;
    next();
  };
}

module.exports = { validate, orderSchema };