export type UserRole =
  | "system_admin"
  | "executive_director"
  | "project_manager"
  | "coordinator"
  | "accountant"
  | "donor"
  | "facilitator"
  | "staff";

export const ROLE_LABELS_AR: Record<UserRole, string> = {
  system_admin: "مسؤول النظام",
  executive_director: "المدير التنفيذي",
  project_manager: "مدير المشاريع",
  coordinator: "منسق",
  accountant: "المحاسب",
  donor: "الممول",
  facilitator: "الميسر",
  staff: "موظف",
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

export interface NavItem {
  href: string;
  label: string;
  icon: string; // simple emoji/glyph, no icon lib dependency
  roles: UserRole[] | "all";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "لوحة التحكم", icon: "📊", roles: "all" },
  {
    href: "/facilitator/daily-log",
    label: "سجل النشاط اليومي",
    icon: "📝",
    roles: ["facilitator"],
  },
  { href: "/requests", label: "الطلبات", icon: "📨", roles: "all" },
  {
    href: "/reports",
    label: "التقارير (5W / أوتشا)",
    icon: "📈",
    roles: ["system_admin", "executive_director", "project_manager", "coordinator", "donor"],
  },
  {
    href: "/reports/financial",
    label: "التقارير المالية",
    icon: "💰",
    roles: ["system_admin", "executive_director", "accountant", "donor", "project_manager"],
  },
  { href: "/files", label: "الملفات", icon: "📁", roles: "all" },
  { href: "/search", label: "بحث شامل", icon: "🔎", roles: "all" },
  { href: "/ai", label: "المساعد الذكي", icon: "🤖", roles: "all" },
  {
    href: "/admin/users",
    label: "إدارة المستخدمين",
    icon: "👥",
    roles: ["system_admin", "executive_director"],
  },
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
