/* eslint-disable camelcase */
exports.up = async function (knex) {
  // stores
  await knex.schema.createTable('stores', (t) => {
    t.increments('id').primary();
    t.string('name', 120).notNullable();
    t.string('slug', 120).notNullable().unique();
    t.string('logoUrl', 255).nullable();
    t.string('themePrimary', 32).defaultTo('#d32f2f');
    t.string('cnpj', 32).nullable();
    t.text('openHours').nullable(); // JSON string
    t.integer('deliveryRadiusKm').defaultTo(5);
    t.integer('deliveryFee').defaultTo(0); // em centavos
    t.integer('packagingFee').defaultTo(0); // em centavos
    t.timestamp('createdAt').defaultTo(knex.fn.now());
    t.timestamp('updatedAt').defaultTo(knex.fn.now());
  });

  // tables (mesas)
  await knex.schema.createTable('tables', (t) => {
    t.increments('id').primary();
    t.integer('storeId').notNullable().references('stores.id').onDelete('CASCADE').onUpdate('CASCADE');
    t.string('name', 60).nullable();
    t.string('number', 24).nullable();
    t.boolean('active').notNullable().defaultTo(true);
    t.index(['storeId']);
  });

  // categories
  await knex.schema.createTable('categories', (t) => {
    t.increments('id').primary();
    t.integer('storeId').notNullable().references('stores.id').onDelete('CASCADE').onUpdate('CASCADE');
    t.string('name', 80).notNullable();
    t.integer('position').notNullable().defaultTo(0);
    t.index(['storeId']);
  });

  // products
  await knex.schema.createTable('products', (t) => {
    t.increments('id').primary();
    t.integer('storeId').notNullable().references('stores.id').onDelete('CASCADE').onUpdate('CASCADE');
    t.integer('categoryId').notNullable().references('categories.id').onDelete('CASCADE').onUpdate('CASCADE');
    t.string('name', 120).notNullable();
    t.text('description').nullable();
    t.integer('price').notNullable(); // centavos
    t.string('imageUrl', 255).nullable();
    t.boolean('active').notNullable().defaultTo(true);
    t.index(['storeId']);
    t.index(['categoryId']);
  });

  // option groups
  await knex.schema.createTable('option_groups', (t) => {
    t.increments('id').primary();
    t.integer('storeId').notNullable().references('stores.id').onDelete('CASCADE').onUpdate('CASCADE');
    t.string('name', 80).notNullable();
    t.integer('min').notNullable().defaultTo(0);
    t.integer('max').notNullable().defaultTo(1);
    t.boolean('required').notNullable().defaultTo(false);
    t.index(['storeId']);
  });

  // options
  await knex.schema.createTable('options', (t) => {
    t.increments('id').primary();
    t.integer('storeId').notNullable().references('stores.id').onDelete('CASCADE').onUpdate('CASCADE');
    t.integer('groupId').notNullable().references('option_groups.id').onDelete('CASCADE').onUpdate('CASCADE');
    t.string('name', 80).notNullable();
    t.integer('price').notNullable().defaultTo(0); // centavos
    t.index(['storeId']);
    t.index(['groupId']);
  });

  // coupons (opcional)
  await knex.schema.createTable('coupons', (t) => {
    t.increments('id').primary();
    t.integer('storeId').notNullable().references('stores.id').onDelete('CASCADE').onUpdate('CASCADE');
    t.string('code', 40).notNullable();
    t.string('type', 20).notNullable(); // percentage | fixed
    t.integer('value').notNullable().defaultTo(0); // % quando percentage; centavos quando fixed
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamp('expiresAt').nullable();
    t.unique(['storeId', 'code']);
    t.index(['storeId']);
  });

  // orders
  await knex.schema.createTable('orders', (t) => {
    t.string('id', 32).primary(); // ex.: ord_xxx
    t.integer('storeId').notNullable().references('stores.id').onDelete('CASCADE').onUpdate('CASCADE');

    t.string('type', 20).notNullable(); // dine_in | pickup | delivery
    t.integer('tableId').nullable().references('tables.id').onDelete('SET NULL').onUpdate('CASCADE');

    t.string('customerName', 120).notNullable().defaultTo('');
    t.string('customerPhone', 40).notNullable().defaultTo('');
    t.text('addressJson').nullable(); // delivery

    t.integer('subtotal').notNullable().defaultTo(0);
    t.integer('deliveryFee').notNullable().defaultTo(0);
    t.integer('packagingFee').notNullable().defaultTo(0);
    t.integer('discount').notNullable().defaultTo(0);
    t.integer('total').notNullable().defaultTo(0);

    t.string('paymentStatus', 20).notNullable().defaultTo('pending'); // pending | paid | failed | refunded
    t.string('status', 30).notNullable().defaultTo('received'); // received | accepted | in_kitchen | ready | out_for_delivery | delivered | cancelled

    t.string('paymentProvider', 40).nullable(); // mercadopago | stripe | ...
    t.string('paymentRef', 80).nullable();

    t.timestamp('createdAt').defaultTo(knex.fn.now());
    t.timestamp('updatedAt').defaultTo(knex.fn.now());

    t.index(['storeId']);
    t.index(['status']);
    t.index(['paymentStatus']);
    t.index(['createdAt']);
  });

  // order_items
  await knex.schema.createTable('order_items', (t) => {
    t.increments('id').primary();
    t.string('orderId', 32).notNullable().references('orders.id').onDelete('CASCADE').onUpdate('CASCADE');
    t.integer('productId').nullable().references('products.id').onDelete('SET NULL').onUpdate('CASCADE');
    t.string('nameSnapshot', 160).notNullable();
    t.integer('unitPrice').notNullable();
    t.integer('qty').notNullable().defaultTo(1);
    t.index(['orderId']);
  });

  // order_item_options
  await knex.schema.createTable('order_item_options', (t) => {
    t.increments('id').primary();
    t.integer('orderItemId').notNullable().references('order_items.id').onDelete('CASCADE').onUpdate('CASCADE');
    t.integer('optionId').nullable().references('options.id').onDelete('SET NULL').onUpdate('CASCADE');
    t.string('nameSnapshot', 160).notNullable();
    t.integer('price').notNullable().defaultTo(0);
    t.index(['orderItemId']);
  });

  // users (admins/staff)
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.integer('storeId').notNullable().references('stores.id').onDelete('CASCADE').onUpdate('CASCADE');
    t.string('email', 160).notNullable().unique();
    t.string('passwordHash', 200).notNullable();
    t.string('role', 20).notNullable().defaultTo('admin'); // admin | staff
    t.timestamp('createdAt').defaultTo(knex.fn.now());
    t.index(['storeId']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('order_item_options');
  await knex.schema.dropTableIfExists('order_items');
  await knex.schema.dropTableIfExists('orders');
  await knex.schema.dropTableIfExists('coupons');
  await knex.schema.dropTableIfExists('options');
  await knex.schema.dropTableIfExists('option_groups');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('categories');
  await knex.schema.dropTableIfExists('tables');
  await knex.schema.dropTableIfExists('stores');
};