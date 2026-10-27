import { Button } from '@contentful/f36-components';
import type { SidebarAppSDK } from '@contentful/app-sdk';
import { useAutoResizer, useSDK } from '@contentful/react-apps-toolkit';
import { batchUpdateMetadata } from '../utils/Util';
import type { UpdatableField } from '../utils/Util';

const Sidebar = () => {
  const sdk = useSDK<SidebarAppSDK>();
  useAutoResizer();

  const updateMetadataForAllFields = async () => {
    
    const fieldsToUpdate: UpdatableField[] = [];
    const controls = sdk.editor.editorInterface.controls ?? [];
    for(let i = 0; i < controls.length; i++) {
      const control = controls[i]; // The controls corresponding to each field
      if(control.widgetId === sdk.ids.app) {
        const field = sdk.entry.fields[control.fieldId];
        fieldsToUpdate.push(field);
      }
    }

    batchUpdateMetadata(sdk, fieldsToUpdate).then(() => {
      sdk.notifier.success("Finished updating metadata for all fields.");
    }).catch(error => {
      console.error("[ERROR] an error occured during the batch update of the metadata: ", error);
      sdk.notifier.error("An unexpected error occured during the update of the Mediaflow fields: " + error);
    });
  }

  return (
    <Button variant="primary" isFullWidth onClick={() => { updateMetadataForAllFields() }}>Update Metadata for all fields</Button>
  );
};

export default Sidebar;