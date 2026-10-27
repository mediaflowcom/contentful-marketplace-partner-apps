import type { BaseAppSDK } from "@contentful/app-sdk";
import { UPDATABLE_FIELDS, WOBBLE_FIELDS } from "../components/Metadata";
import { isReady, getAccessToken, initializeTokenManager } from "./TokenManager";
import { MEDIAFLOW_BASE_URL } from "../config";

type JsonObject = Record<string, unknown>;

/**
 * The part of a Contentful field (sdk.field or sdk.entry.fields[id]) the metadata update needs
 */
export interface UpdatableField {
  type: string;
  getValue: () => unknown;
  setValue: (value: JsonObject) => Promise<unknown>;
}

interface MediaflowApiError {
  error: unknown;
  status?: number;
}

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null;

/**
 * compares if two dates contains the same data in a non-recursive way with strict type comparision.
 *
 * @param object1 - Any date which should be compared to another
 * @param object2 - Any date which should be compared to another
 */
export function compareObjects(object1: unknown, object2: unknown): boolean {
  const stack: Array<[unknown, unknown]> = [[object1, object2]];

  while (stack.length > 0) {
    const [obj1, obj2] = stack.pop() as [unknown, unknown];

    // Note that typeof null is "object", which is a mistake in JS, that's why this is checked separatly here
    if (obj1 === null && obj2 === null) {
      // Both are null
      continue;
    } else if (obj1 === null || obj2 === null) {
      // Either is null but not both
      return false;
    }

    if (typeof obj1 !== typeof obj2) {
      return false;
    }

    if (isObject(obj1) && isObject(obj2)) {
      const isArray = Array.isArray(obj1);
      if (isArray && Array.isArray(obj2) && obj1.length === obj2.length) { // wlog. obj2 is an array as well
        for (let i = 0; i < obj1.length; i++) {
          stack.push([obj1[i], obj2[i]]);
        }
      } else if (isArray) { // wlog. obj2 is an array of differnt size
        return false;
      } else {
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        if (keys1.length !== keys2.length) {
          return false;
        }
        for (const key of keys1) {
          if (!(key in obj2)) {
            return false;
          }
          stack.push([obj1[key], obj2[key]]);
        }
      }
    } else if (obj1 !== obj2) {
      return false;
    }
  }

  return true;
};

/**
 * Checks whether two objects contain the same metadata in a non-recursive way.
 * Strict type comparision is only done for objects, and their properties. This is because the FileSelector returns width and height as a string whereas the mediaflow endpoint returns those as integers.
 *
 * src/components/Metadata.ts::UPDATABLE_FIELDS shows fields that will be compared
 *
 * src/components/Metadata.ts::WOBBLE_FIELDS shows fields that may exist in one object as a particular field and in another as a different field
 *
 * @param object1 - The first object
 * @param object2 - The second object
 *
 * @returns true if both objects contain the same metadata, false otherwise
 */
export function compareMetadata(object1: JsonObject, object2: JsonObject): boolean {

  const compareKeys = UPDATABLE_FIELDS;
  for (const key of compareKeys) {

    const wobbleKey = WOBBLE_FIELDS.get(key);

    const actualValue1 = getWobbleValue(key, wobbleKey, object1);
    const actualValue2 = getWobbleValue(key, wobbleKey, object2);

    if ((actualValue1 && !actualValue2) || (!actualValue1 && actualValue2)) {
      return false;
    }

    if (actualValue1 && typeof actualValue1 === "object") {
      const equal = compareObjects(actualValue1, actualValue2);
      if (!equal) {
        return false;
      }
    } else if (actualValue1 && actualValue1 != actualValue2) {
      return false;
    }
  }

  return true;
}

/**
 * Updates metadata for multiple fields in a single request. This circumvents API throttling
 *
 * @param sdk - The app sdk
 * @param fields - Contentful fields. Those will be updated IFF they are JSON fields with isMeadiflowAsset being true
 */
export async function batchUpdateMetadata(sdk: BaseAppSDK, fields: Array<UpdatableField | undefined>): Promise<void> {

  // Set up dataMap to remember which fields get updated
  const dataMap = new Map<unknown, UpdatableField[]>(); // Stores the mediaflow field id as key and an array with all Contentful fields as values
  for(let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if(!field || field.type !== "Object") {
      continue;
    }

    const fieldValue = field.getValue();
    if(!isObject(fieldValue) || !fieldValue.id || !fieldValue.isMediaflowAsset) {
      continue;
    }

    const fieldsWithSameFile = dataMap.get(fieldValue.id);
    if(fieldsWithSameFile) {
      fieldsWithSameFile.push(field);
    } else {
      dataMap.set(fieldValue.id, [field]);
    }
  }

  if(!dataMap.size) {
    return;
  }

  // Get access token // TODO this should be refactored
  if(!isReady()) {
    initializeTokenManager(sdk);
  }
  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch(error) {
    sdk.notifier.error("Could not update Metadata: Failed to authenticate with Mediaflow. Please make sure that the app is configured correctly");
    console.error("[ERROR] Could not update Metadata for multiple fields due to failed authentication: ", error);
    return;
  }

  // Fetch new data
  const requestFields = getRequestFields().join(",");
  const fetchResponse = await fetch(MEDIAFLOW_BASE_URL + "file/getmultiple?fields=" + requestFields, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids: Array.from(dataMap.keys()) }),
  });
  const response: Array<JsonObject | null> | MediaflowApiError | null = await fetchResponse.json();

  if(!response || !Array.isArray(response)) {
    console.error("[ERROR] The following error occured while trying to batch update Metadata: ", response?.error);
    if(response?.status === 401) {
      sdk.notifier.error("Could not update Metadata: Unauthorized. Please check your app configuration and make sure the Mediaflow credentials are correct.");
    } else {
      sdk.notifier.error("Could not update Metadata: The following error occured" + response?.error);
    }
    return;
  }

  // Update the fields
  const fieldUpdatePromises: Array<Promise<unknown>> = [];
  for(let i = 0; i < response.length; i++) {
    const newData = response[i];
    if(!newData){
      sdk.notifier.error("Cannot update metadata: At least one file to update is not available on Mediaflow any more. Please remove this file and then try again.");
      return;
    }

    const id = newData.id;
    const fieldsToUpdate = dataMap.get(id) ?? [];
    for(let j = 0; j < fieldsToUpdate.length; j++) {
      const fieldToUpdate = fieldsToUpdate[j];
      const oldData = fieldToUpdate.getValue() as JsonObject;
      const updatedData = getUpdatedData(oldData, newData);

      const updatePromise = fieldToUpdate.setValue(updatedData);
      fieldUpdatePromises.push(updatePromise);
    }
  }

  await Promise.allSettled(fieldUpdatePromises);
}


