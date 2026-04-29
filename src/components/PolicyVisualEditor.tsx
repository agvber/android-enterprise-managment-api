"use client";

import { useState } from "react";

type PolicyObj = Record<string, unknown>;

const INSTALL_TYPES = [
  { value: "FORCE_INSTALLED", label: "강제 설치 (삭제 불가)" },
  { value: "PREINSTALLED", label: "사전 설치 (삭제 가능)" },
  { value: "BLOCKED", label: "차단" },
  { value: "AVAILABLE", label: "설치 가능 (Play Store)" },
  { value: "REQUIRED_FOR_SETUP", label: "초기 설정 시 필수 설치" },
  { value: "KIOSK", label: "키오스크 모드" },
];

const DEFAULT_PERMISSION_POLICIES = [
  { value: "", label: "설정 안 함" },
  { value: "PROMPT", label: "사용자에게 물어보기" },
  { value: "GRANT", label: "자동 허용" },
  { value: "DENY", label: "자동 거부" },
];

const AUTO_UPDATE_MODES = [
  { value: "", label: "설정 안 함" },
  { value: "AUTO_UPDATE_DEFAULT", label: "기본 (Wi-Fi에서 자동)" },
  { value: "AUTO_UPDATE_POSTPONED", label: "연기 (최대 90일)" },
  { value: "AUTO_UPDATE_HIGH_PRIORITY", label: "우선 업데이트" },
  { value: "CHOICE_TO_THE_USER", label: "사용자 선택" },
];

const DELEGATED_SCOPES = [
  { value: "CERT_INSTALL", label: "인증서 설치" },
  { value: "MANAGED_CONFIGURATIONS", label: "관리 설정" },
  { value: "BLOCK_UNINSTALL", label: "삭제 차단" },
  { value: "PERMISSION_GRANT", label: "권한 부여" },
  { value: "PACKAGE_ACCESS", label: "패키지 접근" },
  { value: "ENABLE_SYSTEM_APP", label: "시스템 앱 활성화" },
  { value: "NETWORK_ACTIVITY_LOGS", label: "네트워크 로그" },
  { value: "SECURITY_LOGS", label: "보안 로그" },
];

const PASSWORD_QUALITY = [
  { value: "", label: "설정 안 함" },
  { value: "BIOMETRIC_WEAK", label: "생체인식 (약)" },
  { value: "SOMETHING", label: "패턴/PIN/비밀번호" },
  { value: "NUMERIC", label: "숫자 PIN" },
  { value: "NUMERIC_COMPLEX", label: "복잡한 숫자 PIN" },
  { value: "ALPHABETIC", label: "알파벳" },
  { value: "ALPHANUMERIC", label: "알파벳+숫자" },
  { value: "COMPLEX", label: "복잡한 비밀번호" },
];

const SYSTEM_UPDATE_TYPES = [
  { value: "", label: "설정 안 함" },
  { value: "AUTOMATIC", label: "자동 업데이트" },
  { value: "WINDOWED", label: "시간대 지정" },
  { value: "POSTPONE", label: "30일 연기" },
];

const ENCRYPTION_POLICIES = [
  { value: "", label: "설정 안 함" },
  { value: "ENABLED_WITHOUT_PASSWORD", label: "암호화 (비밀번호 없이)" },
  { value: "ENABLED_WITH_PASSWORD", label: "암호화 (비밀번호 필수)" },
];

const LOCATION_MODES = [
  { value: "", label: "설정 안 함" },
  { value: "LOCATION_USER_CHOICE", label: "사용자 선택" },
  { value: "LOCATION_ENFORCED", label: "강제 켜기" },
  { value: "LOCATION_DISABLED", label: "비활성화" },
];

interface Props {
  policy: PolicyObj;
  onChange: (policy: PolicyObj) => void;
}

