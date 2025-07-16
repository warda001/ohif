const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult, query } = require('express-validator');
const database = require('../database');
const { AppError } = require('../middleware/errorHandler');
const { authenticate, authorize, checkResourceAccess } = require('../middleware/auth');
const { parseDicomFile, storeDicomFile, validateDicomFile, searchStudies } = require('../services/dicomService');
const { notifyStudyAssigned, notifyStatOrder } = require('../services/socketService');
const { sendStudyAssignmentEmail, sendStatOrderEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for DICOM file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept all files for now, validation will be done later
    cb(null, true);
  }
});

// All routes require authentication
router.use(authenticate);

// Get all studies
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['unread', 'assigned', 'in_progress', 'completed', 'reported', 'disputed']),
  query('priority').optional().isIn(['normal', 'urgent', 'stat']),
  query('modality').optional().isAlpha(),
  query('assigned_to').optional().isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { 
      page = 1, 
      limit = 20, 
      status, 
      priority, 
      modality, 
      assigned_to,
      patient_name,
      patient_id,
      accession_number,
      study_date_from,
      study_date_to,
      search
    } = req.query;
    
    const offset = (page - 1) * limit;

    let query = database('studies')
      .select(
        'studies.*',
        'assigned_radiologist.first_name as radiologist_first_name',
        'assigned_radiologist.last_name as radiologist_last_name',
        'assigned_radiologist.email as radiologist_email'
      )
      .leftJoin('users as assigned_radiologist', 'studies.assigned_radiologist_id', 'assigned_radiologist.id')
      .where('studies.organization_id', req.user.organization_id);

    // Apply role-based filtering
    if (req.user.role === 'radiologist') {
      query = query.where(function() {
        this.where('studies.assigned_radiologist_id', req.user.id)
          .orWhere('studies.status', 'unread');
      });
    }

    // Apply filters
    if (status) {
      query = query.where('studies.status', status);
    }

    if (priority) {
      query = query.where('studies.priority', priority);
    }

    if (modality) {
      query = query.where('studies.modality', modality);
    }

    if (assigned_to) {
      query = query.where('studies.assigned_radiologist_id', assigned_to);
    }

    if (patient_name) {
      query = query.where('studies.patient_name', 'ilike', `%${patient_name}%`);
    }

    if (patient_id) {
      query = query.where('studies.patient_id', 'ilike', `%${patient_id}%`);
    }

    if (accession_number) {
      query = query.where('studies.accession_number', 'ilike', `%${accession_number}%`);
    }

    if (study_date_from) {
      query = query.where('studies.study_date', '>=', study_date_from);
    }

    if (study_date_to) {
      query = query.where('studies.study_date', '<=', study_date_to);
    }

    if (search) {
      query = query.where(function() {
        this.where('studies.patient_name', 'ilike', `%${search}%`)
          .orWhere('studies.patient_id', 'ilike', `%${search}%`)
          .orWhere('studies.accession_number', 'ilike', `%${search}%`)
          .orWhere('studies.study_description', 'ilike', `%${search}%`);
      });
    }

    // Get total count
    const totalQuery = query.clone();
    const [{ count }] = await totalQuery.count('* as count');

    // Get paginated results
    const studies = await query
      .orderBy('studies.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      studies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get study by ID
router.get('/:id', checkResourceAccess('study'), async (req, res, next) => {
  try {
    const study = await database('studies')
      .select(
        'studies.*',
        'assigned_radiologist.first_name as radiologist_first_name',
        'assigned_radiologist.last_name as radiologist_last_name',
        'assigned_radiologist.email as radiologist_email'
      )
      .leftJoin('users as assigned_radiologist', 'studies.assigned_radiologist_id', 'assigned_radiologist.id')
      .where('studies.id', req.params.id)
      .where('studies.organization_id', req.user.organization_id)
      .first();

    if (!study) {
      return next(new AppError('Study not found', 404));
    }

    // Get series for this study
    const series = await database('series')
      .where('study_id', req.params.id)
      .orderBy('series_number');

    // Get instances for each series
    for (const seriesItem of series) {
      const instances = await database('instances')
        .where('series_id', seriesItem.id)
        .orderBy('instance_number');
      seriesItem.instances = instances;
    }

    study.series = series;

    res.json({ study });
  } catch (error) {
    next(error);
  }
});

// Create new study
router.post('/', authorize('admin', 'manager', 'technician'), [
  body('study_instance_uid').notEmpty(),
  body('patient_name').notEmpty(),
  body('patient_id').notEmpty(),
  body('modality').notEmpty(),
  body('study_description').optional(),
  body('priority').optional().isIn(['normal', 'urgent', 'stat']),
  body('is_stat').optional().isBoolean()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const {
      study_instance_uid,
      patient_name,
      patient_id,
      patient_birth_date,
      patient_sex,
      patient_age,
      modality,
      study_description,
      study_date,
      study_time,
      accession_number,
      referring_physician,
      priority = 'normal',
      is_stat = false
    } = req.body;

    // Check if study already exists
    const existingStudy = await database('studies')
      .where('study_instance_uid', study_instance_uid)
      .where('organization_id', req.user.organization_id)
      .first();

    if (existingStudy) {
      return next(new AppError('Study already exists', 409));
    }

    // Create study
    const [study] = await database('studies')
      .insert({
        organization_id: req.user.organization_id,
        study_instance_uid,
        patient_name,
        patient_id,
        patient_birth_date,
        patient_sex,
        patient_age,
        modality,
        study_description,
        study_date: study_date || new Date(),
        study_time,
        accession_number,
        referring_physician,
        priority,
        is_stat,
        status: 'unread'
      })
      .returning('*');

    // If it's a STAT order, notify radiologists
    if (is_stat) {
      await notifyStatOrder(study.id);
    }

    res.status(201).json({
      message: 'Study created successfully',
      study
    });
  } catch (error) {
    next(error);
  }
});

