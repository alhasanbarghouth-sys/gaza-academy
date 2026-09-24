// Hand-written types mirroring supabase/migrations/0001_init.sql.
// If you change the schema, update this file to match (or generate it with
// `supabase gen types typescript` once you have the Supabase CLI linked).

export type UserRole =
  | "system_admin"
  | "executive_director"
  | "project_manager"
  | "coordinator"
  | "accountant"
  | "donor"
  | "facilitator"
  | "staff";

export type RequestStatus = "pending" | "in_review" | "approved" | "rejected" | "completed";
export type RequestType = "financial" | "logistical" | "administrative" | "hr" | "technical" | "other";
export type RequestPriority = "low" | "normal" | "high" | "urgent";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  department: string | null;
  area: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Camp {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  is_verified: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ActivitySession {
  id: string;
  activity_date: string;
  camp_id: string | null;
  project_name: string;
  activity_type: string;
  beneficiaries_male: number;
  beneficiaries_female: number;
  beneficiaries_children: number;
  beneficiaries_adults: number;
  total_beneficiaries: number;
  description: string | null;
  challenges: string | null;
  attachments: { name: string; url: string }[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ActivitySessionParticipant {
  session_id: string;
  profile_id: string;
  created_at: string;
}

export interface OrgRequest {
  id: string;
  requester_id: string;
  recipient_role: UserRole | null;
  recipient_id: string | null;
  request_type: RequestType;
  title: string;
  message: string;
  status: RequestStatus;
  priority: RequestPriority;
  attachments: { name: string; url: string }[];
  response_note: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Report5W {
  id: string;
  report_month: string;
  generated_by: string;
  data: Record<string, unknown>;
  status: string;
  created_at: string;
}

export interface ReportOchaWeekly {
  id: string;
  week_start: string;
  week_end: string;
  generated_by: string;
  data: Record<string, unknown>;
  status: string;
  created_at: string;
}

export interface FinancialReport {
  id: string;
  uploaded_by: string;
  title: string;
  period: string;
  amount: number | null;
  currency: string;
  file_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface OrgFile {
  id: string;
  uploaded_by: string;
  category: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
}

export interface AiConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// Minimal Database shape for @supabase/supabase-js generics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
