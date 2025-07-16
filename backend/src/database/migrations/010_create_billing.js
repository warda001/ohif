exports.up = function(knex) {
  return knex.schema.createTable('billing', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.string('invoice_number').unique().notNullable();
    table.string('billing_period'); // monthly, quarterly, etc.
    table.date('period_start');
    table.date('period_end');
    table.decimal('amount_due', 10, 2).notNullable();
    table.decimal('amount_paid', 10, 2).defaultTo(0);
    table.string('currency').defaultTo('USD');
    table.string('status').defaultTo('pending'); // pending, paid, overdue, cancelled
    table.json('line_items').defaultTo('{}');
    table.json('usage_summary').defaultTo('{}');
    table.date('due_date');
    table.date('paid_date');
    table.string('payment_method');
    table.string('payment_reference');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('organization_id');
    table.index('invoice_number');
    table.index('status');
    table.index('due_date');
    table.index('billing_period');
    table.index('period_start');
    table.index('period_end');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('billing');
};