import { id } from './id';
import getDataSourcesModule from './getDataSourcesModule';

const extension = {
  /**
   * Only required property. Should be a unique value across all extensions.
   * You ID can be anything you want, but it should be unique.
   */
  id,

  /**
   * DataSources can be used to map the external data formats to the internal
   * format expected by the OHIF's State. DataSources are often used to retrieve
   * studies, series, and instances from external sources.
   */
  getDataSourcesModule,
};

export default extension;