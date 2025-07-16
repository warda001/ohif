exports.up = function(knex) {
  return knex.schema.createTable('notifications', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('type').notNullable(); // sla_warning, stat_order, new_assignment, etc.
    table.string('title').notNullable();
    table.text('message');
    table.json('data').defaultTo('{}');
    table.string('priority').defaultTo('normal'); // low, normal, high, urgent
    table.boolean('is_read').defaultTo(false);
    table.boolean('is_email_sent').defaultTo(false);
    table.boolean('is_sms_sent').defaultTo(false);
    table.datetime('read_at');
    table.datetime('email_sent_at');
    table.datetime('sms_sent_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('organization_id');
    table.index('user_id');
    table.index('type');
    table.index('priority');
    table.index('is_read');
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('notifications');
};