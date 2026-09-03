export const S = {
  // 앱 전역
  APP_NAME: "카이스트 쌀먹파인더",
  APP_DESC: "KAIST에서 밥 주는 행사만 모아보는 서비스",
  APP_SHORT: "쌀먹파인더",
  CALENDAR_PREFIX: "[쌀먹]",

  // 랜딩
  LANDING_TITLE: "카이스트 쌀먹파인더",
  LANDING_SUBTITLE_1: "돈이 없는 KAIST 학부생들은 공짜 밥이 필요합니다.",
  LANDING_CTA: "행사 보러가기 →",
  LANDING_FOOTER: "KAIST portal + dooray 메일에서 수집. (6시간마다 업데이트합니다)",

  // 네비게이션
  NAV_BACK: "← 목록",
  NAV_DETAIL: "행사 상세",
  NAV_FEED: "업데이트 피드",

  // 검색
  SEARCH_PLACEHOLDER: "행사 또는 음식 검색...",

  // 필터
  FILTER_ALL: "전체",

  // 이벤트 목록
  SECTION_TODAY: "오늘",
  SECTION_UPCOMING: "예정",
  SECTION_RECENT_UPDATES: "최근 업데이트",
  EVENTS_EMPTY: "등록된 행사가 없습니다",
  EVENTS_COUNT_UNIT: "건",

  // 이벤트 카드/상세
  TAG_REGISTER: "사전신청",
  DETAIL_REGISTER_CTA: "신청하기 →",
  DETAIL_GOOGLE_CAL: "Google 캘린더에 추가",
  DETAIL_ICS: ".ics 다운로드",

  // 피드
  FEED_ACTION_ADDED: "추가됨",
  FEED_ACTION_UPDATED: "변경됨",
  FEED_ACTION_REMOVED: "삭제됨",
  FEED_UNKNOWN_EVENT: "알 수 없는 행사",
  FEED_BADGE_NEW: "NEW",

  // 날짜
  DAYS: ["일", "월", "화", "수", "목", "금", "토"] as const,
  TIME_JUST_NOW: "방금",
  TIME_MINS_AGO: (n: number) => `${n}분 전`,
  TIME_HOURS_AGO: (n: number) => `${n}시간 전`,
  TIME_DAYS_AGO: (n: number) => `${n}일 전`,
  DATE_FORMAT: (y: number, m: number, d: number, day: string, hh: string, mm: string) =>
    `${m}/${d} (${day}) ${hh}:${mm}`,
  DATE_FORMAT_LONG: (y: number, m: number, d: number, day: string, hh: string, mm: string) =>
    `${y}년 ${m}월 ${d}일 (${day}) ${hh}:${mm}`,
  CAL_MONTH: (y: number, m: number) => `${y}년 ${m}월`,
  CAL_MORNING: "아침",
  CAL_LUNCH: "점심",
  CAL_DINNER: "저녁",

  // 자동신청
  PROFILE_TITLE: "내 프로필",
  PROFILE_DESC: "자동신청에 사용됩니다. 이 정보는 기기에만 저장됩니다.",
  PROFILE_NAME: "이름",
  PROFILE_STUDENT_ID: "학번",
  PROFILE_DEPARTMENT: "학과",
  PROFILE_EMAIL: "이메일",
  PROFILE_PHONE: "전화번호",
  PROFILE_SAVE: "저장",
  PROFILE_SAVED: "저장됨",
  PROFILE_CLEAR: "초기화",
  AUTO_REGISTER: "자동신청",
  AUTO_REGISTER_DONE: "신청 완료!",
  AUTO_REGISTER_FAIL: "신청 실패",
  AUTO_REGISTER_NO_PROFILE: "프로필을 먼저 설정해주세요",
  AUTO_REGISTER_NO_MAPPING: "이 행사는 자동신청을 지원하지 않습니다",
  PRIVACY_NOTICE: "서버에 개인정보가 저장되지 않습니다",

  // 제보
  SUBMIT_TITLE: "쌀먹 제보",
  SUBMIT_DESC: "메일에 안 오는 행사도 직접 등록할 수 있습니다.",
  SUBMIT_EVENT_TITLE: "행사명",
  SUBMIT_EVENT_TITLE_PLACEHOLDER: "AI철학 워크숍",
  SUBMIT_DATE: "날짜",
  SUBMIT_TIME: "시간",
  SUBMIT_LOCATION: "장소",
  SUBMIT_LOCATION_PLACEHOLDER: "E9 양승택 오디토리움",
  SUBMIT_FOOD_TYPE: "식사 종류",
  SUBMIT_FOOD_NOTE: "식사 상세",
  SUBMIT_FOOD_NOTE_PLACEHOLDER: "쉐이크쉑 버거 (사전등록자 한정)",
  SUBMIT_REGISTER_URL: "신청 링크 (선택)",
  SUBMIT_REGISTER_URL_PLACEHOLDER: "https://forms.gle/...",
  SUBMIT_TARGET: "참여 대상",
  SUBMIT_CTA: "제보하기",
  SUBMIT_SUCCESS: "제보 완료! 검토 후 등록됩니다.",
  SUBMIT_FAIL: "제보 실패. 다시 시도해주세요.",
  SUBMIT_VALIDATING: "검증 중...",

  // 음식 타입
  FOOD_TYPES: {
    버거: "버거",
    도시락: "도시락",
    샌드위치: "샌드위치",
    간식: "간식",
    식사: "식사",
    기타: "기타",
  } as const,
} as const;
