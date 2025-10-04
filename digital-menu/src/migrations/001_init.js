/**
 * Cria esquema multi-tenant com storeId em todas as entidades.
 */
exports.up = async function(knex) {
  await knex.schema.createTable('stores', table => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('slug').notNullable().unique();
    table.string('logoUrl');
    table.string('themePrimary').defaultTo('#D32F2F');
    table.string('cnpj');
    table.json('openHours'); // JSON simples
    table.decimal('deliveryRadiusKm').defaultTo(0);
    table.integer('deliveryFee').defaultTo(0);
    table.integer('packagingFee').defaultTo(0);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('tables', table => {
    table.increments('id').primary();
    table.integer('storeId').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    table.string('name').notNullable();
    table.boolean('active').defaultTo(true);
  });

  await knex.schema.createTable('categories', table => {
    table.increments('id').primary();
    table.integer('storeId').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    table.string('name').notNullable();
    table.integer('position').defaultTo(0);
  });

  await knex.schema.createTable('products', table => {
    table.increments('id').primary();
    table.integer('storeId').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    table.integer('categoryId').notNullable().references('id').inTable('categories').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description');
    table.integer('price').notNullable(); // centavos
    table.string('imageUrl');
    table.boolean('active').defaultTo(true);
  });

  await knex.schema.createTable('option_groups', table => {
    table.increments('id').primary();
    table.integer('storeId').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    table.string('name').notNullable();
    table.integer('min').defaultTo(0);
    table.integer('max').defaultTo(1);
    table.boolean('required').defaultTo(false);
  });

  await knex.schema.createTable('options', table => {
    table.increments('id').primary();
    table.integer('storeId').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    table.integer('groupId').notNullable().references('id').inTable('option_groups').onDelete('CASCADE');
    table.string('name').notNullable();
    table.integer('price').defaultTo(0);
  });

  await knex.schema.createTable('coupons', table => {
    table.increments('id').primary();
    table.integer('storeId').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    table.string('code').notNullable();
    table.enu('type', ['percentage', 'fixed']).notNullable();
    table.integer('value').notNullable();
    table.boolean('active').defaultTo(true);
    table.dateTime('expiresAt');
  });

  await knex.schema.createTable('orders', table => {
    table.increments('id').primary();
    table.string('publicId').notNullable().unique(); // token curto público
    table.integer('storeId').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    table.enu('type', ['dine_in', 'pickup', 'delivery']).notNullable();
    table.integer('tableId').nullable().references('id').inTable('tables').onDelete('SET NULL');
    table.string('customerName');
    table.string('customerPhone');
    table.json('addressJson');
    table.integer('subtotal').notNullable();
    table.integer('deliveryFee').defaultTo(0);
    table.integer('packagingFee').defaultTo(0);
    table.integer('discount').defaultTo(0);
    table.integer('total').notNullable();
    table.enu('paymentStatus', ['pending', 'paid', 'failed', 'refunded']).defaultTo('pending');
    table.enu('status', ['received', 'accepted', 'in_kitchen', 'ready', 'out_for_delivery', 'delivered', 'cancelled']).defaultTo('received');
    table.string('paymentProvider');
    table.string('paymentRef');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('order_items', table => {
    table.increments('id').primary();
    table.integer('orderId').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.integer('productId').notNullable().references('id').inTable('products').onDelete('SET NULL');
    table.string('nameSnapshot').notNullable();
    table.integer('unitPrice').notNullable();
    table.integer('qty').notNullable();
  });

  await knex.schema.createTable('order_item_options', table => {
    table.increments('id').primary();
    table.integer('orderItemId').notNullable().references('id').inTable('order_items').onDelete('CASCADE');
    table.integer('optionId').nullable().references('id').inTable('options').onDelete('SET NULL');
    table.string('nameSnapshot').notNullable();
    table.integer('price').notNullable();
  });

  await knex.schema.createTable('users', table => {
    table.increments('id').primary();
    table.integer('storeId').notNullable().references('id').inTable('stores').onDelete('CASCADE');
    table.string('email').notNullable().unique();
    table.string('passwordHash').notNullable();
    table.enu('role', ['admin', 'staff']).defaultTo('admin');
    table.dateTime('createdAt').defaultTo(knex.fn.now());
  });

  // Índices úteis
  await knex.schema.alterTable('categories', t => t.index(['storeId']));
  await knex.schema.alterTable('products', t => t.index(['storeId', 'categoryId']));
  await knex.schema.alterTable('orders', t => t.index(['storeId', 'status', 'paymentStatus']));
};

exports.down = async function(knex) {
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