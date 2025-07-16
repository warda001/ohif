exports.up = function(knex) {
  return knex.schema.createTable('audit_logs', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('action').notNullable();
    table.string('resource_type'); // study, report, user, etc.
    table.uuid('resource_id');
    table.json('old_values').defaultTo('{}');
    table.json('new_values').defaultTo('{}');
    table.string('ip_address');
    table.string('user_agent');
    table.json('metadata').defaultTo('{}');
    table.string('session_id');
    table.string('request_id');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('organization_id');
    table.index('user_id');
    table.index('action');
    table.index('resource_type');
    table.index('resource_id');
    table.index('created_at');
    table.index('session_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('audit_logs');
};