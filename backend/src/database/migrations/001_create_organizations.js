exports.up = function(knex) {
  return knex.schema.createTable('organizations', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('code').unique().notNullable();
    table.string('type').notNullable().defaultTo('healthcare'); // healthcare, radiology_group
    table.text('description');
    table.json('address');
    table.string('contact_email');
    table.string('contact_phone');
    table.string('license_number');
    table.string('tax_id');
    table.boolean('is_active').defaultTo(true);
    table.json('settings').defaultTo('{}');
    table.json('branding').defaultTo('{}'); // logo, colors, etc.
    table.json('sla_defaults').defaultTo('{}'); // default SLA settings
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at');
    
    // Indexes
    table.index('code');
    table.index('is_active');
    table.index('type');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('organizations');
};