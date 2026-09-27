// One-time script: creates the initial staff accounts from Basma's roster.
//
// Username = phone number, temporary password = national ID number.
// Every account is created with must_change_password = true, so each person
// is forced to set their own password on first login.
//
// Run once, after the Supabase migrations (0001-0004) have been applied:
//
//   node --env-file=.env.local scripts/seed-staff.mjs
//
// Safe to re-run: accounts that already exist are skipped, not duplicated.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with: node --env-file=.env.local scripts/seed-staff.mjs"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizePhone(raw) {
  return raw.replace(/\D/g, "");
}

// From the staff roster document. First 5 are management, per the org's
// own instructions; the rest are field staff who file daily activity logs.
const STAFF = [
  { name: "ناهض عبد السلام حنونة", role: "executive_director", phone: "0598885630", nationalId: "949880660", department: "المدير التنفيذي" },
  { name: "رامز محمد عياد", role: "accountant", phone: "0599926361", nationalId: "800676256", department: "المدير المالي" },
  { name: "نوال سليمان الدغمة", role: "project_manager", phone: "0032487258005", nationalId: "938987070", department: "مديرة المشاريع" },
  { name: "تامر عادل العجرمي", role: "project_manager", phone: "003547684409", nationalId: "801353848", department: "مدير البرامج" },
  { name: "بيسال مروان الخطيب", role: "coordinator", phone: "0599861181", nationalId: "803118959", department: "منسق ميداني" },

  { name: "عماد الدين معاوية سلمي", role: "facilitator", phone: "0598821394", nationalId: "400967006", department: "مصور ومصمم جرافيك" },
  { name: "ماجد يحيي نصار", role: "facilitator", phone: "0592560003", nationalId: "401249727", department: "مصور" },
  { name: "رامي زهير البلبيسي", role: "facilitator", phone: "0592127938", nationalId: "411963036", department: "مصور" },
  { name: "اسلام عبد الفتاح عليان", role: "facilitator", phone: "0595833760", nationalId: "802235598", department: "مدرب دراما" },
  { name: "أسماء حمدان قديح", role: "facilitator", phone: "0599052641", nationalId: "931680516", department: "مدرب دراما" },
  { name: "بهاء محمد غازي اليازجي", role: "facilitator", phone: "0599742543", nationalId: "903619237", department: "مدرب دراما" },
  // Roster's "mobile" column (056827720) and "WhatsApp" column (00970567827720
  // -> 0567827720) disagree by one digit for this person — used the WhatsApp
  // version as it's the complete 10-digit number. Verify with them directly.
  { name: "محمد محمود الهندي", role: "facilitator", phone: "0567827720", nationalId: "404673287", department: "مدرب دراما" },
  { name: "مراد نبيل المغاري", role: "facilitator", phone: "0592886884", nationalId: "801378308", department: "مدرب دراما" },
  { name: "نفوذ يوسف أبو الخير", role: "facilitator", phone: "0598336404", nationalId: "801721101", department: "مدرب دراما" },
  { name: "هبة حافظ شلوف", role: "facilitator", phone: "0598607002", nationalId: "801215583", department: "مدرب دراما" },
  { name: "وسيم ناصر الهندي", role: "facilitator", phone: "0595754856", nationalId: "800500357", department: "مدرب دراما" },
  { name: "وفاء ناهض برغوت", role: "facilitator", phone: "0595281113", nationalId: "804902856", department: "مدرب دراما" },
  { name: "يوسف احمد أبو الخير", role: "facilitator", phone: "0599328718", nationalId: "800521874", department: "مدرب دراما" },
  { name: "إبراهيم شفيق المصري", role: "facilitator", phone: "0598767018", nationalId: "802588301", department: "مدرب دراما" },
];

// These 8 have no phone number on file at all (mobile and WhatsApp columns
// both blank) — cannot create a login for them until you get one. Get the
// missing numbers, then either re-run this script with them added above, or
// add them one at a time from "إدارة المستخدمين" in the app.
const SKIPPED_NO_PHONE = [
  { name: "عمار عصام الحلولي", nationalId: "803280031", department: "مصور" },
  { name: "شهد خالد طافش", nationalId: "408108686", department: "مدرب دراما" },
  { name: "تسنيم منذر السرساوي", nationalId: "803650019", department: "مدرب دراما" },
  { name: "صابرين سمير هاشم", nationalId: "803298389", department: "مدرب دراما" },
  { name: "رانيا خليل المقيد", nationalId: "800593790", department: "مدرب دراما" },
  { name: "مرسيل عصام الغصين", nationalId: "405428350", department: "مدرب دراما" },
  { name: "محمد غازي دلول", nationalId: "402904247", department: "مدرب دراما" },
  { name: "براء فتحي أبو ناموس", nationalId: "405967605", department: "مدرب دراما" },
];

async function main() {
  let created = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (const person of STAFF) {
    const phone = normalizePhone(person.phone);
    const email = `${phone}@basma.local`;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: person.nationalId,
      email_confirm: true,
      user_metadata: { full_name: person.name, role: person.role },
    });

    if (error) {
      if (error.message?.toLowerCase().includes("already registered")) {
        console.log(`= skip (exists): ${person.name} (${phone})`);
        skippedExisting++;
      } else {
        console.error(`x FAILED: ${person.name} (${phone}) — ${error.message}`);
        failed++;
      }
      continue;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ phone, department: person.department, must_change_password: true })
      .eq("id", data.user.id);

    if (profileError) {
      console.error(`! created auth user but failed to update profile for ${person.name}: ${profileError.message}`);
    }

    console.log(`+ created: ${person.name} — username: ${phone}, temp password: ${person.nationalId}`);
    created++;
  }

  console.log("\n=== Summary ===");
  console.log(`created: ${created}, already existed: ${skippedExisting}, failed: ${failed}`);

  if (SKIPPED_NO_PHONE.length > 0) {
    console.log(`\n${SKIPPED_NO_PHONE.length} people were NOT created — missing phone number:`);
    for (const p of SKIPPED_NO_PHONE) {
      console.log(`  - ${p.name} (${p.department}, ID ${p.nationalId})`);
    }
    console.log("Get their phone numbers and add them from إدارة المستخدمين, or add them above and re-run.");
  }
}

main();
