// Limit only the Firebase Hosting live channel's old release retention.
// The active live release is not deleted or replaced by this operation.
// GitHub Actions injects the existing Firebase service-account JSON as a secret.
import { createSign } from "node:crypto";

const PROJECT_ID = "tcg-0bato";
const SITE_ID = "tcg-0bato";
const CHANNEL_NAME = "sites/" + SITE_ID + "/channels/live";
// Current active release + four previous releases = five versions kept.
const KEEP_PREVIOUS_RELEASES = 4;
const KEY_ENV = "FIREBASE_SERVICE_ACCOUNT_JSON";

const rawCredentials = process.env[KEY_ENV];
if (!rawCredentials) throw new Error(KEY_ENV + " is not configured");
const key = JSON.parse(rawCredentials);
if (key.type !== "service_account" || key.project_id !== PROJECT_ID ||
    !key.client_email || !key.private_key ||
    key.token_uri !== "https://oauth2.googleapis.com/token") {
  throw new Error("Unexpected Firebase service-account configuration");
}

const jsonBase64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const claim = {
  iss: key.client_email,
  scope: "https://www.googleapis.com/auth/firebase.hosting",
  aud: key.token_uri,
  iat: now,
  exp: now + 600,
};
const unsignedJwt = jsonBase64({ alg: "RS256", typ: "JWT" }) + "." + jsonBase64(claim);
const signer = createSign("RSA-SHA256");
signer.update(unsignedJwt);
const assertion = unsignedJwt + "." + signer.sign(key.private_key, "base64url");

const oauthResponse = await fetch(key.token_uri, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  }),
});
if (!oauthResponse.ok) throw new Error("Google OAuth access token request failed: HTTP " + oauthResponse.status);
const oauth = await oauthResponse.json();
if (!oauth.access_token) throw new Error("Google OAuth returned no access token");

const endpoint = "https://firebasehosting.googleapis.com/v1beta1/" + CHANNEL_NAME;
const headers = { Authorization: "Bearer " + oauth.access_token };
const originalResponse = await fetch(endpoint, { headers });
if (!originalResponse.ok) {
  // In particular, never PATCH a nonexistent channel: PATCH can create channels.
  throw new Error("Failed to verify existing Firebase live channel: HTTP " + originalResponse.status);
}
const original = await originalResponse.json();
if (original.name !== CHANNEL_NAME) throw new Error("Refusing unexpected Firebase Hosting channel");

if (Number(original.retainedReleaseCount) === KEEP_PREVIOUS_RELEASES) {
  console.log("Firebase live channel already retains " + KEEP_PREVIOUS_RELEASES + " previous releases.");
  process.exit(0);
}
const updateResponse = await fetch(endpoint + "?updateMask=retainedReleaseCount", {
  method: "PATCH",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: CHANNEL_NAME,
    retainedReleaseCount: KEEP_PREVIOUS_RELEASES,
  }),
});
if (!updateResponse.ok) {
  throw new Error("Firebase live release-retention update failed: HTTP " + updateResponse.status);
}
const updated = await updateResponse.json();
if (updated.name !== CHANNEL_NAME || Number(updated.retainedReleaseCount) !== KEEP_PREVIOUS_RELEASES) {
  throw new Error("Firebase did not confirm the requested live channel retention");
}
console.log("Firebase live release retention updated: " +
  original.retainedReleaseCount + " -> " + updated.retainedReleaseCount +
  " previous releases. Active live release remains published.");
