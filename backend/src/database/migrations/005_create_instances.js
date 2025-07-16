exports.up = function(knex) {
  return knex.schema.createTable('instances', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('series_id').references('id').inTable('series').onDelete('CASCADE');
    table.string('sop_instance_uid').unique().notNullable();
    table.string('sop_class_uid');
    table.string('instance_number');
    table.string('acquisition_number');
    table.string('content_date');
    table.string('content_time');
    table.integer('rows');
    table.integer('columns');
    table.integer('bits_allocated');
    table.integer('bits_stored');
    table.integer('high_bit');
    table.string('pixel_representation');
    table.string('photometric_interpretation');
    table.string('samples_per_pixel');
    table.string('transfer_syntax_uid');
    table.string('compression_type');
    table.string('image_type');
    table.float('slice_thickness');
    table.float('slice_location');
    table.json('image_position_patient');
    table.json('image_orientation_patient');
    table.json('pixel_spacing');
    table.json('window_center');
    table.json('window_width');
    table.json('dicom_metadata').defaultTo('{}');
    table.string('file_path');
    table.string('file_name');
    table.bigInteger('file_size_bytes');
    table.string('checksum');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('series_id');
    table.index('sop_instance_uid');
    table.index('instance_number');
    table.index('acquisition_number');
    table.index('content_date');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('instances');
};