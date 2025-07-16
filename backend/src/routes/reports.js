const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../database');
const { AppError } = require('../middleware/errorHandler');
const { authenticate, authorize, checkResourceAccess } = require('../middleware/auth');
const { notifyReportFinalized } = require('../services/socketService');
const { sendReportFinalizedEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all reports
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, study_id, radiologist_id } = req.query;
    const offset = (page - 1) * limit;

    let query = database('reports')
      .select(
        'reports.*',
        'studies.patient_name',
        'studies.patient_id',
        'studies.accession_number',
        'studies.study_description',
        'studies.modality',
        'studies.study_date',
        'radiologist.first_name as radiologist_first_name',
        'radiologist.last_name as radiologist_last_name',
        'radiologist.email as radiologist_email'
      )
      .join('studies', 'reports.study_id', 'studies.id')
      .leftJoin('users as radiologist', 'reports.radiologist_id', 'radiologist.id')
      .where('studies.organization_id', req.user.organization_id);

    // Apply role-based filtering
    if (req.user.role === 'radiologist') {
      query = query.where('reports.radiologist_id', req.user.id);
    }

    // Apply filters
    if (status) {
      query = query.where('reports.status', status);
    }

    if (study_id) {
      query = query.where('reports.study_id', study_id);
    }

    if (radiologist_id) {
      query = query.where('reports.radiologist_id', radiologist_id);
    }

    // Get total count
    const totalQuery = query.clone();
    const [{ count }] = await totalQuery.count('* as count');

    // Get paginated results
    const reports = await query
      .orderBy('reports.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      reports,
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

// Get report by ID
router.get('/:id', checkResourceAccess('report'), async (req, res, next) => {
  try {
    const report = await database('reports')
      .select(
        'reports.*',
        'studies.patient_name',
        'studies.patient_id',
        'studies.accession_number',
        'studies.study_description',
        'studies.modality',
        'studies.study_date',
        'studies.study_instance_uid',
        'radiologist.first_name as radiologist_first_name',
        'radiologist.last_name as radiologist_last_name',
        'radiologist.email as radiologist_email'
      )
      .join('studies', 'reports.study_id', 'studies.id')
      .leftJoin('users as radiologist', 'reports.radiologist_id', 'radiologist.id')
      .where('reports.id', req.params.id)
      .where('studies.organization_id', req.user.organization_id)
      .first();

    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    res.json({ report });
  } catch (error) {
    next(error);
  }
});

// Create new report
router.post('/', authorize('radiologist'), [
  body('study_id').isUUID(),
  body('impression').optional().isString(),
  body('findings').optional().isString(),
  body('template_id').optional().isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const {
      study_id,
      impression,
      findings,
      recommendations,
      template_id,
      annotations,
      measurements
    } = req.body;

    // Check if study exists and is assigned to the radiologist
    const study = await database('studies')
      .where('id', study_id)
      .where('organization_id', req.user.organization_id)
      .where('assigned_radiologist_id', req.user.id)
      .first();

    if (!study) {
      return next(new AppError('Study not found or not assigned to you', 404));
    }

    // Check if report already exists
    const existingReport = await database('reports')
      .where('study_id', study_id)
      .first();

    if (existingReport) {
      return next(new AppError('Report already exists for this study', 409));
    }

    // Create report
    const [report] = await database('reports')
      .insert({
        study_id,
        radiologist_id: req.user.id,
        impression,
        findings,
        recommendations,
        template_id,
        annotations: annotations || {},
        measurements: measurements || {},
        status: 'draft'
      })
      .returning('*');

    // Update study status
    await database('studies')
      .where('id', study_id)
      .update({
        status: 'reported',
        reported_at: new Date()
      });

    res.status(201).json({
      message: 'Report created successfully',
      report
    });
  } catch (error) {
    next(error);
  }
});

// Update report
router.put('/:id', checkResourceAccess('report'), [
  body('impression').optional().isString(),
  body('findings').optional().isString(),
  body('recommendations').optional().isString()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const reportId = req.params.id;
    const {
      impression,
      findings,
      recommendations,
      annotations,
      measurements
    } = req.body;

    // Get report
    const report = await database('reports')
      .join('studies', 'reports.study_id', 'studies.id')
      .where('reports.id', reportId)
      .where('studies.organization_id', req.user.organization_id)
      .select('reports.*')
      .first();

    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    // Only the radiologist who created the report can edit it (unless it's finalized)
    if (report.radiologist_id !== req.user.id && report.status === 'finalized') {
      return next(new AppError('Cannot edit finalized report', 403));
    }

    // Update report
    const updates = {};
    if (impression !== undefined) updates.impression = impression;
    if (findings !== undefined) updates.findings = findings;
    if (recommendations !== undefined) updates.recommendations = recommendations;
    if (annotations !== undefined) updates.annotations = annotations;
    if (measurements !== undefined) updates.measurements = measurements;

    await database('reports')
      .where('id', reportId)
      .update({
        ...updates,
        updated_at: new Date()
      });

    // Get updated report
    const updatedReport = await database('reports')
      .where('id', reportId)
      .first();

    res.json({
      message: 'Report updated successfully',
      report: updatedReport
    });
  } catch (error) {
    next(error);
  }
});

