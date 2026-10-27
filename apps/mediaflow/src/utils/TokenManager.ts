import type { BaseAppSDK } from '@contentful/app-sdk';
import { BACKEND_URL } from '../config';

interface TokenResponse {
    access_token?: string;
    expires_in?: number;
}

let tokenPromise: Promise<boolean> | null = null;
let cachedToken: string | null = null;
let expiresAt: number | null = null;
let sdk: BaseAppSDK | null = null;
let ready = false;

/**
 * Initializes the TokenManager by settings its sdk instance.
 * 
 * @param sdkInstance - The Contentful SDK instance from useSDK() 
 */
export function initializeTokenManager(sdkInstance: BaseAppSDK | null | undefined): void {
    if(!sdkInstance || !sdkInstance.cma){
        throw new Error("Failed to initiailze token manager. The sdkInstance is not correct.");
    }
    sdk = sdkInstance;
    ready = true;
}


export function isReady(): boolean {
    return ready;
}

/**
 * Retrieves the cached token. This method will update the token if it is expired ({@link isTokenExpired}) or if forceRefresh is true.
 * 
 * @param forceRefresh - OPTIONAL, When true, the token will be refreshed even if it is not expired.
 * @param noCache - OPTIONAL, When true, the backend will refetch the Contentful parameters instead of using the cached version. This is important when the Contentful parameters changed
 * 
 * @throws Error when an expired token could not be refreshed.
 * 
 * @returns A promise which resolves to the access token.
 */
export async function getAccessToken(forceRefresh = false, noCache = false): Promise<string> {
    if(isTokenExpired() || forceRefresh) {
        if(!tokenPromise) {
            tokenPromise = updateToken(noCache).finally(() => { tokenPromise = null; });
        }
        const updated = await tokenPromise; // This will set the cachedToken variable which can then be returned afterwards
        if(!updated) {
            throw new Error("Failed to update the mediaflow access token.");
        }
    }
    if(!cachedToken) {
        throw new Error("No mediaflow access token available.");
    }
    return cachedToken;
}

/**
 * Replaces the cached token by a new one.
 * 
 * @param noCache - OPTIONAL, When true, the backend will refetch the Contentful parameters instead of using the cached version. This is important when the Contentful parameters changed
 * 
 * @throws Error when the TokenManager is not initialized yet.
 * 
 * @returns A promise which resolves to true if the token was successfully updated, false otherwise.
 */
async function updateToken(noCache = false): Promise<boolean> {
    if(!ready || !sdk) {
        throw new Error("TokenManager is not initialized. Make sure to initialize it first.");
    }

    const appDefinitionId = sdk.ids.app;
    if(!appDefinitionId) {
        throw new Error("The app definition id is missing from the SDK.");
    }
    const spaceId = sdk.ids.space;
    const environmentId = sdk.ids.environment;

    const request = {
        method: 'POST',
        url: BACKEND_URL + "authenticate",
        headers: { "Content-Type": "application/json" } as Record<string, string>,
        body: JSON.stringify({ spaceId, environmentId, noCache }),
    };

    const { additionalHeaders } = await sdk.cma.appSignedRequest.create({ appDefinitionId: appDefinitionId }, {
        method: "POST",
        headers: request.headers,
        body: request.body,
        path: new URL(request.url).pathname,
    });

    Object.assign(request.headers, additionalHeaders);

    const response: TokenResponse | null = await fetch(request.url, request).then(res => res.json());
    if(response && response.access_token && response.expires_in) {
        cachedToken = response.access_token;
        // Set the expiry time one minute earlier to account for network delays. Default expiration time of Mediaflow tokens is 15 hours
        // Note that the time is in milliseconds, thus -60000 is -1 minute
        expiresAt = new Date().getTime() + (response.expires_in * 1000) - 60000; 
        return true;
    }
    return false;
}

/**
 * Returns the cached token without refreshing it, for requests that cannot wait, such as while the page closes.
 *
 * @returns The access token, or null if there is none or it has expired
 */
export function getCachedAccessToken(): string | null {
    return isTokenExpired() ? null : cachedToken;
}

/**
 * Returns true when the cached token is expired or there is no cached token.
 * 
 * @returns true if the token is expired or not existing, false otherwise.
 */
function isTokenExpired(): boolean {
    if(cachedToken && expiresAt && new Date().getTime() < expiresAt) {
        return false;
    }
    return true;
}
