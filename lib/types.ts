export interface Event {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  food_type: FoodType;
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
  event?: { title: string; food_type: string } | null;
}

export type FoodType =
  | "버거"
  | "도시락"
  | "샌드위치"
  | "간식"
  | "식사"
  | "기타";

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
