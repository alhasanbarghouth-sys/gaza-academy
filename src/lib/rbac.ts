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

export const ROLE_LABELS_AR: Record<UserRole, string> = {
  system_admin: "مسؤول النظام",
  executive_director: "المدير التنفيذي",
  project_manager: "مدير المشاريع",
  coordinator: "منسق",
  accountant: "المحاسب",
  donor: "الممول",
  facilitator: "الميسر",
  staff: "موظف",
  board_member: "عضو مجلس الإدارة",
  archivist: "مسؤول قاعدة البيانات المؤسسية",
  volunteer: "متطوع",
  auditor: "مدقق خارجي",
};

export const MANAGEMENT_ROLES: UserRole[] = [
  "system_admin",
  "executive_director",
  "project_manager",
  "coordinator",
];

export function isManagementRole(role: UserRole) {
  return MANAGEMENT_ROLES.includes(role);
}

export type NavIcon =
  | "dashboard"
  | "daily-log"
  | "requests"
  | "reports"
  | "financial"
  | "archive"
  | "files"
  | "search"
  | "assistant"
  | "facilitator-reports"
  | "camps"
  | "users"
  | "appeals"
  | "misconduct";

export type NavSection = "main" | "field" | "information" | "admin";

export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  main: "الرئيسية",
  field: "العمل الميداني والتقارير",
  information: "المعلومات المؤسسية",
  admin: "الإدارة والمتابعة",
};

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  section: NavSection;
  roles: UserRole[] | "all";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "لوحة التحكم", icon: "dashboard", section: "main", roles: "all" },
  { href: "/requests", label: "الطلبات والمراسلات", icon: "requests", section: "main", roles: "all" },
  { href: "/search", label: "بحث شامل", icon: "search", section: "main", roles: "all" },
  { href: "/ai", label: "المساعد الذكي", icon: "assistant", section: "main", roles: "all" },
  { href: "/facilitator/daily-log", label: "سجل النشاط اليومي", icon: "daily-log", section: "field", roles: ["facilitator", "volunteer"] },
  { href: "/admin/facilitator-reports", label: "تقارير الميسرين", icon: "facilitator-reports", section: "field", roles: ["system_admin", "executive_director", "project_manager", "coordinator"] },
  {
    href: "/reports",
    label: "التقارير (5W / أوتشا)",
    icon: "reports",
    section: "field",
    roles: ["system_admin", "executive_director", "project_manager", "coordinator", "donor"],
  },
  {
    href: "/reports/financial",
    label: "التقارير المالية",
    icon: "financial",
    section: "field",
    roles: ["system_admin", "executive_director", "accountant", "donor", "project_manager"],
  },
  { href: "/archive", label: "قاعدة البيانات المؤسسية", icon: "archive", section: "information", roles: "all" },
  { href: "/files", label: "الملفات", icon: "files", section: "information", roles: ["system_admin", "executive_director", "project_manager", "coordinator", "accountant", "donor", "facilitator", "staff", "board_member", "archivist"] },
  { href: "/admin/camps", label: "إدارة المخيمات", icon: "camps", section: "admin", roles: ["system_admin", "executive_director", "project_manager", "coordinator"] },
  { href: "/admin/users", label: "إدارة المستخدمين", icon: "users", section: "admin", roles: ["system_admin", "executive_director"] },
  { href: "/admin/appeals", label: "المناشدات", icon: "appeals", section: "admin", roles: ["system_admin", "executive_director", "project_manager", "coordinator"] },
  { href: "/admin/misconduct", label: "بلاغات الإساءة", icon: "misconduct", section: "admin", roles: ["system_admin", "executive_director"] },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles === "all" || item.roles.includes(role));
}

export const REQUEST_TYPE_LABELS_AR: Record<string, string> = {
  financial: "مالي",
  logistical: "لوجستي",
  administrative: "إداري",
  hr: "موارد بشرية",
  technical: "تقني",
  other: "أخرى",
};

export const REQUEST_STATUS_LABELS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  in_review: "قيد المراجعة",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
  completed: "مكتمل",
};

export const REQUEST_PRIORITY_LABELS_AR: Record<string, string> = {
  low: "منخفضة",
  normal: "عادية",
  high: "عالية",
  urgent: "عاجلة",
};

export const ACTIVITY_TYPE_OPTIONS = [
  "نشاط ثقافي",
  "ورشة فنية",
  "جلسة دعم نفسي اجتماعي",
  "نشاط رياضي",
  "توزيع مساعدات",
  "جلسة توعية",
  "تدريب / بناء قدرات",
  "زيارة ميدانية",
  "أخرى",
];
