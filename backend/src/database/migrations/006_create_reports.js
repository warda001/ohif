exports.up = function(knex) {
  return knex.schema.createTable('reports', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('study_id').references('id').inTable('studies').onDelete('CASCADE');
    table.uuid('radiologist_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('template_id').references('id').inTable('report_templates');
    table.string('report_number').unique();
    table.string('status').defaultTo('draft'); // draft, pending_review, finalized, disputed
    table.text('findings');
    table.text('impression');
    table.text('recommendations');
    table.text('technique');
    table.text('comparison');
    table.text('clinical_history');
    table.json('measurements').defaultTo('{}');
    table.json('annotations').defaultTo('{}');
    table.json('ai_suggestions').defaultTo('{}');
    table.string('language').defaultTo('en');
    table.json('translated_versions').defaultTo('{}');
    table.boolean('is_urgent').defaultTo(false);
    table.boolean('is_critical').defaultTo(false);
    table.text('critical_findings');
    table.datetime('dictated_at');
    table.datetime('transcribed_at');
    table.datetime('reviewed_at');
    table.datetime('finalized_at');
    table.datetime('signed_at');
    table.string('electronic_signature');
    table.uuid('reviewed_by').references('id').inTable('users');
    table.uuid('approved_by').references('id').inTable('users');
    table.json('version_history').defaultTo('{}');
    table.integer('version').defaultTo(1);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at');
    
    // Indexes
    table.index('study_id');
    table.index('radiologist_id');
    table.index('report_number');
    table.index('status');
    table.index('finalized_at');
    table.index('is_urgent');
    table.index('is_critical');
    table.index('language');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('reports');
};