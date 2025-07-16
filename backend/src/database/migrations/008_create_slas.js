exports.up = function(knex) {
  return knex.schema.createTable('slas', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description');
    table.string('priority').notNullable(); // normal, urgent, stat
    table.string('modality'); // specific modality or 'all'
    table.integer('turnaround_time_minutes').notNullable();
    table.integer('warning_threshold_minutes'); // alert before breach
    table.json('business_hours').defaultTo('{}'); // working hours
    table.json('escalation_rules').defaultTo('{}');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('effective_from').defaultTo(knex.fn.now());
    table.timestamp('effective_to');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('organization_id');
    table.index('priority');
    table.index('modality');
    table.index('is_active');
    table.index('effective_from');
    table.index('effective_to');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('slas');
};