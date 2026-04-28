const SCOPES = [
  "https://www.googleapis.com/auth/androidmanagement",
  "https://www.googleapis.com/auth/cloud-platform.read-only",
].join(" ");
const AM_BASE = "https://androidmanagement.googleapis.com/v1";
const CRM_BASE = "https://cloudresourcemanager.googleapis.com/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// ── OAuth Config (localStorage) ──

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

const DEFAULT_CALLBACK_URL =
  "https://google.github.io/android-management-api-samples/oauth_callback.html";

export function saveOAuthConfig(config: OAuthConfig) {
  localStorage.setItem("amm_oauth_config", JSON.stringify(config));
}

export function getOAuthConfig(): OAuthConfig | null {
  const raw = localStorage.getItem("amm_oauth_config");
  if (!raw) return null;
  try {
    const config = JSON.parse(raw) as OAuthConfig;
    if (!config.clientId || !config.clientSecret) return null;
    return config;
  } catch {
    return null;
  }
}

export function clearOAuthConfig() {
  localStorage.removeItem("amm_oauth_config");
}

export function isConfigured(): boolean {
  return getOAuthConfig() !== null;
}

export { DEFAULT_CALLBACK_URL };

// ── Auth ──

function requireConfig(): OAuthConfig {
  const config = getOAuthConfig();
  if (!config) throw new Error("OAuth 설정이 필요합니다. 초기 설정을 완료해주세요.");
  return config;
}

