# principles-blanks

헌법·행정법 일반론 빈칸 채우기 학습 도구 (2026 변시 대비).
STUDYMAP과 동일한 Firebase 프로젝트(`studymap-89c09`)에 연결.

## 기능

- **1단계 (키워드 빈칸)**: 핵심 키워드만 빈칸으로
- **2단계 (전체 작성)**: 전문을 textarea에 통째로 작성 후 정답 비교
- **법조문 자동 표시**: 카드에 등장하는 헌법 조문 정답 확인 시 함께 표시
- **마지막 학습일 동기화**: 섹션 + 난이도 단위로 Firestore에 timestamp만 기록
- **Google 로그인**: STUDYMAP 계정 그대로 사용

## 폴더 구조

```
principles-blanks/
├── index.html              # 진입점 (홈 + 섹션 페이지를 hash 라우터로 전환)
├── css/style.css           # 공통 스타일
├── js/app.js               # Firebase + 라우팅 + 렌더링 통합 모듈
└── data/sections.js        # 섹션·카드 데이터 (현재 법률유보원칙만)
```

## 배포 (GitHub Pages)

1. 새 repo 만들기: `archivingreen-oss/principles-blanks` (Public)
2. 이 폴더 내용 전부 push
3. Settings → Pages → Source: `main` 브랜치 · `/ (root)` 선택
4. 배포 주소: `https://archivingreen-oss.github.io/principles-blanks/`

## Firebase 콘솔 설정 (1회만)

### 1. Authorized domains에 새 도메인 추가
Firebase Console → Authentication → Settings → Authorized domains:
- 기존: `studymap-89c09.firebaseapp.com`, `archivingreen-oss.github.io`
- `archivingreen-oss.github.io`가 이미 등록돼 있으면 그대로 사용 가능 (도메인 단위라 경로 무관)

### 2. Firestore 보안 규칙 확인
`users/{uid}/principlesBlanks/{doc}` 경로에 read/write 권한 필요.
STUDYMAP에 이미 아래 규칙이 있으면 그대로 작동:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

없으면 위 규칙을 Firestore Rules에 추가.

## Firestore 데이터 구조

```
users/{uid}/principlesBlanks/progress
  └── sections
      ├── lr
      │   ├── mode1: <Timestamp>
      │   └── mode2: <Timestamp>
      ├── pwm     (포괄위임금지원칙 — 추후)
      └── ...
```

STUDYMAP의 `users/{uid}/...` 다른 subcollection과 충돌하지 않음.

## 데이터 추가 방법

`data/sections.js`의 `sections` 배열에 새 객체 추가:

```js
{
  id: 'pwm',                        // 짧은 영문 식별자
  name: '포괄위임금지원칙',
  category: '심사기준',
  subject: '헌법·행정법 일반론',
  cards: [
    {
      id: 'pwm-01',
      title: '[정의]',
      template: '... {1} ... {2} ...',
      answers: { 1: '...', 2: '...' },
      statutes: [
        { name: '헌법 제75조', text: '...' }
      ]
    },
    // ...
  ]
}
```

## 정답 비교 normalize

다음은 동일 정답으로 처리:
- 따옴표: `'` `'` `'`
- 가운뎃점: `⋅` `·` `・` `ㆍ`
- 공백 차이 (`본질적 사항` = `본질적사항`)
