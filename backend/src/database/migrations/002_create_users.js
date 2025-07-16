exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.string('email').unique().notNullable();
    table.string('password_hash');
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.string('role').notNullable(); // admin, radiologist, manager, technician, viewer
    table.string('specialization'); // for radiologists
    table.json('credentials').defaultTo('{}'); // medical licenses, certifications
    table.json('preferences').defaultTo('{}'); // language, theme, notifications
    table.json('permissions').defaultTo('{}'); // custom permissions
    table.string('phone');
    table.string('avatar_url');
    table.boolean('is_active').defaultTo(true);
    table.boolean('is_verified').defaultTo(false);
    table.boolean('two_factor_enabled').defaultTo(false);
    table.string('two_factor_secret');
    table.timestamp('last_login');
    table.timestamp('password_changed_at');
    table.string('reset_token');
    table.timestamp('reset_token_expires');
    table.string('verification_token');
    table.timestamp('verification_token_expires');
    table.json('login_attempts').defaultTo('{}');
    table.float('rating_average').defaultTo(0);
    table.integer('rating_count').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at');
    
    // Indexes
    table.index('organization_id');
    table.index('email');
    table.index('role');
    table.index('is_active');
    table.index('specialization');
    table.index('rating_average');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};