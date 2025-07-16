exports.up = function(knex) {
  return knex.schema.createTable('ratings', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('radiologist_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('study_id').references('id').inTable('studies').onDelete('CASCADE');
    table.uuid('report_id').references('id').inTable('reports').onDelete('CASCADE');
    table.uuid('rated_by').references('id').inTable('users').onDelete('CASCADE');
    table.integer('rating').notNullable(); // 1-5 stars
    table.text('feedback');
    table.json('criteria_scores').defaultTo('{}'); // accuracy, timeliness, etc.
    table.string('category').defaultTo('general'); // accuracy, timeliness, communication
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('radiologist_id');
    table.index('study_id');
    table.index('rated_by');
    table.index('rating');
    table.index('category');
    table.index('created_at');
    
    // Unique constraint to prevent duplicate ratings
    table.unique(['radiologist_id', 'study_id', 'rated_by']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('ratings');
};