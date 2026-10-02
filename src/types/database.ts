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
  | "staff"
  | "board_member"
  | "archivist"
  | "volunteer"
  | "auditor";

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
  must_change_password: boolean;
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
  ben_men: number;
  ben_women: number;
  ben_men_disability: number;
  ben_women_disability: number;
  ben_boys: number;
  ben_boys_disability: number;
  ben_girls: number;
  ben_girls_disability: number;
  gbv_encountered: boolean;
  gbv_cases_count: number;
  gbv_referred: boolean;
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
  file_name: string | null;
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

export type PublicSubmissionStatus = "pending" | "in_review" | "resolved" | "investigating" | "closed";

export interface PublicAppeal {
  id: string;
  full_name: string;
  phone: string | null;
  location: string | null;
  message: string;
  status: PublicSubmissionStatus;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
}

export interface MisconductReport {
  id: string;
  reporter_name: string | null;
  reporter_contact: string | null;
  accused_name: string | null;
  incident_description: string;
  incident_location: string | null;
  status: PublicSubmissionStatus;
  reviewed_by: string | null;
  review_note: string | null;
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

// ---- Institutional archive (supabase/migrations/0008_archive.sql) ----------------

export type EntityType =
  | "program"
  | "project"
  | "donor"
  | "organization"
  | "person"
  | "beneficiary"
  | "activity"
  | "event"
  | "period"
  | "decision"
  | "procurement_case";

export type LinkType =
  | "belongs_to"
  | "proves"
  | "based_on"
  | "results_from"
  | "supersedes"
  | "responds_to"
  | "published_in"
  | "requires_consent";

export type RecordStatus = "original" | "modified_copy" | "draft" | "final";
export type DocLanguage = "ar" | "en" | "ar_en";
export type RetentionBasis =
  | "permanent"
  | "document_date"
  | "project_end"
  | "contract_end"
  | "service_end"
  | "closure"
  | "minimal"
  | "pending";

export interface ArchiveAxis {
  code: string;
  letter: string;
  name_ar: string;
}

export interface ArchiveCategory {
  code: string;
  parent_code: string | null;
  axis_code: string;
  level: number;
  name_ar: string;
  materials_ar: string | null;
  default_sensitivity: number | null;
  related_ar: string | null;
  original_item_no: number | null;
  placement_note_ar: string | null;
  retention_basis: RetentionBasis | null;
  retention_years: number | null;
  retention_note_ar: string | null;
  exclusive_doc_type: string | null;
}

export interface ArchiveDocType {
  code: string;
  name_ar: string;
  fixed_category: string | null;
  sort: number;
}

export interface ArchiveLinkRule {
  id: number;
  doc_type: string;
  req_key: string;
  label_ar: string;
  entity_types: EntityType[];
  categories: string[];
  stage: "intake" | "completion";
  is_optional: boolean;
  alt_flag: "unpublished" | null;
  default_link_type: LinkType;
  sort: number;
}

export interface ArchiveRoleMatrixRow {
  role: string;
  scope_code: string;
  read_max: number;
  read_max_in_scope: number;
  can_insert: boolean;
  insert_own_scope_only: boolean;
}

export interface ArchiveEntity {
  id: string;
  entity_type: EntityType;
  code: string;
  name: string | null;
  description: string | null;
  parent_id: string | null;
  profile_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArchiveDocument {
  id: string;
  archive_number: string;
  category_code: string;
  doc_type: string;
  title: string;
  title_en: string | null;
  document_date: string;
  source: string;
  responsible: string;
  record_status: RecordStatus;
  sensitivity: number;
  language: DocLanguage;
  keywords: string | null;
  budget_line: string | null;
  offer_provider_type: "individual" | "organization" | "group" | null;
  is_unpublished: boolean;
  current_version: number;
  link_status: "complete" | "incomplete";
  missing_links: { key: string; label: string; stage: "intake" | "completion" }[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ArchiveDocumentVersion {
  id: string;
  document_id: string;
  version_no: number;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number;
  sha256: string;
  change_reason: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ArchiveLink {
  id: string;
  document_id: string;
  link_type: LinkType;
  target_entity_id: string | null;
  target_document_id: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface ArchiveGrant {
  id: string;
  profile_id: string;
  designation: string;
  category_prefix: string | null;
  document_id: string | null;
  max_sensitivity: number;
  can_insert: boolean;
  valid_from: string;
  valid_until: string | null;
  reason: string;
  granted_by: string;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}

export interface ArchiveAccessLogEntry {
  id: number;
  document_id: string;
  version_no: number | null;
  actor_id: string | null;
  action: "view" | "download" | "export" | "public_download";
  created_at: string;
}

// Minimal Database shape for @supabase/supabase-js generics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
