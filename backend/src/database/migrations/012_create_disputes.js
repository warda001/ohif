exports.up = function(knex) {
  return knex.schema.createTable('disputes', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('report_id').references('id').inTable('reports').onDelete('CASCADE');
    table.uuid('study_id').references('id').inTable('studies').onDelete('CASCADE');
    table.uuid('raised_by').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('assigned_to').references('id').inTable('users');
    table.string('dispute_number').unique().notNullable();
    table.string('status').defaultTo('open'); // open, investigating, resolved, closed
    table.string('priority').defaultTo('medium'); // low, medium, high, urgent
    table.text('reason');
    table.text('description');
    table.json('evidence').defaultTo('{}');
    table.text('resolution');
    table.datetime('resolved_at');
    table.uuid('resolved_by').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('report_id');
    table.index('study_id');
    table.index('raised_by');
    table.index('assigned_to');
    table.index('dispute_number');
    table.index('status');
    table.index('priority');
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('disputes');
};