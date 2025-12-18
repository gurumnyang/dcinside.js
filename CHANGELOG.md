# Changelog

모든 눈에 띄는 변경 사항은 이 파일에 기록합니다.

## [1.10.0] - 2025-10-28
- feat: 실시간 베스트 추천(실베추) 공개 API 추가
  - `dc.recommendBest({ galleryId, postId, jar?, userAgent?, proxy? })`
  - 프록시 설정(`AxiosProxyConfig | false`) 지원
  - CSRF 토큰 자동 추출 및 응답 정규화(`success`, `message`, `responseStatus`, `raw`)
- docs: README에 실베추 사용법 및 API 레퍼런스 추가

## [1.9.0]
- 릴리스 태그 정리 (내부)

