const bcrypt = require('bcrypt');

exports.seed = async function(knex) {
  await knex('order_item_options').del();
  await knex('order_items').del();
  await knex('orders').del();
  await knex('options').del();
  await knex('option_groups').del();
  await knex('products').del();
  await knex('categories').del();
  await knex('tables').del();
  await knex('users').del();
  await knex('stores').del();
  await knex('coupons').del();

  const [cantinaId] = await knex('stores').insert({
    name: 'Cantina da Praça',
    slug: 'cantina',
    logoUrl: '/public/img/placeholder.png',
    themePrimary: '#C62828',
    deliveryRadiusKm: 3,
    deliveryFee: 800, // R$8,00
    packagingFee: 300 // R$3,00
  }, ['id']);

  const [burgerId] = await knex('stores').insert({
    name: 'Burger do Zé',
    slug: 'burger-ze',
    logoUrl: '/public/img/placeholder.png',
    themePrimary: '#FBC02D',
    deliveryRadiusKm: 5,
    deliveryFee: 1000,
    packagingFee: 400
  }, ['id']);

  // Categorias + Produtos
  const catCantina = await knex('categories').insert([
    { storeId: cantinaId.id || cantinaId, name: 'Massas', position: 1 },
    { storeId: cantinaId.id || cantinaId, name: 'Bebidas', position: 2 }
  ], ['id', 'storeId']);

  const catBurger = await knex('categories').insert([
    { storeId: burgerId.id || burgerId, name: 'Burgers', position: 1 },
    { storeId: burgerId.id || burgerId, name: 'Acompanhamentos', position: 2 }
  ], ['id', 'storeId']);

  const [cantinaMassas, cantinaBebidas] = catCantina;
  const [burgerBurgers, burgerSides] = catBurger;

  await knex('products').insert([
    {
      storeId: cantinaId.id || cantinaId,
      categoryId: cantinaMassas.id,
      name: 'Spaghetti ao Sugo',
      description: 'Massa artesanal com molho de tomate.',
      price: 2800,
      imageUrl: '/public/img/placeholder.png',
      active: true
    },
    {
      storeId: cantinaId.id || cantinaId,
      categoryId: cantinaBebidas.id,
      name: 'Suco de Uva',
      description: 'Natural, 300ml.',
      price: 900,
      imageUrl: '/public/img/placeholder.png',
      active: true
    },
    {
      storeId: burgerId.id || burgerId,
      categoryId: burgerBurgers.id,
      name: 'Zé Burger',
      description: 'Pão brioche, 160g, queijo e molho da casa.',
      price: 3200,
      imageUrl: '/public/img/placeholder.png',
      active: true
    },
    {
      storeId: burgerId.id || burgerId,
      categoryId: burgerSides.id,
      name: 'Batata Rústica',
      description: 'Porção individual.',
      price: 1200,
      imageUrl: '/public/img/placeholder.png',
      active: true
    }
  ]);

  // Grupos de opções (ex.: Queijo extra)
  const [g1] = await knex('option_groups').insert({
    storeId: cantinaId.id || cantinaId,
    name: 'Extras',
    min: 0,
    max: 2,
    required: false
  }, ['id']);

  await knex('options').insert([
    { storeId: cantinaId.id || cantinaId, groupId: g1.id, name: 'Queijo extra', price: 400 },
    { storeId: cantinaId.id || cantinaId, groupId: g1.id, name: 'Molho pesto', price: 500 }
  ]);

  // Mesas 1-10
  const tables = Array.from({ length: 10 }, (_, i) => ({ storeId: cantinaId.id || cantinaId, name: String(i + 1), active: true }));
  await knex('tables').insert(tables);

  // Cupom simples
  await knex('coupons').insert({
    storeId: cantinaId.id || cantinaId,
    code: 'PROMO10',
    type: 'percentage',
    value: 10,
    active: true
  });

  // Usuários admin (senha: 123456)
  const hash = await bcrypt.hash('123456', 10);
  await knex('users').insert([
    { storeId: cantinaId.id || cantinaId, email: 'admin@cantina.com', passwordHash: hash, role: 'admin' },
    { storeId: burgerId.id || burgerId, email: 'admin@burger.com', passwordHash: hash, role: 'admin' }
  ]);

  // Pedidos de exemplo (sem pagamento real)
  const { nanoid } = await import('nanoid');
  const pub1 = nanoid(12);
  const pub2 = nanoid(12);
  const pub3 = nanoid(12);

  const [o1] = await knex('orders').insert({
    publicId: pub1,
    storeId: cantinaId.id || cantinaId,
    type: 'dine_in',
    tableId: 1,
    customerName: null,
    customerPhone: null,
    addressJson: null,
    subtotal: 2800,
    deliveryFee: 0,
    packagingFee: 0,
    discount: 0,
    total: 2800,
    paymentStatus: 'pending',
    status: 'received',
    paymentProvider: null
  }, ['id']);

  await knex('order_items').insert({
    orderId: o1.id,
    productId: 1,
    nameSnapshot: 'Spaghetti ao Sugo',
    unitPrice: 2800,
    qty: 1
  });

  const [o2] = await knex('orders').insert({
    publicId: pub2,
    storeId: burgerId.id || burgerId,
    type: 'pickup',
    tableId: null,
    customerName: 'João',
    customerPhone: '11999999999',
    addressJson: null,
    subtotal: 4400,
    deliveryFee: 0,
    packagingFee: 400,
    discount: 0,
    total: 4800,
    paymentStatus: 'paid',
    status: 'ready',
    paymentProvider: 'mercadopago',
    paymentRef: 'test-ref'
  }, ['id']);

  await knex('order_items').insert([
    { orderId: o2.id, productId: 3, nameSnapshot: 'Zé Burger', unitPrice: 3200, qty: 1 },
    { orderId: o2.id, productId: 4, nameSnapshot: 'Batata Rústica', unitPrice: 1200, qty: 1 }
  ]);

  const [o3] = await knex('orders').insert({
    publicId: pub3,
    storeId: cantinaId.id || cantinaId,
    type: 'delivery',
    tableId: null,
    customerName: 'Maria',
    customerPhone: '11988888888',
    addressJson: JSON.stringify({ cep: '01000-000', street: 'Rua A', number: '100', city: 'São Paulo', state: 'SP' }),
    subtotal: 2800,
    deliveryFee: 800,
    packagingFee: 300,
    discount: 0,
    total: 3900,
    paymentStatus: 'pending',
    status: 'accepted',
    paymentProvider: null
  }, ['id']);

  await knex('order_items').insert({
    orderId: o3.id, productId: 1, nameSnapshot: 'Spaghetti ao Sugo', unitPrice: 2800, qty: 1
  });
};