import { useCallback, useState, useEffect } from 'react';
import { Heading, Form, Paragraph, Flex, FormControl, TextInput, Checkbox } from '@contentful/f36-components';
import { css } from '@emotion/css';
import type { ConfigAppSDK } from '@contentful/app-sdk';
import { useSDK } from '@contentful/react-apps-toolkit';
import QueryGuide from '../components/QueryGuide';
import tokens from '@contentful/f36-tokens';
import { getAccessToken, initializeTokenManager, isReady } from '../utils/TokenManager';
import { shouldShowMediaflowLinks } from '../utils/MediaflowUrl';
import type { InstallationParameters } from '../types';

const ConfigScreen = () => {
  const [parameters, setParameters] = useState<InstallationParameters>({}); // Installation parameters.

  const sdk = useSDK<ConfigAppSDK>();

  const onConfigure = useCallback(async () => {
    const currentState = await sdk.app.getCurrentState();
    return {
      parameters, // Installation parameters (clientId, etc.)
      targetState: currentState,
    };
  }, [parameters, sdk]);

  const onConfigurationCompleted = useCallback(async (error: unknown) => {
    if(error) {
      sdk.notifier.error("Please make sure the client id, client secret and refresh token are set and then try again.");
    } else {
      if(!isReady()) {
        initializeTokenManager(sdk);
      }
      try {
        await getAccessToken(true, true); // Awaiting access token to check if the login is successful
        sdk.notifier.success("Mediaflow authentication successful");
      } catch {
        sdk.notifier.error("Mediaflow authentication failed. Please check your credentials again");
      }
    }
  }, [onConfigure]);

  useEffect(() => {
    sdk.app.onConfigure(() => onConfigure());
    sdk.app.onConfigurationCompleted((error) => onConfigurationCompleted(error));
  }, [sdk, onConfigure, onConfigurationCompleted]);

  /**
   * Retrieves the installation parameters and sets the app as ready
   * Note that the installation parameters will be null if the app is not installed yet
   */
  useEffect(() => {
    (async () => {
      const currentParameters = await sdk.app.getParameters<InstallationParameters>();
      if (currentParameters) {
        setParameters(currentParameters);
      }

      sdk.app.setReady(); // Hides loading screen
    })();
  }, [sdk]);

  return (
    <Flex flexDirection="column" className={css({ margin: '80px', maxWidth: '800px' })}>
      <Form>
        <Heading>App Configuration</Heading>
        <Paragraph>Welcome to the Mediaflow App.</Paragraph>
        <FormControl.Label>Client ID:</FormControl.Label>
        <TextInput
          value={parameters.clientId || ''}
          type="text"
          name="clientId"
          onChange={(e) => { setParameters({ ...parameters, clientId: e.target.value }); }}
          style={{ marginBottom: tokens.spacingM }}
        />
        <FormControl.Label>Client Secret:</FormControl.Label>
        <TextInput
          value={parameters.clientSecret || ''}
          type="password"
          name="clientSecret"
          onChange={(e) => { setParameters({...parameters, clientSecret: e.target.value}) } }
          style={{ marginBottom: tokens.spacingM }}
        />
        <FormControl.Label>Refresh Token:</FormControl.Label>
        <TextInput
          value={parameters.refreshToken || ''}
          type="password"
          name="refreshToken"
          onChange={(e) => { setParameters({...parameters, refreshToken: e.target.value}) } }
          style={{ marginBottom: tokens.spacingL }}
        />
        <Checkbox
          name="showMediaflowLinks"
          isChecked={ shouldShowMediaflowLinks(parameters) }
          onChange={(e) => { setParameters({...parameters, showMediaflowLinks: e.target.checked}) } }
          helpText="Turn this off if your editors don't have access to Mediaflow. It hides the &quot;Edit in Mediaflow&quot; link and the link in the missing alt text warning."
        >
          Show links to files in Mediaflow
        </Checkbox>
      </Form>
      <Heading as="h2">Using the app</Heading>
      <Paragraph>To use the app create a new content model and add the app to JSON-Fields, which are required to be used for Mediaflow assets. You can add the app to a content model's sidebar if you want a button to update the metadata for all Mediaflow assets in one entry at once.</Paragraph>

      <QueryGuide />
    </Flex>
  );
};
export default ConfigScreen;
