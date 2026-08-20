# Shoply 기여 가이드

Shoply 프로젝트의 브랜치와 커밋 규칙입니다.

## 브랜치 전략

Shoply는 `fgc` 프로젝트와 동일한 간소화된 Git Flow를 사용합니다.

| 브랜치 | 역할 |
| --- | --- |
| `main` | 배포 가능한 안정 버전 |
| `develop` | 다음 릴리즈를 위한 기능 통합 및 기본 브랜치 |
| `feature/*` | 신규 기능 개발 |
| `fix/*` | 일반 버그 수정 |
| `release/*` | QA 및 릴리즈 준비 |
| `hotfix/*` | 배포 버전의 긴급 수정 |
| `refactor/*` | 기능 변경 없는 코드 개선 |
| `docs/*` | 문서 작성 및 수정 |

`main`과 `develop`에는 직접 push하지 않고 작업 브랜치의 Pull Request로 병합합니다.

브랜치 이름은 영문 소문자와 하이픈을 사용합니다.

```text
feature/{이슈번호}-{작업내용}
fix/{이슈번호}-{설명}
hotfix/{이슈번호}-{설명}
refactor/{이슈번호}-{설명}
docs/{이슈번호}-{설명}
release/{버전}
```

## 커밋 메시지

Conventional Commits 형식을 사용합니다.

```text
<type>(<scope>): <subject>
```

주요 타입은 다음과 같습니다.

- `feat`: 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 변경
- `refactor`: 기능 변경 없는 구조 개선
- `test`: 테스트 추가 또는 수정
- `chore`: 빌드 및 설정 변경

예시:

```text
feat(extractor): 네이버 쇼핑 상품 정보 추출 추가
fix(storage): 중복 상품 수량 합산 오류 수정
docs(readme): Chrome 설치 방법 보완
```