// Finalize report
router.put('/:id/finalize', checkResourceAccess('report'), async (req, res, next) => {
  try {
    const reportId = req.params.id;

    // Get report
    const report = await database('reports')
      .join('studies', 'reports.study_id', 'studies.id')
      .where('reports.id', reportId)
      .where('studies.organization_id', req.user.organization_id)
      .select('reports.*', 'studies.patient_name', 'studies.study_description', 'studies.modality')
      .first();

    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    // Only the radiologist who created the report can finalize it
    if (report.radiologist_id !== req.user.id) {
      return next(new AppError('Access denied', 403));
    }

    // Check if report is already finalized
    if (report.status === 'finalized') {
      return next(new AppError('Report already finalized', 400));
    }

    // Finalize report
    await database('reports')
      .where('id', reportId)
      .update({
        status: 'finalized',
        finalized_at: new Date(),
        finalized_by: req.user.id
      });

    // Send notifications
    await notifyReportFinalized(reportId);

    res.json({ message: 'Report finalized successfully' });
  } catch (error) {
    next(error);
  }
});

// Sign report (electronic signature)
router.put('/:id/sign', checkResourceAccess('report'), [
  body('signature_type').isIn(['electronic', 'digital']),
  body('signature_data').optional().isString()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const reportId = req.params.id;
    const { signature_type, signature_data } = req.body;

    // Get report
    const report = await database('reports')
      .join('studies', 'reports.study_id', 'studies.id')
      .where('reports.id', reportId)
      .where('studies.organization_id', req.user.organization_id)
      .select('reports.*')
      .first();

    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    // Only the radiologist who created the report can sign it
    if (report.radiologist_id !== req.user.id) {
      return next(new AppError('Access denied', 403));
    }

    // Check if report is finalized
    if (report.status !== 'finalized') {
      return next(new AppError('Report must be finalized before signing', 400));
    }

    // Add signature
    await database('reports')
      .where('id', reportId)
      .update({
        signature_type,
        signature_data,
        signed_at: new Date(),
        signed_by: req.user.id
      });

    res.json({ message: 'Report signed successfully' });
  } catch (error) {
    next(error);
  }
});

// Create report revision
router.post('/:id/revisions', checkResourceAccess('report'), [
  body('reason').notEmpty(),
  body('changes').notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const reportId = req.params.id;
    const { reason, changes } = req.body;

    // Get report
    const report = await database('reports')
      .join('studies', 'reports.study_id', 'studies.id')
      .where('reports.id', reportId)
      .where('studies.organization_id', req.user.organization_id)
      .select('reports.*')
      .first();

    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    // Store current report version
    const currentVersion = {
      impression: report.impression,
      findings: report.findings,
      recommendations: report.recommendations,
      annotations: report.annotations,
      measurements: report.measurements,
      version: report.version || 1,
      revised_at: new Date(),
      revised_by: req.user.id,
      revision_reason: reason
    };

    // Update report with new version
    await database('reports')
      .where('id', reportId)
      .update({
        ...changes,
        version: (report.version || 1) + 1,
        revision_history: database.raw('jsonb_insert(COALESCE(revision_history, \'[]\'), \'{0}\', ?)', [JSON.stringify(currentVersion)]),
        updated_at: new Date()
      });

    res.json({ message: 'Report revision created successfully' });
  } catch (error) {
    next(error);
  }
});

// Get report revisions
router.get('/:id/revisions', checkResourceAccess('report'), async (req, res, next) => {
  try {
    const reportId = req.params.id;

    const report = await database('reports')
      .join('studies', 'reports.study_id', 'studies.id')
      .where('reports.id', reportId)
      .where('studies.organization_id', req.user.organization_id)
      .select('reports.revision_history', 'reports.version')
      .first();

    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    res.json({
      current_version: report.version || 1,
      revision_history: report.revision_history || []
    });
  } catch (error) {
    next(error);
  }
});

// Add annotation to report
router.post('/:id/annotations', checkResourceAccess('report'), [
  body('type').isIn(['measurement', 'arrow', 'text', 'circle', 'rectangle']),
  body('data').isObject(),
  body('series_id').optional().isUUID(),
  body('instance_id').optional().isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const reportId = req.params.id;
    const { type, data, series_id, instance_id } = req.body;

    // Get report
    const report = await database('reports')
      .join('studies', 'reports.study_id', 'studies.id')
      .where('reports.id', reportId)
      .where('studies.organization_id', req.user.organization_id)
      .select('reports.*')
      .first();

    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    // Create annotation
    const annotation = {
      id: require('uuid').v4(),
      type,
      data,
      series_id,
      instance_id,
      created_at: new Date(),
      created_by: req.user.id
    };

    // Update report annotations
    await database('reports')
      .where('id', reportId)
      .update({
        annotations: database.raw('jsonb_insert(COALESCE(annotations, \'[]\'), \'{0}\', ?)', [JSON.stringify(annotation)]),
        updated_at: new Date()
      });

    res.json({
      message: 'Annotation added successfully',
      annotation
    });
  } catch (error) {
    next(error);
  }
});

