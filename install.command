#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "  ================================================"
echo "  Android Management Console - Setup"
echo "  ================================================"
echo ""

# 1. Check Node.js
if command -v node &>/dev/null; then
  echo "  [OK] Node.js $(node -v)"
elif [ -s "$HOME/.nvm/nvm.sh" ]; then
  echo "  [..] nvm에서 Node.js 로드 중..."
  export NVM_DIR="$HOME/.nvm"
  . "$NVM_DIR/nvm.sh"
  if command -v node &>/dev/null; then
    echo "  [OK] Node.js $(node -v) (nvm)"
  else
    echo "  [..] Node.js 설치 중 (nvm install 20)..."
    nvm install 20
  fi
else
  echo ""
  echo "  [ERROR] Node.js가 설치되어 있지 않습니다."
  echo ""
  echo "  아래 방법 중 하나로 설치해 주세요:"
  echo ""
  echo "    방법 1) https://nodejs.org 에서 다운로드"
  echo "    방법 2) Homebrew: brew install node"
  echo "    방법 3) nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  echo ""
  echo "  설치 후 이 스크립트를 다시 실행해 주세요."
  echo ""
  read -p "  아무 키나 누르면 종료합니다..." -n1
  exit 1
fi

# 2. Install dependencies
echo ""
echo "  [..] 의존성 설치 중 (npm install)..."
echo ""
npm install
if [ $? -ne 0 ]; then
  echo ""
  echo "  [ERROR] npm install 실패. 위 에러 메시지를 확인해 주세요."
  echo ""
  read -p "  아무 키나 누르면 종료합니다..." -n1
  exit 1
fi

# 3. Build
echo ""
echo "  [..] 빌드 중 (npm run build)..."
echo ""
npm run build
if [ $? -ne 0 ]; then
  echo ""
  echo "  [ERROR] 빌드 실패. 위 에러 메시지를 확인해 주세요."
  echo ""
  read -p "  아무 키나 누르면 종료합니다..." -n1
  exit 1
fi

echo ""
echo "  ================================================"
echo "  설치 완료!"
echo "  ================================================"
echo ""
echo "  이제 start.command를 더블클릭하여 실행하세요."
echo ""
read -p "  아무 키나 누르면 종료합니다..." -n1
