export interface Event {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  is_food: boolean;
  category: EventCategory | null;
  food_type: FoodType | null;
  food_note: string | null;
  target_audience: string | null;
  register_url: string | null;
  source_type: "email" | "portal";
  source_hash: string;
  description: string | null;
  form_id: string | null;
  form_mapping: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateLog {
  id: string;
  event_id: string;
  action: "added" | "updated" | "removed";
  diff: Record<string, unknown> | null;
  created_at: string;
  event?: Pick<Event, "title" | "is_food" | "category" | "food_type"> | null;
}

export type FoodType =
  | "버거"
  | "도시락"
  | "샌드위치"
  | "간식"
  | "식사"
  | "기타";

export type EventCategory = "세미나" | "설명회" | "대회" | "문화" | "기타";

export const EVENT_CATEGORIES: EventCategory[] = ["세미나", "설명회", "대회", "문화", "기타"];

/** 쌀먹찾기(음식 행사만) / 행사모음(전체) */
export type Mode = "food" | "all";

export interface Submission {
  id: string;
  title: string;
  start_at: string;
  location: string | null;
  food_type: FoodType;
  food_note: string | null;
  target_audience: string | null;
  register_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface Registration {
  id: string;
  event_id: string;
  profile_name: string;
  profile_student_id: string | null;
  form_response: Record<string, string> | null;
  created_at: string;
  event?: { title: string; food_type: string; start_at: string } | null;
}

export interface Attendee {
  id: string;
  event_id: string;
  nickname: string;
  created_at: string;
}

export const FOOD_TYPES: FoodType[] = [
  "버거",
  "도시락",
  "샌드위치",
  "간식",
  "식사",
  "기타",
];
