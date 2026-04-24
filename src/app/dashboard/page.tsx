"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import QRCode from "qrcode";
import PolicyVisualEditor from "@/components/PolicyVisualEditor";
import {
  isAuthenticated,
  clearAuth,
  listProjects,
  listEnterprises,
  listDevices,
  getDevice,
  deleteDevice,
  updateDevicePolicy,
  issueCommand,
  listPolicies,
  getPolicy,
  upsertPolicy,
  deletePolicy,
  createEnrollmentToken,
  createSignupUrl,
  completeEnterpriseSignup,
} from "@/lib/google-api";

type Enterprise = {
  name?: string;
  enterpriseDisplayName?: string;
  enabledNotificationTypes?: string[];
};

type Device = {
  name?: string;
  state?: string;
  appliedState?: string;
  hardwareInfo?: {
    brand?: string;
    model?: string;
    manufacturer?: string;
    serialNumber?: string;
    hardware?: string;
    deviceBasebandVersion?: string;
  };
  softwareInfo?: {
    androidVersion?: string;
    securityPatchLevel?: string;
    androidBuildNumber?: string;
    deviceKernelVersion?: string;
    bootloaderVersion?: string;
    androidBuildFingerprint?: string;
    primaryLanguageCode?: string;
    androidDevicePolicyVersionName?: string;
    systemUpdateInfo?: {
      updateStatus?: string;
      updateReceivedTime?: string;
    };
  };
  policyName?: string;
  appliedPolicyName?: string;
  appliedPolicyVersion?: string;
  enrollmentTime?: string;
  lastStatusReportTime?: string;
  lastPolicySyncTime?: string;
  apiLevel?: number;
  networkInfo?: {
    imei?: string;
    meid?: string;
    wifiMacAddress?: string;
    networkOperatorName?: string;
  };
  memoryInfo?: {
    totalRam?: string;
    totalInternalStorage?: string;
  };
  powerManagementEvents?: {
    eventType?: string;
    createTime?: string;
    batteryLevel?: number;
  }[];
  hardwareStatusSamples?: {
    createTime?: string;
    batteryTemperatures?: number[];
    cpuTemperatures?: number[];
    cpuUsages?: number[];
    fanSpeeds?: number[];
    skinTemperatures?: number[];
    gpuTemperatures?: number[];
  }[];
  displays?: {
    name?: string;
    displayId?: number;
    refreshRate?: number;
    state?: string;
    width?: number;
    height?: number;
    density?: number;
  }[];
  nonComplianceDetails?: {
    settingName?: string;
    nonComplianceReason?: string;
    fieldPath?: string;
    currentValue?: unknown;
    installationFailureReason?: string;
  }[];
  securityPosture?: {
    devicePosture?: string;
    postureDetails?: {
      securityRisk?: string;
      advice?: { defaultMessage?: string }[];
    }[];
  };
  user?: {
    accountIdentifier?: string;
  };
  applicationReports?: AppReport[];
};

type AppReport = {
  packageName?: string;
  displayName?: string;
  versionName?: string;
  versionCode?: number;
  state?: string;
  installerPackageName?: string;
  packageSha256Hash?: string;
  signingKeyCertFingerprints?: string[];
  applicationSource?: string;
  events?: {
    eventType?: string;
    createTime?: string;
  }[];
  permissionGrants?: string[];
  enabled?: boolean;
};

type Policy = {
  name?: string;
  version?: string;
};

type EnrollmentToken = {
  name?: string;
  value?: string;
  qrCode?: string;
  expirationTimestamp?: string;
};

const NAV_ITEMS = [
  { id: "enterprise", label: "Enterprise 설정", icon: "🏢" },
  { id: "devices", label: "기기 관리", icon: "📱" },
  { id: "policies", label: "정책 관리", icon: "📋" },
  { id: "enrollment", label: "기기 등록", icon: "🔗" },
];