// Update annotation
router.put('/:id/annotations/:annotation_id', checkResourceAccess('report'), [
  body('data').isObject()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const reportId = req.params.id;
    const annotationId = req.params.annotation_id;
    const { data } = req.body;

    // Get report
    const report = await database('reports')
      .join('studies', 'reports.study_id', 'studies.id')
      .where('reports.id', reportId)
      .where('studies.organization_id', req.user.organization_id)
      .select('reports.*')
      .first();

    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    // Update annotation
    await database.raw(`
      UPDATE reports 
      SET annotations = jsonb_set(
        annotations, 
        '{${annotationId},data}', 
        ?
      ),
      updated_at = now()
      WHERE id = ?
    `, [JSON.stringify(data), reportId]);

    res.json({ message: 'Annotation updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete annotation
router.delete('/:id/annotations/:annotation_id', checkResourceAccess('report'), async (req, res, next) => {
  try {
    const reportId = req.params.id;
    const annotationId = req.params.annotation_id;

    // Get report
    const report = await database('reports')
      .join('studies', 'reports.study_id', 'studies.id')
      .where('reports.id', reportId)
      .where('studies.organization_id', req.user.organization_id)
      .select('reports.*')
      .first();

    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    // Remove annotation
    await database.raw(`
      UPDATE reports 
      SET annotations = annotations - ?
      WHERE id = ?
    `, [annotationId, reportId]);

    res.json({ message: 'Annotation deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Export report
router.get('/:id/export', checkResourceAccess('report'), async (req, res, next) => {
  try {
    const reportId = req.params.id;
    const { format = 'pdf' } = req.query;

    // Get report with full details
    const report = await database('reports')
      .select(
        'reports.*',
        'studies.patient_name',
        'studies.patient_id',
        'studies.accession_number',
        'studies.study_description',
        'studies.modality',
        'studies.study_date',
        'studies.study_instance_uid',
        'radiologist.first_name as radiologist_first_name',
        'radiologist.last_name as radiologist_last_name',
        'radiologist.email as radiologist_email'
      )
      .join('studies', 'reports.study_id', 'studies.id')
      .leftJoin('users as radiologist', 'reports.radiologist_id', 'radiologist.id')
      .where('reports.id', reportId)
      .where('studies.organization_id', req.user.organization_id)
      .first();

    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    // Export based on format
    if (format === 'pdf') {
      // Generate PDF (implementation depends on PDF library)
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=report_${reportId}.pdf`);
      // PDF generation logic here
      res.json({ message: 'PDF export not yet implemented' });
    } else if (format === 'json') {
      res.json({ report });
    } else {
      return next(new AppError('Unsupported export format', 400));
    }
  } catch (error) {
    next(error);
  }
});

// Get report statistics
router.get('/:id/stats', checkResourceAccess('report'), async (req, res, next) => {
  try {
    const reportId = req.params.id;

    const report = await database('reports')
      .join('studies', 'reports.study_id', 'studies.id')
      .where('reports.id', reportId)
      .where('studies.organization_id', req.user.organization_id)
      .select(
        'reports.created_at',
        'reports.finalized_at',
        'reports.signed_at',
        'reports.version',
        'studies.assigned_at',
        'studies.started_at',
        'studies.completed_at'
      )
      .first();

    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    // Calculate timing statistics
    const timings = {};
    
    if (report.created_at && report.completed_at) {
      timings.report_creation_time = new Date(report.created_at) - new Date(report.completed_at);
    }

    if (report.finalized_at && report.created_at) {
      timings.report_finalization_time = new Date(report.finalized_at) - new Date(report.created_at);
    }

    if (report.signed_at && report.finalized_at) {
      timings.signing_time = new Date(report.signed_at) - new Date(report.finalized_at);
    }

    res.json({
      stats: {
        ...report,
        timings
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete report (admin only)
router.delete('/:id', authorize('admin'), checkResourceAccess('report'), async (req, res, next) => {
  try {
    const reportId = req.params.id;

    // Check if report is finalized
    const report = await database('reports')
      .where('id', reportId)
      .first();

    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    if (report.status === 'finalized') {
      return next(new AppError('Cannot delete finalized report', 400));
    }

    // Delete report
    await database('reports')
      .where('id', reportId)
      .delete();

    // Update study status
    await database('studies')
      .where('id', report.study_id)
      .update({
        status: 'completed'
      });

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;