export function getAuthUrl() {
  const config = requireConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/auth?${params}`;
}

export async function exchangeCode(code: string) {
  const config = requireConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

async function refreshAccessToken(refreshToken: string) {
  const config = requireConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data.access_token as string;
}

// ── Token management (localStorage) ──

interface StoredAuth {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export function saveAuth(tokens: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}) {
  const auth: StoredAuth = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };
  localStorage.setItem("amm_auth", JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem("amm_auth");
}

export function isAuthenticated(): boolean {
  const raw = localStorage.getItem("amm_auth");
  if (!raw) return false;
  try {
    const auth = JSON.parse(raw) as StoredAuth;
    return !!auth.access_token && auth.expires_at > Date.now();
  } catch {
    return false;
  }
}

class AuthExpiredError extends Error {
  constructor(message = "Session expired") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  clearAuth();
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (window.location.pathname !== `${base}/`) {
    window.location.href = `${base}/`;
  }
}

async function getAccessToken(): Promise<string> {
  const raw = localStorage.getItem("amm_auth");
  if (!raw) {
    redirectToLogin();
    throw new AuthExpiredError("Not authenticated");
  }

  let auth: StoredAuth;
  try {
    auth = JSON.parse(raw) as StoredAuth;
  } catch {
    redirectToLogin();
    throw new AuthExpiredError("Stored auth is corrupted");
  }

  // If token is still valid (with 60s buffer)
  if (auth.expires_at > Date.now() + 60000) {
    return auth.access_token;
  }

  // Try refresh
  if (auth.refresh_token) {
    try {
      const newToken = await refreshAccessToken(auth.refresh_token);
      const updated: StoredAuth = {
        ...auth,
        access_token: newToken,
        expires_at: Date.now() + 3600 * 1000,
      };
      localStorage.setItem("amm_auth", JSON.stringify(updated));
      return newToken;
    } catch {
      redirectToLogin();
      throw new AuthExpiredError("Token refresh failed");
    }
  }

  redirectToLogin();
  throw new AuthExpiredError("Token expired. Please re-authenticate.");
}

// ── API helper ──

// Centralized response handler — covers auth redirects, 204 No Content,
// non-2xx responses (including non-JSON error bodies), and structured
// `{ error: { message } }` error envelopes from Google APIs.
async function parseGoogleApiResponse(res: Response) {
  if (res.status === 401 || res.status === 403) {
    redirectToLogin();
    throw new AuthExpiredError("Session expired. Please sign in again.");
  }
  if (res.status === 204) return null;

  const text = await res.text();
  let data: { error?: { message?: string } } & Record<string, unknown> | null = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON body — fall through to raw text below */
    }
  }

  if (!res.ok) {
    throw new Error(data?.error?.message || text || `${res.status} ${res.statusText}`);
  }
  if (data?.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  return data;
}

async function amApi(
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  const token = await getAccessToken();
  const res = await fetch(`${AM_BASE}/${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return parseGoogleApiResponse(res);
}

// ── GCP Projects ──

export async function listProjects() {
  const token = await getAccessToken();
  const projects = [];
  let pageToken = "";

  do {
    const url = `${CRM_BASE}/projects?filter=lifecycleState:ACTIVE${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseGoogleApiResponse(res);
    projects.push(...((data?.projects as unknown[]) || []));
    pageToken = (data?.nextPageToken as string) || "";
  } while (pageToken);

  return projects as {
    projectId: string;
    name: string;
    projectNumber: string;
  }[];
}

// ── Enterprise ──

export async function listEnterprises(projectId: string) {
  const data = await amApi(
    `enterprises?projectId=${encodeURIComponent(projectId)}`
  );
  return data?.enterprises || [];
}

export async function getEnterprise(enterpriseName: string) {
  return amApi(enterpriseName);
}

export async function createSignupUrl(projectId: string, callbackUrl: string) {
  return amApi(
    `signupUrls?projectId=${encodeURIComponent(projectId)}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    { method: "POST" }
  );
}

export async function completeEnterpriseSignup(
  projectId: string,
  signupUrlName: string,
  enterpriseToken: string
) {
  return amApi(
    `enterprises?projectId=${encodeURIComponent(projectId)}&signupUrlName=${encodeURIComponent(signupUrlName)}&enterpriseToken=${encodeURIComponent(enterpriseToken)}`,
    { method: "POST", body: {} }
  );
}

// ── Devices ──

export async function listDevices(enterpriseName: string) {
  const all = [];
  let pageToken = "";
  do {
    const params = pageToken ? `?pageSize=100&pageToken=${encodeURIComponent(pageToken)}` : "?pageSize=100";
    const data = await amApi(`${enterpriseName}/devices${params}`);
    all.push(...((data?.devices as unknown[]) || []));
    pageToken = (data?.nextPageToken as string) || "";
  } while (pageToken);
  return all;
}

export async function getDevice(deviceName: string) {
  return amApi(deviceName);
}

export async function deleteDevice(deviceName: string) {
  return amApi(deviceName, { method: "DELETE" });
}

export async function updateDevicePolicy(
  deviceName: string,
  policyName: string
) {
  return amApi(`${deviceName}?updateMask=policyName`, {
    method: "PATCH",
    body: { policyName },
  });
}

export async function getOperation(operationName: string) {
  return amApi(operationName);
}

export async function issueCommand(
  deviceName: string,
  command: Record<string, unknown>
) {
  return amApi(`${deviceName}:issueCommand`, {
    method: "POST",
    body: command,
  });
}

// ── Policies ──

export async function listPolicies(enterpriseName: string) {
  const all = [];
  let pageToken = "";
  do {
    const params = pageToken ? `?pageSize=100&pageToken=${encodeURIComponent(pageToken)}` : "?pageSize=100";
    const data = await amApi(`${enterpriseName}/policies${params}`);
    all.push(...((data?.policies as unknown[]) || []));
    pageToken = (data?.nextPageToken as string) || "";
  } while (pageToken);
  return all;
}

export async function getPolicy(policyName: string) {
  return amApi(policyName);
}

export async function upsertPolicy(
  policyName: string,
  policy: Record<string, unknown>
) {
  return amApi(policyName, { method: "PATCH", body: policy });
}

export async function deletePolicy(policyName: string) {
  return amApi(policyName, { method: "DELETE" });
}

// ── Enrollment Tokens ──

export async function createEnrollmentToken(
  enterpriseName: string,
  policyName: string
) {
  return amApi(`${enterpriseName}/enrollmentTokens`, {
    method: "POST",
    body: {
      policyName,
      duration: "86400s",
    },
  });
}
