#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "  ================================================"
echo "  Android Management Console"
echo "  ================================================"
echo ""
echo "  서버를 시작합니다... 브라우저가 자동으로 열립니다."
echo ""
echo "  종료하려면 이 터미널 창을 닫거나 Ctrl+C를 누르세요."
echo "  ================================================"
echo ""
python3 server.py