// Upload DICOM files for a study
router.post('/:id/upload', checkResourceAccess('study'), upload.array('dicom_files', 100), async (req, res, next) => {
  try {
    const studyId = req.params.id;
    const files = req.files;

    if (!files || files.length === 0) {
      return next(new AppError('No files uploaded', 400));
    }

    // Get study
    const study = await database('studies')
      .where('id', studyId)
      .where('organization_id', req.user.organization_id)
      .first();

    if (!study) {
      return next(new AppError('Study not found', 404));
    }

    const uploadResults = [];

    for (const file of files) {
      try {
        // Validate DICOM file
        const validation = validateDicomFile(file.buffer);
        if (!validation.isValid) {
          uploadResults.push({
            filename: file.originalname,
            success: false,
            error: `Invalid DICOM file: ${validation.error || 'Missing required tags'}`
          });
          continue;
        }

        // Parse DICOM metadata
        const metadata = await parseDicomFile(file.buffer);

        // Store DICOM file
        const storageResult = await storeDicomFile(file.buffer, req.user.organization_id, metadata);

        uploadResults.push({
          filename: file.originalname,
          success: true,
          ...storageResult
        });

      } catch (error) {
        uploadResults.push({
          filename: file.originalname,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      message: 'Files processed',
      results: uploadResults
    });
  } catch (error) {
    next(error);
  }
});

// Assign study to radiologist
router.put('/:id/assign', authorize('admin', 'manager'), checkResourceAccess('study'), [
  body('radiologist_id').isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { radiologist_id } = req.body;
    const studyId = req.params.id;

    // Check if radiologist exists and is in the same organization
    const radiologist = await database('users')
      .where('id', radiologist_id)
      .where('organization_id', req.user.organization_id)
      .where('role', 'radiologist')
      .where('is_active', true)
      .first();

    if (!radiologist) {
      return next(new AppError('Radiologist not found', 404));
    }

    // Get study
    const study = await database('studies')
      .where('id', studyId)
      .where('organization_id', req.user.organization_id)
      .first();

    if (!study) {
      return next(new AppError('Study not found', 404));
    }

    // Calculate SLA due date
    const slaMinutes = study.is_stat ? 60 : 1440; // 1 hour for STAT, 24 hours for normal
    const slaDueDate = new Date(Date.now() + slaMinutes * 60 * 1000);

    // Assign study
    await database('studies')
      .where('id', studyId)
      .update({
        assigned_radiologist_id: radiologist_id,
        assigned_at: new Date(),
        status: 'assigned',
        sla_due_date: slaDueDate
      });

    // Send notifications
    await notifyStudyAssigned(studyId, radiologist_id);
    await sendStudyAssignmentEmail(radiologist.email, {
      name: `${radiologist.first_name} ${radiologist.last_name}`,
      patientName: study.patient_name,
      studyDescription: study.study_description,
      modality: study.modality,
      priority: study.priority,
      dueDate: slaDueDate.toISOString()
    });

    res.json({ message: 'Study assigned successfully' });
  } catch (error) {
    next(error);
  }
});

// Take study (radiologist claims unassigned study)
router.put('/:id/take', authorize('radiologist'), checkResourceAccess('study'), async (req, res, next) => {
  try {
    const studyId = req.params.id;

    // Get study
    const study = await database('studies')
      .where('id', studyId)
      .where('organization_id', req.user.organization_id)
      .where('status', 'unread')
      .whereNull('assigned_radiologist_id')
      .first();

    if (!study) {
      return next(new AppError('Study not available for assignment', 404));
    }

    // Calculate SLA due date
    const slaMinutes = study.is_stat ? 60 : 1440; // 1 hour for STAT, 24 hours for normal
    const slaDueDate = new Date(Date.now() + slaMinutes * 60 * 1000);

    // Assign study to current user
    await database('studies')
      .where('id', studyId)
      .update({
        assigned_radiologist_id: req.user.id,
        assigned_at: new Date(),
        status: 'assigned',
        sla_due_date: slaDueDate
      });

    res.json({ message: 'Study taken successfully' });
  } catch (error) {
    next(error);
  }
});

// Start reading study
router.put('/:id/start', authorize('radiologist'), checkResourceAccess('study'), async (req, res, next) => {
  try {
    const studyId = req.params.id;

    // Get study
    const study = await database('studies')
      .where('id', studyId)
      .where('assigned_radiologist_id', req.user.id)
      .where('status', 'assigned')
      .first();

    if (!study) {
      return next(new AppError('Study not found or not assigned to you', 404));
    }

    // Update status to in_progress
    await database('studies')
      .where('id', studyId)
      .update({
        status: 'in_progress',
        started_at: new Date()
      });

    res.json({ message: 'Study reading started' });
  } catch (error) {
    next(error);
  }
});

// Complete study
router.put('/:id/complete', authorize('radiologist'), checkResourceAccess('study'), async (req, res, next) => {
  try {
    const studyId = req.params.id;

    // Get study
    const study = await database('studies')
      .where('id', studyId)
      .where('assigned_radiologist_id', req.user.id)
      .where('status', 'in_progress')
      .first();

    if (!study) {
      return next(new AppError('Study not found or not in progress', 404));
    }

    // Update status to completed
    await database('studies')
      .where('id', studyId)
      .update({
        status: 'completed',
        completed_at: new Date()
      });

    res.json({ message: 'Study completed' });
  } catch (error) {
    next(error);
  }
});

// Flag study as STAT
router.put('/:id/stat', authorize('admin', 'manager'), checkResourceAccess('study'), async (req, res, next) => {
  try {
    const studyId = req.params.id;

    // Get study
    const study = await database('studies')
      .where('id', studyId)
      .where('organization_id', req.user.organization_id)
      .first();

    if (!study) {
      return next(new AppError('Study not found', 404));
    }

    // Update study as STAT
    await database('studies')
      .where('id', studyId)
      .update({
        is_stat: true,
        priority: 'stat',
        sla_due_date: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      });

    // Notify radiologists
    await notifyStatOrder(studyId);

    res.json({ message: 'Study flagged as STAT' });
  } catch (error) {
    next(error);
  }
});

// Search studies
router.get('/search', async (req, res, next) => {
  try {
    const searchParams = {
      organizationId: req.user.organization_id,
      ...req.query
    };

    const results = await searchStudies(searchParams);
    res.json({ studies: results });
  } catch (error) {
    next(error);
  }
});

// Get study statistics
router.get('/:id/stats', checkResourceAccess('study'), async (req, res, next) => {
  try {
    const studyId = req.params.id;

    const stats = await database('studies')
      .where('id', studyId)
      .select(
        'number_of_series',
        'number_of_instances',
        'total_size_bytes',
        'created_at',
        'assigned_at',
        'started_at',
        'completed_at',
        'sla_due_date'
      )
      .first();

    if (!stats) {
      return next(new AppError('Study not found', 404));
    }

    // Calculate timing statistics
    const now = new Date();
    const timings = {};

    if (stats.assigned_at) {
      timings.time_to_assignment = new Date(stats.assigned_at) - new Date(stats.created_at);
    }

    if (stats.started_at && stats.assigned_at) {
      timings.time_to_start = new Date(stats.started_at) - new Date(stats.assigned_at);
    }

    if (stats.completed_at && stats.started_at) {
      timings.reading_time = new Date(stats.completed_at) - new Date(stats.started_at);
    }

    if (stats.sla_due_date) {
      timings.time_remaining = new Date(stats.sla_due_date) - now;
    }

    res.json({
      stats: {
        ...stats,
        timings
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete study (admin only)
router.delete('/:id', authorize('admin'), checkResourceAccess('study'), async (req, res, next) => {
  try {
    const studyId = req.params.id;

    // Check if study has reports
    const reports = await database('reports')
      .where('study_id', studyId)
      .count('* as count')
      .first();

    if (reports.count > 0) {
      return next(new AppError('Cannot delete study with existing reports', 400));
    }

    // Delete instances
    await database('instances')
      .whereIn('series_id', function() {
        this.select('id').from('series').where('study_id', studyId);
      })
      .delete();

    // Delete series
    await database('series')
      .where('study_id', studyId)
      .delete();

    // Delete study
    await database('studies')
      .where('id', studyId)
      .delete();

    res.json({ message: 'Study deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;