export default function PolicyVisualEditor({ policy, onChange }: Props) {
  const update = (path: string, value: unknown) => {
    const next = { ...policy };
    const keys = path.split(".");
    let obj: Record<string, unknown> = next;
    for (let i = 0; i < keys.length - 1; i++) {
      if (obj[keys[i]] === undefined) obj[keys[i]] = {};
      obj = obj[keys[i]] as Record<string, unknown>;
    }
    const last = keys[keys.length - 1];
    if (value === "" || value === undefined || value === false) {
      delete obj[last];
      // clean up empty parents
      if (keys.length > 1 && typeof obj === "object" && Object.keys(obj).length === 0) {
        let parent: Record<string, unknown> = next;
        for (let i = 0; i < keys.length - 2; i++) parent = parent[keys[i]] as Record<string, unknown>;
        delete parent[keys[keys.length - 2]];
      }
    } else {
      obj[last] = value;
    }
    onChange(next);
  };

  const getBool = (path: string): boolean => {
    const keys = path.split(".");
    let obj: unknown = policy;
    for (const k of keys) {
      if (obj === undefined || obj === null || typeof obj !== "object") return false;
      obj = (obj as Record<string, unknown>)[k];
    }
    return obj === true;
  };

  const getStr = (path: string): string => {
    const keys = path.split(".");
    let obj: unknown = policy;
    for (const k of keys) {
      if (obj === undefined || obj === null || typeof obj !== "object") return "";
      obj = (obj as Record<string, unknown>)[k];
    }
    if (obj === undefined || obj === null) return "";
    return String(obj);
  };

  const getNum = (path: string): number | "" => {
    const val = getStr(path);
    return val === "" ? "" : Number(val);
  };

  // ── Apps ──
  const apps: Record<string, unknown>[] = (policy.applications as Record<string, unknown>[] | undefined) || [];
  const [expandedApp, setExpandedApp] = useState<number | null>(null);

  const [newPkg, setNewPkg] = useState("");
  const [newInstallType, setNewInstallType] = useState("FORCE_INSTALLED");

  const addApp = () => {
    if (!newPkg.trim()) return;
    const next = [...apps, { packageName: newPkg.trim(), installType: newInstallType }];
    onChange({ ...policy, applications: next });
    setNewPkg("");
    setExpandedApp(next.length - 1);
  };

  const removeApp = (idx: number) => {
    const next = apps.filter((_, i) => i !== idx);
    onChange({ ...policy, applications: next.length > 0 ? next : undefined });
    setExpandedApp(null);
  };

  const updateApp = (idx: number, field: string, value: unknown) => {
    const next = [...apps];
    const updated = { ...next[idx] };
    if (value === "" || value === undefined || value === false) {
      delete updated[field];
    } else {
      updated[field] = value;
    }
    next[idx] = updated;
    onChange({ ...policy, applications: next });
  };

  const toggleAppDelegatedScope = (idx: number, scope: string, enabled: boolean) => {
    const current: string[] = (apps[idx].delegatedScopes as string[] | undefined) || [];
    const next = enabled ? [...current, scope] : current.filter((s: string) => s !== scope);
    updateApp(idx, "delegatedScopes", next.length > 0 ? next : undefined);
  };

  const updateAppPermission = (idx: number, permission: string, policy_val: string) => {
    const current: { permission: string; policy: string }[] = (apps[idx].permissionGrants as { permission: string; policy: string }[] | undefined) || [];
    const existing = current.findIndex((p) => p.permission === permission);
    let next;
    if (policy_val === "") {
      next = current.filter((p) => p.permission !== permission);
    } else if (existing >= 0) {
      next = [...current];
      next[existing] = { permission, policy: policy_val };
    } else {
      next = [...current, { permission, policy: policy_val }];
    }
    updateApp(idx, "permissionGrants", next.length > 0 ? next : undefined);
  };

  const [newPermission, setNewPermission] = useState("");

  return (
    <div className="space-y-6">
      {/* ── 앱 관리 ── */}
      <EditorSection title="앱 관리" desc="기기에 설치/차단할 앱을 관리합니다.">
        {/* 전체 앱 기본 권한 정책 */}
        <SelectField
          label="전체 앱 기본 권한 정책"
          value={(policy.defaultPermissionPolicy as string | undefined) || ""}
          options={DEFAULT_PERMISSION_POLICIES}
          onChange={(v) => onChange({ ...policy, defaultPermissionPolicy: v || undefined })}
        />
        <div className="border-t my-3" />

        {/* 앱 목록 */}
        {apps.map((rawApp, i) => {
          type AppEntry = {
            packageName?: string;
            installType?: string;
            defaultPermissionPolicy?: string;
            autoUpdateMode?: string;
            minimumVersionCode?: number;
            disabled?: boolean;
            connectedWorkAndPersonalApp?: string;
            managedConfiguration?: unknown;
            permissionGrants?: { permission: string; policy: string }[];
            delegatedScopes?: string[];
            accessibleTrackIds?: string[];
          };
          const app = rawApp as AppEntry;
          return (
          <div key={i} className="border rounded-lg mb-2 overflow-hidden">
            {/* 앱 헤더 */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
              <button
                onClick={() => setExpandedApp(expandedApp === i ? null : i)}
                className="text-gray-400 text-xs w-5"
              >
                {expandedApp === i ? "▲" : "▼"}
              </button>
              <code className="flex-1 text-sm font-medium truncate">{app.packageName}</code>
              <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded border">
                {INSTALL_TYPES.find((t) => t.value === app.installType)?.label || app.installType}
              </span>
              <button
                onClick={() => removeApp(i)}
                className="text-red-400 hover:text-red-600 text-xs"
              >
                삭제
              </button>
            </div>

            {/* 앱 상세 설정 */}
            {expandedApp === i && (
              <div className="p-4 space-y-3 border-t">
                {/* 기본 설정 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">패키지명</label>
                    <input
                      type="text"
                      value={app.packageName}
                      onChange={(e) => updateApp(i, "packageName", e.target.value)}
                      className="w-full border rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">설치 유형</label>
                    <select
                      value={app.installType}
                      onChange={(e) => updateApp(i, "installType", e.target.value)}
                      className="w-full border rounded-lg px-3 py-1.5 text-sm"
                    >
                      {INSTALL_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 기본 권한 정책 */}
                <SelectField
                  label="이 앱의 기본 권한 정책"
                  value={app.defaultPermissionPolicy || ""}
                  options={DEFAULT_PERMISSION_POLICIES}
                  onChange={(v) => updateApp(i, "defaultPermissionPolicy", v || undefined)}
                />

                {/* 자동 업데이트 */}
                <SelectField
                  label="자동 업데이트"
                  value={app.autoUpdateMode || ""}
                  options={AUTO_UPDATE_MODES}
                  onChange={(v) => updateApp(i, "autoUpdateMode", v || undefined)}
                />

                {/* 최소 버전 */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm">최소 버전 코드</span>
                  <input
                    type="number"
                    value={app.minimumVersionCode || ""}
                    onChange={(e) => updateApp(i, "minimumVersionCode", e.target.value ? Number(e.target.value) : undefined)}
                    className="border rounded-lg px-3 py-1 text-sm w-28 text-right"
                    placeholder="미지정"
                  />
                </div>

                {/* 토글 설정들 */}
                <Toggle
                  label="알림 차단"
                  checked={app.disabled === true}
                  onChange={(v) => updateApp(i, "disabled", v || undefined)}
                />
                <Toggle
                  label="앱에서 위젯 허용"
                  checked={app.connectedWorkAndPersonalApp === "CONNECTED_WORK_AND_PERSONAL_APP_ALLOWED"}
                  onChange={(v) => updateApp(i, "connectedWorkAndPersonalApp", v ? "CONNECTED_WORK_AND_PERSONAL_APP_ALLOWED" : undefined)}
                />

                {/* 관리 설정 (Managed Configuration) */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">관리 설정 (JSON)</label>
                  <textarea
                    value={app.managedConfiguration ? JSON.stringify(app.managedConfiguration, null, 2) : ""}
                    onChange={(e) => {
                      if (!e.target.value.trim()) {
                        updateApp(i, "managedConfiguration", undefined);
                        return;
                      }
                      try {
                        updateApp(i, "managedConfiguration", JSON.parse(e.target.value));
                      } catch { /* 사용자 타이핑 중 */ }
                    }}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm font-mono"
                    placeholder='{"key": "value"}'
                  />
                </div>

                {/* 개별 권한 설정 */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">개별 권한 설정</label>
                  {(app.permissionGrants || []).map((pg: { permission: string; policy: string }, pi: number) => (
                    <div key={pi} className="flex items-center gap-2 mb-1">
                      <code className="flex-1 text-xs bg-gray-50 px-2 py-1 rounded truncate">{pg.permission}</code>
                      <select
                        value={pg.policy}
                        onChange={(e) => updateAppPermission(i, pg.permission, e.target.value)}
                        className="border rounded px-2 py-1 text-xs"
                      >
                        <option value="PROMPT">물어보기</option>
                        <option value="GRANT">허용</option>
                        <option value="DENY">거부</option>
                      </select>
                      <button
                        onClick={() => updateAppPermission(i, pg.permission, "")}
                        className="text-red-400 text-xs"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={newPermission}
                      onChange={(e) => setNewPermission(e.target.value)}
                      placeholder="android.permission.CAMERA"
                      className="flex-1 border rounded px-2 py-1 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newPermission.trim()) {
                          updateAppPermission(i, newPermission.trim(), "GRANT");
                          setNewPermission("");
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (newPermission.trim()) {
                          updateAppPermission(i, newPermission.trim(), "GRANT");
                          setNewPermission("");
                        }
                      }}
                      className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
                    >
                      추가
                    </button>
                  </div>
                </div>

                {/* 위임 범위 */}
                <div>
                  <label className="text-xs text-gray-400 block mb-2">위임 범위 (Delegated Scopes)</label>
                  <div className="grid grid-cols-2 gap-1">
                    {DELEGATED_SCOPES.map((scope) => (
                      <label key={scope.value} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                        <input
                          type="checkbox"
                          checked={(app.delegatedScopes || []).includes(scope.value)}
                          onChange={(e) => toggleAppDelegatedScope(i, scope.value, e.target.checked)}
                          className="rounded"
                        />
                        {scope.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* 접근성 설정 */}
                <Toggle
                  label="접근성 서비스 강제 허용"
                  checked={app.accessibleTrackIds !== undefined}
                  onChange={(v) => updateApp(i, "accessibleTrackIds", v ? [] : undefined)}
                />

                {/* 트랙 ID */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm">앱 트랙 (테스트/베타)</span>
                  <input
                    type="text"
                    value={(app.accessibleTrackIds || []).join(", ")}
                    onChange={(e) => {
                      const ids = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                      updateApp(i, "accessibleTrackIds", ids.length > 0 ? ids : undefined);
                    }}
                    className="border rounded-lg px-3 py-1 text-sm w-40 text-right"
                    placeholder="track-id"
                  />
                </div>
              </div>
            )}
          </div>
          );
        })}

        {/* 새 앱 추가 */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <input
            type="text"
            value={newPkg}
            onChange={(e) => setNewPkg(e.target.value)}
            placeholder="패키지명 (com.example.app)"
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
            onKeyDown={(e) => e.key === "Enter" && addApp()}
          />
          <select
            value={newInstallType}
            onChange={(e) => setNewInstallType(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm"
          >
            {INSTALL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            onClick={addApp}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
          >
            추가
          </button>
        </div>
      </EditorSection>

      {/* ── 보안 ── */}
      <EditorSection title="보안" desc="기기 보안 관련 설정입니다.">
        <Toggle label="화면 캡처 차단" checked={getBool("screenCaptureDisabled")} onChange={(v) => update("screenCaptureDisabled", v)} />
        <Toggle label="카메라 차단" checked={getBool("cameraDisabled")} onChange={(v) => update("cameraDisabled", v)} />
        <Toggle label="디버깅 허용" checked={getBool("debuggingFeaturesAllowed")} onChange={(v) => update("debuggingFeaturesAllowed", v)} />
        <Toggle label="초기화(Factory Reset) 차단" checked={getBool("factoryResetDisabled")} onChange={(v) => update("factoryResetDisabled", v)} />
        <Toggle label="안전 부팅 차단" checked={getBool("safeBootDisabled")} onChange={(v) => update("safeBootDisabled", v)} />
        <SelectField
          label="암호화 정책"
          value={getStr("encryptionPolicy")}
          options={ENCRYPTION_POLICIES}
          onChange={(v) => update("encryptionPolicy", v)}
        />
      </EditorSection>

      {/* ── 비밀번호 ── */}
      <EditorSection title="비밀번호" desc="기기 잠금 비밀번호 요구사항입니다.">
        <SelectField
          label="비밀번호 품질"
          value={getStr("passwordRequirements.passwordQuality")}
          options={PASSWORD_QUALITY}
          onChange={(v) => update("passwordRequirements.passwordQuality", v)}
        />
        <NumberField
          label="최소 길이"
          value={getNum("passwordRequirements.passwordMinimumLength")}
          onChange={(v) => update("passwordRequirements.passwordMinimumLength", v || undefined)}
        />
        <NumberField
          label="최소 영문자 수"
          value={getNum("passwordRequirements.passwordMinimumLetters")}
          onChange={(v) => update("passwordRequirements.passwordMinimumLetters", v || undefined)}
        />
        <NumberField
          label="최소 숫자 수"
          value={getNum("passwordRequirements.passwordMinimumNumeric")}
          onChange={(v) => update("passwordRequirements.passwordMinimumNumeric", v || undefined)}
        />
        <NumberField
          label="최소 기호 수"
          value={getNum("passwordRequirements.passwordMinimumSymbols")}
          onChange={(v) => update("passwordRequirements.passwordMinimumSymbols", v || undefined)}
        />
        <NumberField
          label="비밀번호 만료 (일)"
          value={getNum("passwordRequirements.passwordExpirationTimeout")}
          onChange={(v) => update("passwordRequirements.passwordExpirationTimeout", v ? `${v}d` : undefined)}
        />
        <NumberField
          label="재사용 금지 횟수"
          value={getNum("passwordRequirements.passwordHistoryLength")}
          onChange={(v) => update("passwordRequirements.passwordHistoryLength", v || undefined)}
        />
        <NumberField
          label="최대 실패 횟수 (초기화)"
          value={getNum("passwordRequirements.maximumFailedPasswordsForWipe")}
          onChange={(v) => update("passwordRequirements.maximumFailedPasswordsForWipe", v || undefined)}
        />
      </EditorSection>

      {/* ── 기기 기능 ── */}
      <EditorSection title="기기 기능" desc="기기 기능 제한 설정입니다.">
        <Toggle label="Bluetooth 차단" checked={getBool("bluetoothDisabled")} onChange={(v) => update("bluetoothDisabled", v)} />
        <Toggle label="USB 파일 전송 차단" checked={getBool("usbFileTransferDisabled")} onChange={(v) => update("usbFileTransferDisabled", v)} />
        <Toggle label="Wi-Fi 설정 변경 차단" checked={getBool("wifiConfigDisabled")} onChange={(v) => update("wifiConfigDisabled", v)} />
        <Toggle label="설정 앱 차단" checked={getBool("modifyAccountsDisabled")} onChange={(v) => update("modifyAccountsDisabled", v)} />
        <Toggle label="앱 제거 차단" checked={getBool("uninstallAppsDisabled")} onChange={(v) => update("uninstallAppsDisabled", v)} />
        <Toggle label="SMS 차단" checked={getBool("smsDisabled")} onChange={(v) => update("smsDisabled", v)} />
        <Toggle label="셀 브로드캐스트 차단" checked={getBool("cellBroadcastsConfigDisabled")} onChange={(v) => update("cellBroadcastsConfigDisabled", v)} />
        <Toggle label="외부 저장소 마운트 차단" checked={getBool("mountPhysicalMediaDisabled")} onChange={(v) => update("mountPhysicalMediaDisabled", v)} />
        <Toggle label="상태표시줄 비활성화" checked={getBool("statusBarDisabled")} onChange={(v) => update("statusBarDisabled", v)} />
        <SelectField
          label="위치 설정"
          value={getStr("locationMode")}
          options={LOCATION_MODES}
          onChange={(v) => update("locationMode", v)}
        />
      </EditorSection>

      {/* ── 시스템 업데이트 ── */}
      <EditorSection title="시스템 업데이트" desc="OS 업데이트 정책입니다.">
        <SelectField
          label="업데이트 유형"
          value={getStr("systemUpdate.type")}
          options={SYSTEM_UPDATE_TYPES}
          onChange={(v) => update("systemUpdate.type", v)}
        />
        {getStr("systemUpdate.type") === "WINDOWED" && (
          <>
            <NumberField
              label="시작 시간 (분, 0~1440)"
              value={getNum("systemUpdate.startMinutes")}
              onChange={(v) => update("systemUpdate.startMinutes", v || undefined)}
            />
            <NumberField
              label="종료 시간 (분, 0~1440)"
              value={getNum("systemUpdate.endMinutes")}
              onChange={(v) => update("systemUpdate.endMinutes", v || undefined)}
            />
          </>
        )}
      </EditorSection>

      {/* ── 상태 보고 ── */}
      <EditorSection title="상태 보고" desc="기기 상태 보고 설정입니다.">
        <Toggle
          label="하드웨어 상태 보고"
          checked={getBool("statusReportingSettings.hardwareStatusEnabled")}
          onChange={(v) => update("statusReportingSettings.hardwareStatusEnabled", v)}
        />
        <Toggle
          label="소프트웨어 정보 보고"
          checked={getBool("statusReportingSettings.softwareInfoEnabled")}
          onChange={(v) => update("statusReportingSettings.softwareInfoEnabled", v)}
        />
        <Toggle
          label="메모리 정보 보고"
          checked={getBool("statusReportingSettings.memoryInfoEnabled")}
          onChange={(v) => update("statusReportingSettings.memoryInfoEnabled", v)}
        />
        <Toggle
          label="네트워크 정보 보고"
          checked={getBool("statusReportingSettings.networkInfoEnabled")}
          onChange={(v) => update("statusReportingSettings.networkInfoEnabled", v)}
        />
        <Toggle
          label="디스플레이 정보 보고"
          checked={getBool("statusReportingSettings.displayInfoEnabled")}
          onChange={(v) => update("statusReportingSettings.displayInfoEnabled", v)}
        />
        <Toggle
          label="전원 이벤트 보고"
          checked={getBool("statusReportingSettings.powerManagementEventsEnabled")}
          onChange={(v) => update("statusReportingSettings.powerManagementEventsEnabled", v)}
        />
        <Toggle
          label="앱 보고"
          checked={getBool("statusReportingSettings.applicationReportsEnabled")}
          onChange={(v) => update("statusReportingSettings.applicationReportsEnabled", v)}
        />
      </EditorSection>

      {/* ── 키가드(잠금화면) ── */}
      <EditorSection title="잠금화면 (Keyguard)" desc="잠금화면에서 비활성화할 기능입니다.">
        <Toggle label="카메라 비활성화" checked={((policy.keyguardDisabledFeatures as string[] | undefined) || []).includes("CAMERA")} onChange={(v) => {
          const current: string[] = (policy.keyguardDisabledFeatures as string[] | undefined) || [];
          const next = v ? [...current, "CAMERA"] : current.filter((f: string) => f !== "CAMERA");
          onChange({ ...policy, keyguardDisabledFeatures: next.length > 0 ? next : undefined });
        }} />
        <Toggle label="알림 비활성화" checked={((policy.keyguardDisabledFeatures as string[] | undefined) || []).includes("NOTIFICATIONS")} onChange={(v) => {
          const current: string[] = (policy.keyguardDisabledFeatures as string[] | undefined) || [];
          const next = v ? [...current, "NOTIFICATIONS"] : current.filter((f: string) => f !== "NOTIFICATIONS");
          onChange({ ...policy, keyguardDisabledFeatures: next.length > 0 ? next : undefined });
        }} />
        <Toggle label="생체인식 비활성화" checked={((policy.keyguardDisabledFeatures as string[] | undefined) || []).includes("BIOMETRICS")} onChange={(v) => {
          const current: string[] = (policy.keyguardDisabledFeatures as string[] | undefined) || [];
          const next = v ? [...current, "BIOMETRICS"] : current.filter((f: string) => f !== "BIOMETRICS");
          onChange({ ...policy, keyguardDisabledFeatures: next.length > 0 ? next : undefined });
        }} />
        <Toggle label="전체 비활성화" checked={((policy.keyguardDisabledFeatures as string[] | undefined) || []).includes("ALL_FEATURES")} onChange={(v) => {
          const current: string[] = (policy.keyguardDisabledFeatures as string[] | undefined) || [];
          const next = v ? [...current, "ALL_FEATURES"] : current.filter((f: string) => f !== "ALL_FEATURES");
          onChange({ ...policy, keyguardDisabledFeatures: next.length > 0 ? next : undefined });
        }} />
      </EditorSection>
    </div>
  );
}

// ── Sub-components ──

function EditorSection({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition"
      >
        <div className="text-left">
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-xs text-gray-400">{desc}</div>
        </div>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="p-5 space-y-3">{children}</div>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1 cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition ${checked ? "bg-blue-600" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </label>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded-lg px-3 py-1 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function NumberField({ label, value, onChange }: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="border rounded-lg px-3 py-1 text-sm w-24 text-right"
        placeholder="0"
      />
    </div>
  );
}
