import { createDicomLibraryApi } from './DicomLibraryDataSource';

/**
 * Registers the DICOM Library Data Source with the OHIF Viewer.
 */
function getDataSourcesModule() {
  return [
    {
      name: 'dicomlibrary',
      wadoUriRoot: 'dicomlibrary',
      qidoRoot: 'dicomlibrary',
      wadoRoot: 'dicomlibrary',
      qidoSupportsIncludeField: false,
      supportsReject: false,
      imageRendering: 'wadouri',
      thumbnailRendering: 'wadouri',
      enableStudyLazyLoad: true,
      supportsFuzzyMatching: false,
      supportsWildcard: false,
      staticWado: false,
      singlepart: 'bulkdata',
      // The actual data source implementation
      createDataSource: createDicomLibraryApi,
    },
  ];
}

export default getDataSourcesModule;