/**
 * Cria tabelas principais. Tipos simplificados para SQLite.
 * Campos monetários em centavos (inteiro).
 */
exports.up = async function(knex) {
  await knex.schema.createTable('stores', (t) => {
    t.string('id').primary(); // uuid
    t.string('name').notNullable();
    t.string('slug').notNullable().unique();
    t.string('logoUrl');
    t.string('themePrimary').defaultTo('#e11d48'); // rosa/vermelho
    t.string('cnpj');
    t.json('openHours'); // {mon: [{open:"09:00", close:"18:00"}], ...}
    t.float('deliveryRadiusKm').defaultTo(3);
    t.integer('deliveryFee').defaultTo(0);
    t.integer('packagingFee').defaultTo(0);
    t.timestamp('createdAt').defaultTo(knex.fn.now());
    t.timestamp('updatedAt').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('tables', (t) => {
    t.string('id').primary();
    t.string('storeId').notNullable().references('stores.id').onDelete('CASCADE');
    t.string('name').notNullable();
    t.boolean('active').defaultTo(true);
  });

  await knex.schema.createTable('categories', (t) => {
    t.string('id').primary();
    t.string('storeId').notNullable().references('stores.id').onDelete('CASCADE');
    t.string('name').notNullable();
    t.integer('position').defaultTo(0);
  });

  await knex.schema.createTable('products', (t) => {
    t.string('id').primary();
    t.string('storeId').notNullable().references('stores.id').onDelete('CASCADE');
    t.string('categoryId').notNullable().references('categories.id').onDelete('CASCADE');
    t.string('name').notNullable();
    t.text('description');
    t.integer('price').notNullable(); // centavos
    t.string('imageUrl');
    t.boolean('active').defaultTo(true);
  });

  await knex.schema.createTable('option_groups', (t) => {
    t.string('id').primary();
    t.string('storeId').notNullable().references('stores.id').onDelete('CASCADE');
    t.string('name').notNullable();
    t.integer('min').defaultTo(0);
    t.integer('max').defaultTo(1);
    t.boolean('required').defaultTo(false);
  });

  await knex.schema.createTable('options', (t) => {
    t.string('id').primary();
    t.string('storeId').notNullable().references('stores.id').onDelete('CASCADE');
    t.string('groupId').notNullable().references('option_groups.id').onDelete('CASCADE');
    t.string('name').notNullable();
    t.integer('price').defaultTo(0);
  });

  await knex.schema.createTable('users', (t) => {
    t.string('id').primary();
    t.string('storeId').notNullable().references('stores.id').onDelete('CASCADE');
    t.string('email').notNullable().unique();
    t.string('passwordHash').notNullable();
    t.string('role').notNullable().defaultTo('admin'); // admin/staff
    t.timestamp('createdAt').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('orders', (t) => {
    t.string('id').primary(); // uuid
    t.string('storeId').notNullable().references('stores.id').onDelete('CASCADE');
    t.string('type').notNullable(); // dine_in/pickup/delivery
    t.string('tableId'); // nullable
    t.string('customerName');
    t.string('customerPhone');
    t.text('addressJson'); // para delivery
    t.integer('subtotal').notNullable().defaultTo(0);
    t.integer('deliveryFee').notNullable().defaultTo(0);
    t.integer('packagingFee').notNullable().defaultTo(0);
    t.integer('discount').notNullable().defaultTo(0);
    t.integer('total').notNullable().defaultTo(0);
    t.string('paymentStatus').notNullable().defaultTo('pending'); // pending/paid/failed/refunded
    t.string('status').notNullable().defaultTo('received'); // received/accepted/in_kitchen/ready/out_for_delivery/delivered/cancelled
    t.string('paymentProvider'); // mercadopago
    t.string('paymentRef'); // id do pagamento externo
    t.string('publicToken').notNullable(); // para tracking sem login
    t.timestamp('createdAt').defaultTo(knex.fn.now());
    t.timestamp('updatedAt').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('order_items', (t) => {
    t.string('id').primary();
    t.string('orderId').notNullable().references('orders.id').onDelete('CASCADE');
    t.string('productId').notNullable().references('products.id');
    t.string('nameSnapshot').notNullable();
    t.integer('unitPrice').notNullable();
    t.integer('qty').notNullable().defaultTo(1);
  });

  await knex.schema.createTable('order_item_options', (t) => {
    t.string('id').primary();
    t.string('orderItemId').notNullable().references('order_items.id').onDelete('CASCADE');
    t.string('optionId').notNullable().references('options.id');
    t.string('nameSnapshot').notNullable();
    t.integer('price').notNullable().defaultTo(0);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('order_item_options');
  await knex.schema.dropTableIfExists('order_items');
  await knex.schema.dropTableIfExists('orders');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('options');
  await knex.schema.dropTableIfExists('option_groups');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('categories');
  await knex.schema.dropTableIfExists('tables');
  await knex.schema.dropTableIfExists('stores');
};