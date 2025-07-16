const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const database = require('../src/database');
const { parseDicomFile, storeDicomFile } = require('../src/services/dicomService');
const logger = require('../src/utils/logger');

class DicomDataImporter {
  constructor() {
    this.baseUrl = 'https://www.dicomlibrary.com';
    this.studyUrl = 'https://www.dicomlibrary.com?study=1.3.6.1.4.1.44316.6.102.1.20250704114423696.61158672119535771932';
    this.organizationId = null;
    this.importedFiles = [];
  }

  async createTestOrganization() {
    try {
      // Check if test organization exists
      let org = await database('organizations')
        .where('code', 'TEST_ORG')
        .first();

      if (!org) {
        // Create test organization
        const [newOrg] = await database('organizations')
          .insert({
            name: 'Test Radiology Organization',
            code: 'TEST_ORG',
            email: 'test@radiologyplatform.com',
            phone: '+1-555-0123',
            address: '123 Medical Center Dr',
            city: 'Test City',
            state: 'TC',
            country: 'US',
            postal_code: '12345',
            is_active: true
          })
          .returning('*');
        
        org = newOrg;
        logger.info('Created test organization:', org.id);
      }

      this.organizationId = org.id;
      return org;
    } catch (error) {
      logger.error('Error creating test organization:', error);
      throw error;
    }
  }

  async createTestUser() {
    try {
      const bcrypt = require('bcryptjs');
      
      // Check if test user exists
      let user = await database('users')
        .where('email', 'test@radiologyplatform.com')
        .first();

      if (!user) {
        const hashedPassword = await bcrypt.hash('password123', 12);
        
        // Create test user
        const [newUser] = await database('users')
          .insert({
            organization_id: this.organizationId,
            email: 'test@radiologyplatform.com',
            password_hash: hashedPassword,
            first_name: 'Test',
            last_name: 'Radiologist',
            role: 'radiologist',
            is_active: true,
            is_verified: true
          })
          .returning('*');
        
        user = newUser;
        logger.info('Created test user:', user.id);
      }

      return user;
    } catch (error) {
      logger.error('Error creating test user:', error);
      throw error;
    }
  }

  async fetchDicomStudyInfo() {
    try {
      logger.info('Fetching DICOM study information from:', this.studyUrl);
      
      // This is a simplified approach - in reality, you'd need to parse the DICOM library page
      // For now, we'll create sample DICOM data structure
      const studyInfo = {
        studyInstanceUID: '1.3.6.1.4.1.44316.6.102.1.20250704114423696.61158672119535771932',
        studyDate: '20250704',
        studyTime: '114423',
        studyDescription: 'Test Study from DICOM Library',
        patientName: 'Test Patient',
        patientID: 'TEST001',
        patientBirthDate: '19900101',
        patientSex: 'M',
        patientAge: '034Y',
        modality: 'CT',
        accessionNumber: 'ACC001',
        referringPhysician: 'Dr. Test Physician',
        institutionName: 'Test Hospital',
        series: [
          {
            seriesInstanceUID: '1.3.6.1.4.1.44316.6.102.2.20250704114423696.61158672119535771932',
            seriesNumber: '1',
            seriesDescription: 'Test CT Series',
            modality: 'CT',
            instances: [
              {
                sopInstanceUID: '1.3.6.1.4.1.44316.6.102.3.20250704114423696.61158672119535771932.1',
                instanceNumber: '1'
              }
            ]
          }
        ]
      };

      return studyInfo;
    } catch (error) {
      logger.error('Error fetching DICOM study info:', error);
      throw error;
    }
  }

