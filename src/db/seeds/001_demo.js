const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Limpa
  await knex('order_item_options').del();
  await knex('order_items').del();
  await knex('orders').del();
  await knex('users').del();
  await knex('options').del();
  await knex('option_groups').del();
  await knex('products').del();
  await knex('categories').del();
  await knex('tables').del();
  await knex('stores').del();

  const store1 = { id: uuid(), name: 'Cantina da Praça', slug: 'cantina', themePrimary: '#dc2626', deliveryRadiusKm: 3, deliveryFee: 800, packagingFee: 300 };
  const store2 = { id: uuid(), name: 'Burger do Zé', slug: 'burger-ze', themePrimary: '#f59e0b', deliveryRadiusKm: 4, deliveryFee: 1000, packagingFee: 400 };

  await knex('stores').insert([store1, store2]);

  const tables = [];
  for (let i = 1; i <= 10; i++) {
    tables.push({ id: uuid(), storeId: store1.id, name: `${i}`, active: true });
    tables.push({ id: uuid(), storeId: store2.id, name: `${i}`, active: true });
  }
  await knex('tables').insert(tables);

  const cat1 = { id: uuid(), storeId: store1.id, name: 'Massas', position: 1 };
  const cat2 = { id: uuid(), storeId: store1.id, name: 'Bebidas', position: 2 };
  const cat3 = { id: uuid(), storeId: store2.id, name: 'Burgers', position: 1 };
  const cat4 = { id: uuid(), storeId: store2.id, name: 'Bebidas', position: 2 };
  await knex('categories').insert([cat1, cat2, cat3, cat4]);

  const p1 = { id: uuid(), storeId: store1.id, categoryId: cat1.id, name: 'Spaghetti à Bolonhesa', description: 'Massa fresca com molho bolonhesa.', price: 3200, imageUrl: '', active: true };
  const p2 = { id: uuid(), storeId: store1.id, categoryId: cat2.id, name: 'Refrigerante Lata', description: '350ml', price: 700, imageUrl: '', active: true };
  const p3 = { id: uuid(), storeId: store2.id, categoryId: cat3.id, name: 'Cheeseburger', description: 'Pão, carne, queijo, alface e tomate.', price: 2800, imageUrl: '', active: true };
  const p4 = { id: uuid(), storeId: store2.id, categoryId: cat4.id, name: 'Milkshake', description: '300ml', price: 1500, imageUrl: '', active: true };
  await knex('products').insert([p1, p2, p3, p4]);

  const grp1 = { id: uuid(), storeId: store2.id, name: 'Ponto da carne', min: 1, max: 1, required: true };
  const opt11 = { id: uuid(), storeId: store2.id, groupId: grp1.id, name: 'Ao ponto', price: 0 };
  const opt12 = { id: uuid(), storeId: store2.id, groupId: grp1.id, name: 'Bem passado', price: 0 };
  await knex('option_groups').insert([grp1]);
  await knex('options').insert([opt11, opt12]);

  const pass = await bcrypt.hash('admin123', 10);
  await knex('users').insert([
    { id: uuid(), storeId: store1.id, email: 'admin@cantina.com', passwordHash: pass, role: 'admin' },
    { id: uuid(), storeId: store2.id, email: 'admin@burger.com', passwordHash: pass, role: 'admin' }
  ]);

  // Pedidos de exemplo
  const order1 = {
    id: uuid(), storeId: store1.id, type: 'dine_in', tableId: tables[0].id, customerName: 'Mesa 1',
    subtotal: 3200, deliveryFee: 0, packagingFee: 0, discount: 0, total: 3200,
    paymentStatus: 'paid', status: 'ready', paymentProvider: 'mercadopago', paymentRef: 'demo', publicToken: uuid()
  };
  await knex('orders').insert([order1]);
  await knex('order_items').insert([{ id: uuid(), orderId: order1.id, productId: p1.id, nameSnapshot: p1.name, unitPrice: p1.price, qty: 1 }]);
};