function QrCodeCanvas({ data }: { data: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, data, {
        width: 256,
        margin: 2,
        errorCorrectionLevel: "M",
      });
    }
  }, [data]);
  return (
    <div className="mb-4 flex justify-center">
      <canvas ref={canvasRef} className="border rounded-lg" />
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("enterprise");
  const [enterprise, setEnterprise] = useState("");
  const [projectId, setProjectId] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [enrollmentToken, setEnrollmentToken] =
    useState<EnrollmentToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Filters
  const [deviceStateFilter, setDeviceStateFilter] = useState<string>("ALL");
  const [devicePolicyFilter, setDevicePolicyFilter] = useState<string>("ALL");
  const [deviceSearch, setDeviceSearch] = useState("");

  const filteredDevices = devices.filter((d) => {
    if (deviceStateFilter !== "ALL" && d.state !== deviceStateFilter) return false;
    if (devicePolicyFilter !== "ALL" && d.policyName !== devicePolicyFilter) return false;
    if (deviceSearch) {
      const q = deviceSearch.toLowerCase();
      const haystack = [
        d.name,
        d.hardwareInfo?.brand,
        d.hardwareInfo?.model,
        d.hardwareInfo?.serialNumber,
        d.networkInfo?.imei,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const deviceStates = ["ALL", ...Array.from(new Set(devices.map((d) => d.state).filter(Boolean)))];
  const devicePolicies = ["ALL", ...Array.from(new Set(devices.map((d) => d.policyName).filter(Boolean)))];

  const [policyEditorMode, setPolicyEditorMode] = useState<"visual" | "json">("visual");
  const [policyId, setPolicyId] = useState("default");
  const [policyJson, setPolicyJson] = useState(
    JSON.stringify(
      {
        applications: [
          {
            packageName: "com.google.android.gm",
            installType: "FORCE_INSTALLED",
          },
        ],
        debuggingFeaturesAllowed: false,
        screenCaptureDisabled: false,
      },
      null,
      2
    )
  );

  const [enrollPolicyName, setEnrollPolicyName] = useState("");
  const [detailDevice, setDetailDevice] = useState<Device | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [changePolicyTarget, setChangePolicyTarget] = useState<string | null>(null);
  const [changePolicyValue, setChangePolicyValue] = useState("");
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loadingEnterprises, setLoadingEnterprises] = useState(false);
  const [gcpProjects, setGcpProjects] = useState<
    { projectId: string; name: string }[]
  >([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const showMessage = useCallback(
    (type: "success" | "error", text: string) => {
      setMessage({ type, text });
      setTimeout(() => setMessage(null), 5000);
    },
    []
  );

  // Check auth & load localStorage
  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`;
      return;
    }
    const saved = localStorage.getItem("amm_enterprise");
    if (saved) setEnterprise(saved);
    const savedProject = localStorage.getItem("amm_project_id");
    if (savedProject) setProjectId(savedProject);
  }, []);

  useEffect(() => {
    if (enterprise) localStorage.setItem("amm_enterprise", enterprise);
  }, [enterprise]);

  useEffect(() => {
    if (projectId) localStorage.setItem("amm_project_id", projectId);
  }, [projectId]);

  // ── GCP Projects ──
  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const data = await listProjects();
      setGcpProjects(data);
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoadingProjects(false);
  }, [showMessage]);

  // ── Enterprise ──
  const loadEnterprises = async () => {
    if (!projectId) {
      showMessage("error", "프로젝트 ID를 먼저 입력하세요.");
      return;
    }
    setLoadingEnterprises(true);
    try {
      const data = await listEnterprises(projectId);
      setEnterprises(Array.isArray(data) ? data : []);
      if (data.length === 0) {
        showMessage("error", "등록된 Enterprise가 없습니다.");
      }
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoadingEnterprises(false);
  };

  const handleCreateEnterprise = async () => {
    if (!projectId) {
      showMessage("error", "프로젝트 ID를 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const callbackUrl = window.location.origin + "/dashboard";
      const data = await createSignupUrl(projectId, callbackUrl);
      if (data.url) {
        window.open(data.url, "_blank");
        showMessage(
          "success",
          "새 탭에서 Enterprise 등록을 완료하세요. 완료 후 URL에서 enterpriseToken을 복사하여 아래에 입력하세요."
        );
      }
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  };

  const [signupUrlName, setSignupUrlName] = useState("");
  const [enterpriseToken, setEnterpriseToken] = useState("");

  const handleCompleteEnterprise = async () => {
    if (!enterpriseToken) return;
    setLoading(true);
    try {
      const data = await completeEnterpriseSignup(
        projectId,
        signupUrlName,
        enterpriseToken
      );
      if (data.name) {
        setEnterprise(data.name);
        showMessage("success", `Enterprise 생성 완료: ${data.name}`);
      }
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  };

  // ── Devices ──
  const loadDevices = useCallback(async () => {
    if (!enterprise) {
      showMessage("error", "Enterprise 이름을 먼저 설정하세요.");
      return;
    }
    setLoading(true);
    try {
      const data = await listDevices(enterprise);
      setDevices(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  }, [enterprise, showMessage]);

  const handleViewDetail = async (name: string) => {
    setLoadingDetail(true);
    try {
      const data = await getDevice(name);
      setDetailDevice(data);
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoadingDetail(false);
  };

  const getUptime = (events?: Device["powerManagementEvents"]) => {
    if (!events || events.length === 0) return null;
    const bootEvents = events
      .filter((e) => e.eventType === "BOOT_COMPLETED" || e.eventType === "BATTERY_LEVEL_COLLECTED")
      .sort((a, b) => new Date(b.createTime || 0).getTime() - new Date(a.createTime || 0).getTime());
    const lastBoot = bootEvents.find((e) => e.eventType === "BOOT_COMPLETED");
    if (!lastBoot?.createTime) return null;
    const bootTime = new Date(lastBoot.createTime).getTime();
    const now = Date.now();
    const diff = now - bootTime;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return { bootTime: lastBoot.createTime, display: `${days}일 ${hours}시간 ${mins}분` };
  };

  const formatBytes = (bytes?: string) => {
    if (!bytes) return "N/A";
    const b = parseInt(bytes);
    if (isNaN(b)) return bytes;
    if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`;
    if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
    return `${b} B`;
  };

  const handleDeleteDevice = async (name: string) => {
    if (!confirm("⚠️ 이 기기를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;
    setLoading(true);
    try {
      await deleteDevice(name);
      showMessage("success", "기기가 삭제되었습니다.");
      loadDevices();
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  };

  const handleChangePolicy = async () => {
    if (!changePolicyTarget || !changePolicyValue) return;
    const fullPolicyName = changePolicyValue.includes("/")
      ? changePolicyValue
      : `${enterprise}/policies/${changePolicyValue}`;
    setLoading(true);
    try {
      await updateDevicePolicy(changePolicyTarget, fullPolicyName);
      showMessage("success", "정책이 변경되었습니다.");
      setChangePolicyTarget(null);
      setChangePolicyValue("");
      loadDevices();
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  };

  const handleCommand = async (commandType: string, deviceName?: string) => {
    const target = deviceName;
    if (!target) return;

    const labels: Record<string, string> = {
      LOCK: "이 기기를 잠금하시겠습니까?",
      REBOOT: "이 기기를 재부팅하시겠습니까?",
      RESET_PASSWORD: "",
    };
    if (commandType !== "RESET_PASSWORD" && !confirm(labels[commandType])) return;

    setLoading(true);
    try {
      let command: Record<string, unknown> = {};
      if (commandType === "LOCK") {
        command = { type: "LOCK" };
      } else if (commandType === "RESET_PASSWORD") {
        const pw = prompt("새 비밀번호를 입력하세요:");
        if (pw === null) { setLoading(false); return; }
        if (!confirm("비밀번호를 재설정하시겠습니까?")) { setLoading(false); return; }
        command = { type: "RESET_PASSWORD", newPassword: pw };
      } else if (commandType === "REBOOT") {
        command = { type: "REBOOT" };
      }
      await issueCommand(target, command);
      showMessage("success", `${commandType} 명령이 전송되었습니다.`);
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  };

  // ── Policies ──
  const loadPolicies = useCallback(async () => {
    if (!enterprise) {
      showMessage("error", "Enterprise 이름을 먼저 설정하세요.");
      return;
    }
    setLoading(true);
    try {
      const data = await listPolicies(enterprise);
      setPolicies(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  }, [enterprise, showMessage]);

  const handleSavePolicy = async () => {
    if (!enterprise || !policyId) {
      showMessage("error", "Enterprise와 Policy ID를 입력하세요.");
      return;
    }
    if (!confirm(`정책 "${policyId}"을(를) 저장/업데이트하시겠습니까?`)) return;
    setLoading(true);
    try {
      const parsed = JSON.parse(policyJson);
      const name = `${enterprise}/policies/${policyId}`;
      await upsertPolicy(name, parsed);
      showMessage("success", "정책이 저장되었습니다.");
      loadPolicies();
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  };

  const handleDeletePolicy = async (name: string) => {
    const id = name.split("/policies/")[1];
    if (!confirm(`⚠️ 정책 "${id}"을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setLoading(true);
    try {
      await deletePolicy(name);
      showMessage("success", "정책이 삭제되었습니다.");
      loadPolicies();
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  };

  const handleLoadPolicyDetail = async (name: string) => {
    const id = name.split("/policies/")[1];
    if (!confirm(`정책 "${id}"을(를) 편집기로 불러오시겠습니까?\n현재 편집 중인 내용은 사라집니다.`)) return;
    setLoading(true);
    try {
      const data = await getPolicy(name);
      const id = name.split("/policies/")[1];
      setPolicyId(id);
      const { name: _n, version: _v, ...rest } = data;
      setPolicyJson(JSON.stringify(rest, null, 2));
      showMessage("success", "정책을 불러왔습니다.");
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  };

  // ── Enrollment ──
  const handleCreateEnrollment = async () => {
    if (!enterprise) {
      showMessage("error", "Enterprise 이름을 먼저 설정하세요.");
      return;
    }
    const policy = enrollPolicyName || `${enterprise}/policies/default`;
    setLoading(true);
    try {
      const data = await createEnrollmentToken(enterprise, policy);
      setEnrollmentToken(data);
      showMessage("success", "등록 토큰이 생성되었습니다.");
    } catch (e: unknown) {
      showMessage("error", e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  };

  // Auto-load when switching tabs
  useEffect(() => {
    if (activeTab === "enterprise" && gcpProjects.length === 0) loadProjects();
    if (activeTab === "devices" && enterprise) loadDevices();
    if (activeTab === "policies" && enterprise) loadPolicies();
    if (activeTab === "enrollment" && enterprise) loadPolicies();
  }, [activeTab, enterprise, gcpProjects.length, loadProjects, loadDevices, loadPolicies]);

  const handleLogout = () => {
    clearAuth();
    window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`;
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-5 border-b border-gray-700">
          <h1 className="text-lg font-bold">📱 AMM Console</h1>
          <p className="text-xs text-gray-400 mt-1">Android Management</p>
        </div>
        <nav className="flex-1 p-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition flex items-center gap-3 ${
                activeTab === item.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          {enterprise && (
            <div className="text-xs text-gray-400 mb-3 truncate" title={enterprise}>
              {enterprise}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-xs text-gray-400 hover:text-white transition"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {message && (
          <div
            className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-white ${
              message.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {message.text}
          </div>
        )}

        {loading && (
          <div className="fixed top-0 left-64 right-0 h-1 bg-blue-200 z-40">
            <div className="h-1 bg-blue-600 animate-pulse w-1/2" />
          </div>
        )}

        <div className="p-8 max-w-5xl">
          {/* ── ENTERPRISE TAB ── */}
          {activeTab === "enterprise" && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Enterprise 설정</h2>

              <div className="bg-white rounded-xl shadow p-6 mb-6">
                <h3 className="font-semibold mb-4">기존 Enterprise 연결</h3>

                <div className="mb-4">
                  <label className="text-sm text-gray-500 block mb-2">GCP 프로젝트 선택</label>
                  {loadingProjects ? (
                    <p className="text-sm text-gray-400 py-2">프로젝트 목록 불러오는 중...</p>
                  ) : gcpProjects.length > 0 ? (
                    <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                      {gcpProjects.map((p) => (
                        <button
                          key={p.projectId}
                          onClick={() => {
                            setProjectId(p.projectId);
                            setEnterprises([]);
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-lg border transition ${
                            projectId === p.projectId
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="font-medium text-sm">{p.name}</div>
                          <div className="text-xs text-gray-400">{p.projectId}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 mb-3">
                      프로젝트를 불러올 수 없습니다.
                      <button onClick={loadProjects} className="text-blue-600 hover:underline ml-1">
                        다시 시도
                      </button>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="또는 프로젝트 ID 직접 입력"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="flex-1 border rounded-lg px-4 py-2 text-sm"
                    />
                    <button
                      onClick={loadEnterprises}
                      disabled={loadingEnterprises || !projectId}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {loadingEnterprises ? "조회 중..." : "Enterprise 조회"}
                    </button>
                  </div>
                </div>

                {enterprises.length > 0 && (
                  <div className="mb-4">
                    <label className="text-sm text-gray-500 block mb-2">Enterprise 선택</label>
                    <div className="space-y-2">
                      {enterprises.map((ent) => (
                        <button
                          key={ent.name}
                          onClick={() => {
                            setEnterprise(ent.name || "");
                            showMessage("success", `${ent.name} 선택됨`);
                          }}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                            enterprise === ent.name
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="font-medium text-sm">{ent.name}</div>
                          {ent.enterpriseDisplayName && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {ent.enterpriseDisplayName}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 mt-4">
                  <p className="text-sm text-gray-400 mb-2">또는 직접 입력:</p>
                  <input
                    type="text"
                    placeholder="enterprises/LC01234567"
                    value={enterprise}
                    onChange={(e) => setEnterprise(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold mb-4">새 Enterprise 생성</h3>
                <p className="text-sm text-gray-500 mb-3">
                  위에서 입력한 GCP 프로젝트 ID로 새 Enterprise를 생성합니다.
                </p>
                <button
                  onClick={handleCreateEnterprise}
                  disabled={loading}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Enterprise Signup URL 생성
                </button>

                <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
                  <p className="text-sm text-gray-500">
                    Signup 완료 후, 리다이렉트된 URL에서 파라미터를 복사하세요:
                  </p>
                  <input
                    type="text"
                    placeholder="Signup URL Name"
                    value={signupUrlName}
                    onChange={(e) => setSignupUrlName(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Enterprise Token (URL에서 복사)"
                    value={enterpriseToken}
                    onChange={(e) => setEnterpriseToken(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                  <button
                    onClick={handleCompleteEnterprise}
                    className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition"
                  >
                    Enterprise 등록 완료
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── DEVICES TAB ── */}
          {activeTab === "devices" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">기기 관리</h2>
                  {devices.length > 0 && (
                    <span className="text-sm text-gray-400 bg-gray-100 px-2 py-1 rounded">
                      API 조회: 총 {devices.length}대
                    </span>
                  )}
                </div>
                <button
                  onClick={loadDevices}
                  className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 transition text-sm"
                >
                  새로고침
                </button>
              </div>

              {devices.length > 0 && (
                <div className="flex gap-3 mb-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs text-gray-400 block mb-1">검색 (IMEI, S/N, 모델, 이름)</label>
                    <input
                      type="text"
                      value={deviceSearch}
                      onChange={(e) => setDeviceSearch(e.target.value)}
                      placeholder="검색어 입력..."
                      className="w-full border rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">상태</label>
                    <select
                      value={deviceStateFilter}
                      onChange={(e) => setDeviceStateFilter(e.target.value)}
                      className="border rounded-lg px-3 py-1.5 text-sm"
                    >
                      {deviceStates.map((s) => (
                        <option key={s} value={s}>{s === "ALL" ? "전체 상태" : s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">정책</label>
                    <select
                      value={devicePolicyFilter}
                      onChange={(e) => setDevicePolicyFilter(e.target.value)}
                      className="border rounded-lg px-3 py-1.5 text-sm"
                    >
                      {devicePolicies.map((p) => (
                        <option key={p} value={p}>{p === "ALL" ? "전체 정책" : p?.split("/").pop()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <span className="text-xs text-gray-400 pb-2">
                      {filteredDevices.length} / {devices.length}대
                    </span>
                  </div>
                </div>
              )}

              {devices.length === 0 ? (
                <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">
                  <p className="text-4xl mb-3">📱</p>
                  <p>등록된 기기가 없습니다.</p>
                  <p className="text-sm mt-1">
                    &quot;기기 등록&quot; 탭에서 QR 코드를 생성하여 기기를 등록하세요.
                  </p>
                </div>
              ) : filteredDevices.length === 0 ? (
                <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">
                  <p>필터 조건에 맞는 기기가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredDevices.map((device) => (
                    <div key={device.name} className="bg-white rounded-xl shadow p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`inline-block w-2.5 h-2.5 rounded-full ${
                                device.state === "ACTIVE"
                                  ? "bg-green-500"
                                  : device.state === "PROVISIONING"
                                    ? "bg-yellow-500"
                                    : "bg-gray-400"
                              }`}
                            />
                            <span className="font-semibold">
                              {device.hardwareInfo?.brand} {device.hardwareInfo?.model}
                            </span>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                              {device.state}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 space-y-1">
                            <p>
                              Android {device.softwareInfo?.androidVersion || "N/A"} |
                              보안 패치: {device.softwareInfo?.securityPatchLevel || "N/A"} |
                              마지막 보고: {device.lastStatusReportTime
                                ? new Date(device.lastStatusReportTime).toLocaleString()
                                : "N/A"}
                            </p>
                            <p>
                              S/N: {device.hardwareInfo?.serialNumber || "N/A"} |
                              IMEI: {device.networkInfo?.imei || "N/A"}
                            </p>
                            <p className="text-xs">
                              정책: {device.policyName?.split("/").pop()}
                              {device.appliedPolicyVersion && (
                                <span className="ml-1 text-gray-400">
                                  (v{device.appliedPolicyVersion})
                                </span>
                              )} |
                              등록: {device.enrollmentTime
                                ? new Date(device.enrollmentTime).toLocaleDateString()
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleViewDetail(device.name!)}
                            className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
                          >
                            📋 상세
                          </button>
                          <button
                            onClick={() => handleCommand("LOCK", device.name)}
                            className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg hover:bg-yellow-200"
                          >
                            🔒 잠금
                          </button>
                          <button
                            onClick={() => handleCommand("REBOOT", device.name)}
                            className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200"
                          >
                            🔄 재부팅
                          </button>
                          <button
                            onClick={() => handleCommand("RESET_PASSWORD", device.name)}
                            className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-200"
                          >
                            🔑 비밀번호
                          </button>
                          <button
                            onClick={() => {
                              setChangePolicyTarget(device.name!);
                              setChangePolicyValue(device.policyName?.split("/").pop() || "");
                            }}
                            className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200"
                          >
                            📋 정책변경
                          </button>
                          <button
                            onClick={() => handleDeleteDevice(device.name!)}
                            className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200"
                          >
                            🗑️ 삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── POLICIES TAB ── */}
          {activeTab === "policies" && (
            <div>
              <h2 className="text-2xl font-bold mb-6">정책 관리</h2>

              <div className="bg-white rounded-xl shadow p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">정책 편집기</h3>
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => {
                        if (policyEditorMode === "json") {
                          try { JSON.parse(policyJson); } catch { showMessage("error", "JSON 형식이 올바르지 않습니다."); return; }
                        }
                        setPolicyEditorMode("visual");
                      }}
                      className={`px-3 py-1 rounded-md text-sm transition ${
                        policyEditorMode === "visual" ? "bg-white shadow font-medium" : "text-gray-500"
                      }`}
                    >
                      UI 편집
                    </button>
                    <button
                      onClick={() => setPolicyEditorMode("json")}
                      className={`px-3 py-1 rounded-md text-sm transition ${
                        policyEditorMode === "json" ? "bg-white shadow font-medium" : "text-gray-500"
                      }`}
                    >
                      JSON
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="text-sm text-gray-500 block mb-1">Policy ID</label>
                  <input
                    type="text"
                    value={policyId}
                    onChange={(e) => setPolicyId(e.target.value)}
                    placeholder="default"
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>

                {policyEditorMode === "visual" ? (
                  <div className="mb-3">
                    <PolicyVisualEditor
                      policy={(() => { try { return JSON.parse(policyJson); } catch { return {}; } })()}
                      onChange={(p) => setPolicyJson(JSON.stringify(p, null, 2))}
                    />
                  </div>
                ) : (
                  <div className="mb-3">
                    <label className="text-sm text-gray-500 block mb-1">Policy JSON</label>
                    <textarea
                      value={policyJson}
                      onChange={(e) => setPolicyJson(e.target.value)}
                      rows={20}
                      className="w-full border rounded-lg px-4 py-2 font-mono text-sm"
                    />
                  </div>
                )}

                <button
                  onClick={handleSavePolicy}
                  disabled={loading}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  정책 저장 / 업데이트
                </button>
              </div>

              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">등록된 정책</h3>
                  <button onClick={loadPolicies} className="text-sm text-blue-600 hover:underline">
                    새로고침
                  </button>
                </div>
                {policies.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">등록된 정책이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {policies.map((p) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                      >
                        <div>
                          <span className="font-medium">{p.name?.split("/policies/")[1]}</span>
                          <span className="text-xs text-gray-400 ml-2">v{p.version}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLoadPolicyDetail(p.name!)}
                            className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200"
                          >
                            편집
                          </button>
                          <button
                            onClick={() => handleDeletePolicy(p.name!)}
                            className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ENROLLMENT TAB ── */}
          {activeTab === "enrollment" && (
            <div>
              <h2 className="text-2xl font-bold mb-6">기기 등록</h2>

              <div className="bg-white rounded-xl shadow p-6 mb-6">
                <h3 className="font-semibold mb-4">Enrollment Token 생성</h3>
                <p className="text-sm text-gray-500 mb-4">
                  기기에 적용할 정책을 선택하고 등록 토큰을 생성하세요. QR 코드로 기기를 쉽게 등록할 수 있습니다.
                </p>
                <div className="mb-4">
                  <label className="text-sm text-gray-500 block mb-2">정책 선택</label>
                  {policies.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {policies.map((p) => (
                        <button
                          key={p.name}
                          onClick={() => setEnrollPolicyName(p.name || "")}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                            enrollPolicyName === p.name
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="font-medium text-sm">
                            {p.name?.split("/policies/")[1]}
                          </div>
                          <div className="text-xs text-gray-400">{p.name}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 mb-3">
                      등록된 정책이 없습니다. 정책 관리 탭에서 먼저 정책을 생성하세요.
                    </p>
                  )}
                  <input
                    type="text"
                    value={enrollPolicyName}
                    onChange={(e) => setEnrollPolicyName(e.target.value)}
                    placeholder={`${enterprise || "enterprises/..."}/policies/default`}
                    className="w-full border rounded-lg px-4 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={handleCreateEnrollment}
                  disabled={loading}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  등록 토큰 생성
                </button>
              </div>

              {enrollmentToken && (
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="font-semibold mb-4">생성된 등록 토큰</h3>

                  {enrollmentToken.qrCode && (
                    <QrCodeCanvas data={enrollmentToken.qrCode} />
                  )}

                  <div className="bg-gray-50 rounded-lg p-4 mb-3">
                    <label className="text-xs text-gray-400 block mb-1">Token Value</label>
                    <code className="text-sm break-all">{enrollmentToken.value}</code>
                  </div>

                  <div className="text-sm text-gray-500">
                    <p>
                      만료:{" "}
                      {enrollmentToken.expirationTimestamp
                        ? new Date(enrollmentToken.expirationTimestamp).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>

                  <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                    <p className="font-semibold mb-1">기기 등록 방법:</p>
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>기기를 초기화(Factory Reset)합니다.</li>
                      <li>&quot;Welcome&quot; 화면에서 화면을 6번 탭합니다.</li>
                      <li>QR 코드 리더가 열리면 위의 QR 코드를 스캔합니다.</li>
                      <li>기기가 자동으로 프로비저닝됩니다.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Change Policy Dialog ── */}
      {changePolicyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-semibold text-lg mb-1">정책 변경</h3>
            <p className="text-sm text-gray-500 mb-4">
              {changePolicyTarget.split("/").pop()}
            </p>

            <label className="text-sm font-medium text-gray-700 block mb-2">
              적용할 정책 선택
            </label>
            {policies.length > 0 ? (
              <div className="max-h-48 overflow-y-auto border rounded-lg mb-3">
                {policies.map((p) => {
                  const shortName = (p.name || "").split("/").pop() || "";
                  return (
                    <button
                      key={p.name}
                      onClick={() => setChangePolicyValue(shortName)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 ${
                        changePolicyValue === shortName
                          ? "bg-blue-100 text-blue-800 font-medium"
                          : "text-gray-700"
                      }`}
                    >
                      {shortName}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                value={changePolicyValue}
                onChange={(e) => setChangePolicyValue(e.target.value)}
                placeholder="Policy ID (예: default)"
                className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
              />
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setChangePolicyTarget(null); setChangePolicyValue(""); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleChangePolicy}
                disabled={!changePolicyValue}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                변경
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Device Detail Slide-over ── */}
      {detailDevice && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setDetailDevice(null)}
          />
          <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold">
                {detailDevice.hardwareInfo?.brand} {detailDevice.hardwareInfo?.model}
              </h3>
              <button
                onClick={() => setDetailDevice(null)}
                className="text-gray-400 hover:text-gray-700 text-xl"
              >
                &times;
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-10 text-center text-gray-400">로딩 중...</div>
            ) : (
              <div className="p-6 space-y-6">
                {/* 상태 */}
                <Section title="상태">
                  <Row label="상태" value={detailDevice.state} />
                  <Row label="적용 상태" value={detailDevice.appliedState} />
                  <Row
                    label="업타임"
                    value={getUptime(detailDevice.powerManagementEvents)?.display}
                  />
                  <Row
                    label="마지막 부팅"
                    value={getUptime(detailDevice.powerManagementEvents)?.bootTime
                      ? new Date(getUptime(detailDevice.powerManagementEvents)!.bootTime).toLocaleString()
                      : undefined}
                  />
                  <Row
                    label="마지막 상태 보고"
                    value={detailDevice.lastStatusReportTime
                      ? new Date(detailDevice.lastStatusReportTime).toLocaleString()
                      : undefined}
                  />
                  <Row
                    label="마지막 정책 동기화"
                    value={detailDevice.lastPolicySyncTime
                      ? new Date(detailDevice.lastPolicySyncTime).toLocaleString()
                      : undefined}
                  />
                  <Row
                    label="등록일"
                    value={detailDevice.enrollmentTime
                      ? new Date(detailDevice.enrollmentTime).toLocaleString()
                      : undefined}
                  />
                </Section>

                {/* 하드웨어 */}
                <Section title="하드웨어">
                  <Row label="제조사" value={detailDevice.hardwareInfo?.manufacturer} />
                  <Row label="브랜드" value={detailDevice.hardwareInfo?.brand} />
                  <Row label="모델" value={detailDevice.hardwareInfo?.model} />
                  <Row label="하드웨어" value={detailDevice.hardwareInfo?.hardware} />
                  <Row label="S/N" value={detailDevice.hardwareInfo?.serialNumber} />
                  <Row label="베이스밴드" value={detailDevice.hardwareInfo?.deviceBasebandVersion} />
                  <Row label="RAM" value={formatBytes(detailDevice.memoryInfo?.totalRam)} />
                  <Row label="내부 저장소" value={formatBytes(detailDevice.memoryInfo?.totalInternalStorage)} />
                </Section>

                {/* 소프트웨어 */}
                <Section title="소프트웨어">
                  <Row label="Android" value={detailDevice.softwareInfo?.androidVersion} />
                  <Row label="API Level" value={detailDevice.apiLevel?.toString()} />
                  <Row label="보안 패치" value={detailDevice.softwareInfo?.securityPatchLevel} />
                  <Row label="빌드 번호" value={detailDevice.softwareInfo?.androidBuildNumber} />
                  <Row label="커널" value={detailDevice.softwareInfo?.deviceKernelVersion} />
                  <Row label="부트로더" value={detailDevice.softwareInfo?.bootloaderVersion} />
                  <Row label="언어" value={detailDevice.softwareInfo?.primaryLanguageCode} />
                  <Row label="DPC 버전" value={detailDevice.softwareInfo?.androidDevicePolicyVersionName} />
                  <Row
                    label="시스템 업데이트"
                    value={detailDevice.softwareInfo?.systemUpdateInfo?.updateStatus}
                  />
                </Section>

                {/* 네트워크 */}
                <Section title="네트워크">
                  <Row label="IMEI" value={detailDevice.networkInfo?.imei} />
                  <Row label="MEID" value={detailDevice.networkInfo?.meid} />
                  <Row label="Wi-Fi MAC" value={detailDevice.networkInfo?.wifiMacAddress} />
                  <Row label="통신사" value={detailDevice.networkInfo?.networkOperatorName} />
                </Section>

                {/* 정책 */}
                <Section title="정책">
                  <Row label="적용 정책" value={detailDevice.appliedPolicyName?.split("/").pop()} />
                  <Row label="정책 버전" value={detailDevice.appliedPolicyVersion} />
                  <Row label="설정 정책" value={detailDevice.policyName?.split("/").pop()} />
                </Section>

                {/* 디스플레이 */}
                {detailDevice.displays && detailDevice.displays.length > 0 && (
                  <Section title="디스플레이">
                    {detailDevice.displays.map((d, i) => (
                      <div key={i} className="mb-2">
                        <Row label={`디스플레이 ${i + 1}`} value={`${d.width}x${d.height} @ ${d.density}dpi`} />
                        <Row label="리프레시율" value={d.refreshRate ? `${d.refreshRate}Hz` : undefined} />
                        <Row label="상태" value={d.state} />
                      </div>
                    ))}
                  </Section>
                )}

                {/* 보안 */}
                <Section title="보안">
                  <Row label="보안 상태" value={detailDevice.securityPosture?.devicePosture} />
                  {detailDevice.securityPosture?.postureDetails?.map((pd, i) => (
                    <Row key={i} label={`위험 요소 ${i + 1}`} value={pd.securityRisk} />
                  ))}
                  <Row label="사용자" value={detailDevice.user?.accountIdentifier} />
                </Section>

                {/* 하드웨어 상태 그래프 */}
                {detailDevice.hardwareStatusSamples && detailDevice.hardwareStatusSamples.length > 0 && (() => {
                  const samples = detailDevice.hardwareStatusSamples!;

                  // CPU 사용률 타임라인 (각 샘플의 코어별 평균)
                  const cpuData = samples.map((s) => ({
                    time: s.createTime ? new Date(s.createTime).toLocaleTimeString() : "",
                    ...(s.cpuUsages?.reduce((acc, val, i) => ({ ...acc, [`코어${i}`]: parseFloat((val * 100).toFixed(1)) }), {}) || {}),
                    평균: s.cpuUsages ? parseFloat((s.cpuUsages.reduce((a, b) => a + b, 0) / s.cpuUsages.length * 100).toFixed(1)) : 0,
                  }));

                  const cpuCoreCount = samples[0]?.cpuUsages?.length || 0;
                  const coreColors = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

                  // 온도 타임라인
                  const tempData = samples.map((s) => ({
                    time: s.createTime ? new Date(s.createTime).toLocaleTimeString() : "",
                    배터리: s.batteryTemperatures?.[0] ? parseFloat(s.batteryTemperatures[0].toFixed(1)) : null,
                    CPU: s.cpuTemperatures?.[0] ? parseFloat(s.cpuTemperatures[0].toFixed(1)) : null,
                    GPU: s.gpuTemperatures?.[0] ? parseFloat(s.gpuTemperatures[0].toFixed(1)) : null,
                    스킨: s.skinTemperatures?.[0] ? parseFloat(s.skinTemperatures[0].toFixed(1)) : null,
                  }));

                  // 최신 샘플의 코어별 CPU 사용률 (바 차트)
                  const latest = samples[samples.length - 1];
                  const coreBarData = latest.cpuUsages?.map((u, i) => ({
                    name: `코어${i}`,
                    사용률: parseFloat((u * 100).toFixed(1)),
                  })) || [];

                  return (
                    <>
                      {/* CPU 사용률 타임라인 */}
                      {cpuData.length > 0 && cpuData[0].평균 !== undefined && (
                        <Section title="CPU 사용률 추이">
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={cpuData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                              <Tooltip />
                              <Legend />
                              {cpuCoreCount <= 8 && Array.from({ length: cpuCoreCount }).map((_, i) => (
                                <Line
                                  key={i}
                                  type="monotone"
                                  dataKey={`코어${i}`}
                                  stroke={coreColors[i % coreColors.length]}
                                  strokeWidth={1}
                                  dot={false}
                                  strokeOpacity={0.5}
                                />
                              ))}
                              <Line type="monotone" dataKey="평균" stroke="#111827" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </Section>
                      )}

                      {/* 코어별 현재 CPU 사용률 */}
                      {coreBarData.length > 0 && (
                        <Section title="코어별 CPU 사용률 (현재)">
                          <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={coreBarData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                              <Tooltip />
                              <Bar dataKey="사용률" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </Section>
                      )}

                      {/* 온도 추이 */}
                      {tempData.length > 0 && (
                        <Section title="온도 추이">
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={tempData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} unit="°C" />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="배터리" stroke="#f59e0b" strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="CPU" stroke="#ef4444" strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="GPU" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="스킨" stroke="#22c55e" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </Section>
                      )}
                    </>
                  );
                })()}

                {/* 전원 이벤트 */}
                {detailDevice.powerManagementEvents && detailDevice.powerManagementEvents.length > 0 && (
                  <PowerEventsSection events={detailDevice.powerManagementEvents} />
                )}

                {/* 설치된 앱 */}
                {detailDevice.applicationReports && detailDevice.applicationReports.length > 0 && (
                  <AppReportsSection apps={detailDevice.applicationReports} />
                )}

                {/* 컴플라이언스 */}
                {detailDevice.nonComplianceDetails && detailDevice.nonComplianceDetails.length > 0 && (
                  <Section title="정책 미준수 항목">
                    {detailDevice.nonComplianceDetails.map((nc, i) => (
                      <div key={i} className="mb-2 p-3 bg-red-50 rounded-lg text-sm">
                        <div className="font-medium text-red-700">{nc.settingName}</div>
                        <div className="text-red-500 text-xs">사유: {nc.nonComplianceReason}</div>
                        {nc.fieldPath && (
                          <div className="text-red-400 text-xs">필드: {nc.fieldPath}</div>
                        )}
                      </div>
                    ))}
                  </Section>
                )}

                {/* Raw JSON */}
                <Section title="원본 데이터 (JSON)">
                  <details>
                    <summary className="text-sm text-blue-600 cursor-pointer hover:underline">
                      펼치기
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto max-h-96">
                      {JSON.stringify(detailDevice, null, 2)}
                    </pre>
                  </details>
                </Section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper components ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
        {title}
      </h4>
      <div className="bg-gray-50 rounded-lg p-4">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-right max-w-[60%] break-all">
        {value || "N/A"}
      </span>
    </div>
  );
}

const POWER_EVENT_META: Record<string, { icon: string; label: string; color: string }> = {
  BOOT_COMPLETED: { icon: "🟢", label: "부팅 완료", color: "bg-green-50 text-green-700 border-green-200" },
  SHUTDOWN: { icon: "🔴", label: "종료", color: "bg-red-50 text-red-700 border-red-200" },
  BATTERY_LOW: { icon: "🪫", label: "배터리 부족", color: "bg-orange-50 text-orange-700 border-orange-200" },
  BATTERY_OKAY: { icon: "🔋", label: "배터리 정상", color: "bg-green-50 text-green-700 border-green-200" },
  BATTERY_LEVEL_COLLECTED: { icon: "📊", label: "배터리 수집", color: "bg-gray-50 text-gray-600 border-gray-200" },
  POWER_CONNECTED: { icon: "🔌", label: "충전 시작", color: "bg-blue-50 text-blue-700 border-blue-200" },
  POWER_DISCONNECTED: { icon: "⚡", label: "충전 해제", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
};

function PowerEventsSection({ events }: { events: NonNullable<Device["powerManagementEvents"]> }) {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");

  const eventTypes = Array.from(new Set(events.map((e) => e.eventType).filter(Boolean))) as string[];

  const filtered = filter === "ALL" ? events : events.filter((e) => e.eventType === filter);
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createTime || 0).getTime() - new Date(a.createTime || 0).getTime()
  );
  const displayed = showAll ? sorted : sorted.slice(0, 15);

  return (
    <Section title={`전원 이벤트 (${events.length}건)`}>
      {/* 필터 */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => setFilter("ALL")}
          className={`text-xs px-2.5 py-1 rounded-full border ${
            filter === "ALL" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          전체 ({events.length})
        </button>
        {eventTypes.map((type) => {
          const meta = POWER_EVENT_META[type];
          const count = events.filter((e) => e.eventType === type).length;
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                filter === type ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {meta?.icon || "⚙️"} {meta?.label || type} ({count})
            </button>
          );
        })}
      </div>

      {/* 이벤트 목록 */}
      <div className="space-y-1.5">
        {displayed.map((e, i) => {
          const meta = POWER_EVENT_META[e.eventType || ""] || {
            icon: "⚙️",
            label: e.eventType || "UNKNOWN",
            color: "bg-gray-50 text-gray-600 border-gray-200",
          };
          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${meta.color}`}
            >
              <span className="text-base">{meta.icon}</span>
              <span className="font-medium min-w-[90px]">{meta.label}</span>
              <span className="text-xs opacity-70 flex-1">
                {e.createTime ? new Date(e.createTime).toLocaleString() : "N/A"}
              </span>
              {e.batteryLevel !== undefined && (
                <span className="text-xs font-mono whitespace-nowrap">
                  {e.batteryLevel >= 0 ? `${e.batteryLevel}%` : ""}
                  {e.batteryLevel !== undefined && e.batteryLevel >= 0 && (
                    <span
                      className="inline-block ml-1.5 h-2 rounded-full align-middle"
                      style={{
                        width: `${Math.max(e.batteryLevel * 0.4, 4)}px`,
                        backgroundColor:
                          e.batteryLevel > 50 ? "#22c55e" : e.batteryLevel > 20 ? "#f59e0b" : "#ef4444",
                      }}
                    />
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {sorted.length > 15 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-blue-600 hover:underline"
        >
          {showAll ? "접기" : `전체 ${sorted.length}건 보기`}
        </button>
      )}
    </Section>
  );
}

function AppReportsSection({ apps }: { apps: AppReport[] }) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [selectedApp, setSelectedApp] = useState<AppReport | null>(null);

  const sources = ["ALL", ...Array.from(new Set(apps.map((a) => a.applicationSource).filter(Boolean)))];

  const filtered = apps.filter((a) => {
    if (sourceFilter !== "ALL" && a.applicationSource !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = [a.packageName, a.displayName].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (a.displayName || a.packageName || "").localeCompare(b.displayName || b.packageName || ""));

  const stateColor = (state?: string) => {
    switch (state) {
      case "INSTALLED": return "bg-green-100 text-green-700";
      case "DISABLED": return "bg-gray-100 text-gray-500";
      case "REMOVED": return "bg-red-100 text-red-600";
      default: return "bg-gray-100 text-gray-500";
    }
  };

  const sourceLabel = (src?: string) => {
    switch (src) {
      case "SYSTEM_APP_FACTORY_VERSION": return "시스템 (초기)";
      case "SYSTEM_APP_UPDATED_VERSION": return "시스템 (업데이트)";
      case "INSTALLED_FROM_PLAY_STORE": return "Play Store";
      default: return src || "알 수 없음";
    }
  };

  return (
    <>
      <Section title={`설치된 앱 (${apps.length}개)`}>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="앱 이름 또는 패키지명 검색..."
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-xs"
          >
            {sources.map((s) => (
              <option key={s} value={s}>{s === "ALL" ? "전체 소스" : sourceLabel(s)}</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-gray-400 mb-2">{filtered.length}개 표시</div>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {filtered.map((app, i) => (
            <button
              key={i}
              onClick={() => setSelectedApp(app)}
              className="w-full flex items-center justify-between py-1.5 px-2 rounded hover:bg-white text-sm text-left cursor-pointer transition"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{app.displayName || app.packageName}</div>
                {app.displayName && (
                  <div className="text-xs text-gray-400 truncate">{app.packageName}</div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="text-xs text-gray-500">{app.versionName || `v${app.versionCode}`}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${stateColor(app.state)}`}>
                  {app.state || "N/A"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* 앱 상세 다이얼로그 */}
      {selectedApp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedApp(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <div>
                <h3 className="font-bold">{selectedApp.displayName || selectedApp.packageName}</h3>
                {selectedApp.displayName && (
                  <p className="text-xs text-gray-400">{selectedApp.packageName}</p>
                )}
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-3">
              <Row label="상태" value={selectedApp.state} />
              <Row label="활성화" value={selectedApp.enabled === false ? "비활성화" : "활성화"} />
              <Row label="버전" value={selectedApp.versionName} />
              <Row label="버전 코드" value={selectedApp.versionCode?.toString()} />
              <Row label="설치 소스" value={sourceLabel(selectedApp.applicationSource)} />
              <Row label="설치 앱" value={selectedApp.installerPackageName} />

              <div className="border-t pt-3 mt-3">
                <div className="text-xs text-gray-400 mb-1">패키지 SHA-256 해시</div>
                <code className="text-xs bg-gray-50 p-2 rounded block break-all">
                  {selectedApp.packageSha256Hash || "N/A"}
                </code>
              </div>

              {selectedApp.signingKeyCertFingerprints && selectedApp.signingKeyCertFingerprints.length > 0 && (
                <div className="border-t pt-3">
                  <div className="text-xs text-gray-400 mb-1">서명 키 인증서 지문</div>
                  {selectedApp.signingKeyCertFingerprints.map((fp, i) => (
                    <code key={i} className="text-xs bg-gray-50 p-2 rounded block break-all mb-1">
                      {fp}
                    </code>
                  ))}
                </div>
              )}

              {selectedApp.permissionGrants && selectedApp.permissionGrants.length > 0 && (
                <div className="border-t pt-3">
                  <div className="text-xs text-gray-400 mb-1">부여된 권한 ({selectedApp.permissionGrants.length}개)</div>
                  <div className="max-h-40 overflow-y-auto">
                    {selectedApp.permissionGrants.map((p, i) => (
                      <div key={i} className="text-xs bg-gray-50 px-2 py-1 rounded mb-0.5 font-mono truncate">{p}</div>
                    ))}
                  </div>
                </div>
              )}

              {selectedApp.events && selectedApp.events.length > 0 && (
                <div className="border-t pt-3">
                  <div className="text-xs text-gray-400 mb-1">앱 이벤트 (최근)</div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {selectedApp.events.slice(-10).reverse().map((e, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-gray-500">
                          {e.createTime ? new Date(e.createTime).toLocaleString() : "N/A"}
                        </span>
                        <span className="font-medium">{e.eventType}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-3">
                <details>
                  <summary className="text-xs text-blue-600 cursor-pointer hover:underline">원본 JSON</summary>
                  <pre className="mt-2 text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto max-h-60">
                    {JSON.stringify(selectedApp, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
