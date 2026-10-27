import { MEDIAFLOW_BASE_URL } from "../config";
import type { MediaflowFileData } from "../types";

interface MediaflowFolder {
    id: string | number;
}

/**
 * Retrieves the ids of the folders a Mediaflow file is in. Fields created before the folderId was stored
 * (e.g. migrated assets) only have a file id, so the folder has to be looked up.
 *
 * @param fileId - The Mediaflow id of the file
 * @param accessToken - The bearer access token for the Mediaflow API
 *
 * @throws Error when the request fails or the response is not a list of folders
 *
 * @returns The folder ids, empty if the file is in no folder
 */
export async function getFileFolderIds(fileId: string | number, accessToken: string): Promise<Array<string | number>> {
    const response = await fetch(MEDIAFLOW_BASE_URL + "file/" + fileId + "/folders", {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + accessToken,
            "Content-Type": "application/json",
        }
    });
    if(!response.ok) {
        throw new Error("Request failed with status " + response.status);
    }
    const folders: unknown = await response.json();
    if(!Array.isArray(folders)) {
        throw new Error("Unexpected response format");
    }
    return (folders as MediaflowFolder[]).map(folder => folder.id);
}

/**
 * The folder is only needed for the links to Mediaflow, so it is looked up only when they are shown
 *
 * @param fieldData - The stored field data
 * @param showMediaflowLinks - Whether links to the file in Mediaflow are shown
 *
 * @returns The file id whose folder has to be looked up, or null if no lookup is needed
 */
export function fileIdNeedingFolderLookup(fieldData: MediaflowFileData | null, showMediaflowLinks: boolean): string | number | null {
    if(!showMediaflowLinks || !fieldData?.id || fieldData.folderId) {
        return null;
    }
    return fieldData.id;
}
