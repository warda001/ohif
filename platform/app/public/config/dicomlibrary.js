/** @type {AppTypes.Config} */

window.config = {
  name: 'config/dicomlibrary.js',
  routerBasename: null,
  extensions: [],
  modes: [],
  showStudyList: true,
  showWarningMessageForCrossOrigin: true,
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  experimentalStudyBrowserSort: false,
  strictZSpacingForVolumeViewport: true,
  groupEnabledModesFirst: true,
  maxNumRequests: {
    interaction: 100,
    thumbnail: 75,
    prefetch: 25,
  },
  defaultDataSourceName: 'dicomlibrary',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomlibrary',
      configuration: {
        friendlyName: 'DICOM Library',
        name: 'dicomlibrary',
        // Note: DICOM Library doesn't have a standard DICOMweb API
        // This is a placeholder configuration - you may need to download files manually
        wadoUriRoot: 'https://www.dicomlibrary.com',
        qidoRoot: 'https://www.dicomlibrary.com',
        wadoRoot: 'https://www.dicomlibrary.com',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadouri', // Use WADO-URI for individual file access
        thumbnailRendering: 'wadouri',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: false,
        staticWado: false,
        singlepart: 'bulkdata',
        // Custom headers for DICOM Library access
        requestOptions: {
          headers: {
            'Accept': 'application/dicom',
            'Content-Type': 'application/dicom',
          },
        },
        // Custom study configuration for the specific dataset
        customStudies: [
          {
            studyInstanceUID: 'dicomlibrary.daae3df7f522b56724aed7e3e544c0fe',
            studyDescription: 'DICOM Library Study',
            studyDate: '20240101',
            patientName: 'DICOM Library Patient',
            patientId: 'DCM001',
            accessionNumber: 'daae3df7f522b56724aed7e3e544c0fe',
            url: 'https://www.dicomlibrary.com/?manage=daae3df7f522b56724aed7e3e544c0fe',
          }
        ]
      },
    },
    
    // Fallback to default AWS data source
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'aws-fallback',
      configuration: {
        friendlyName: 'AWS S3 Static wado server (Fallback)',
        name: 'aws',
        wadoUriRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        qidoRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        wadoRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: true,
        supportsWildcard: false,
        staticWado: true,
        singlepart: 'bulkdata,video',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
        omitQuotationForMultipartRequest: true,
      },
    },
  ],
  
  // Custom URL handling for DICOM Library
  customRoutes: [
    {
      path: '/dicomlibrary/:studyId',
      component: 'DicomLibraryViewer',
      props: {
        studyUrl: 'https://www.dicomlibrary.com/?manage=',
      }
    }
  ],
  
  // Extensions and modes configuration
  extensions: [
    '@ohif/extension-default',
    '@ohif/extension-cornerstone',
    '@ohif/extension-measurement-tracking',
    '@ohif/extension-cornerstone-dicom-sr',
    '@ohif/extension-cornerstone-dicom-seg',
    '@ohif/extension-cornerstone-dicom-rt',
    '@ohif/extension-dicom-pdf',
    '@ohif/extension-dicom-video',
    '@ohif/extension-dicom-microscopy',
    '@ohif/extension-cornerstone-dynamic-volume',
  ],
  modes: [
    '@ohif/mode-longitudinal',
    '@ohif/mode-basic-dev-mode',
    '@ohif/mode-tmtv',
    '@ohif/mode-microscopy',
  ],
  
  // CORS configuration for external data sources
  corsOptions: {
    credentials: 'omit',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  },
  
  // Custom data loading configuration
  customDataLoaders: {
    dicomlibrary: {
      enabled: true,
      downloadRequired: true,
      supportedFormats: ['dcm', 'dicom'],
      instructions: 'Please download DICOM files from DICOM Library and upload them to the viewer',
    }
  },
  
  hotkeys: [
    {
      commandName: 'incrementActiveViewport',
      label: 'Next Viewport',
      keys: ['right'],
    },
    {
      commandName: 'decrementActiveViewport',
      label: 'Previous Viewport',
      keys: ['left'],
    },
    { commandName: 'rotateViewportCW', label: 'Rotate Right', keys: ['r'] },
    { commandName: 'rotateViewportCCW', label: 'Rotate Left', keys: ['l'] },
    { commandName: 'invertViewport', label: 'Invert', keys: ['i'] },
    {
      commandName: 'flipViewportVertical',
      label: 'Flip Horizontally',
      keys: ['h'],
    },
    {
      commandName: 'flipViewportHorizontal',
      label: 'Flip Vertically',
      keys: ['v'],
    },
    { commandName: 'scaleUpViewport', label: 'Zoom In', keys: ['+'] },
    { commandName: 'scaleDownViewport', label: 'Zoom Out', keys: ['-'] },
    { commandName: 'fitViewportToWindow', label: 'Zoom to Fit', keys: ['='] },
    { commandName: 'resetViewport', label: 'Reset', keys: ['space'] },
    { commandName: 'nextImage', label: 'Next Image', keys: ['down'] },
    { commandName: 'previousImage', label: 'Previous Image', keys: ['up'] },
    {
      commandName: 'previousViewportDisplaySet',
      label: 'Previous Series',
      keys: ['pagedown'],
    },
    {
      commandName: 'nextViewportDisplaySet',
      label: 'Next Series',
      keys: ['pageup'],
    },
    { commandName: 'setToolActive', label: 'Zoom', keys: ['z'] },
    { commandName: 'setToolActive', label: 'Pan', keys: ['p'] },
    {
      commandName: 'setToolActive',
      commandOptions: { toolName: 'StackScrollMouseWheel' },
      label: 'Scroll',
      keys: ['s'],
    },
    {
      commandName: 'setToolActive',
      commandOptions: { toolName: 'Length' },
      label: 'Length',
      keys: ['t'],
    },
    {
      commandName: 'setToolActive',
      commandOptions: { toolName: 'Angle' },
      label: 'Angle',
      keys: ['a'],
    },
    {
      commandName: 'setToolActive',
      commandOptions: { toolName: 'Rectangle' },
      label: 'Rectangle',
      keys: ['r'],
    },
    {
      commandName: 'setToolActive',
      commandOptions: { toolName: 'Ellipse' },
      label: 'Ellipse',
      keys: ['e'],
    },
    {
      commandName: 'setToolActive',
      commandOptions: { toolName: 'CircleROI' },
      label: 'Circle',
      keys: ['c'],
    },
    {
      commandName: 'setToolActive',
      commandOptions: { toolName: 'Bidirectional' },
      label: 'Bidirectional',
      keys: ['b'],
    },
    { commandName: 'setToolActive', label: 'Window/Level', keys: ['w'] },
    { commandName: 'setToolActive', label: 'Crosshairs', keys: ['x'] },
    {
      commandName: 'setToolActive',
      commandOptions: { toolName: 'ReferenceLines' },
      label: 'Reference Lines',
      keys: ['f'],
    },
    {
      commandName: 'setToolActive',
      commandOptions: { toolName: 'StackImageSync' },
      label: 'Stack Image Sync',
      keys: ['alt+s'],
    },
    { commandName: 'clearMeasurements', label: 'Clear Measurements', keys: ['Delete'] },
    { commandName: 'displayStudyInformation', label: 'Study Information', keys: ['i'] },
    { commandName: 'showDownloadViewportModal', label: 'Download High Quality Image', keys: ['alt+d'] },
    { commandName: 'toggleSidePanels', label: 'Toggle Side Panels', keys: ['tab'] },
    { commandName: 'toggleOverlays', label: 'Toggle Overlays', keys: ['shift+alt+o'] },
    { commandName: 'windowLevelPreset1', label: 'W/L Preset 1', keys: ['1'] },
    { commandName: 'windowLevelPreset2', label: 'W/L Preset 2', keys: ['2'] },
    { commandName: 'windowLevelPreset3', label: 'W/L Preset 3', keys: ['3'] },
    { commandName: 'windowLevelPreset4', label: 'W/L Preset 4', keys: ['4'] },
    { commandName: 'windowLevelPreset5', label: 'W/L Preset 5', keys: ['5'] },
    { commandName: 'windowLevelPreset6', label: 'W/L Preset 6', keys: ['6'] },
    { commandName: 'windowLevelPreset7', label: 'W/L Preset 7', keys: ['7'] },
    { commandName: 'windowLevelPreset8', label: 'W/L Preset 8', keys: ['8'] },
    { commandName: 'windowLevelPreset9', label: 'W/L Preset 9', keys: ['9'] },
  ],
};