  async generateSampleDicomFile() {
    try {
      // Generate a minimal DICOM file structure for testing
      // In production, you'd fetch actual DICOM files
      const dicomHeader = Buffer.from([
        0x44, 0x49, 0x43, 0x4D, // DICM prefix
        0x02, 0x00, 0x10, 0x00, // Transfer Syntax UID
        0x55, 0x49, 0x00, 0x00, // UI VR
        0x1A, 0x00, 0x00, 0x00, // Length
        // Transfer Syntax UID value
        0x31, 0x2E, 0x32, 0x2E, 0x38, 0x34, 0x30, 0x2E, 0x31, 0x30, 0x30, 0x30, 0x38, 0x2E, 0x31, 0x2E, 0x32, 0x2E, 0x31, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);

      // This is a simplified DICOM file for testing
      // In production, you'd fetch actual DICOM files from the URL
      const sampleDicomBuffer = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // Preamble
        dicomHeader
      ]);

      return sampleDicomBuffer;
    } catch (error) {
      logger.error('Error generating sample DICOM file:', error);
      throw error;
    }
  }

  async importStudyToDatabase(studyInfo) {
    try {
      logger.info('Importing study to database:', studyInfo.studyInstanceUID);

      // Check if study already exists
      const existingStudy = await database('studies')
        .where('study_instance_uid', studyInfo.studyInstanceUID)
        .where('organization_id', this.organizationId)
        .first();

      if (existingStudy) {
        logger.info('Study already exists, skipping import');
        return existingStudy;
      }

      // Create study record
      const [study] = await database('studies')
        .insert({
          organization_id: this.organizationId,
          study_instance_uid: studyInfo.studyInstanceUID,
          accession_number: studyInfo.accessionNumber,
          patient_id: studyInfo.patientID,
          patient_name: studyInfo.patientName,
          patient_birth_date: studyInfo.patientBirthDate,
          patient_sex: studyInfo.patientSex,
          patient_age: studyInfo.patientAge,
          study_date: studyInfo.studyDate,
          study_time: studyInfo.studyTime,
          study_description: studyInfo.studyDescription,
          modality: studyInfo.modality,
          referring_physician: studyInfo.referringPhysician,
          institution_name: studyInfo.institutionName,
          status: 'unread',
          priority: 'normal',
          dicom_metadata: studyInfo
        })
        .returning('*');

      logger.info('Created study record:', study.id);

      // Import series and instances
      for (const seriesInfo of studyInfo.series) {
        await this.importSeriesToDatabase(study.id, seriesInfo);
      }

      // Update study counts
      await this.updateStudyCounts(study.id);

      return study;
    } catch (error) {
      logger.error('Error importing study to database:', error);
      throw error;
    }
  }

  async importSeriesToDatabase(studyId, seriesInfo) {
    try {
      logger.info('Importing series to database:', seriesInfo.seriesInstanceUID);

      // Create series record
      const [series] = await database('series')
        .insert({
          study_id: studyId,
          series_instance_uid: seriesInfo.seriesInstanceUID,
          series_number: seriesInfo.seriesNumber,
          series_description: seriesInfo.seriesDescription,
          modality: seriesInfo.modality,
          dicom_metadata: seriesInfo
        })
        .returning('*');

      logger.info('Created series record:', series.id);

      // Import instances
      for (const instanceInfo of seriesInfo.instances) {
        await this.importInstanceToDatabase(series.id, instanceInfo);
      }

      return series;
    } catch (error) {
      logger.error('Error importing series to database:', error);
      throw error;
    }
  }

  async importInstanceToDatabase(seriesId, instanceInfo) {
    try {
      logger.info('Importing instance to database:', instanceInfo.sopInstanceUID);

      // Generate sample DICOM file
      const dicomBuffer = await this.generateSampleDicomFile();
      
      // Create instance record
      const [instance] = await database('instances')
        .insert({
          series_id: seriesId,
          sop_instance_uid: instanceInfo.sopInstanceUID,
          instance_number: instanceInfo.instanceNumber,
          file_size_bytes: dicomBuffer.length,
          dicom_metadata: instanceInfo
        })
        .returning('*');

      logger.info('Created instance record:', instance.id);
      this.importedFiles.push(instance);

      return instance;
    } catch (error) {
      logger.error('Error importing instance to database:', error);
      throw error;
    }
  }

  async updateStudyCounts(studyId) {
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

      logger.info('Updated study counts for study:', studyId);
    } catch (error) {
      logger.error('Error updating study counts:', error);
      throw error;
    }
  }

  async createSampleData() {
    try {
      logger.info('Creating additional sample data...');

      // Create sample report templates
      await this.createSampleReportTemplates();

      // Create sample SLA configuration
      await this.createSampleSLA();

      logger.info('Sample data creation completed');
    } catch (error) {
      logger.error('Error creating sample data:', error);
      throw error;
    }
  }

  async createSampleReportTemplates() {
    try {
      const templates = [
        {
          name: 'CT Chest Template',
          modality: 'CT',
          body_part: 'CHEST',
          template_content: {
            sections: [
              {
                name: 'Clinical History',
                content: 'Clinical history: {{clinical_history}}'
              },
              {
                name: 'Technique',
                content: 'Technique: Axial CT images of the chest were obtained.'
              },
              {
                name: 'Findings',
                content: 'Findings:\n\nLungs: {{lung_findings}}\nMediastinum: {{mediastinum_findings}}\nPleura: {{pleura_findings}}'
              },
              {
                name: 'Impression',
                content: 'Impression:\n{{impression}}'
              }
            ]
          }
        },
        {
          name: 'General Template',
          modality: 'ALL',
          body_part: 'ALL',
          template_content: {
            sections: [
              {
                name: 'Clinical History',
                content: 'Clinical history: {{clinical_history}}'
              },
              {
                name: 'Findings',
                content: 'Findings:\n{{findings}}'
              },
              {
                name: 'Impression',
                content: 'Impression:\n{{impression}}'
              }
            ]
          }
        }
      ];

      for (const template of templates) {
        await database('report_templates')
          .insert({
            organization_id: this.organizationId,
            ...template
          })
          .onConflict(['organization_id', 'name'])
          .ignore();
      }

      logger.info('Created sample report templates');
    } catch (error) {
      logger.error('Error creating sample report templates:', error);
      throw error;
    }
  }

  async createSampleSLA() {
    try {
      const slas = [
        {
          name: 'Standard CT SLA',
          modality: 'CT',
          priority: 'normal',
          target_minutes: 1440, // 24 hours
          escalation_minutes: 1800 // 30 hours
        },
        {
          name: 'STAT CT SLA',
          modality: 'CT',
          priority: 'stat',
          target_minutes: 60, // 1 hour
          escalation_minutes: 90 // 1.5 hours
        },
        {
          name: 'General SLA',
          modality: 'ALL',
          priority: 'normal',
          target_minutes: 1440, // 24 hours
          escalation_minutes: 1800 // 30 hours
        }
      ];

      for (const sla of slas) {
        await database('slas')
          .insert({
            organization_id: this.organizationId,
            ...sla
          })
          .onConflict(['organization_id', 'name'])
          .ignore();
      }

      logger.info('Created sample SLA configurations');
    } catch (error) {
      logger.error('Error creating sample SLA configurations:', error);
      throw error;
    }
  }

  async run() {
    try {
      logger.info('Starting DICOM data import process...');

      // Step 1: Create test organization and user
      await this.createTestOrganization();
      await this.createTestUser();

      // Step 2: Fetch DICOM study information
      const studyInfo = await this.fetchDicomStudyInfo();

      // Step 3: Import study to database
      const study = await this.importStudyToDatabase(studyInfo);

      // Step 4: Create additional sample data
      await this.createSampleData();

      logger.info('DICOM data import completed successfully!');
      logger.info('Import summary:', {
        organizationId: this.organizationId,
        studyId: study.id,
        importedFiles: this.importedFiles.length
      });

      return {
        success: true,
        organizationId: this.organizationId,
        studyId: study.id,
        importedFiles: this.importedFiles.length
      };

    } catch (error) {
      logger.error('DICOM data import failed:', error);
      throw error;
    }
  }
}

// CLI execution
if (require.main === module) {
  const importer = new DicomDataImporter();
  
  importer.run()
    .then((result) => {
      console.log('Import completed successfully:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}

module.exports = DicomDataImporter;