/**
 * Updates the Metadata for a JSON-Field
 *
 * @param sdk - The app sdk.
 * @param field - The field to be updated
 */
export async function updateMetadata(sdk: BaseAppSDK, field: UpdatableField): Promise<void> {
  batchUpdateMetadata(sdk, [field]);
}

/**
 * Gets all UPDATABLE_FIELDS and turns them into their respective Mediaflow-Endpoint field.
 *
 * src/components/Metadata.ts::WOBBLE_FIELDS gives an example for what wobble fields are
 *
 * @returns An array containing fieldnames used by the Mediaflow API
 */
function getRequestFields(): string[] {
  const requestFields = UPDATABLE_FIELDS.map(field => {
    const wobbleField = WOBBLE_FIELDS.get(field);
    if(wobbleField) {
      return wobbleField.split(".")[0];
    } else {
      return field;
    }
  });
  return requestFields;
}

/**
 * Overwrites all UPDATABLE_FIELDS in the oldData with the newData. Removes fields from the oldData which are not present in the newData
 * IMPORTANT:
 *  - newData must contain WOBBLE_FIELD values
 *  - oldData must contain WOBBLE_FIELD keys
 *  => This means oldData.altText will be overwritten by newData.alttext if the WOBBLE_FIELD ["altText", "alttext"] exists
 *
 * @param oldData - The stored field data
 * @param newData - The data from Mediaflow
 */
function getUpdatedData(oldData: JsonObject, newData: JsonObject): JsonObject {
  const updatedData = UPDATABLE_FIELDS.reduce((resultObject, field) => {
    const wobbleField = WOBBLE_FIELDS.get(field);

    if(keyExists(wobbleField || field, newData)) {
      resultObject[field] = getValue(wobbleField || field, newData);
    } else {
      resultObject[field] = undefined;
    }

    return resultObject
  }, oldData);
  return updatedData;
}

/**
 * Gets the value of an object at key. The key may be nested or wobbly (meaning it could be either key or wobbleKey)
 *
 * @param key - The key of a property on the object
 * @param wobbleKey - The wobbleKey of a property on the object
 * @param object - The actual object
 *
 * @throws Error when neither key nor wobblekey is provided
 *
 * @returns returns object on key. The key may be nested
 */
function getWobbleValue(key: string, wobbleKey: string | undefined, object: JsonObject): unknown {
  if(!key && !wobbleKey) {
    throw new Error("Could not get value on an object without the propertykey")
  }

  let actualValue;
  if(wobbleKey) {
    const value = getValue(key, object);
    const wobbleValue = getValue(wobbleKey, object);
    actualValue = value || wobbleValue;
  } else {
    actualValue = getValue(key, object);
  }
  return actualValue;
}

/**
 * Checks if a dynamic key exists in an object. The key may be a nested key
 *
 * @param key - The maybe nested key
 * @param object - The object to look in
 * @returns true if the key exists
 */
const keyExists = (key: string, object: JsonObject): boolean => {
  if(key.includes(".")) {
    const keys = key.split(".");
    let currentObject: unknown = object;
    for(let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if(isObject(currentObject) && k in currentObject) {
        currentObject = currentObject[k];
      } else {
        return false;
      }
    }
    return true;
  } else {
    return key in object;
  }
}

/**
 * Gets the value of a dynamic key in an object. The key may be a nested key
 *
 * @param key - the maybe nested key
 * @param object - the object whose value to get
 *
 * @returns the objects value at the property matching key, or undefined if no key was provided, or the key in the property path is not existing
 */
const getValue = (key: string | undefined, object: JsonObject): unknown => {
  if(!key) {
    return undefined;
  }

  if(key.includes(".")) {
    const keys = key.split(".");
    let currentObject: unknown = object;
    for(let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if(isObject(currentObject) && k in currentObject) {
        currentObject = currentObject[k];
      } else {
        return undefined;
      }
    }
    return currentObject;
  } else {
    return object[key];
  }
}
