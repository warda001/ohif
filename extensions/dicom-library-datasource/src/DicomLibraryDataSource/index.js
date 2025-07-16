import { api } from 'dicomweb-client';
import { DicomMetaDictionary, DicomMessage } from 'dicom-parser';
import { utils } from '@ohif/core';

const { sortBy, sortingCriteria } = utils;

/**
 * Creates a DICOM Library data source API
 */
function createDicomLibraryApi(dataSourceConfig) {
  const { configuration } = dataSourceConfig;
  
  // Custom implementation for DICOM Library
  const implementation = {
    initialize: async ({ params, query }) => {
      console.log('DICOM Library Data Source initialized');
      return {};
    },

    query: {
      studies: {
        search: async (params) => {
          console.log('Searching studies from DICOM Library', params);
          
          // Since DICOM Library doesn't have a standard API,
          // we'll return mock data or handle file uploads
          return {
            studies: [
              {
                StudyInstanceUID: 'dicomlibrary.daae3df7f522b56724aed7e3e544c0fe',
                StudyDescription: 'DICOM Library Study',
                StudyDate: '20240101',
                StudyTime: '120000',
                AccessionNumber: 'daae3df7f522b56724aed7e3e544c0fe',
                PatientName: 'DICOM Library Patient',
                PatientID: 'DCM001',
                PatientBirthDate: '19900101',
                PatientSex: 'O',
                StudyID: '1',
                NumberOfStudyRelatedSeries: 1,
                NumberOfStudyRelatedInstances: 1,
                ModalitiesInStudy: 'CT',
                // Custom properties for DICOM Library
                _dicomLibraryUrl: 'https://www.dicomlibrary.com/?manage=daae3df7f522b56724aed7e3e544c0fe',
                _requiresDownload: true,
                _instructions: 'Please download DICOM files from DICOM Library and drag them into the viewer'
              }
            ]
          };
        },
      },
      series: {
        search: async (studyInstanceUID) => {
          console.log('Searching series for study:', studyInstanceUID);
          
          return {
            series: [
              {
                StudyInstanceUID: studyInstanceUID,
                SeriesInstanceUID: 'dicomlibrary.series.001',
                SeriesDescription: 'DICOM Library Series',
                SeriesNumber: '1',
                SeriesDate: '20240101',
                SeriesTime: '120000',
                Modality: 'CT',
                NumberOfSeriesRelatedInstances: 1,
                BodyPartExamined: 'CHEST',
                ProtocolName: 'DICOM Library Protocol',
                _dicomLibraryUrl: 'https://www.dicomlibrary.com/?manage=daae3df7f522b56724aed7e3e544c0fe',
                _requiresDownload: true
              }
            ]
          };
        },
      },
      instances: {
        search: async (studyInstanceUID, seriesInstanceUID) => {
          console.log('Searching instances for series:', seriesInstanceUID);
          
          return {
            instances: [
              {
                StudyInstanceUID: studyInstanceUID,
                SeriesInstanceUID: seriesInstanceUID,
                SOPInstanceUID: 'dicomlibrary.instance.001',
                SOPClassUID: '1.2.840.10008.5.1.4.1.1.2', // CT Image Storage
                InstanceNumber: '1',
                ImagePositionPatient: [0, 0, 0],
                ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
                PixelSpacing: [1, 1],
                SliceThickness: '5.0',
                Rows: 512,
                Columns: 512,
                BitsAllocated: 16,
                BitsStored: 16,
                HighBit: 15,
                PixelRepresentation: 1,
                WindowCenter: 40,
                WindowWidth: 400,
                RescaleIntercept: -1024,
                RescaleSlope: 1,
                _dicomLibraryUrl: 'https://www.dicomlibrary.com/?manage=daae3df7f522b56724aed7e3e544c0fe',
                _requiresDownload: true
              }
            ]
          };
        },
      },
    },

    retrieve: {
      /**
       * Retrieves metadata for a study/series/instance
       */
      metadata: async ({ studyInstanceUID, seriesInstanceUID, sopInstanceUID }) => {
        console.log('Retrieving metadata for:', { studyInstanceUID, seriesInstanceUID, sopInstanceUID });
        
        // Return mock metadata since DICOM Library requires manual download
        return {
          StudyInstanceUID: studyInstanceUID,
          SeriesInstanceUID: seriesInstanceUID,
          SOPInstanceUID: sopInstanceUID,
          _dicomLibraryUrl: 'https://www.dicomlibrary.com/?manage=daae3df7f522b56724aed7e3e544c0fe',
          _requiresDownload: true,
          _message: 'Please download DICOM files from DICOM Library and use the local file loader'
        };
      },

      /**
       * Retrieves bulk data (pixel data)
       */
      bulkDataURI: async ({ uri, studyInstanceUID, seriesInstanceUID, sopInstanceUID }) => {
        console.log('Bulk data URI requested:', uri);
        
        // Since DICOM Library doesn't have direct API access,
        // we'll need to handle file uploads differently
        throw new Error('DICOM Library requires manual file download. Please download files and use local file loader.');
      },

      /**
       * Generates direct URL for DICOM Library access
       */
      directURL: ({ studyInstanceUID, seriesInstanceUID, sopInstanceUID }) => {
        return `https://www.dicomlibrary.com/?manage=daae3df7f522b56724aed7e3e544c0fe`;
      },
    },

    store: {
      dicom: async (dataset) => {
        console.log('Store operation not supported for DICOM Library');
        throw new Error('Store operation not supported for DICOM Library data source');
      },
    },

    /**
     * Custom method to handle DICOM Library specific operations
     */
    dicomLibrary: {
      /**
       * Get download instructions for a study
       */
      getDownloadInstructions: (studyInstanceUID) => {
        return {
          url: 'https://www.dicomlibrary.com/?manage=daae3df7f522b56724aed7e3e544c0fe',
          instructions: [
            '1. Visit the DICOM Library URL',
            '2. Download the DICOM files to your computer',
            '3. Drag and drop the files into the OHIF viewer',
            '4. Or use the "Load Local Files" option in the viewer'
          ]
        };
      },

      /**
       * Check if a study requires download
       */
      requiresDownload: (studyInstanceUID) => {
        return studyInstanceUID.includes('dicomlibrary');
      },

      /**
       * Get the original DICOM Library URL
       */
      getOriginalUrl: (studyInstanceUID) => {
        if (studyInstanceUID.includes('daae3df7f522b56724aed7e3e544c0fe')) {
          return 'https://www.dicomlibrary.com/?manage=daae3df7f522b56724aed7e3e544c0fe';
        }
        return null;
      }
    },

    /**
     * Delete study metadata promise (for cache management)
     */
    deleteStudyMetadataPromise: (studyInstanceUID) => {
      console.log('Deleting study metadata promise for:', studyInstanceUID);
      // Implementation for cache cleanup
    },

    /**
     * Get configuration
     */
    getConfig: () => configuration,
  };

  return implementation;
}

export { createDicomLibraryApi };