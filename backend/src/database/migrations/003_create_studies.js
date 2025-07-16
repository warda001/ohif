exports.up = function(knex) {
  return knex.schema.createTable('studies', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.string('study_instance_uid').unique().notNullable();
    table.string('accession_number');
    table.string('patient_id');
    table.string('patient_name');
    table.date('patient_birth_date');
    table.string('patient_sex');
    table.string('patient_age');
    table.float('patient_weight');
    table.float('patient_height');
    table.string('referring_physician');
    table.string('performing_physician');
    table.string('study_description');
    table.datetime('study_date');
    table.datetime('study_time');
    table.string('modality');
    table.string('institution_name');
    table.string('station_name');
    table.string('department_name');
    table.integer('number_of_series').defaultTo(0);
    table.integer('number_of_instances').defaultTo(0);
    table.string('priority').defaultTo('normal'); // normal, urgent, stat
    table.string('status').defaultTo('unread'); // unread, assigned, in_progress, completed, reported, disputed
    table.uuid('assigned_radiologist_id').references('id').inTable('users');
    table.datetime('assigned_at');
    table.datetime('started_at');
    table.datetime('completed_at');
    table.datetime('reported_at');
    table.datetime('sla_due_date');
    table.boolean('is_stat').defaultTo(false);
    table.boolean('is_anonymized').defaultTo(false);
    table.json('anonymization_map').defaultTo('{}');
    table.json('dicom_metadata').defaultTo('{}');
    table.json('custom_fields').defaultTo('{}');
    table.string('storage_path');
    table.bigInteger('total_size_bytes').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at');
    
    // Indexes
    table.index('organization_id');
    table.index('study_instance_uid');
    table.index('accession_number');
    table.index('patient_id');
    table.index('status');
    table.index('priority');
    table.index('assigned_radiologist_id');
    table.index('study_date');
    table.index('modality');
    table.index('is_stat');
    table.index('sla_due_date');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('studies');
};