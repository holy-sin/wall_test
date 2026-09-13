# AR 가벽 배치 MVP

8th Wall World Tracking과 Absolute Scale을 사용해 1.5m × 2.3m × 0.1m 가벽을 실제 공간의 바닥에 한 개 배치하는 Vite + TypeScript + Three.js MVP입니다.

## 실행

```bash
npm install
npm run dev
```

프로덕션 빌드:

```bash
npm run build
```

`postinstall`, `dev`, `build` 단계에서 8th Wall Engine과 XRExtras가 `public/external`로 복사됩니다. 모바일 카메라 테스트는 HTTPS가 필요하므로 개발 서버를 ngrok 같은 HTTPS 터널로 연결하세요.

상시 테스트 주소는 GitHub 저장소를 Vercel 프로젝트로 가져오는 방식을 권장합니다. Vercel 설정은 다음과 같습니다.

- Framework Preset: `Vite`
- Build Command: `pnpm run build`
- Output Directory: `dist`
- Install Command: `pnpm install --frozen-lockfile`

배포가 완료되면 고정된 `https://<project>.vercel.app` 주소를 휴대폰에서 엽니다. `main` 브랜치 push는 production 배포로, 그 외 브랜치와 pull request는 별도 preview 주소로 사용할 수 있습니다.

## 디버그 화면

URL에 `?debug=1`을 붙이면 현재 상태, tracking status/reason, 카메라 위치, hitTest 결과, 배치 좌표/yaw, 모델 로드 상태와 transform lock 검사를 볼 수 있습니다.

## 실제 기기 확인 순서

1. Android Chrome 또는 iOS Safari에서 HTTPS URL을 엽니다.
2. `AR 시작`을 누르고 카메라 권한을 허용합니다.
3. 안내에 따라 휴대폰을 천천히 앞뒤로 움직입니다.
4. 배치 안내가 보이면 바닥을 한 번 터치합니다.
5. 1~2m 이동하며 가벽이 화면을 따라오지 않고 같은 월드 위치에 남는지 확인합니다.
6. `다시 배치`를 여러 번 사용해 가벽이 한 개만 존재하는지 확인합니다.

Absolute Scale은 공간 미리보기를 위한 추정값이며 시공용 정밀 측정값이 아닙니다.
