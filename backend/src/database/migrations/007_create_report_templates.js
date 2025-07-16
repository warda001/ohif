exports.up = function(knex) {
  return knex.schema.createTable('report_templates', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description');
    table.string('modality'); // X-ray, CT, MRI, etc.
    table.string('body_part');
    table.string('category');
    table.text('template_content');
    table.json('sections').defaultTo('{}'); // findings, impression, etc.
    table.json('macros').defaultTo('{}'); // pre-defined text snippets
    table.json('formatting').defaultTo('{}'); // styles, fonts, etc.
    table.string('language').defaultTo('en');
    table.boolean('is_default').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    table.uuid('created_by').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at');
    
    // Indexes
    table.index('organization_id');
    table.index('modality');
    table.index('body_part');
    table.index('category');
    table.index('language');
    table.index('is_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('report_templates');
};