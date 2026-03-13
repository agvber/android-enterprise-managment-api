"use client";

import { useEffect, useState } from "react";
import {
  getAuthUrl,
  exchangeCode,
  saveAuth,
  isAuthenticated,
  isConfigured,
  saveOAuthConfig,
  getOAuthConfig,
  clearOAuthConfig,
  DEFAULT_CALLBACK_URL,
} from "@/lib/google-api";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Setup form
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [callbackUrl, setCallbackUrl] = useState(DEFAULT_CALLBACK_URL);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/dashboard`;
    } else {
      const config = getOAuthConfig();
      if (config) {
        setConfigured(true);
        setClientId(config.clientId);
        setClientSecret(config.clientSecret);
        setCallbackUrl(config.callbackUrl);
      }
      setLoading(false);
    }
  }, []);

  const handleSaveConfig = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError("Client ID와 Client Secret은 필수입니다.");
      return;
    }
    saveOAuthConfig({
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      callbackUrl: callbackUrl.trim() || DEFAULT_CALLBACK_URL,
    });
    setConfigured(true);
    setShowSetup(false);
    setError("");
  };

  const handleResetConfig = () => {
    if (!confirm("OAuth 설정을 초기화하시겠습니까?")) return;
    clearOAuthConfig();
    setConfigured(false);
    setClientId("");
    setClientSecret("");
    setCallbackUrl(DEFAULT_CALLBACK_URL);
    setShowSetup(false);
  };

  const handleSubmitCode = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const tokens = await exchangeCode(code.trim());
      saveAuth(tokens);
      window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/dashboard`;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "인증에 실패했습니다.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  // Step 1: OAuth Setup
  if (!configured || showSetup) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-lg w-full">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">⚙️</div>
            <h1 className="text-2xl font-bold mb-2">초기 설정</h1>
            <p className="text-gray-500 text-sm">
              Google Cloud Console에서 생성한 OAuth 2.0 자격증명을 입력하세요.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxx.apps.googleusercontent.com"
                className="w-full border rounded-lg px-4 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Secret <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="GOCSPX-xxxxx"
                className="w-full border rounded-lg px-4 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Callback URL
              </label>
              <input
                type="text"
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder={DEFAULT_CALLBACK_URL}
                className="w-full border rounded-lg px-4 py-2 text-sm text-gray-600"
              />
              <p className="text-xs text-gray-400 mt-1">
                기본값을 사용하려면 비워두세요.
              </p>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleSaveConfig}
              className="w-full bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              설정 저장
            </button>

            {configured && (
              <button
                onClick={() => { setShowSetup(false); setError(""); }}
                className="w-full text-gray-500 text-sm hover:underline"
              >
                취소
              </button>
            )}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-2">
            <p className="font-semibold text-gray-600">설정 방법:</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Google Cloud Console 접속</li>
              <li>API 및 서비스 &gt; 사용자 인증 정보</li>
              <li>OAuth 2.0 클라이언트 ID 생성 (또는 기존 것 사용)</li>
              <li>Client ID와 Client Secret 복사</li>
            </ol>
            <p className="text-gray-400 mt-2">
              설정은 이 브라우저의 localStorage에만 저장되며 서버로 전송되지 않습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Login
  const authUrl = getAuthUrl();

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-lg w-full text-center">
        <div className="text-5xl mb-4">📱</div>
        <h1 className="text-2xl font-bold mb-2">
          Android Management Console
        </h1>
        <p className="text-gray-500 mb-6">
          Google 계정으로 로그인하여 Android 기기를 관리하세요.
        </p>

        <a
          href={authUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition mb-6"
        >
          1. Google 계정으로 인증
        </a>

        <div className="text-left bg-gray-50 rounded-lg p-5">
          <p className="text-sm text-gray-600 mb-3">
            2. 인증 완료 후 표시되는 <strong>Authorization Code</strong>를
            아래에 붙여넣으세요:
          </p>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Authorization code를 붙여넣으세요"
            className="w-full border rounded-lg px-4 py-2 mb-3 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleSubmitCode()}
          />
          {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
          <button
            onClick={handleSubmitCode}
            disabled={submitting || !code.trim()}
            className="w-full bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {submitting ? "인증 중..." : "로그인 완료"}
          </button>
        </div>

        <button
          onClick={() => setShowSetup(true)}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 hover:underline"
        >
          OAuth 설정 변경
        </button>
        <span className="mx-2 text-gray-300">|</span>
        <button
          onClick={handleResetConfig}
          className="mt-4 text-xs text-gray-400 hover:text-red-500 hover:underline"
        >
          설정 초기화
        </button>
      </div>
    </div>
  );
}
