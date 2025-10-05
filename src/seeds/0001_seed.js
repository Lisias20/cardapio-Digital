const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');

function cents(v) {
  // aceita 12.34 (reais) ou 1234 (centavos)
  const n = Number(v);
  if (String(v).includes('.')) return Math.round(n * 100);
  return Math.round(n);
}

exports.seed = async function (knex) {
  // Limpa na ordem correta (filhos -> pais)
  await knex('order_item_options').del();
  await knex('order_items').del();
  await knex('orders').del();
  await knex('coupons').del();
  await knex('options').del();
  await knex('option_groups').del();
  await knex('products').del();
  await knex('categories').del();
  await knex('tables').del();
  await knex('users').del();
  await knex('stores').del();

  const now = new Date().toISOString();

  // Stores
  const [cantinaId] = await knex('stores').insert({
    name: 'Cantina da Praça',
    slug: 'cantina',
    logoUrl: 'https://via.placeholder.com/80x80.png?text=C',
    themePrimary: '#d32f2f',
    cnpj: null,
    openHours: JSON.stringify({
      mon: ['11:30-15:00', '18:30-22:30'],
      tue: ['11:30-15:00', '18:30-22:30'],
      wed: ['11:30-15:00', '18:30-22:30'],
      thu: ['11:30-15:00', '18:30-23:00'],
      fri: ['11:30-15:00', '18:30-23:30'],
      sat: ['12:00-23:30'],
      sun: ['12:00-22:00']
    }),
    deliveryRadiusKm: 5,
    deliveryFee: cents(7.9),
    packagingFee: cents(2.5),
    createdAt: now, updatedAt: now
  });

  const [burgerId] = await knex('stores').insert({
    name: 'Burger do Zé',
    slug: 'burger-ze',
    logoUrl: 'https://via.placeholder.com/80x80.png?text=Z',
    themePrimary: '#f59e0b',
    cnpj: null,
    openHours: JSON.stringify({
      mon: ['18:00-23:30'],
      tue: ['18:00-23:30'],
      wed: ['18:00-23:30'],
      thu: ['18:00-23:30'],
      fri: ['18:00-23:59'],
      sat: ['18:00-23:59'],
      sun: ['18:00-23:00']
    }),
    deliveryRadiusKm: 6,
    deliveryFee: cents(8.9),
    packagingFee: cents(2.0),
    createdAt: now, updatedAt: now
  });

  // Mesas 1–10 para cada loja
  for (let i = 1; i <= 10; i++) {
    await knex('tables').insert([
      { storeId: cantinaId, name: `Mesa ${i}`, number: String(i), active: 1 },
      { storeId: burgerId, name: `Mesa ${i}`, number: String(i), active: 1 }
    ]);
  }

  // Categorias Cantina
  const [cantCatMassas] = await knex('categories').insert({ storeId: cantinaId, name: 'Massas', position: 1 });
  const [cantCatPizzas] = await knex('categories').insert({ storeId: cantinaId, name: 'Pizzas', position: 2 });
  const [cantCatBebidas] = await knex('categories').insert({ storeId: cantinaId, name: 'Bebidas', position: 3 });

  // Produtos Cantina
  const cantProducts = [
    { categoryId: cantCatMassas, name: 'Spaghetti à Bolonhesa', description: 'Molho de carne, tomate e especiarias', price: cents(38.9), imageUrl: 'https://picsum.photos/seed/spaghetti/600/400' },
    { categoryId: cantCatMassas, name: 'Fettuccine Alfredo', description: 'Molho cremoso com parmesão', price: cents(41.9), imageUrl: 'https://picsum.photos/seed/fettuccine/600/400' },
    { categoryId: cantCatMassas, name: 'Lasanha à Bolonhesa', description: 'Recheada e gratinada', price: cents(44.9), imageUrl: 'https://picsum.photos/seed/lasanha/600/400' },

    { categoryId: cantCatPizzas, name: 'Pizza Margherita', description: 'Molho de tomate, muçarela e manjericão', price: cents(54.9), imageUrl: 'https://picsum.photos/seed/margherita/600/400' },
    { categoryId: cantCatPizzas, name: 'Pizza Calabresa', description: 'Calabresa fatiada e cebola', price: cents(57.9), imageUrl: 'https://picsum.photos/seed/calabresa/600/400' },

    { categoryId: cantCatBebidas, name: 'Refrigerante Lata', description: '350ml', price: cents(8.0), imageUrl: 'https://picsum.photos/seed/refri1/600/400' },
    { categoryId: cantCatBebidas, name: 'Suco de Laranja', description: 'Natural 300ml', price: cents(12.0), imageUrl: 'https://picsum.photos/seed/suco/600/400' }
  ];
  const cantProductIds = [];
  for (const p of cantProducts) {
    const [id] = await knex('products').insert({ storeId: cantinaId, ...p, active: 1 });
    cantProductIds.push(id);
  }

  // Categorias Burger
  const [burgCatBurgers] = await knex('categories').insert({ storeId: burgerId, name: 'Burgers', position: 1 });
  const [burgCatSides] = await knex('categories').insert({ storeId: burgerId, name: 'Acompanhamentos', position: 2 });
  const [burgCatDrinks] = await knex('categories').insert({ storeId: burgerId, name: 'Bebidas', position: 3 });

  const burgProducts = [
    { categoryId: burgCatBurgers, name: 'Burger Clássico', description: '160g, queijo prato, alface, tomate', price: cents(29.9), imageUrl: 'https://picsum.photos/seed/burger1/600/400' },
    { categoryId: burgCatBurgers, name: 'Cheese Bacon', description: 'Bacon crocante e cheddar', price: cents(34.9), imageUrl: 'https://picsum.photos/seed/burger2/600/400' },
    { categoryId: burgCatBurgers, name: 'Duplo Smash', description: 'Dois discos 90g, queijo e molho da casa', price: cents(39.9), imageUrl: 'https://picsum.photos/seed/burger3/600/400' },

    { categoryId: burgCatSides, name: 'Batata Frita', description: '200g', price: cents(14.9), imageUrl: 'https://picsum.photos/seed/batata/600/400' },
    { categoryId: burgCatSides, name: 'Onion Rings', description: 'Anéis de cebola crocantes', price: cents(16.9), imageUrl: 'https://picsum.photos/seed/onion/600/400' },

    { categoryId: burgCatDrinks, name: 'Refrigerante Lata', description: '350ml', price: cents(8.0), imageUrl: 'https://picsum.photos/seed/refri2/600/400' },
    { categoryId: burgCatDrinks, name: 'Milkshake', description: '300ml, sabores', price: cents(16.9), imageUrl: 'https://picsum.photos/seed/milkshake/600/400' }
  ];
  const burgProductIds = [];
  for (const p of burgProducts) {
    const [id] = await knex('products').insert({ storeId: burgerId, ...p, active: 1 });
    burgProductIds.push(id);
  }

  // Option groups + options (Cantina)
  const [cantGrpTamanho] = await knex('option_groups').insert({ storeId: cantinaId, name: 'Tamanho', min: 1, max: 1, required: 1 });
  const [cantGrpExtras] = await knex('option_groups').insert({ storeId: cantinaId, name: 'Extras', min: 0, max: 3, required: 0 });

  await knex('options').insert([
    { storeId: cantinaId, groupId: cantGrpTamanho, name: 'Pequeno', price: cents(0) },
    { storeId: cantinaId, groupId: cantGrpTamanho, name: 'Médio', price: cents(5) },
    { storeId: cantinaId, groupId: cantGrpTamanho, name: 'Grande', price: cents(10) },

    { storeId: cantinaId, groupId: cantGrpExtras, name: 'Queijo extra', price: cents(4) },
    { storeId: cantinaId, groupId: cantGrpExtras, name: 'Bacon', price: cents(5) },
    { storeId: cantinaId, groupId: cantGrpExtras, name: 'Molho pesto', price: cents(4) }
  ]);

  // Option groups + options (Burger)
  const [burgGrpPonto] = await knex('option_groups').insert({ storeId: burgerId, name: 'Ponto da carne', min: 1, max: 1, required: 1 });
  const [burgGrpExtras] = await knex('option_groups').insert({ storeId: burgerId, name: 'Extras', min: 0, max: 3, required: 0 });

  await knex('options').insert([
    { storeId: burgerId, groupId: burgGrpPonto, name: 'Ao ponto', price: cents(0) },
    { storeId: burgerId, groupId: burgGrpPonto, name: 'Bem passado', price: cents(0) },

    { storeId: burgerId, groupId: burgGrpExtras, name: 'Queijo', price: cents(3) },
    { storeId: burgerId, groupId: burgGrpExtras, name: 'Bacon', price: cents(5) },
    { storeId: burgerId, groupId: burgGrpExtras, name: 'Molho da casa', price: cents(2.5) }
  ]);

  // Cupons
  await knex('coupons').insert([
    { storeId: cantinaId, code: 'BEMVINDO', type: 'percentage', value: 10, active: 1, expiresAt: null },
    { storeId: burgerId, code: 'BEMVINDO', type: 'percentage', value: 10, active: 1, expiresAt: null },
    { storeId: burgerId, code: 'FRETE5', type: 'fixed', value: cents(5), active: 1, expiresAt: null }
  ]);

  // Users (admins)
  const pass = await bcrypt.hash('admin123', 10);
  await knex('users').insert([
    { storeId: cantinaId, email: 'admin@cantina.local', passwordHash: pass, role: 'admin', createdAt: now },
    { storeId: burgerId, email: 'admin@burgerze.local', passwordHash: pass, role: 'admin', createdAt: now }
  ]);

  // Pedidos de exemplo
  const cantina = await knex('stores').where({ id: cantinaId }).first();
  const burger = await knex('stores').where({ id: burgerId }).first();

  // Helpers para buscar produtos/opções por nome
  const prodByName = async (storeId, name) =>
    knex('products').where({ storeId }).andWhere('name', name).first();

  const optByName = async (storeId, name) =>
    knex('options').where({ storeId }).andWhere('name', name).first();

  async function createOrder({
    store, type, tableNumber, customerName = '', customerPhone = '',
    addressJson = null, items, status = 'received', paymentStatus = 'pending'
  }) {
    let tableId = null;
    if (type === 'dine_in' && tableNumber) {
      const t = await knex('tables').where({ storeId: store.id, number: String(tableNumber) }).first();
      tableId = t ? t.id : null;
    }

    // Calcula subtotal
    let subtotal = 0;
    const detailed = [];
    for (const it of items) {
      const p = await prodByName(store.id, it.product);
      if (!p) continue;
      const qty = it.qty || 1;
      const chosenOpts = [];
      if (Array.isArray(it.options)) {
        for (const on of it.options) {
          const o = await optByName(store.id, on);
          if (o) chosenOpts.push(o);
        }
      }
      const optsSum = chosenOpts.reduce((acc, o) => acc + o.price, 0);
      const line = (p.price + optsSum) * qty;
      subtotal += line;
      detailed.push({ p, qty, chosenOpts });
    }

    const deliveryFee = type === 'delivery' ? store.deliveryFee : 0;
    const packagingFee = store.packagingFee || 0;
    const discount = 0;
    const total = Math.max(0, subtotal + deliveryFee + packagingFee - discount);

    const id = 'ord_' + nanoid(8);
    const createdAt = new Date().toISOString();

    await knex('orders').insert({
      id,
      storeId: store.id,
      type,
      tableId,
      customerName,
      customerPhone,
      addressJson: addressJson ? JSON.stringify(addressJson) : null,
      subtotal,
      deliveryFee,
      packagingFee,
      discount,
      total,
      paymentStatus,
      status,
      paymentProvider: null,
      paymentRef: null,
      createdAt,
      updatedAt: createdAt
    });

    for (const d of detailed) {
      const [orderItemId] = await knex('order_items').insert({
        orderId: id,
        productId: d.p.id,
        nameSnapshot: d.p.name,
        unitPrice: d.p.price,
        qty: d.qty
      });
      if (d.chosenOpts.length) {
        await knex('order_item_options').insert(
          d.chosenOpts.map(o => ({
            orderItemId,
            optionId: o.id,
            nameSnapshot: o.name,
            price: o.price
          }))
        );
      }
    }

    return id;
  }

  // Pedido 1: Cantina • Mesa 3 • pago • em preparo
  await createOrder({
    store: cantina,
    type: 'dine_in',
    tableNumber: 3,
    items: [
      { product: 'Spaghetti à Bolonhesa', qty: 1, options: ['Grande', 'Queijo extra'] },
      { product: 'Refrigerante Lata', qty: 1 }
    ],
    status: 'in_kitchen',
    paymentStatus: 'paid'
  });

  // Pedido 2: Burger • Retirada • pago • pronto
  await createOrder({
    store: burger,
    type: 'pickup',
    items: [
      { product: 'Cheese Bacon', qty: 1, options: ['Ao ponto', 'Bacon'] },
      { product: 'Batata Frita', qty: 1 }
    ],
    status: 'ready',
    paymentStatus: 'paid'
  });

  // Pedido 3: Burger • Delivery • pendente • recebido
  await createOrder({
    store: burger,
    type: 'delivery',
    customerName: 'João Silva',
    customerPhone: '(11) 98888-7777',
    addressJson: { cep: '01234-567', address: 'Rua das Flores, Centro, São Paulo', number: '100', complement: 'Ap 12' },
    items: [
      { product: 'Burger Clássico', qty: 1, options: ['Ao ponto', 'Molho da casa'] },
      { product: 'Refrigerante Lata', qty: 1 }
    ],
    status: 'received',
    paymentStatus: 'pending'
  });
};