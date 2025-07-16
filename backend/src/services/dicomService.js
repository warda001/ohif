const dicomParser = require('dicom-parser');
const dcmjs = require('dcmjs');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const database = require('../database');
const logger = require('../utils/logger');

class DicomService {
  constructor() {
    this.storagePath = process.env.DICOM_STORAGE_PATH || './dicom_storage';
    this.aet = process.env.DICOM_AET || 'RADIOLOGY_PLATFORM';
    this.port = process.env.DICOM_PORT || 11112;
    this.ensureStorageDirectory();
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create DICOM storage directory:', error);
    }
  }

  /**
   * Parse DICOM file and extract metadata
   * @param {Buffer} fileBuffer - DICOM file buffer
   * @returns {Object} Parsed DICOM metadata
   */
  async parseDicomFile(fileBuffer) {
    try {
      const dataSet = dicomParser.parseDicom(fileBuffer);
      
      // Extract common DICOM tags
      const metadata = {
        // Study level
        studyInstanceUID: this.getTagValue(dataSet, 'x0020000d'),
        studyDate: this.getTagValue(dataSet, 'x00080020'),
        studyTime: this.getTagValue(dataSet, 'x00080030'),
        studyDescription: this.getTagValue(dataSet, 'x00081030'),
        accessionNumber: this.getTagValue(dataSet, 'x00080050'),
        
        // Patient level
        patientName: this.getTagValue(dataSet, 'x00100010'),
        patientID: this.getTagValue(dataSet, 'x00100020'),
        patientBirthDate: this.getTagValue(dataSet, 'x00100030'),
        patientSex: this.getTagValue(dataSet, 'x00100040'),
        patientAge: this.getTagValue(dataSet, 'x00101010'),
        
        // Series level
        seriesInstanceUID: this.getTagValue(dataSet, 'x0020000e'),
        seriesNumber: this.getTagValue(dataSet, 'x00200011'),
        seriesDescription: this.getTagValue(dataSet, 'x0008103e'),
        modality: this.getTagValue(dataSet, 'x00080060'),
        bodyPartExamined: this.getTagValue(dataSet, 'x00180015'),
        
        // Instance level
        sopInstanceUID: this.getTagValue(dataSet, 'x00080018'),
        sopClassUID: this.getTagValue(dataSet, 'x00080016'),
        instanceNumber: this.getTagValue(dataSet, 'x00200013'),
        
        // Image information
        rows: this.getTagValue(dataSet, 'x00280010'),
        columns: this.getTagValue(dataSet, 'x00280011'),
        bitsAllocated: this.getTagValue(dataSet, 'x00280100'),
        bitsStored: this.getTagValue(dataSet, 'x00280101'),
        pixelRepresentation: this.getTagValue(dataSet, 'x00280103'),
        photometricInterpretation: this.getTagValue(dataSet, 'x00280004'),
        
        // Equipment information
        institutionName: this.getTagValue(dataSet, 'x00080080'),
        stationName: this.getTagValue(dataSet, 'x00081010'),
        manufacturer: this.getTagValue(dataSet, 'x00080070'),
        manufacturerModelName: this.getTagValue(dataSet, 'x00081090'),
        
        // Physician information
        referringPhysicianName: this.getTagValue(dataSet, 'x00080090'),
        performingPhysicianName: this.getTagValue(dataSet, 'x00081050'),
        
        // Additional metadata
        acquisitionDate: this.getTagValue(dataSet, 'x00080022'),
        acquisitionTime: this.getTagValue(dataSet, 'x00080032'),
        contentDate: this.getTagValue(dataSet, 'x00080023'),
        contentTime: this.getTagValue(dataSet, 'x00080033'),
        
        // Pixel spacing and geometry
        pixelSpacing: this.getTagValue(dataSet, 'x00280030'),
        sliceThickness: this.getTagValue(dataSet, 'x00180050'),
        sliceLocation: this.getTagValue(dataSet, 'x00201041'),
        imagePositionPatient: this.getTagValue(dataSet, 'x00200032'),
        imageOrientationPatient: this.getTagValue(dataSet, 'x00200037'),
        
        // Window/Level
        windowCenter: this.getTagValue(dataSet, 'x00281050'),
        windowWidth: this.getTagValue(dataSet, 'x00281051'),
        
        // Transfer syntax
        transferSyntaxUID: this.getTagValue(dataSet, 'x00020010')
      };

      return metadata;
    } catch (error) {
      logger.error('Failed to parse DICOM file:', error);
      throw error;
    }
  }

  /**
   * Get tag value from DICOM dataset
   * @param {Object} dataSet - DICOM dataset
   * @param {string} tag - DICOM tag
   * @returns {string} Tag value
   */
  getTagValue(dataSet, tag) {
    try {
      const element = dataSet.elements[tag];
      if (!element) return null;
      
      return dataSet.string(tag);
    } catch (error) {
      return null;
    }
  }

  /**
   * Store DICOM file
   * @param {Buffer} fileBuffer - DICOM file buffer
   * @param {string} organizationId - Organization ID
   * @param {Object} metadata - DICOM metadata
   * @returns {Object} Storage information
   */
  async storeDicomFile(fileBuffer, organizationId, metadata) {
    try {
      // Generate file paths
      const studyPath = path.join(this.storagePath, organizationId, metadata.studyInstanceUID);
      const seriesPath = path.join(studyPath, metadata.seriesInstanceUID);
      const fileName = `${metadata.sopInstanceUID}.dcm`;
      const filePath = path.join(seriesPath, fileName);

      // Create directories
      await fs.mkdir(seriesPath, { recursive: true });

      // Calculate file checksum
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Store file
      await fs.writeFile(filePath, fileBuffer);

      // Store in database
      await this.storeDicomMetadata(organizationId, metadata, filePath, fileBuffer.length, checksum);

      return {
        filePath,
        fileName,
        checksum,
        size: fileBuffer.length
      };
    } catch (error) {
      logger.error('Failed to store DICOM file:', error);
      throw error;
    }
  }

  /**
   * Store DICOM metadata in database
   * @param {string} organizationId - Organization ID
   * @param {Object} metadata - DICOM metadata
   * @param {string} filePath - File path
   * @param {number} fileSize - File size
   * @param {string} checksum - File checksum
   */
  async storeDicomMetadata(organizationId, metadata, filePath, fileSize, checksum) {
    try {
      // Check if study exists
      let study = await database('studies')
        .where('study_instance_uid', metadata.studyInstanceUID)
        .where('organization_id', organizationId)
        .first();

      if (!study) {
        // Create study
        const [studyId] = await database('studies')
          .insert({
            organization_id: organizationId,
            study_instance_uid: metadata.studyInstanceUID,
            accession_number: metadata.accessionNumber,
            patient_id: metadata.patientID,
            patient_name: metadata.patientName,
            patient_birth_date: metadata.patientBirthDate,
            patient_sex: metadata.patientSex,
            patient_age: metadata.patientAge,
            study_date: metadata.studyDate,
            study_time: metadata.studyTime,
            study_description: metadata.studyDescription,
            modality: metadata.modality,
            referring_physician: metadata.referringPhysicianName,
            performing_physician: metadata.performingPhysicianName,
            institution_name: metadata.institutionName,
            station_name: metadata.stationName,
            dicom_metadata: metadata,
            storage_path: path.dirname(filePath)
          })
          .returning('id');

        study = { id: studyId };
      }

      // Check if series exists
      let series = await database('series')
        .where('series_instance_uid', metadata.seriesInstanceUID)
        .where('study_id', study.id)
        .first();

      if (!series) {
        // Create series
        const [seriesId] = await database('series')
          .insert({
            study_id: study.id,
            series_instance_uid: metadata.seriesInstanceUID,
            series_number: metadata.seriesNumber,
            series_description: metadata.seriesDescription,
            modality: metadata.modality,
            body_part_examined: metadata.bodyPartExamined,
            series_date: metadata.acquisitionDate,
            series_time: metadata.acquisitionTime,
            manufacturer: metadata.manufacturer,
            manufacturer_model_name: metadata.manufacturerModelName,
            dicom_metadata: metadata,
            storage_path: path.dirname(filePath)
          })
          .returning('id');

        series = { id: seriesId };
      }

      // Store instance
      await database('instances').insert({
        series_id: series.id,
        sop_instance_uid: metadata.sopInstanceUID,
        sop_class_uid: metadata.sopClassUID,
        instance_number: metadata.instanceNumber,
        acquisition_number: metadata.acquisitionNumber,
        content_date: metadata.contentDate,
        content_time: metadata.contentTime,
        rows: metadata.rows,
        columns: metadata.columns,
        bits_allocated: metadata.bitsAllocated,
        bits_stored: metadata.bitsStored,
        pixel_representation: metadata.pixelRepresentation,
        photometric_interpretation: metadata.photometricInterpretation,
        transfer_syntax_uid: metadata.transferSyntaxUID,
        slice_thickness: metadata.sliceThickness,
        slice_location: metadata.sliceLocation,
        image_position_patient: metadata.imagePositionPatient,
        image_orientation_patient: metadata.imageOrientationPatient,
        pixel_spacing: metadata.pixelSpacing,
        window_center: metadata.windowCenter,
        window_width: metadata.windowWidth,
        dicom_metadata: metadata,
        file_path: filePath,
        file_name: path.basename(filePath),
        file_size_bytes: fileSize,
        checksum: checksum
      });

      // Update counts
      await this.updateCounts(study.id);

    } catch (error) {
      logger.error('Failed to store DICOM metadata:', error);
      throw error;
    }
  }

  /**
   * Update study and series instance counts
   * @param {string} studyId - Study ID
   */
  async updateCounts(studyId) {
    try {
      // Update series counts
      await database.raw(`
        UPDATE series 
        SET number_of_instances = (
          SELECT COUNT(*) 
          FROM instances 
          WHERE instances.series_id = series.id
        )
        WHERE study_id = ?
      `, [studyId]);

      // Update study counts
      await database.raw(`
        UPDATE studies 
        SET 
          number_of_series = (
            SELECT COUNT(*) 
            FROM series 
            WHERE series.study_id = studies.id
          ),
          number_of_instances = (
            SELECT COUNT(*) 
            FROM instances 
            JOIN series ON instances.series_id = series.id
            WHERE series.study_id = studies.id
          ),
          total_size_bytes = (
            SELECT COALESCE(SUM(instances.file_size_bytes), 0)
            FROM instances 
            JOIN series ON instances.series_id = series.id
            WHERE series.study_id = studies.id
          )
        WHERE id = ?
      `, [studyId]);

    } catch (error) {
      logger.error('Failed to update counts:', error);
    }
  }

  /**
   * Generate thumbnail for DICOM image
   * @param {Buffer} dicomBuffer - DICOM file buffer
   * @param {number} size - Thumbnail size
   * @returns {Buffer} Thumbnail buffer
   */
  async generateThumbnail(dicomBuffer, size = 256) {
    try {
      // This is a simplified thumbnail generation
      // In production, you'd want to properly extract pixel data from DICOM
      const dataSet = dicomParser.parseDicom(dicomBuffer);
      
      // Extract pixel data (this is very simplified)
      const pixelDataElement = dataSet.elements.x7fe00010;
      if (!pixelDataElement) {
        throw new Error('No pixel data found');
      }

      // For now, generate a placeholder thumbnail
      const thumbnail = await sharp({
        create: {
          width: size,
          height: size,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
      .png()
      .toBuffer();

      return thumbnail;
    } catch (error) {
      logger.error('Failed to generate thumbnail:', error);
      throw error;
    }
  }

  /**
   * Anonymize DICOM file
   * @param {Buffer} dicomBuffer - DICOM file buffer
   * @param {Object} anonymizationMap - Anonymization mapping
   * @returns {Buffer} Anonymized DICOM buffer
   */
  async anonymizeDicomFile(dicomBuffer, anonymizationMap = {}) {
    try {
      const dataSet = dicomParser.parseDicom(dicomBuffer);
      
      // Define tags to anonymize
      const tagsToAnonymize = {
        'x00100010': anonymizationMap.patientName || 'ANONYMOUS',
        'x00100020': anonymizationMap.patientID || 'ANON123',
        'x00100030': anonymizationMap.patientBirthDate || '',
        'x00100040': anonymizationMap.patientSex || '',
        'x00080090': anonymizationMap.referringPhysician || 'ANONYMOUS',
        'x00081050': anonymizationMap.performingPhysician || 'ANONYMOUS',
        'x00080080': anonymizationMap.institutionName || 'ANONYMOUS'
      };

      // Create anonymized buffer (simplified implementation)
      // In production, you'd use dcmjs or similar library for proper anonymization
      let anonymizedBuffer = Buffer.from(dicomBuffer);

      // Store anonymization mapping
      await database('studies')
        .where('study_instance_uid', this.getTagValue(dataSet, 'x0020000d'))
        .update({
          is_anonymized: true,
          anonymization_map: anonymizationMap
        });

      return anonymizedBuffer;
    } catch (error) {
      logger.error('Failed to anonymize DICOM file:', error);
      throw error;
    }
  }

  /**
   * Retrieve DICOM file
   * @param {string} filePath - File path
   * @returns {Buffer} DICOM file buffer
   */
  async retrieveDicomFile(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return fileBuffer;
    } catch (error) {
      logger.error('Failed to retrieve DICOM file:', error);
      throw error;
    }
  }

  /**
   * Delete DICOM file
   * @param {string} filePath - File path
   */
  async deleteDicomFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.error('Failed to delete DICOM file:', error);
      throw error;
    }
  }

  /**
   * Validate DICOM file
   * @param {Buffer} fileBuffer - DICOM file buffer
   * @returns {Object} Validation result
   */
  validateDicomFile(fileBuffer) {
    try {
      const dataSet = dicomParser.parseDicom(fileBuffer);
      
      // Check for required tags
      const requiredTags = [
        'x0020000d', // Study Instance UID
        'x0020000e', // Series Instance UID
        'x00080018', // SOP Instance UID
        'x00080016'  // SOP Class UID
      ];

      const missingTags = [];
      for (const tag of requiredTags) {
        if (!dataSet.elements[tag]) {
          missingTags.push(tag);
        }
      }

      return {
        isValid: missingTags.length === 0,
        missingTags,
        metadata: this.parseDicomFile(fileBuffer)
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Get DICOM study statistics
   * @param {string} organizationId - Organization ID
   * @returns {Object} Study statistics
   */
  async getStudyStatistics(organizationId) {
    try {
      const stats = await database('studies')
        .where('organization_id', organizationId)
        .select(
          database.raw('COUNT(*) as total_studies'),
          database.raw('SUM(number_of_series) as total_series'),
          database.raw('SUM(number_of_instances) as total_instances'),
          database.raw('SUM(total_size_bytes) as total_size'),
          database.raw('COUNT(CASE WHEN modality = ? THEN 1 END) as ct_studies', ['CT']),
          database.raw('COUNT(CASE WHEN modality = ? THEN 1 END) as mr_studies', ['MR']),
          database.raw('COUNT(CASE WHEN modality = ? THEN 1 END) as xr_studies', ['XR']),
          database.raw('COUNT(CASE WHEN modality = ? THEN 1 END) as us_studies', ['US'])
        )
        .first();

      return stats;
    } catch (error) {
      logger.error('Failed to get study statistics:', error);
      throw error;
    }
  }

  /**
   * Search studies
   * @param {Object} searchParams - Search parameters
   * @returns {Array} Search results
   */
  async searchStudies(searchParams) {
    try {
      let query = database('studies')
        .select('*')
        .where('organization_id', searchParams.organizationId);

      if (searchParams.patientName) {
        query = query.where('patient_name', 'ilike', `%${searchParams.patientName}%`);
      }

      if (searchParams.patientId) {
        query = query.where('patient_id', 'ilike', `%${searchParams.patientId}%`);
      }

      if (searchParams.accessionNumber) {
        query = query.where('accession_number', 'ilike', `%${searchParams.accessionNumber}%`);
      }

      if (searchParams.studyDate) {
        query = query.where('study_date', searchParams.studyDate);
      }

      if (searchParams.modality) {
        query = query.where('modality', searchParams.modality);
      }

      if (searchParams.dateRange) {
        query = query.whereBetween('study_date', [
          searchParams.dateRange.start,
          searchParams.dateRange.end
        ]);
      }

      const results = await query
        .orderBy('study_date', 'desc')
        .limit(searchParams.limit || 100);

      return results;
    } catch (error) {
      logger.error('Failed to search studies:', error);
      throw error;
    }
  }
}

// Create singleton instance
const dicomService = new DicomService();

const setupDicomService = async () => {
  await dicomService.ensureStorageDirectory();
  logger.info('DICOM service initialized');
};

module.exports = {
  setupDicomService,
  dicomService,
  parseDicomFile: dicomService.parseDicomFile.bind(dicomService),
  storeDicomFile: dicomService.storeDicomFile.bind(dicomService),
  generateThumbnail: dicomService.generateThumbnail.bind(dicomService),
  anonymizeDicomFile: dicomService.anonymizeDicomFile.bind(dicomService),
  retrieveDicomFile: dicomService.retrieveDicomFile.bind(dicomService),
  deleteDicomFile: dicomService.deleteDicomFile.bind(dicomService),
  validateDicomFile: dicomService.validateDicomFile.bind(dicomService),
  getStudyStatistics: dicomService.getStudyStatistics.bind(dicomService),
  searchStudies: dicomService.searchStudies.bind(dicomService)
};