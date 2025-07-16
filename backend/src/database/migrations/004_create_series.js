exports.up = function(knex) {
  return knex.schema.createTable('series', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('study_id').references('id').inTable('studies').onDelete('CASCADE');
    table.string('series_instance_uid').unique().notNullable();
    table.string('series_number');
    table.string('series_description');
    table.string('modality');
    table.string('body_part_examined');
    table.string('protocol_name');
    table.string('operator_name');
    table.datetime('series_date');
    table.datetime('series_time');
    table.integer('number_of_instances').defaultTo(0);
    table.string('manufacturer');
    table.string('manufacturer_model_name');
    table.string('device_serial_number');
    table.string('software_version');
    table.json('dicom_metadata').defaultTo('{}');
    table.string('storage_path');
    table.bigInteger('total_size_bytes').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('study_id');
    table.index('series_instance_uid');
    table.index('modality');
    table.index('series_number');
    table.index('series_date');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('series');
};