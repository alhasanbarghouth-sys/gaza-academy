-- ============================================================================
-- Institutional archive (مخزن المعلومات والأرشيف المؤسسي)
-- Implements «المخطط التصنيفي ونموذج الربط» v1.0:
--
--   * Taxonomy: 5 axes, 16 sections, 110 subcategories (الأبواب 4 و5)
--   * Entity registry with auto codes PG/P/D/O/E/B/A/X/T/R (+C for procurement
--     case files) and project membership for "own scope" (الباب 6)
--   * One original location per document + typed links to entities and other
--     documents — never copies (الباب 3، المبدأ الأول)
--   * Mandatory link rules per document type (الباب 7)
--   * S0–S3 sensitivity enforced by Row Level Security from the role matrix,
--     plus named/temporary grants for S3 (الباب 8)
--   * Archive numbers BSCA-[category]-[year]-[seq], immutable versions with a
--     SHA-256 fingerprint, retention schedule, append-only access log (16.02),
--     audit of every change (الأبواب 10، 11، 16)
--
-- Every write goes through a SECURITY DEFINER procedure that re-checks the
-- caller's permissions; users have no direct INSERT/UPDATE/DELETE on any
-- archive table. Files live in a private "archive" bucket with no user
-- policies at all — downloads go through the app, which logs them first.
--
-- Run AFTER 0007_archive_roles.sql (SQL Editor -> New query -> paste -> Run).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Taxonomy
-- ----------------------------------------------------------------------------
create table public.archive_axes (
  code     text primary key,          -- A..E (أ..هـ)
  letter   text not null,
  name_ar  text not null
);

insert into public.archive_axes (code, letter, name_ar) values
  ('A', 'أ',  'الهوية والحوكمة والامتثال'),
  ('B', 'ب',  'الموارد والتشغيل'),
  ('C', 'ج',  'العمل البرامجي والعلاقات'),
  ('D', 'د',  'الصورة والسمعة والمخاطر'),
  ('E', 'هـ', 'ضبط الأرشفة');

create table public.archive_categories (
  code                 text primary key,             -- '04', '04.04', '04.04.02'
  parent_code          text references public.archive_categories(code),
  axis_code            text not null references public.archive_axes(code),
  level                smallint not null check (level between 1 and 3),
  name_ar              text not null,
  materials_ar         text,                          -- أنواع المواد / وصف المحور
  default_sensitivity  smallint check (default_sensitivity between 0 and 3),
  related_ar           text,                          -- عمود «الروابط»
  original_item_no     smallint,                      -- رقمه في تعريف المشروع
  placement_note_ar    text,                          -- سبب الموضع
  retention_basis      text check (retention_basis in
                         ('permanent','document_date','project_end','contract_end',
                          'service_end','closure','minimal','pending')),
  retention_years      smallint,
  retention_note_ar    text,
  exclusive_doc_type   text                           -- category accepts only this type
);

insert into public.archive_categories
  (code, parent_code, axis_code, level, name_ar, materials_ar, original_item_no, placement_note_ar) values
  ('01', null, 'A', 1, 'وثائق الهوية والتأسيس', 'أصل الجمعية وهويتها القانونية والمؤسسية. معظمها مادة ثابتة قليلة التغيّر، وهي الأنسب لبدء الإدخال.', 1, 'مدخل الأرشيف: هوية الجمعية التي تُبنى عليها بقية الفئات.'),
  ('02', null, 'A', 1, 'الحوكمة والقرارات', 'سجل التفكير الإداري لا نتيجته وحدها: النقاشات والتحفظات والبدائل المرفوضة تُحفظ مع القرار.', 2, 'تتفرع عن الهوية، وتحكم القرارات المالية والتشغيلية.'),
  ('03', null, 'A', 1, 'الامتثال والقانون', 'نُقل بعد الحوكمة لأنه يتفرع عنها، ولأن العقود والتصاريح تربط الجانب القانوني بالمالية والمشاريع.', 7, 'نُقل ليلي الحوكمة لأن العقود والتصاريح والامتثال أدوات تنفيذ القرارات.'),
  ('04', null, 'B', 1, 'المالية', 'كل مستند مالي له «موضع أصلي» هنا، ولكنه يظهر تلقائياً في ملف المشروع وبطاقة المانح وملف الفترة المالية عبر الروابط الإلزامية.', 3, 'أول محور الموارد، ويرتبط بكل مشروع وعقد.'),
  ('05', null, 'B', 1, 'الموارد البشرية', 'أعلى المواد حساسية بعد المستفيدين. الإتاحة بحسب الدور وبملف الشخص نفسه، وكل اطلاع يُسجَّل.', 6, 'مورد بشري يُموَّل من المشاريع، ويرتبط بالمالية.'),
  ('06', null, 'B', 1, 'السلامة والجودة والبيئة', 'يتعلق بالمقر والمعدات والعاملين وسلامة التشغيل.', 13, 'نُقل من آخر القائمة إلى الموارد لأنه يخص المقر والمعدات والعاملين.'),
  ('07', null, 'C', 1, 'البرامج والمشاريع', 'قلب الأرشيف وأكثر محاوره ارتباطاً. «ملف المشروع» هو نقطة التقاء الروابط: يحمل رمزاً واحداً وتُشير إليه كل الفئات الأخرى.', 4, 'محور العمل الفعلي وأكثر الفئات ارتباطاً.'),
  ('08', null, 'C', 1, 'المستفيدون', 'مبدأ الترميز: لا يظهر اسم المستفيد في أي فئة سوى 08.02، وفي سائر المواضع يُستعمل رمز مستفيد مجهَّل (B-xxxx).', 5, 'مرتبط مباشرة بالمشاريع، وأعلى الفئات حماية.'),
  ('09', null, 'C', 1, 'الشكاوى والملاحظات', 'تُحفظ كل شكوى مهما بدت صغيرة. وتشمل قناة «اقتراحات وشكاوى» المنشورة على الموقع.', 8, 'نتاج التفاعل مع المستفيدين والأطراف.'),
  ('10', null, 'C', 1, 'أصحاب المصلحة والشراكات', 'يضم «بطاقة الجهة» لكل مانح وشريك: تُجمع منها تلقائياً كل العقود والمشاريع والتقارير المرتبطة بها.', 10, 'علاقات المشاريع والتمويل بالجهات الخارجية.'),
  ('11', null, 'D', 1, 'الاتصال والإعلام', 'يتقاطع مباشرة مع أقسام الموقع (أخبار بسمة، المطبوعات، الاستديو). المصدر الأول لإدخال المحتوى التاريخي لأنه منشور أصلاً.', 9, 'صورة الجمعية المعلنة، ويقابل أقسام الموقع.'),
  ('12', null, 'D', 1, 'شهادات الطرف الثالث', 'ما قاله الآخرون عن الجمعية، وتُحفظ معه حيثيات القول ومصدره.', 11, 'ما قيل عن الجمعية من الخارج، ويدعم الصورة.'),
  ('13', null, 'D', 1, 'المسؤولية المجتمعية والأخلاقية', 'مواقف الجمعية وتعهداتها العلنية، وما يثبت وفاءها بها.', 14, 'مواقف الجمعية وتعهداتها العلنية.'),
  ('14', null, 'D', 1, 'الأزمات والحوادث', 'الفئة التي يُقاس بها نجاح النظام كله: أن يجد فريق الأزمة أدلته في دقائق.', 12, 'مكان اختبار قيمة الأرشيف كله، ويستدعي من الفئات الأخرى.'),
  ('15', null, 'D', 1, 'البيانات والقياس', 'الأرقام الخام تُحفظ مع منهجية استخراجها حتى يمكن الدفاع عن أي نتيجة.', 15, 'قياس ما سبق جميعاً، ومصدر الدليل الكمي.'),
  ('16', null, 'E', 1, 'ضبط الأرشفة', 'ليست مجرد مجلد: هي «الطبقة الضابطة» التي تُطبَّق على كل الفئات الأخرى، وتحوي سجلاتها وأدلتها.', 16, 'طبقة ضابطة تحكم كل ما قبلها، فتأتي أخيراً.');

insert into public.archive_categories
  (code, parent_code, axis_code, level, name_ar, materials_ar, default_sensitivity, related_ar)
select v.code, v.parent, s.axis_code, v.lvl, v.name, v.materials, v.sens, v.related
from (values
  -- 01 وثائق الهوية والتأسيس
  ('01.01','01',2,'التسجيل والترخيص','شهادات التسجيل، التجديدات السنوية، كتب الجهات المرخِّصة، رسوم التجديد',1,'03.05 الاعتمادات، 04 المالية (رسوم)'),
  ('01.02','01',2,'النظام الأساسي وتعديلاته','كل نسخة من النظام الأساسي، قرارات التعديل، الصيغ المقارنة بين النسخ',0,'02.01 محاضر الجمعية العمومية (قرار التعديل)'),
  ('01.03','01',2,'الرؤية والرسالة والقيم','كل نسخة مع تاريخ اعتمادها والمحضر المعتمد لها',0,'02.01 المحضر، 11.08 الرسائل المعتمدة'),
  ('01.04','01',2,'الهيكل التنظيمي','الهياكل المتعاقبة وتواريخها، توصيف الوحدات، خرائط خطوط الإبلاغ',1,'05 الموارد البشرية، 02.05 التفويضات'),
  ('01.05','01',2,'الهوية البصرية','الشعار وأدلة الاستخدام والنماذج المعتمدة، وسجل تغييراتها وأسبابها',0,'11 الاتصال والإعلام'),
  ('01.06','01',2,'الخطط الاستراتيجية والتشغيلية','الخطط الاستراتيجية، الخطط السنوية، تقارير تقييم الخطط',1,'07 البرامج، 15.05 مؤشرات الأداء المؤسسي'),
  ('01.07','01',2,'تاريخ الجمعية وسيرتها','النبذة منذ التأسيس عام 1994، المحطات الكبرى، كتيبات التعريف، الشهادات الشفوية للمؤسسين',0,'11.05 الإصدارات، 12 شهادات الطرف الثالث'),
  -- 02 الحوكمة والقرارات
  ('02.01','02',2,'محاضر الهيئات','محاضر مجلس الإدارة والجمعية العمومية واللجان، بما فيها النقاشات والتحفظات والأصوات المخالفة، وكشوف الحضور',2,'02.02 القرارات، وثائق مرفقة بالمحضر'),
  ('02.02','02',2,'سجل القرارات وتسبيبها','بطاقة لكل قرار كبير: نصه، مبرراته، البدائل التي دُرست ورُفضت وأسباب رفضها',2,'02.01 المحضر المصدر، 02.03 السياسة الناتجة، المشروع المتأثر'),
  ('02.03','02',2,'السياسات والأدلة الإجرائية','كل سياسة بإصداراتها وتاريخ سريان كل إصدار (مالية، مشتريات، حماية، توظيف، خصوصية…)',1,'03.06 التزامات المانحين، 16.01 سياسة الأرشفة'),
  ('02.04','02',2,'تضارب المصالح والإفصاح','الإقرارات الدورية، سجل الإفصاح، قرارات المعالجة',3,'02.01 المحضر، 04.05 المشتريات'),
  ('02.05','02',2,'الصلاحيات والتفويضات','من فوّض من، ومتى، وفي أي نطاق ولأي مدة، وسجل التوقيعات المعتمدة',2,'04.04 السندات (التفويض بالصرف)، 01.04 الهيكل'),
  ('02.06','02',2,'الانتخابات وتشكيل الهيئات','نتائج كل دورة، قوائم المرشحين، تشكيل مجلس الإدارة والهيئة الإدارية',1,'02.01 المحاضر، 05.01 (للموظفين الأعضاء)'),
  -- 03 الامتثال والقانون
  ('03.01','03',2,'العقود والاتفاقيات','عقود التمويل والشراكة والخدمات والإيجار والتوريد',2,'04.03 التمويل، 10 الشراكات، المشروع، المانح'),
  ('03.02','03',2,'مذكرات التفاهم','مذكرات التفاهم مع المؤسسات الحكومية والأهلية (مثل مذكرات التعاون مع مديرية التربية)',1,'10.01 أصحاب المصلحة، المشروع'),
  ('03.03','03',2,'المراسلات الرسمية والرقابية','المراسلات مع الجهات الرسمية والرقابية وردودها',2,'03.04 التفتيش، الحدث/الأزمة'),
  ('03.04','03',2,'التفتيش والرقابة وتصحيح الملاحظات','تقارير التفتيش، خطط التصحيح، ما يثبت التنفيذ',2,'03.03 المراسلات، 04.02 التدقيق'),
  ('03.05','03',2,'الشهادات والاعتمادات','الشهادات والاعتمادات وتواريخ صلاحيتها مع تنبيه آلي قبل الانتهاء',1,'01.01 التسجيل، 12.02 الاعتمادات المستقلة'),
  ('03.06','03',2,'الالتزام بسياسات المانحين','سجل الالتزام بمكافحة الإرهاب ومكافحة الفساد والحماية من الاستغلال والإساءة الجنسية، وما يثبته',2,'02.03 السياسات، 05.04 الإقرارات، المانح'),
  ('03.07','03',2,'التصاريح والموافقات للأنشطة','التصريح اللازم لكل نشاط والموافقات الرسمية',1,'07.09 سجل الأنشطة'),
  ('03.08','03',2,'القضايا والنزاعات والتسويات','الدعاوى والأحكام والتسويات والمراسلات القانونية',3,'14 الأزمات، 03.01 العقد محل النزاع'),
  -- 04 المالية
  ('04.01','04',2,'الموازنات والقوائم المالية المدققة','الموازنات السنوية، الموازنات المعدلة، القوائم المالية المدققة',2,'04.02 التدقيق، 01.06 الخطط، الفترة المالية'),
  ('04.02','04',2,'التدقيق الخارجي','تقارير المدقق، رسائل الإدارة، ردود الجمعية وخطط المعالجة',2,'04.01 القوائم، 03.04 التصحيح'),
  ('04.03','04',2,'عقود التمويل والتقارير المالية للمانحين','عقود المنح، الملاحق، التقارير المالية المرفوعة وملاحظات المانح عليها',2,'03.01 العقد، المشروع، المانح، 07.02 تقرير الإنجاز المرافق'),
  ('04.04','04',2,'السندات','تتفرع إلى: سندات الصرف، سندات القبض، الفواتير، العروض',2,'المشروع، بند الموازنة، المانح، الفترة'),
  ('04.04.01','04.04',3,'سندات الصرف','سند الصرف مع المرفقات (فاتورة، عرض أسعار، موافقة الصرف، إيصال الاستلام)',2,'04.04.03 الفاتورة، 04.05 ملف المشتريات، 02.05 التفويض'),
  ('04.04.02','04.04',3,'سندات القبض','سند القبض مع مرفقاته (إشعار التحويل، العقد، الإيصال)',2,'04.03 العقد، 04.07 الكشف البنكي، 04.08 التبرعات'),
  ('04.04.03','04.04',3,'الفواتير','فواتير الموردين والمقاولين مع تاريخ الاستلام والتدقيق',2,'04.04.01 سند الصرف، 04.05 المشتريات'),
  ('04.04.04','04.04',3,'العروض','تنظَّم حسب مقدِّم العرض: عروض الأفراد، عروض المنظمات والشركات، عروض المجموعات. وتُربط جميعها بـ«ملف حالة» يجمع كل العروض المتنافسة على الحالة الواحدة',2,'04.05 محضر اللجنة، 04.06 الأصول (في حالة بيع/شراء أصل)'),
  ('04.05','04',2,'المشتريات والعطاءات','محاضر لجان المشتريات والعطاءات، جدول مقارنة العروض، العروض الفائزة والخاسرة، أسباب الترسية',2,'04.04.04 العروض، 02.04 تضارب المصالح، 02.05 التفويض'),
  ('04.06','04',2,'الأصول والعهد والجرد','سجل الأصول، العهد، محاضر الجرد الدوري، الإتلاف والبيع',1,'04.05 الشراء، 06.03 الصيانة'),
  ('04.07','04',2,'الحسابات البنكية وتسوياتها','كشوف الحساب وتسويات البنك الشهرية (لا تُخزَّن أرقام الحسابات الكاملة في نصوص مفتوحة)',3,'04.04 السندات، 04.08 التبرعات'),
  ('04.08','04',2,'التبرعات والمتبرعون','سجل التبرعات والمتبرعين وإيصالاتهم، وما يثبت صرف كل تبرع في غرضه',2,'04.04.02 سند القبض، 04.04.01 سند الصرف، 11 (التقدير العلني بإذن)'),
  -- 05 الموارد البشرية
  ('05.01','05',2,'ملفات الموظفين والمتطوعين','العقود، المؤهلات، التوصيف الوظيفي',3,'05.02 إجراء التوظيف، 04 الراتب من أي مشروع'),
  ('05.02','05',2,'إجراءات التوظيف لكل وظيفة','الإعلان، المتقدمون، محاضر المقابلات، أسباب الاختيار',3,'05.01، المشروع الممول للوظيفة، 02.04'),
  ('05.03','05',2,'التقييمات والترقيات والجزاءات','تقييمات الأداء، سجل الترقيات والجزاءات',3,'05.01، 05.08 التظلمات'),
  ('05.04','05',2,'إقرارات السلوك والحماية','مدونة السلوك وسياسة الحماية الموقَّعة من كل عامل ومتطوع',2,'02.03 السياسة، 03.06 التزامات المانحين'),
  ('05.05','05',2,'التدريب وبناء القدرات','سجل تدريب العاملين وشهاداته',1,'07.08 المواد التدريبية، المشروع'),
  ('05.06','05',2,'إنهاء الخدمة','محاضر الإنهاء، مقابلات الخروج، تسوية المستحقات',3,'05.01، 05.07'),
  ('05.07','05',2,'الرواتب والتأمينات والمستحقات','كشوف الرواتب، التأمينات، المستحقات',3,'04.04.01 سندات الصرف، المشروع'),
  ('05.08','05',2,'التظلمات الداخلية','التظلمات ونتائج البت فيها',3,'09 الشكاوى (إحالة)، 05.03'),
  ('05.09','05',2,'المتطوعون وطلبات التطوع','طلبات التطوع الواردة عبر الموقع، سجل المتطوعين والساعات والأنشطة',2,'07.09 الأنشطة، 05.04'),
  -- 06 السلامة والجودة والبيئة
  ('06.01','06',2,'السلامة وحوادث العمل','إجراءات السلامة، سجل الحوادث وإصابات العمل',2,'14.01 سجل الحوادث، 05.01'),
  ('06.02','06',2,'فحوصات الجودة','المعايير والفحوصات ونتائجها',1,'07.04 الرصد والتقييم'),
  ('06.03','06',2,'صيانة المرافق والمعدات','سجلات الصيانة الدورية والطارئة',1,'04.06 الأصول، 04.04.01 سند الصرف'),
  ('06.04','06',2,'الالتزام البيئي والاجتماعي','ما يثبت الالتزام بالمعايير البيئية والاجتماعية',1,'03.06 التزامات المانحين، 13.03'),
  -- 07 البرامج والمشاريع
  ('07.01','07',2,'ملف المشروع (التصميم)','المقترح، الإطار المنطقي، خطة العمل، الموازنة، نسخ التعديل',1,'04.03 عقد التمويل، 03.01 العقد، المانح، الشركاء'),
  ('07.02','07',2,'تقارير الإنجاز','التقارير الدورية والنهائية، وتقارير جهات الاختصاص والتنسيق القطاعي الدورية',1,'07.03 المؤشرات، 04.03 التقرير المالي المرافق'),
  ('07.03','07',2,'مؤشرات الأداء','لكل مؤشر: خط الأساس، المستهدف، المتحقق فعلاً، مصدر القياس',1,'15.03 البيانات الخام، 07.02'),
  ('07.04','07',2,'الرصد والتقييم','تقارير الرصد والتقييم الداخلية والخارجية',1,'15.04 المنهجيات، 07.05'),
  ('07.05','07',2,'الدروس المستفادة والتعثر','الدروس، والمشاريع أو الأنشطة التي تعثرت وأسباب تعثرها',2,'07.04، 14 (إن بلغ حد الأزمة)'),
  ('07.06','07',2,'الحضور والتوزيع والاستلام','كشوف الحضور، سجلات التوزيع، توقيعات الاستلام',3,'07.09 النشاط، 08.02 (بترميز المستفيد)'),
  ('07.07','07',2,'الوسائط المؤرخة','صور وفيديوهات الأنشطة بتاريخها، مع ما يثبت موافقة من ظهر فيها',2,'08.03 الموافقة، 11.09 الاستديو، النشاط'),
  ('07.08','07',2,'المواد التدريبية والمنتجات المعرفية','الحقائب التدريبية، الأدلة، المسرحيات والنصوص والأفلام والمنتجات المعرفية',0,'11.05 الإصدارات، 05.05'),
  ('07.09','07',2,'سجل الأنشطة','بطاقة لكل نشاط (ورشة، عرض مسرحي، تدريب، فعالية): التاريخ، الموقع، الفئة، المخرجات',1,'07.06، 07.07، 03.07، المشروع'),
  -- 08 المستفيدون
  ('08.01','08',2,'معايير الاختيار وإثبات تطبيقها','المعايير المعتمدة، محاضر الاختيار، ما يثبت العدالة في التطبيق',1,'02.03 السياسات، المشروع'),
  ('08.02','08',2,'قوائم المستفيدين وبياناتهم','القوائم والبيانات الشخصية، محمية وفق سياسة الخصوصية',3,'07.06 (بالرمز)، 08.03'),
  ('08.03','08',2,'نماذج الموافقة المستنيرة','نماذج الموافقة الموقعة (بما فيها موافقة الأهل/الأوصياء وموافقة التصوير)',3,'07.07 الوسائط، 08.02'),
  ('08.04','08',2,'استبيانات الرضا','الأدوات والنتائج والتحليل',1,'15.01، المشروع'),
  ('08.05','08',2,'قصص النجاح','القصص الموثقة بإذن أصحابها، مع رابط الإذن',1,'08.03 الإذن، 11.05 الإصدارات'),
  ('08.06','08',2,'سجل الإحالات','الإحالات إلى جهات أخرى ومتابعتها (يُخصص لمنسق الحماية)',3,'08.02، 09، 14'),
  -- 09 الشكاوى والملاحظات
  ('09.01','09',2,'سجل الشكاوى الواردة','كل شكوى بتاريخ ورودها وقناتها (الموقع، الهاتف، مباشرة…)',3,'المشروع، النشاط، الشخص المشكو منه'),
  ('09.02','09',2,'مسار المعالجة','من استلمها، الإجراء، تاريخ الإغلاق',3,'09.01، 05.08 عند كون الشكوى داخلية'),
  ('09.03','09',2,'الردود المرسلة للشاكي','نص كل رد وتاريخه',3,'09.01، 09.02'),
  ('09.04','09',2,'تحليل الأنماط والتغييرات','التحليل الدوري للأنماط والتغييرات الناتجة',1,'15.05، 02.02 القرارات'),
  ('09.05','09',2,'الملاحظات والمقترحات','الإيجابية والسلبية من الجمهور والشركاء',1,'10، 11.04'),
  -- 10 أصحاب المصلحة والشراكات
  ('10.01','10',2,'خريطة أصحاب المصلحة','الخريطة وتحديثاتها وتصنيف الأطراف',1,'10.07 بطاقات الجهات'),
  ('10.02','10',2,'الاجتماعات واللقاءات','سجل الاجتماعات ومحاضرها',1,'الجهة، المشروع، 02.01'),
  ('10.03','10',2,'رسائل الشكر والتوصية','رسائل من الشركاء والمانحين والجهات الرسمية',0,'12 شهادات الطرف الثالث'),
  ('10.04','10',2,'تقييمات المانحين والشركاء','تقييم أداء الجمعية من الجهات الخارجية',2,'12.03، المشروع'),
  ('10.05','10',2,'الشراكات المنتهية أو المتوقفة','أسباب الانتهاء ونتائج الشراكة',2,'03.01 العقد، 10.07'),
  ('10.06','10',2,'الشبكات والتحالفات والعضويات','الانتساب والعضويات والمشاركة في الشبكات',1,'03.05 الاعتمادات'),
  ('10.07','10',2,'بطاقات المانحين والشركاء','بطاقة لكل جهة، ومن الجهات المذكورة على الموقع: CBD، Enabel، Diakonia، اليونسكو، USAID، خدمات الإغاثة الكاثوليكية، القنصلية الأمريكية، مركز القطان',1,'03.01، 04.03، 07.01، 10.04'),
  -- 11 الاتصال والإعلام
  ('11.01','11',2,'البيانات والتصريحات الرسمية','كل بيان بنصه الكامل وتاريخه والجهة التي أصدرته',0,'02.02 القرار الذي صدر عنه، 14 الأزمة'),
  ('11.02','11',2,'التغطيات الإعلامية','التغطيات الإيجابية والسلبية (وهي «الظهور الإعلامي» في الموقع)',0,'المشروع، النشاط، 12'),
  ('11.03','11',2,'أرشيف المواقع والمنصات','لقطات مؤرخة للموقع وفيسبوك وإكس ويوتيوب وإنستغرام، بما فيها المنشورات المحذوفة أو المعدلة وسبب ذلك',1,'11.01، 14'),
  ('11.04','11',2,'التفاعلات المهمة والردود','التعليقات والتفاعلات المؤثرة وردود الجمعية',1,'11.03، 09.05'),
  ('11.05','11',2,'التقارير السنوية والنشرات والإصدارات','التقارير السنوية، النشرة الشهرية، المنشورات الدعائية، الأدلة',0,'07.08، 01.07'),
  ('11.06','11',2,'المقابلات الصحفية','المقابلة كاملة (تسجيل ونص) لا المقتطف المنشور وحده',1,'11.02'),
  ('11.07','11',2,'التصحيحات والاعتذارات','ما أصدرته الجمعية من تصحيح أو اعتذار',1,'11.01، 14'),
  ('11.08','11',2,'الرسائل الموحدة المعتمدة','الرسائل الرئيسية وتواريخ اعتمادها',1,'01.03، 02.02'),
  ('11.09','11',2,'الاستديو: الصور والفيديو','ألبومات الصور والفيديو المنشورة (قسم «الاستديو» في الموقع)',0,'07.07 الأصل المؤرخ، 08.03 الموافقة'),
  -- 12 شهادات الطرف الثالث
  ('12.01','12',2,'الجوائز والتكريمات','الجائزة وحيثيات منحها وجهتها',0,'المشروع، 11.02'),
  ('12.02','12',2,'الاعتمادات من جهات مستقلة','الاعتماد ونطاقه وصلاحيته',0,'03.05'),
  ('12.03','12',2,'التقييمات والتصنيفات الخارجية','التقييمات الصادرة عن جهات خارجية',1,'10.04'),
  ('12.04','12',2,'الدراسات والأبحاث','دراسات تناولت الجمعية أو استشهدت بها',0,'11.02'),
  ('12.05','12',2,'شهادات المستفيدين والخبراء','شهادات موثقة بإذن أصحابها',1,'08.03 الإذن'),
  -- 13 المسؤولية المجتمعية والأخلاقية
  ('13.01','13',2,'المبادرات المجتمعية','المبادرات ونتائجها',1,'07 المشروع، 11'),
  ('13.02','13',2,'المواقف العلنية','مواقف الجمعية من القضايا العامة مع تاريخها وسندها',1,'11.01، 02.02'),
  ('13.03','13',2,'الإنصاف وعدم التمييز وإمكانية الوصول','ما يثبت الالتزام، ومنه خدمات الأشخاص ذوي الإعاقة',1,'06.04، 08.01'),
  ('13.04','13',2,'سجل الشفافية','ما أُفصح عنه للجمهور ومتى',0,'11.05، 04.01'),
  -- 14 الأزمات والحوادث
  ('14.01','14',2,'سجل الأزمات والحوادث','ما حدث، ومتى، ومن تأثر',2,'الحدث (X-xxx)، 06.01'),
  ('14.02','14',2,'الإجراءات بتسلسلها الزمني','الخط الزمني الدقيق للإجراءات',2,'14.01، 02.01'),
  ('14.03','14',2,'الرسائل أثناء الأزمة','الرسائل الصادرة داخلياً وخارجياً',2,'11.01، 11.07'),
  ('14.04','14',2,'تقارير ما بعد الأزمة','التقرير والدروس المستفادة',2,'07.05، 02.02'),
  ('14.05','14',2,'خطة إدارة الأزمات والتمارين','الخطة، نتائج التمارين والمحاكاة',1,'02.03'),
  ('14.06','14',2,'سجل المخاطر','السجل وتحديثاته',1,'15.05، 01.06'),
  ('14.07','14',2,'الإشاعات والردود','الإشاعات المرصودة والردود المفنِّدة لها',1,'11.03، 11.04'),
  -- 15 البيانات والقياس
  ('15.01','15',2,'قياس السمعة واستطلاعات الرأي','النتائج الدورية والأدوات',1,'08.04، 12'),
  ('15.02','15',2,'الرصد الإعلامي والرقمي','تقارير الرصد',1,'11.02، 11.03'),
  ('15.03','15',2,'بيانات الأداء الخام','البيانات الأولية لا الملخصات وحدها',2,'07.03 المؤشرات'),
  ('15.04','15',2,'منهجيات القياس','الأدوات وطرائق الحساب وحدود النتائج',1,'07.04، 15.01'),
  ('15.05','15',2,'مؤشرات الأداء المؤسسي','المؤشرات المؤسسية على مستوى الجمعية (لا المشروع)',1,'01.06، 09.04، 14.06'),
  -- 16 ضبط الأرشفة
  ('16.01','16',2,'سياسة الأرشفة وجدول الاحتفاظ','السياسة وجدول مدد الاحتفاظ لكل نوع من المستندات',1,'02.03، 03.06'),
  ('16.02','16',2,'سجل الوصول','من اطلع على ماذا ومتى (يُولَّد آلياً)',3,'كل الفئات'),
  ('16.03','16',2,'سجل الإصدارات والتعديلات','الأصل غير المعدَّل، وكل نسخة معدلة وسبب تعديلها',2,'كل الفئات'),
  ('16.04','16',2,'النسخ الاحتياطية واختبارات الاسترجاع','سجل النسخ في أكثر من موقع (رقمي وورقي) ونتائج اختبار الاسترجاع',2,null),
  ('16.05','16',2,'المراجعة الدورية','تقارير مراجعة الاكتمال والسلامة',1,'كل الفئات'),
  ('16.06','16',2,'حزم الأدلة الجاهزة','حزم مجمّعة مسبقاً للموضوعات الحساسة',2,'04، 05، 08، 09، 14'),
  ('16.07','16',2,'دليل المستخدم والأدوار','دليل الاستخدام ونماذج الإدخال وجدول الأدوار',1,null)
) as v(code, parent, lvl, name, materials, sens, related)
join public.archive_categories s on s.code = split_part(v.code, '.', 1) and s.level = 1;

-- Retention schedule (الباب 11 — مقترح للنقاش ويحتاج مراجعة قانونية)
update public.archive_categories set retention_basis = 'permanent', retention_note_ar = 'دائم — تاريخ الجمعية'
  where level > 1 and (code like '01.%' or code like '02.%');
update public.archive_categories set retention_basis = 'contract_end', retention_years = 10,
  retention_note_ar = 'عشر سنوات بعد انتهاء العقد، أو أطول مدة يشترطها المانح'
  where level > 1 and code like '03.%';
update public.archive_categories set retention_basis = 'closure', retention_years = 10,
  retention_note_ar = 'حتى الفصل في القضية ثم عشر سنوات'
  where code = '03.08';
update public.archive_categories set retention_basis = 'project_end', retention_years = 10,
  retention_note_ar = 'عشر سنوات بعد إغلاق المشروع أو السنة المالية، أو أطول مدة يشترطها المانح'
  where level > 1 and code like '04.%';
update public.archive_categories set retention_basis = 'permanent', retention_years = null,
  retention_note_ar = 'دائم — القوائم المالية المدققة'
  where code = '04.01';
update public.archive_categories set retention_basis = 'service_end', retention_years = 7,
  retention_note_ar = 'سبع سنوات بعد انتهاء الخدمة'
  where level > 1 and code like '05.%';
update public.archive_categories set retention_basis = 'document_date', retention_years = 10,
  retention_note_ar = 'كشوف الرواتب: عشر سنوات'
  where code = '05.07';
update public.archive_categories set retention_basis = 'permanent', retention_note_ar = 'دائم للوثائق والتقارير'
  where level > 1 and code like '07.%';
update public.archive_categories set retention_basis = 'document_date', retention_years = 10,
  retention_note_ar = 'سجلات التوزيع والحضور: عشر سنوات'
  where code = '07.06';
update public.archive_categories set retention_basis = 'minimal',
  retention_note_ar = 'أقصر مدة لازمة ثم الإتلاف الموثق أو التجهيل، وفق سياسة الخصوصية وشروط المانح'
  where level > 1 and code like '08.%';
update public.archive_categories set retention_basis = 'closure', retention_years = 7,
  retention_note_ar = 'سبع سنوات بعد الإغلاق؛ حالات الحماية وفق بروتوكولات القطاع'
  where level > 1 and code like '09.%';
update public.archive_categories set retention_basis = 'permanent', retention_note_ar = 'دائم — ذاكرة مؤسسية'
  where level > 1 and (code like '11.%' or code like '12.%' or code like '13.%' or code like '14.%');
update public.archive_categories set retention_basis = 'document_date', retention_years = 10,
  retention_note_ar = 'البيانات الخام: خمس إلى عشر سنوات (يُعتمد الأطول)'
  where code in ('15.01', '15.02', '15.03');
update public.archive_categories set retention_basis = 'permanent', retention_note_ar = 'دائم — المنهجيات والمؤشرات المؤسسية'
  where code in ('15.04', '15.05');
update public.archive_categories set retention_basis = 'pending',
  retention_note_ar = 'لم تُحدَّد في جدول الاحتفاظ المقترح — بانتظار القرار'
  where level > 1 and retention_basis is null;

-- ----------------------------------------------------------------------------
-- 2. Document types and mandatory link rules (الباب 7)
-- ----------------------------------------------------------------------------
create table public.archive_doc_types (
  code            text primary key,
  name_ar         text not null,
  fixed_category  text references public.archive_categories(code),
  sort            int not null
);

insert into public.archive_doc_types (code, name_ar, fixed_category, sort) values
  ('payment_voucher',    'سند صرف',                         '04.04.01', 1),
  ('receipt_voucher',    'سند قبض',                         '04.04.02', 2),
  ('invoice',            'فاتورة',                          '04.04.03', 3),
  ('offer',              'عرض (فرد/منظمة/مجموعة)',           '04.04.04', 4),
  ('procurement_minutes','محضر لجنة مشتريات',               '04.05',    5),
  ('progress_report',    'تقرير إنجاز',                     '07.02',    6),
  ('attendance_sheet',   'كشف حضور / توزيع / استلام',        '07.06',    7),
  ('activity_media',     'صورة أو فيديو لنشاط',              '07.07',    8),
  ('complaint',          'شكوى',                            '09.01',    9),
  ('governance_minutes', 'محضر مجلس / جمعية عمومية',          '02.01',   10),
  ('contract',           'عقد / اتفاقية',                    '03.01',   11),
  ('employee_file',      'ملف موظف',                        '05.01',   12),
  ('official_statement', 'بيان رسمي',                       '11.01',   13),
  ('award',              'جائزة أو تكريم',                   '12.01',   14),
  ('incident',           'حادثة أو أزمة',                    '14.01',   15),
  ('letter',             'مراسلة',                          null,      20),
  ('report',             'تقرير',                           null,      21),
  ('minutes',            'محضر (لجنة/اجتماع)',                null,      22),
  ('policy',             'سياسة / لائحة / دليل',              null,      23),
  ('plan',               'خطة',                             null,      24),
  ('certificate',        'شهادة / اعتماد / ترخيص',            null,      25),
  ('form',               'نموذج',                           null,      26),
  ('register',           'كشف / سجل / جدول',                  null,      27),
  ('photo',              'صورة',                            null,      28),
  ('video',              'فيديو / تسجيل صوتي',                null,      29),
  ('publication',        'إصدار / منشور / نشرة',              null,      30),
  ('dataset',            'بيانات',                          null,      31),
  ('other',              'أخرى',                            null,      99);

alter table public.archive_categories
  add constraint archive_categories_exclusive_doc_type_fkey
  foreign key (exclusive_doc_type) references public.archive_doc_types(code);

-- Categories that hold exactly one kind of record: everything filed there IS
-- that type, so a generic type cannot be used to slip past its link rules.
update public.archive_categories c set exclusive_doc_type = t.code
from public.archive_doc_types t
where t.fixed_category = c.code
  and c.code in ('04.04.01', '04.04.02', '04.04.03', '04.04.04', '07.06', '07.07', '09.01');

create table public.archive_link_rules (
  id                 serial primary key,
  doc_type           text not null references public.archive_doc_types(code),
  req_key            text not null,
  label_ar           text not null,
  entity_types       text[] not null default '{}',
  categories         text[] not null default '{}',   -- '*' = any document
  stage              text not null check (stage in ('intake', 'completion')),
  is_optional        boolean not null default false,  -- «إن وُجد»
  alt_flag           text check (alt_flag in ('unpublished')),
  default_link_type  text not null,
  sort               int not null,
  unique (doc_type, req_key)
);

-- stage 'intake'     : blocks filing until linked (entities that exist beforehand)
-- stage 'completion' : record is flagged «ناقص الروابط» until linked
--                      (documents that are often produced afterwards — e.g. the
--                      invoice and its payment voucher each require the other)
insert into public.archive_link_rules
  (doc_type, req_key, label_ar, entity_types, categories, stage, is_optional, alt_flag, default_link_type, sort) values
  ('payment_voucher','project','المشروع','{project}','{}','intake',false,null,'belongs_to',1),
  ('payment_voucher','donor','المانح','{donor}','{}','intake',false,null,'belongs_to',2),
  ('payment_voucher','period','الفترة','{period}','{}','intake',false,null,'belongs_to',3),
  ('payment_voucher','approval','موافقة الصرف (02.05)','{}','{02.05}','completion',false,null,'based_on',4),
  ('payment_voucher','invoice_or_offer','الفاتورة (04.04.03) أو ملف العرض (04.04.04 / 04.05)','{}','{04.04.03,04.04.04,04.05}','completion',false,null,'based_on',5),
  ('payment_voucher','bank','كشف البنك (04.07)','{}','{04.07}','completion',false,null,'proves',6),

  ('receipt_voucher','project_or_donation','المشروع أو التبرع (04.08)','{project}','{04.08}','intake',false,null,'belongs_to',1),
  ('receipt_voucher','period','الفترة','{period}','{}','intake',false,null,'belongs_to',2),
  ('receipt_voucher','contract','عقد التمويل (04.03)','{}','{04.03}','completion',false,null,'based_on',3),
  ('receipt_voucher','bank','كشف البنك (04.07)','{}','{04.07}','completion',false,null,'proves',4),

  ('invoice','voucher','سند الصرف الذي سددها (04.04.01)','{}','{04.04.01}','completion',false,null,'proves',1),
  ('invoice','procurement','ملف المشتريات (04.05) إن وُجد','{}','{04.05}','completion',true,null,'based_on',2),

  ('offer','case','ملف الحالة (مثل: عرض بيع السيارة)','{procurement_case}','{}','intake',false,null,'belongs_to',1),
  ('offer','committee','محضر لجنة المشتريات (04.05)','{}','{04.05}','completion',false,null,'based_on',2),
  ('offer','coi','تضارب المصالح (02.04) إن وُجد','{}','{02.04}','completion',true,null,'based_on',3),

  ('procurement_minutes','project','المشروع','{project}','{}','intake',false,null,'belongs_to',1),
  ('procurement_minutes','offers','العروض كلها، الفائز والخاسر (04.04.04)','{}','{04.04.04}','completion',false,null,'based_on',2),
  ('procurement_minutes','authority','الصلاحية (02.05)','{}','{02.05}','completion',false,null,'based_on',3),
  ('procurement_minutes','voucher','سند الصرف الناتج (04.04.01)','{}','{04.04.01}','completion',false,null,'results_from',4),

  ('progress_report','project','المشروع','{project}','{}','intake',false,null,'belongs_to',1),
  ('progress_report','donor','المانح','{donor}','{}','intake',false,null,'belongs_to',2),
  ('progress_report','indicators','المؤشرات (07.03)','{}','{07.03}','completion',false,null,'based_on',3),
  ('progress_report','financial','التقرير المالي المرافق (04.03)','{}','{04.03}','completion',false,null,'based_on',4),

  ('attendance_sheet','activity','النشاط','{activity}','{}','intake',false,null,'proves',1),
  ('attendance_sheet','project','المشروع','{project}','{}','intake',false,null,'belongs_to',2),
  ('attendance_sheet','beneficiaries','المستفيدون بالرموز المجهلة (B-xxxx)','{beneficiary}','{}','intake',false,null,'belongs_to',3),

  ('activity_media','activity','النشاط','{activity}','{}','intake',false,null,'proves',1),
  ('activity_media','project','المشروع','{project}','{}','intake',false,null,'belongs_to',2),
  ('activity_media','consent','الموافقة (08.03)','{}','{08.03}','completion',false,null,'requires_consent',3),
  ('activity_media','published','المنشور الذي نُشرت فيه (11.03) وإلا فتعلَّم «غير منشور»','{}','{11.03}','completion',false,'unpublished','published_in',4),

  ('complaint','subject','المشروع أو النشاط أو الشخص المعني','{project,activity,person}','{}','intake',false,null,'belongs_to',1),
  ('complaint','handling','مسار المعالجة (09.02)','{}','{09.02}','completion',false,null,'results_from',2),
  ('complaint','reply','الرد (09.03)','{}','{09.03}','completion',false,null,'responds_to',3),
  ('complaint','event','الحدث (14.01) إن بلغت أزمة','{event}','{14.01}','completion',true,null,'belongs_to',4),

  ('governance_minutes','decisions','القرارات الناتجة (02.02)','{decision}','{02.02}','completion',false,null,'results_from',1),
  ('governance_minutes','discussed','المستندات المناقشة','{}','{*}','completion',true,null,'based_on',2),
  ('governance_minutes','policies','السياسات الناتجة (02.03) إن نتجت','{}','{02.03}','completion',true,null,'results_from',3),

  ('contract','party','الجهة (مانح / شريك)','{donor,organization}','{}','intake',false,null,'belongs_to',1),
  ('contract','project','المشروع','{project}','{}','intake',false,null,'belongs_to',2),
  ('contract','budget','موازنة العقد (04.03)','{}','{04.03}','completion',false,null,'based_on',3),
  ('contract','permits','التصاريح (03.07) إن لزمت','{}','{03.07}','completion',true,null,'based_on',4),

  ('employee_file','person','الموظف (E-xxx)','{person}','{}','intake',false,null,'belongs_to',1),
  ('employee_file','recruitment','إجراء التوظيف (05.02)','{}','{05.02}','completion',false,null,'based_on',2),
  ('employee_file','funding_project','المشروع الممول','{project}','{}','completion',false,null,'belongs_to',3),
  ('employee_file','payroll','كشوف الرواتب (05.07)','{}','{05.07}','completion',false,null,'based_on',4),

  ('official_statement','origin','القرار أو الحدث الذي صدر عنه','{decision,event}','{02.02,14.01}','completion',false,null,'results_from',1),
  ('official_statement','snapshot','اللقطة المؤرشفة من الموقع (11.03)','{}','{11.03}','completion',false,null,'published_in',2),
  ('official_statement','interactions','التفاعلات (11.04) إن وُجدت','{}','{11.04}','completion',true,null,'based_on',3),

  ('award','subject','المشروع أو النشاط أو البرنامج','{project,activity,program}','{}','intake',false,null,'belongs_to',1),
  ('award','coverage','التغطية الإعلامية (11.02)','{}','{11.02}','completion',false,null,'published_in',2),

  ('incident','event','الحدث (X-xxx)','{event}','{}','intake',false,null,'belongs_to',1),
  ('incident','timeline','الخط الزمني (14.02)','{}','{14.02}','completion',false,null,'based_on',2),
  ('incident','messages','الرسائل (14.03)','{}','{14.03}','completion',false,null,'based_on',3),
  ('incident','rumors','الإشاعات (14.07) إن وُجدت','{}','{14.07}','completion',true,null,'based_on',4),
  ('incident','post_report','التقرير اللاحق (14.04)','{}','{14.04}','completion',false,null,'results_from',5),
  ('incident','risk_register','سجل المخاطر (14.06)','{}','{14.06}','completion',false,null,'based_on',6);

-- ----------------------------------------------------------------------------
-- 3. Role × axis permission matrix (الباب 8)
--    read_max            : highest sensitivity readable anywhere in the scope
--    read_max_in_scope   : highest sensitivity readable for the user's own
--                          projects/activities (project membership)
--    The most specific scope wins (category prefix beats axis). S3 is only
--    reachable here where the matrix names it explicitly (finance manager on
--    04, archivist on 16); everywhere else it needs a named grant.
--    facilitator and coordinator use the «موظف» rows.
-- ----------------------------------------------------------------------------
create table public.archive_role_matrix (
  role                   text not null,
  scope_code             text not null,
  read_max               smallint not null check (read_max between -1 and 3),
  read_max_in_scope      smallint not null check (read_max_in_scope between -1 and 3),
  can_insert             boolean not null default false,
  insert_own_scope_only  boolean not null default false,
  primary key (role, scope_code)
);

insert into public.archive_role_matrix values
  ('donor','A',1,1,false,false), ('donor','B',-1,-1,false,false), ('donor','04',-1,2,false,false),
  ('donor','C',-1,2,false,false), ('donor','D',1,1,false,false), ('donor','E',-1,-1,false,false),

  ('volunteer','A',1,1,false,false), ('volunteer','B',-1,-1,false,false),
  ('volunteer','C',-1,1,true,true), ('volunteer','D',1,1,false,false),
  ('volunteer','E',-1,-1,false,false), ('volunteer','16.07',1,1,false,false),

  ('staff','A',1,1,false,false), ('staff','B',1,1,false,false), ('staff','05',-1,-1,false,false),
  ('staff','C',-1,2,true,true), ('staff','D',1,1,true,false),
  ('staff','E',-1,-1,false,false), ('staff','16.07',1,1,false,false),

  ('project_manager','A',1,1,false,false), ('project_manager','B',-1,-1,false,false),
  ('project_manager','04',-1,2,false,false), ('project_manager','C',-1,2,true,true),
  ('project_manager','D',1,2,true,false), ('project_manager','E',-1,-1,false,false),
  ('project_manager','16.07',1,1,false,false),

  ('accountant','A',2,2,false,false), ('accountant','B',1,1,false,false), ('accountant','04',3,3,true,false),
  ('accountant','C',2,2,false,false), ('accountant','D',1,1,false,false),
  ('accountant','E',-1,-1,false,false), ('accountant','16.04',2,2,false,false), ('accountant','16.07',1,1,false,false),

  ('executive_director','A',2,2,true,false), ('executive_director','B',2,2,false,false),
  ('executive_director','05',2,2,true,false), ('executive_director','06',2,2,true,false),
  ('executive_director','C',2,2,false,false), ('executive_director','D',2,2,true,false),
  ('executive_director','E',-1,-1,false,false), ('executive_director','16.05',2,2,false,false),
  ('executive_director','16.06',2,2,false,false), ('executive_director','16.07',1,1,false,false),

  ('board_member','A',2,2,false,false), ('board_member','B',-1,-1,false,false), ('board_member','04',2,2,false,false),
  ('board_member','C',1,1,false,false), ('board_member','D',2,2,false,false),
  ('board_member','E',-1,-1,false,false), ('board_member','16.05',2,2,false,false), ('board_member','16.07',1,1,false,false),

  ('archivist','A',-1,-1,false,false), ('archivist','B',-1,-1,false,false), ('archivist','C',-1,-1,false,false),
  ('archivist','D',2,2,true,false), ('archivist','E',3,3,true,false),

  ('system_admin','A',-1,-1,false,false), ('system_admin','B',-1,-1,false,false),
  ('system_admin','C',-1,-1,false,false), ('system_admin','D',-1,-1,false,false),
  ('system_admin','E',-1,-1,false,false), ('system_admin','16.04',2,2,true,false),

  ('auditor','A',-1,-1,false,false), ('auditor','B',-1,-1,false,false), ('auditor','C',-1,-1,false,false),
  ('auditor','D',-1,-1,false,false), ('auditor','E',-1,-1,false,false);

-- ----------------------------------------------------------------------------
-- 4. Entity registry (الباب 6)
-- ----------------------------------------------------------------------------
create table public.archive_counters (
  scope     text not null,
  year      int not null,
  last_seq  int not null default 0,
  primary key (scope, year)
);

create table public.archive_entities (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in
                 ('program','project','donor','organization','person','beneficiary',
                  'activity','event','period','decision','procurement_case')),
  code         text not null unique,
  name         text,
  description  text,
  parent_id    uuid references public.archive_entities(id),
  profile_id   uuid references public.profiles(id),
  start_date   date,
  end_date     date,
  is_active    boolean not null default true,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- an anonymised beneficiary code never carries a name (المبدأ الخامس)
  constraint archive_entities_beneficiary_anonymous check (entity_type <> 'beneficiary' or name is null),
  constraint archive_entities_named check (entity_type = 'beneficiary' or nullif(btrim(name), '') is not null),
  constraint archive_entities_profile_only_person check (profile_id is null or entity_type = 'person'),
  constraint archive_entities_dates check (end_date is null or start_date is null or end_date >= start_date)
);

create index idx_archive_entities_type on public.archive_entities(entity_type);
create index idx_archive_entities_parent on public.archive_entities(parent_id);
create unique index idx_archive_entities_person_profile on public.archive_entities(profile_id) where profile_id is not null;

create table public.archive_project_members (
  project_id   uuid not null references public.archive_entities(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  member_role  text not null check (member_role in ('manager', 'member', 'donor')),
  added_by     uuid references public.profiles(id),
  added_at     timestamptz not null default now(),
  primary key (project_id, profile_id)
);

create index idx_archive_project_members_profile on public.archive_project_members(profile_id);

-- Seeds from the website survey (الباب 2) — programs, donors and partners
insert into public.archive_entities (entity_type, code, name, description) values
  ('program', 'PG-1', 'برنامج الثقافة والفنون', 'مشاريع المسرح والدراما والإنتاج الفني، مع أنشطتها'),
  ('program', 'PG-2', 'برنامج الدعم النفسي الاجتماعي', 'مشاريع الدعم النفسي للأطفال والنساء (مثل جلسات I-DEAL)، وتقارير جهات الاختصاص'),
  ('program', 'PG-3', 'برنامج شبكة الشباب الفلسطيني', 'مشاريع الشباب والحوار والتمكين'),
  ('program', 'PG-4', 'برنامج مجتمع حضاري', 'المشاريع المجتمعية'),
  ('donor', 'D-01', 'CBD', null),
  ('donor', 'D-02', 'Enabel', null),
  ('donor', 'D-03', 'Diakonia', null),
  ('donor', 'D-04', 'اليونسكو (UNESCO)', null),
  ('donor', 'D-05', 'USAID', null),
  ('donor', 'D-06', 'خدمات الإغاثة الكاثوليكية (CRS)', null),
  ('donor', 'D-07', 'القنصلية الأمريكية', null),
  ('organization', 'O-01', 'مركز القطان', null),
  ('organization', 'O-02', 'مديرية التربية والتعليم', null),
  ('period', 'T-2024', 'السنة المالية 2024', null),
  ('period', 'T-2025', 'السنة المالية 2025', null),
  ('period', 'T-2026', 'السنة المالية 2026', null);

update public.archive_entities set start_date = make_date(substr(code, 3)::int, 1, 1), end_date = make_date(substr(code, 3)::int, 12, 31)
  where entity_type = 'period';

insert into public.archive_counters (scope, year, last_seq) values
  ('entity:program', 0, 4), ('entity:donor', 0, 7), ('entity:organization', 0, 2);

-- ----------------------------------------------------------------------------
-- 5. Documents, immutable versions, typed links
-- ----------------------------------------------------------------------------
create table public.archive_documents (
  id                   uuid primary key default gen_random_uuid(),
  archive_number       text not null unique,
  category_code        text not null references public.archive_categories(code),
  doc_type             text not null references public.archive_doc_types(code),
  title                text not null,
  title_en             text,
  document_date        date not null,
  source               text not null,
  responsible          text not null,
  record_status        text not null check (record_status in ('original','modified_copy','draft','final')),
  sensitivity          smallint not null check (sensitivity between 0 and 3),
  language             text not null check (language in ('ar','en','ar_en')),
  keywords             text,
  budget_line          text,
  offer_provider_type  text check (offer_provider_type in ('individual','organization','group')),
  is_unpublished       boolean not null default false,
  current_version      int not null default 1,
  link_status          text not null default 'incomplete' check (link_status in ('complete','incomplete')),
  missing_links        jsonb not null default '[]'::jsonb,
  created_by           uuid not null references public.profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  search_text          text generated always as (
    archive_number || ' ' || title || ' ' || coalesce(title_en, '') || ' ' ||
    coalesce(keywords, '') || ' ' || source || ' ' || responsible
  ) stored
);

create index idx_archive_documents_category on public.archive_documents(category_code);
create index idx_archive_documents_date on public.archive_documents(document_date);
create index idx_archive_documents_created_by on public.archive_documents(created_by);
create index idx_archive_documents_search on public.archive_documents using gin (search_text gin_trgm_ops);

create table public.archive_document_versions (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.archive_documents(id),
  version_no     int not null,
  storage_path   text not null unique,
  file_name      text not null,
  mime_type      text,
  file_size      bigint not null,
  sha256         text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  change_reason  text,
  uploaded_by    uuid not null references public.profiles(id),
  uploaded_at    timestamptz not null default now(),
  unique (document_id, version_no),
  check (version_no = 1 or nullif(btrim(change_reason), '') is not null)
);

create table public.archive_links (
  id                  uuid primary key default gen_random_uuid(),
  document_id         uuid not null references public.archive_documents(id),
  link_type           text not null check (link_type in
                        ('belongs_to','proves','based_on','results_from','supersedes',
                         'responds_to','published_in','requires_consent')),
  target_entity_id    uuid references public.archive_entities(id),
  target_document_id  uuid references public.archive_documents(id),
  note                text,
  created_by          uuid not null references public.profiles(id),
  created_at          timestamptz not null default now(),
  check ((target_entity_id is null) <> (target_document_id is null)),
  check (target_document_id is null or target_document_id <> document_id)
);

create unique index idx_archive_links_unique
  on public.archive_links (document_id, link_type, coalesce(target_entity_id, target_document_id));
create index idx_archive_links_entity on public.archive_links(target_entity_id);
create index idx_archive_links_target_doc on public.archive_links(target_document_id);

-- ----------------------------------------------------------------------------
-- 6. Named / temporary grants, access log
-- ----------------------------------------------------------------------------
create table public.archive_grants (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles(id),
  designation      text not null check (designation in
                     ('protection_coordinator','external_auditor','hr_officer',
                      'communications_officer','named_access')),
  category_prefix  text references public.archive_categories(code),   -- null = every category
  document_id      uuid references public.archive_documents(id),       -- or one document
  max_sensitivity  smallint not null check (max_sensitivity between 0 and 3),
  can_insert       boolean not null default false,
  valid_from       timestamptz not null default now(),
  valid_until      timestamptz,
  reason           text not null,
  granted_by       uuid not null references public.profiles(id),
  created_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  revoked_by       uuid references public.profiles(id),
  check (category_prefix is null or document_id is null),
  check (valid_until is null or valid_until > valid_from)
);

create index idx_archive_grants_profile on public.archive_grants(profile_id);

create table public.archive_access_log (
  id           bigint generated always as identity primary key,
  document_id  uuid not null references public.archive_documents(id),
  version_no   int,
  actor_id     uuid references public.profiles(id),
  action       text not null check (action in ('view','download','export','public_download')),
  created_at   timestamptz not null default now()
);

create index idx_archive_access_log_document on public.archive_access_log(document_id, created_at desc);
create index idx_archive_access_log_actor on public.archive_access_log(actor_id, created_at desc);

-- Change history of archive records. Kept apart from the general audit_log
-- because its snapshots carry titles of restricted records, which the
-- technical administrator must not read (المبدأ السادس).
create table public.archive_audit (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles(id),
  action       text not null,
  object_type  text not null,
  object_id    uuid,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index idx_archive_audit_object on public.archive_audit(object_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 7. Access helpers
-- ----------------------------------------------------------------------------
create or replace function public.archive_pad(n int, width int)
returns text language sql immutable as $$
  select case when length(n::text) >= width then n::text else lpad(n::text, width, '0') end
$$;

create or replace function public.archive_next_seq(p_scope text, p_year int)
returns int language sql volatile security definer set search_path = public as $$
  insert into public.archive_counters as c (scope, year, last_seq) values (p_scope, p_year, 1)
  on conflict (scope, year) do update set last_seq = c.last_seq + 1
  returning last_seq
$$;

-- The caller's role as the archive matrix sees it (null = no active account).
create or replace function public.archive_effective_role()
returns text language sql stable security definer set search_path = public as $$
  select case when p.role in ('facilitator', 'coordinator') then 'staff' else p.role::text end
  from public.profiles p
  where p.id = auth.uid() and p.is_active
$$;

create or replace function public.archive_category_matches(p_category text, p_prefix text)
returns boolean language sql immutable as $$
  select p_prefix = '*' or p_category = p_prefix or p_category like p_prefix || '.%'
$$;

create or replace function public.archive_matrix_lookup(p_role text, p_category text)
returns public.archive_role_matrix language sql stable security definer set search_path = public as $$
  select m.*
  from public.archive_role_matrix m
  join public.archive_categories c on c.code = p_category
  where m.role = p_role
    and (m.scope_code = c.axis_code or public.archive_category_matches(p_category, m.scope_code))
  order by case when m.scope_code = c.axis_code then 0 else length(m.scope_code) end desc
  limit 1
$$;

-- "نطاقه": the document is linked to a project the user is a member of, or to
-- an entity (activity, case, event…) whose parent is such a project.
create or replace function public.archive_doc_in_scope(p_doc_id uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.archive_links l
    join public.archive_entities e on e.id = l.target_entity_id
    join public.archive_project_members m
      on m.profile_id = p_uid
     and m.project_id = case when e.entity_type = 'project' then e.id else e.parent_id end
    where l.document_id = p_doc_id
  )
$$;

create or replace function public.archive_grant_allows(
  p_uid uuid, p_doc_id uuid, p_category text, p_sensitivity smallint, p_for_insert boolean default false
) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.archive_grants g
    where g.profile_id = p_uid
      and g.revoked_at is null
      and g.valid_from <= now()
      and (g.valid_until is null or g.valid_until > now())
      and g.max_sensitivity >= p_sensitivity
      and (not p_for_insert or g.can_insert)
      and (
        (g.document_id is not null and g.document_id = p_doc_id)
        or (g.document_id is null
            and (g.category_prefix is null or public.archive_category_matches(p_category, g.category_prefix)))
      )
  )
$$;

-- Content access: may this user open the file?
create or replace function public.archive_can_read(
  p_doc_id uuid, p_category text, p_sensitivity smallint, p_created_by uuid, p_status text
) returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
  m      public.archive_role_matrix;
begin
  -- S0: public. Anonymous visitors only see records that are not drafts.
  if p_sensitivity = 0 and (v_uid is not null or p_status <> 'draft') then
    return true;
  end if;
  if v_uid is null then
    return false;
  end if;
  v_role := public.archive_effective_role();
  if v_role is null then
    return false;
  end if;
  if p_created_by = v_uid then
    return true;
  end if;
  if public.archive_grant_allows(v_uid, p_doc_id, p_category, p_sensitivity) then
    return true;
  end if;
  -- «ملفه الشخصي فقط في 05»: a person's own HR records (not recruitment
  -- files or grievances, which also hold other people's data).
  if p_category like '05.%' and p_category not in ('05.02', '05.08') and exists (
    select 1 from public.archive_links l
    join public.archive_entities e on e.id = l.target_entity_id
    where l.document_id = p_doc_id and e.entity_type = 'person' and e.profile_id = v_uid
  ) then
    return true;
  end if;
  m := public.archive_matrix_lookup(v_role, p_category);
  if m.role is null then
    return false;
  end if;
  if p_sensitivity <= m.read_max then
    return true;
  end if;
  if p_sensitivity <= m.read_max_in_scope and public.archive_doc_in_scope(p_doc_id, v_uid) then
    return true;
  end if;
  return false;
end
$$;

-- Row visibility: content readers, plus the archivist, who manages
-- classification and metadata without opening restricted content (المبدأ السادس).
create or replace function public.archive_can_see(
  p_doc_id uuid, p_category text, p_sensitivity smallint, p_created_by uuid, p_status text
) returns boolean language sql stable security definer set search_path = public as $$
  select public.archive_can_read(p_doc_id, p_category, p_sensitivity, p_created_by, p_status)
      or (auth.uid() is not null and public.archive_effective_role() = 'archivist')
$$;

create or replace function public.archive_can_see_doc(p_doc_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select public.archive_can_see(d.id, d.category_code, d.sensitivity, d.created_by, d.record_status)
    from public.archive_documents d where d.id = p_doc_id
  ), false)
$$;

create or replace function public.archive_can_read_doc(p_doc_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select public.archive_can_read(d.id, d.category_code, d.sensitivity, d.created_by, d.record_status)
    from public.archive_documents d where d.id = p_doc_id
  ), false)
$$;

create or replace function public.archive_can_insert(p_category text, p_sensitivity smallint, p_in_scope boolean)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_role text := public.archive_effective_role();
  m      public.archive_role_matrix;
begin
  if v_role is null then
    return false;
  end if;
  if public.archive_grant_allows(auth.uid(), null, p_category, p_sensitivity, true) then
    return true;
  end if;
  m := public.archive_matrix_lookup(v_role, p_category);
  if m.role is null or not m.can_insert then
    return false;
  end if;
  return not m.insert_own_scope_only or p_in_scope;
end
$$;

-- External accounts see the registry minus people, beneficiary codes, events
-- and decisions; internal accounts see the whole registry.
create or replace function public.archive_can_see_entity(p_type text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.archive_effective_role() is null then false
    when public.archive_effective_role() in ('donor', 'volunteer', 'auditor')
      then p_type in ('program','project','donor','organization','period','activity','procurement_case')
    else true
  end
$$;

-- Leaf categories the caller may file into, for the intake form.
create or replace function public.archive_my_insert_categories()
returns table (code text, own_scope_only boolean)
language sql stable security definer set search_path = public as $$
  select c.code,
         not public.archive_grant_allows(auth.uid(), null, c.code, 0::smallint, true)
           and coalesce((public.archive_matrix_lookup(public.archive_effective_role(), c.code)).insert_own_scope_only, false)
  from public.archive_categories c
  where c.level > 1
    and not exists (select 1 from public.archive_categories k where k.parent_code = c.code)
    and public.archive_effective_role() is not null
    and (public.archive_grant_allows(auth.uid(), null, c.code, 0::smallint, true)
         or coalesce((public.archive_matrix_lookup(public.archive_effective_role(), c.code)).can_insert, false))
  order by c.code
$$;

-- «إحصاء لا أسماء»: evidence packs report how many records exist in a
-- category (e.g. signed consent forms) without revealing any of them.
create or replace function public.archive_count_documents(p_prefixes text[])
returns int language sql stable security definer set search_path = public as $$
  select case
    when public.archive_effective_role() is null
      or public.archive_effective_role() in ('donor', 'volunteer', 'auditor') then null
    else (select count(*)::int from public.archive_documents d
          where exists (select 1 from unnest(p_prefixes) x where public.archive_category_matches(d.category_code, x)))
  end
$$;

create or replace function public.archive_can_read_access_log()
returns boolean language sql stable security definer set search_path = public as $$
  select public.archive_effective_role() = 'archivist'
      or public.archive_grant_allows(auth.uid(), null, '16.02', 3::smallint)
$$;

-- ----------------------------------------------------------------------------
-- 8. Link completeness (الباب 7)
-- ----------------------------------------------------------------------------
create or replace function public.archive_refresh_link_status(p_doc_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_doc     public.archive_documents;
  v_missing jsonb := '[]'::jsonb;
  r         record;
  v_ok      boolean;
begin
  select * into v_doc from public.archive_documents where id = p_doc_id;
  if not found then
    return;
  end if;

  for r in
    select * from public.archive_link_rules
    where doc_type = v_doc.doc_type and not is_optional
    order by sort
  loop
    v_ok := r.alt_flag = 'unpublished' and v_doc.is_unpublished;

    if not v_ok and cardinality(r.entity_types) > 0 then
      v_ok := exists (
        select 1 from public.archive_links l
        join public.archive_entities e on e.id = l.target_entity_id
        where l.document_id = p_doc_id and e.entity_type = any (r.entity_types)
      );
    end if;

    -- A link between two documents counts for both of them, so the invoice
    -- and the voucher that paid it complete each other with a single link.
    if not v_ok and cardinality(r.categories) > 0 then
      v_ok := exists (
        select 1 from public.archive_links l
        join public.archive_documents o
          on o.id = case when l.document_id = p_doc_id then l.target_document_id else l.document_id end
        where l.target_document_id is not null
          and (l.document_id = p_doc_id or l.target_document_id = p_doc_id)
          and exists (select 1 from unnest(r.categories) c where public.archive_category_matches(o.category_code, c))
      );
    end if;

    if not v_ok then
      v_missing := v_missing || jsonb_build_object('key', r.req_key, 'label', r.label_ar, 'stage', r.stage);
    end if;
  end loop;

  update public.archive_documents
  set link_status = case when jsonb_array_length(v_missing) = 0 then 'complete' else 'incomplete' end,
      missing_links = v_missing
  where id = p_doc_id;
end
$$;

create or replace function public.archive_links_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.archive_refresh_link_status(old.document_id);
    if old.target_document_id is not null then
      perform public.archive_refresh_link_status(old.target_document_id);
    end if;
    return old;
  end if;
  perform public.archive_refresh_link_status(new.document_id);
  if new.target_document_id is not null then
    perform public.archive_refresh_link_status(new.target_document_id);
  end if;
  return new;
end
$$;

create trigger archive_links_after_change
  after insert or delete on public.archive_links
  for each row execute function public.archive_links_after_change();

-- ----------------------------------------------------------------------------
-- 9. Integrity guards: no one erases a record, a version, or an access trace
-- ----------------------------------------------------------------------------
create or replace function public.archive_block_change()
returns trigger language plpgsql as $$
begin
  raise exception 'السجل محمي من التعديل والحذف (%)', tg_table_name;
end
$$;

create trigger archive_versions_immutable
  before update or delete on public.archive_document_versions
  for each row execute function public.archive_block_change();
create trigger archive_versions_no_truncate
  before truncate on public.archive_document_versions
  for each statement execute function public.archive_block_change();

create trigger archive_access_log_immutable
  before update or delete on public.archive_access_log
  for each row execute function public.archive_block_change();
create trigger archive_access_log_no_truncate
  before truncate on public.archive_access_log
  for each statement execute function public.archive_block_change();

create trigger archive_documents_no_delete
  before delete on public.archive_documents
  for each row execute function public.archive_block_change();
create trigger archive_documents_no_truncate
  before truncate on public.archive_documents
  for each statement execute function public.archive_block_change();

create trigger archive_audit_immutable
  before update or delete on public.archive_audit
  for each row execute function public.archive_block_change();
create trigger archive_audit_no_truncate
  before truncate on public.archive_audit
  for each statement execute function public.archive_block_change();

create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function public.archive_block_change();
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.archive_block_change();

create or replace function public.archive_documents_guard()
returns trigger language plpgsql as $$
begin
  if new.archive_number is distinct from old.archive_number
     or new.category_code is distinct from old.category_code
     or new.doc_type is distinct from old.doc_type
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'رقم الأرشفة والتصنيف ونوع المستند ومُدخِله ثابتة لا تتغير';
  end if;
  if new.sensitivity < old.sensitivity then
    raise exception 'لا يمكن خفض درجة الحساسية';
  end if;
  return new;
end
$$;

create trigger archive_documents_guard
  before update on public.archive_documents
  for each row execute function public.archive_documents_guard();

-- Role and activation changes decide who sees what, so they are audited.
create or replace function public.audit_profile_access_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'profile.access_change', 'profile', new.id,
            jsonb_build_object('old_role', old.role, 'new_role', new.role,
                               'old_active', old.is_active, 'new_active', new.is_active));
  end if;
  return new;
end
$$;

create trigger audit_profile_access_change
  after update on public.profiles
  for each row execute function public.audit_profile_access_change();

-- ----------------------------------------------------------------------------
-- 10. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.archive_axes enable row level security;
alter table public.archive_categories enable row level security;
alter table public.archive_doc_types enable row level security;
alter table public.archive_link_rules enable row level security;
alter table public.archive_role_matrix enable row level security;
alter table public.archive_counters enable row level security;
alter table public.archive_entities enable row level security;
alter table public.archive_project_members enable row level security;
alter table public.archive_documents enable row level security;
alter table public.archive_document_versions enable row level security;
alter table public.archive_links enable row level security;
alter table public.archive_grants enable row level security;
alter table public.archive_access_log enable row level security;
alter table public.archive_audit enable row level security;

-- The classification scheme itself is public reference material.
create policy archive_axes_read on public.archive_axes for select using (true);
create policy archive_categories_read on public.archive_categories for select using (true);
create policy archive_doc_types_read on public.archive_doc_types for select using (true);
create policy archive_link_rules_read on public.archive_link_rules for select using (true);
create policy archive_role_matrix_read on public.archive_role_matrix for select using (auth.uid() is not null);

create policy archive_entities_read on public.archive_entities
  for select using (public.archive_can_see_entity(entity_type));

create policy archive_project_members_read on public.archive_project_members
  for select using (
    profile_id = auth.uid()
    or public.archive_effective_role() not in ('donor', 'volunteer', 'auditor')
  );

create policy archive_documents_read on public.archive_documents
  for select using (public.archive_can_see(id, category_code, sensitivity, created_by, record_status));

create policy archive_versions_read on public.archive_document_versions
  for select using (public.archive_can_see_doc(document_id));

create policy archive_links_read on public.archive_links
  for select using (
    public.archive_can_see_doc(document_id)
    and (target_document_id is null or public.archive_can_see_doc(target_document_id))
    and (target_entity_id is null or exists (
      select 1 from public.archive_entities e
      where e.id = target_entity_id and public.archive_can_see_entity(e.entity_type)))
  );

create policy archive_grants_read on public.archive_grants
  for select using (
    profile_id = auth.uid()
    or public.archive_effective_role() in ('executive_director', 'archivist')
  );

create policy archive_access_log_read on public.archive_access_log
  for select using (public.archive_can_read_access_log());

create policy archive_audit_read on public.archive_audit
  for select using (public.archive_can_read_access_log());

-- No direct writes at all: everything below goes through the procedures.
revoke insert, update, delete, truncate on
  public.archive_axes, public.archive_categories, public.archive_doc_types,
  public.archive_link_rules, public.archive_role_matrix, public.archive_counters,
  public.archive_entities, public.archive_project_members, public.archive_documents,
  public.archive_document_versions, public.archive_links, public.archive_grants,
  public.archive_access_log, public.archive_audit
from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11. Procedures (all writes)
-- ----------------------------------------------------------------------------
create or replace function public.archive_audit(p_action text, p_object_type text, p_object_id uuid, p_meta jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.archive_audit (actor_id, action, object_type, object_id, metadata)
  values (auth.uid(), p_action, p_object_type, p_object_id, coalesce(p_meta, '{}'::jsonb))
$$;

create or replace function public.archive_require_role(p_allowed text[])
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_role text := public.archive_effective_role();
begin
  if v_role is null then
    raise exception 'يجب تسجيل الدخول بحساب فعّال';
  end if;
  if not (v_role = any (p_allowed)) then
    raise exception 'لا تملك صلاحية تنفيذ هذا الإجراء';
  end if;
  return v_role;
end
$$;

-- ---- entities -------------------------------------------------------------------
create or replace function public.archive_create_entity(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_type    text := p->>'entity_type';
  v_role    text;
  v_parent  public.archive_entities;
  v_year    int;
  v_code    text;
  v_id      uuid;
  v_name    text := nullif(btrim(p->>'name'), '');
  v_prefix  text;
  v_width   int;
begin
  v_role := public.archive_require_role(case v_type
    when 'program'          then array['executive_director','archivist']
    when 'project'          then array['executive_director','project_manager','archivist']
    when 'donor'            then array['executive_director','project_manager','accountant','archivist']
    when 'organization'     then array['executive_director','project_manager','accountant','archivist']
    when 'person'           then array['executive_director','archivist']
    when 'beneficiary'      then array['executive_director','project_manager','staff','volunteer','archivist']
    when 'activity'         then array['executive_director','project_manager','staff','volunteer','archivist']
    when 'event'            then array['executive_director','project_manager','staff','archivist']
    when 'period'           then array['executive_director','accountant','archivist']
    when 'decision'         then array['executive_director','archivist']
    when 'procurement_case' then array['executive_director','project_manager','accountant','archivist']
    else array[]::text[] end);

  if v_type = 'beneficiary' then
    v_name := null;
  elsif v_type = 'period' then
    v_name := coalesce(v_name, 'السنة المالية ' || (p->>'year'));
  elsif v_name is null then
    raise exception 'الاسم إلزامي';
  end if;

  if nullif(p->>'parent_id', '') is not null then
    select * into v_parent from public.archive_entities where id = (p->>'parent_id')::uuid;
    if not found then
      raise exception 'الكيان الأب غير موجود';
    end if;
    if v_type = 'project' and v_parent.entity_type <> 'program' then
      raise exception 'المشروع يتبع برنامجاً';
    end if;
    if v_type in ('activity', 'procurement_case', 'event') and v_parent.entity_type <> 'project' then
      raise exception 'هذا الكيان يتبع مشروعاً';
    end if;
  end if;

  if v_type = 'person' and nullif(p->>'profile_id', '') is not null and exists (
    select 1 from public.archive_entities where profile_id = (p->>'profile_id')::uuid
  ) then
    raise exception 'هذا الحساب مربوط ببطاقة شخص موجودة';
  end if;

  if v_type = 'period' then
    v_year := (p->>'year')::int;
    if v_year is null or v_year < 1994 or v_year > 2100 then
      raise exception 'السنة غير صحيحة';
    end if;
    v_code := 'T-' || v_year;
    if exists (select 1 from public.archive_entities where code = v_code) then
      raise exception 'الفترة % موجودة مسبقاً', v_code;
    end if;
  else
    select pre, w into v_prefix, v_width from (values
      ('program','PG-',1), ('project','P-',3), ('donor','D-',2), ('organization','O-',2),
      ('person','E-',3), ('beneficiary','B-',4), ('activity','A-',4), ('event','X-',3),
      ('decision','R-',3), ('procurement_case','C-',3)) as t(typ, pre, w)
    where typ = v_type;
    v_code := v_prefix || public.archive_pad(public.archive_next_seq('entity:' || v_type, 0), v_width);
  end if;

  insert into public.archive_entities
    (entity_type, code, name, description, parent_id, profile_id, start_date, end_date, created_by)
  values (
    v_type, v_code, v_name, nullif(btrim(p->>'description'), ''),
    nullif(p->>'parent_id', '')::uuid,
    case when v_type = 'person' then nullif(p->>'profile_id', '')::uuid end,
    coalesce(nullif(p->>'start_date', '')::date, case when v_type = 'period' then make_date(v_year, 1, 1) end),
    coalesce(nullif(p->>'end_date', '')::date, case when v_type = 'period' then make_date(v_year, 12, 31) end),
    auth.uid()
  )
  returning id into v_id;

  -- A project manager who opens a project manages it.
  if v_type = 'project' and v_role = 'project_manager' then
    insert into public.archive_project_members (project_id, profile_id, member_role, added_by)
    values (v_id, auth.uid(), 'manager', auth.uid());
  end if;

  perform public.archive_audit('archive.entity.create', 'archive_entity', v_id,
    jsonb_build_object('code', v_code, 'type', v_type));
  return jsonb_build_object('id', v_id, 'code', v_code);
end
$$;

create or replace function public.archive_update_entity(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old public.archive_entities;
  v_role text := public.archive_effective_role();
begin
  select * into v_old from public.archive_entities where id = p_id;
  if not found then
    raise exception 'الكيان غير موجود';
  end if;
  if v_role is null or not (v_role in ('executive_director', 'archivist') or v_old.created_by = auth.uid()) then
    raise exception 'لا تملك صلاحية تعديل هذا الكيان';
  end if;

  update public.archive_entities set
    name        = case when entity_type = 'beneficiary' then null
                       else coalesce(nullif(btrim(p->>'name'), ''), name) end,
    description = case when p ? 'description' then nullif(btrim(p->>'description'), '') else description end,
    start_date  = case when p ? 'start_date' then nullif(p->>'start_date', '')::date else start_date end,
    end_date    = case when p ? 'end_date' then nullif(p->>'end_date', '')::date else end_date end,
    is_active   = coalesce((p->>'is_active')::boolean, is_active),
    updated_at  = now()
  where id = p_id;

  perform public.archive_audit('archive.entity.update', 'archive_entity', p_id,
    jsonb_build_object('code', v_old.code, 'before', to_jsonb(v_old), 'changes', p));
end
$$;

create or replace function public.archive_can_manage_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.archive_effective_role() in ('executive_director', 'archivist')
      or exists (select 1 from public.archive_project_members m
                 where m.project_id = p_project_id and m.profile_id = auth.uid() and m.member_role = 'manager')
$$;

create or replace function public.archive_set_project_member(p_project_id uuid, p_profile_id uuid, p_member_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.archive_entities where id = p_project_id and entity_type = 'project') then
    raise exception 'المشروع غير موجود';
  end if;
  if not public.archive_can_manage_project(p_project_id) then
    raise exception 'لا تملك صلاحية إدارة أعضاء هذا المشروع';
  end if;
  if p_member_role not in ('manager', 'member', 'donor') then
    raise exception 'دور العضو غير صحيح';
  end if;
  insert into public.archive_project_members (project_id, profile_id, member_role, added_by)
  values (p_project_id, p_profile_id, p_member_role, auth.uid())
  on conflict (project_id, profile_id) do update set member_role = excluded.member_role;
  perform public.archive_audit('archive.project.member_set', 'archive_entity', p_project_id,
    jsonb_build_object('profile_id', p_profile_id, 'member_role', p_member_role));
end
$$;

create or replace function public.archive_remove_project_member(p_project_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.archive_can_manage_project(p_project_id) then
    raise exception 'لا تملك صلاحية إدارة أعضاء هذا المشروع';
  end if;
  delete from public.archive_project_members where project_id = p_project_id and profile_id = p_profile_id;
  perform public.archive_audit('archive.project.member_remove', 'archive_entity', p_project_id,
    jsonb_build_object('profile_id', p_profile_id));
end
$$;

-- ---- documents ------------------------------------------------------------------
create or replace function public.archive_validate_link(p_link jsonb)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  v_entity uuid := nullif(p_link->>'target_entity_id', '')::uuid;
  v_doc    uuid := nullif(p_link->>'target_document_id', '')::uuid;
begin
  if coalesce(p_link->>'link_type', '') not in
     ('belongs_to','proves','based_on','results_from','supersedes','responds_to','published_in','requires_consent') then
    raise exception 'نوع رابط غير معروف';
  end if;
  if (v_entity is null) = (v_doc is null) then
    raise exception 'كل رابط يشير إلى كيان واحد أو مستند واحد';
  end if;
  if v_entity is not null and not exists (
    select 1 from public.archive_entities e where e.id = v_entity and public.archive_can_see_entity(e.entity_type)
  ) then
    raise exception 'الكيان المرتبط غير موجود';
  end if;
  if v_doc is not null and not public.archive_can_see_doc(v_doc) then
    raise exception 'المستند المرتبط غير موجود أو لا تملك صلاحية رؤيته';
  end if;
end
$$;

create or replace function public.archive_create_document(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid         uuid := auth.uid();
  v_role        text := public.archive_effective_role();
  v_cat         public.archive_categories;
  v_type        public.archive_doc_types;
  v_sens        smallint;
  v_date        date;
  v_links       jsonb := coalesce(p->'links', '[]'::jsonb);
  v_link        jsonb;
  v_entity_ids  uuid[] := '{}';
  v_doc_ids     uuid[] := '{}';
  v_in_scope    boolean;
  v_missing     text[] := '{}';
  v_unpublished boolean := coalesce((p->>'is_unpublished')::boolean, false);
  v_responsible text := btrim(coalesce(p->>'responsible', ''));
  r             record;
  v_ok          boolean;
  v_number      text;
  v_id          uuid;
begin
  if v_uid is null or v_role is null then
    raise exception 'يجب تسجيل الدخول بحساب فعّال';
  end if;

  select * into v_type from public.archive_doc_types where code = p->>'doc_type';
  if not found then
    raise exception 'نوع المستند غير معروف';
  end if;
  select * into v_cat from public.archive_categories where code = p->>'category_code';
  if not found then
    raise exception 'التصنيف غير معروف';
  end if;
  if v_cat.level = 1 or exists (select 1 from public.archive_categories c where c.parent_code = v_cat.code) then
    raise exception 'اختر تصنيفاً فرعياً نهائياً: لا يُحفظ مستند في محور أو في تصنيف له فروع';
  end if;
  if v_type.fixed_category is not null and v_type.fixed_category <> v_cat.code then
    raise exception 'الموضع الأصلي لـ«%» هو %', v_type.name_ar, v_type.fixed_category;
  end if;
  if v_cat.exclusive_doc_type is not null and v_cat.exclusive_doc_type <> v_type.code then
    raise exception 'التصنيف % مخصص لنوع واحد من المستندات', v_cat.code;
  end if;

  v_sens := (p->>'sensitivity')::smallint;
  if v_sens is null or v_sens < v_cat.default_sensitivity or v_sens > 3 then
    raise exception 'درجة الحساسية لا تقل عن درجة التصنيف الافتراضية (S%)', v_cat.default_sensitivity;
  end if;

  -- نموذج الوصف الإلزامي (الباب 10)
  if nullif(btrim(p->>'title'), '') is null then
    raise exception 'العنوان إلزامي';
  end if;
  if nullif(btrim(p->>'source'), '') is null then
    raise exception 'المصدر إلزامي';
  end if;
  if v_responsible = '' or v_responsible in ('الإدارة', 'الادارة', 'إدارة', 'ادارة') then
    raise exception 'المسؤول عن المستند إلزامي: شخص أو وحدة محددة، لا «الإدارة» عموماً';
  end if;
  v_date := nullif(p->>'document_date', '')::date;
  if v_date is null or v_date > current_date + 1 then
    raise exception 'تاريخ المستند إلزامي ولا يكون في المستقبل';
  end if;
  if coalesce(p->>'record_status', '') not in ('original', 'modified_copy', 'draft', 'final') then
    raise exception 'حالة المستند غير صحيحة';
  end if;
  if coalesce(p->>'language', '') not in ('ar', 'en', 'ar_en') then
    raise exception 'لغة المستند غير صحيحة';
  end if;
  if v_type.code = 'payment_voucher' and nullif(btrim(p->>'budget_line'), '') is null then
    raise exception 'بند الموازنة إلزامي لسند الصرف';
  end if;
  if v_type.code = 'offer' and coalesce(p->>'offer_provider_type', '') not in ('individual', 'organization', 'group') then
    raise exception 'حدد مقدّم العرض: فرد، أو منظمة/شركة، أو مجموعة';
  end if;

  -- The file must sit in the caller's own upload folder and must not already
  -- belong to another record (prevents claiming someone else's file).
  if coalesce(p->>'sha256', '') !~ '^[0-9a-f]{64}$'
     or coalesce(p->>'storage_path', '') not like v_uid::text || '/%'
     or coalesce((p->>'file_size')::bigint, 0) <= 0 then
    raise exception 'الملف غير صالح';
  end if;

  for v_link in select * from jsonb_array_elements(v_links) loop
    perform public.archive_validate_link(v_link);
    if nullif(v_link->>'target_entity_id', '') is not null then
      v_entity_ids := v_entity_ids || (v_link->>'target_entity_id')::uuid;
    else
      v_doc_ids := v_doc_ids || (v_link->>'target_document_id')::uuid;
    end if;
  end loop;

  for r in
    select * from public.archive_link_rules
    where doc_type = v_type.code and stage = 'intake' and not is_optional
    order by sort
  loop
    v_ok := (r.alt_flag = 'unpublished' and v_unpublished)
      or exists (select 1 from public.archive_entities e
                 where e.id = any (v_entity_ids) and e.entity_type = any (r.entity_types))
      or exists (select 1 from public.archive_documents o
                 where o.id = any (v_doc_ids)
                   and exists (select 1 from unnest(r.categories) c where public.archive_category_matches(o.category_code, c)));
    if not v_ok then
      v_missing := v_missing || r.label_ar;
    end if;
  end loop;
  if cardinality(v_missing) > 0 then
    raise exception 'روابط إلزامية ناقصة: %', array_to_string(v_missing, '، ');
  end if;

  v_in_scope := exists (
    select 1 from public.archive_entities e
    join public.archive_project_members m
      on m.profile_id = v_uid
     and m.project_id = case when e.entity_type = 'project' then e.id else e.parent_id end
    where e.id = any (v_entity_ids)
  );
  if not public.archive_can_insert(v_cat.code, v_sens, v_in_scope) then
    raise exception 'لا تملك صلاحية الإدراج في التصنيف % (أو أن المستند خارج نطاق مشاريعك)', v_cat.code;
  end if;

  v_number := 'BSCA-' || v_cat.code || '-' || extract(year from v_date)::int || '-'
           || public.archive_pad(public.archive_next_seq(v_cat.code, extract(year from v_date)::int), 4);

  insert into public.archive_documents (
    archive_number, category_code, doc_type, title, title_en, document_date, source, responsible,
    record_status, sensitivity, language, keywords, budget_line, offer_provider_type, is_unpublished, created_by
  ) values (
    v_number, v_cat.code, v_type.code, btrim(p->>'title'), nullif(btrim(p->>'title_en'), ''), v_date,
    btrim(p->>'source'), v_responsible, p->>'record_status', v_sens, p->>'language',
    nullif(btrim(p->>'keywords'), ''), nullif(btrim(p->>'budget_line'), ''),
    nullif(p->>'offer_provider_type', ''), v_unpublished, v_uid
  )
  returning id into v_id;

  insert into public.archive_document_versions
    (document_id, version_no, storage_path, file_name, mime_type, file_size, sha256, uploaded_by)
  values (v_id, 1, p->>'storage_path', coalesce(nullif(btrim(p->>'file_name'), ''), 'file'),
          nullif(p->>'mime_type', ''), (p->>'file_size')::bigint, p->>'sha256', v_uid);

  insert into public.archive_links (document_id, link_type, target_entity_id, target_document_id, created_by)
  select v_id, l->>'link_type', nullif(l->>'target_entity_id', '')::uuid, nullif(l->>'target_document_id', '')::uuid, v_uid
  from jsonb_array_elements(v_links) l
  on conflict do nothing;

  perform public.archive_refresh_link_status(v_id);
  perform public.archive_audit('archive.document.create', 'archive_document', v_id,
    jsonb_build_object('archive_number', v_number, 'category', v_cat.code, 'sensitivity', v_sens, 'sha256', p->>'sha256'));

  return jsonb_build_object('id', v_id, 'archive_number', v_number);
end
$$;

create or replace function public.archive_can_edit_doc(p_doc public.archive_documents)
returns boolean language sql stable security definer set search_path = public as $$
  select p_doc.created_by = auth.uid()
      or public.archive_effective_role() = 'archivist'
      or (public.archive_can_see(p_doc.id, p_doc.category_code, p_doc.sensitivity, p_doc.created_by, p_doc.record_status)
          and public.archive_can_insert(p_doc.category_code, p_doc.sensitivity,
                                        public.archive_doc_in_scope(p_doc.id, auth.uid())))
$$;

create or replace function public.archive_add_version(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_doc  public.archive_documents;
  v_next int;
begin
  select * into v_doc from public.archive_documents where id = (p->>'document_id')::uuid for update;
  if not found or not public.archive_can_read_doc(v_doc.id) then
    raise exception 'المستند غير موجود أو لا تملك صلاحية فتحه';
  end if;
  if not (v_doc.created_by = v_uid
          or public.archive_can_insert(v_doc.category_code, v_doc.sensitivity, public.archive_doc_in_scope(v_doc.id, v_uid))) then
    raise exception 'لا تملك صلاحية إضافة إصدار لهذا المستند';
  end if;
  if nullif(btrim(p->>'change_reason'), '') is null then
    raise exception 'سبب التعديل إلزامي لكل إصدار جديد';
  end if;
  if coalesce(p->>'sha256', '') !~ '^[0-9a-f]{64}$'
     or coalesce(p->>'storage_path', '') not like v_uid::text || '/%'
     or coalesce((p->>'file_size')::bigint, 0) <= 0 then
    raise exception 'الملف غير صالح';
  end if;

  v_next := v_doc.current_version + 1;
  insert into public.archive_document_versions
    (document_id, version_no, storage_path, file_name, mime_type, file_size, sha256, change_reason, uploaded_by)
  values (v_doc.id, v_next, p->>'storage_path', coalesce(nullif(btrim(p->>'file_name'), ''), 'file'),
          nullif(p->>'mime_type', ''), (p->>'file_size')::bigint, p->>'sha256', btrim(p->>'change_reason'), v_uid);

  update public.archive_documents
  set current_version = v_next,
      record_status = coalesce(nullif(p->>'record_status', ''), 'modified_copy'),
      updated_at = now()
  where id = v_doc.id;

  perform public.archive_audit('archive.document.version', 'archive_document', v_doc.id,
    jsonb_build_object('archive_number', v_doc.archive_number, 'version', v_next,
                       'sha256', p->>'sha256', 'reason', p->>'change_reason'));
  return jsonb_build_object('version_no', v_next);
end
$$;

create or replace function public.archive_update_document(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_doc public.archive_documents;
  v_responsible text;
begin
  select * into v_doc from public.archive_documents where id = p_id for update;
  if not found or not public.archive_can_see_doc(p_id) then
    raise exception 'المستند غير موجود';
  end if;
  if not public.archive_can_edit_doc(v_doc) then
    raise exception 'لا تملك صلاحية تعديل بيانات هذا المستند';
  end if;
  v_responsible := btrim(coalesce(p->>'responsible', v_doc.responsible));
  if v_responsible in ('', 'الإدارة', 'الادارة', 'إدارة', 'ادارة') then
    raise exception 'المسؤول عن المستند: شخص أو وحدة محددة، لا «الإدارة» عموماً';
  end if;
  if p ? 'record_status' and p->>'record_status' not in ('original', 'modified_copy', 'draft', 'final') then
    raise exception 'حالة المستند غير صحيحة';
  end if;
  if p ? 'language' and p->>'language' not in ('ar', 'en', 'ar_en') then
    raise exception 'لغة المستند غير صحيحة';
  end if;

  update public.archive_documents set
    title          = coalesce(nullif(btrim(p->>'title'), ''), title),
    title_en       = case when p ? 'title_en' then nullif(btrim(p->>'title_en'), '') else title_en end,
    source         = coalesce(nullif(btrim(p->>'source'), ''), source),
    responsible    = v_responsible,
    record_status  = coalesce(nullif(p->>'record_status', ''), record_status),
    language       = coalesce(nullif(p->>'language', ''), language),
    keywords       = case when p ? 'keywords' then nullif(btrim(p->>'keywords'), '') else keywords end,
    budget_line    = case when p ? 'budget_line' then nullif(btrim(p->>'budget_line'), '') else budget_line end,
    sensitivity    = coalesce((p->>'sensitivity')::smallint, sensitivity),
    is_unpublished = coalesce((p->>'is_unpublished')::boolean, is_unpublished),
    updated_at     = now()
  where id = p_id;

  perform public.archive_refresh_link_status(p_id);
  perform public.archive_audit('archive.document.update', 'archive_document', p_id,
    jsonb_build_object('archive_number', v_doc.archive_number,
                       'before', to_jsonb(v_doc) - 'search_text' - 'missing_links', 'changes', p));
end
$$;

create or replace function public.archive_add_link(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_doc public.archive_documents;
  v_id  uuid;
begin
  select * into v_doc from public.archive_documents where id = (p->>'document_id')::uuid;
  if not found or not public.archive_can_see_doc(v_doc.id) then
    raise exception 'المستند غير موجود';
  end if;
  if not public.archive_can_edit_doc(v_doc) then
    raise exception 'لا تملك صلاحية ربط هذا المستند';
  end if;
  perform public.archive_validate_link(p);

  insert into public.archive_links (document_id, link_type, target_entity_id, target_document_id, note, created_by)
  values (v_doc.id, p->>'link_type', nullif(p->>'target_entity_id', '')::uuid,
          nullif(p->>'target_document_id', '')::uuid, nullif(btrim(p->>'note'), ''), auth.uid())
  on conflict do nothing
  returning id into v_id;

  perform public.archive_audit('archive.link.add', 'archive_document', v_doc.id,
    jsonb_build_object('archive_number', v_doc.archive_number, 'link', p));
  return v_id;
end
$$;

create or replace function public.archive_remove_link(p_link_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_link public.archive_links;
begin
  select * into v_link from public.archive_links where id = p_link_id;
  if not found or not public.archive_can_see_doc(v_link.document_id) then
    raise exception 'الرابط غير موجود';
  end if;
  if not (v_link.created_by = auth.uid() or public.archive_effective_role() = 'archivist') then
    raise exception 'يحذف الرابطَ من أنشأه أو مسؤول الأرشيف فقط';
  end if;
  delete from public.archive_links where id = p_link_id;
  perform public.archive_audit('archive.link.remove', 'archive_document', v_link.document_id, to_jsonb(v_link));
end
$$;

-- ---- access log ---------------------------------------------------------------------
-- Returns whether the caller may perform the action; logs it when allowed.
create or replace function public.archive_log_access(p_document_id uuid, p_version_no int, p_action text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_action not in ('view', 'download') then
    return false;
  end if;
  if p_action = 'download' and not public.archive_can_read_doc(p_document_id) then
    return false;
  end if;
  if p_action = 'view' and not public.archive_can_see_doc(p_document_id) then
    return false;
  end if;
  insert into public.archive_access_log (document_id, version_no, actor_id, action)
  values (p_document_id, p_version_no, auth.uid(), p_action);
  return true;
end
$$;

create or replace function public.archive_log_export(p_document_ids uuid[])
returns void language sql security definer set search_path = public as $$
  insert into public.archive_access_log (document_id, actor_id, action)
  select d, auth.uid(), 'export' from unnest(p_document_ids) d
  where auth.uid() is not null and public.archive_can_see_doc(d)
$$;

-- ---- grants (executive director only) --------------------------------------------
create or replace function public.archive_create_grant(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  perform public.archive_require_role(array['executive_director']);
  if nullif(btrim(p->>'reason'), '') is null then
    raise exception 'سبب التفويض إلزامي';
  end if;
  if (p->>'profile_id')::uuid = auth.uid() then
    raise exception 'لا يمنح أحد نفسه تفويضاً';
  end if;
  insert into public.archive_grants
    (profile_id, designation, category_prefix, document_id, max_sensitivity, can_insert, valid_until, reason, granted_by)
  values (
    (p->>'profile_id')::uuid, p->>'designation', nullif(p->>'category_prefix', ''),
    nullif(p->>'document_id', '')::uuid, (p->>'max_sensitivity')::smallint,
    coalesce((p->>'can_insert')::boolean, false), nullif(p->>'valid_until', '')::timestamptz,
    btrim(p->>'reason'), auth.uid()
  )
  returning id into v_id;
  perform public.archive_audit('archive.grant.create', 'archive_grant', v_id, p);
  return v_id;
end
$$;

create or replace function public.archive_revoke_grant(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.archive_require_role(array['executive_director']);
  update public.archive_grants set revoked_at = now(), revoked_by = auth.uid()
  where id = p_id and revoked_at is null;
  perform public.archive_audit('archive.grant.revoke', 'archive_grant', p_id, '{}'::jsonb);
end
$$;

-- Procedures are for signed-in users only.
do $$
declare
  f text;
begin
  foreach f in array array[
    'archive_create_entity(jsonb)', 'archive_update_entity(uuid, jsonb)',
    'archive_set_project_member(uuid, uuid, text)', 'archive_remove_project_member(uuid, uuid)',
    'archive_create_document(jsonb)', 'archive_add_version(jsonb)', 'archive_update_document(uuid, jsonb)',
    'archive_add_link(jsonb)', 'archive_remove_link(uuid)', 'archive_log_access(uuid, int, text)',
    'archive_log_export(uuid[])', 'archive_create_grant(jsonb)', 'archive_revoke_grant(uuid)',
    'archive_refresh_link_status(uuid)', 'archive_next_seq(text, int)', 'archive_audit(text, text, uuid, jsonb)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

revoke execute on function public.archive_refresh_link_status(uuid) from authenticated;
revoke execute on function public.archive_next_seq(text, int) from authenticated;
revoke execute on function public.archive_audit(text, text, uuid, jsonb) from authenticated;

-- ----------------------------------------------------------------------------
-- 12. Storage: private bucket, no user policies — the app hands out short
--     signed links only after checking and logging access.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('archive', 'archive', false, 52428800)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 13. The new external roles do not get the legacy shared file center.
-- ----------------------------------------------------------------------------
drop policy if exists files_read_all on public.files;
create policy files_read_all on public.files
  for select using (auth.uid() is not null and public.current_user_role() not in ('auditor', 'volunteer'));

drop policy if exists "org-files read (authenticated)" on storage.objects;
create policy "org-files read (authenticated)" on storage.objects
  for select using (
    bucket_id = 'org-files' and auth.uid() is not null
    and public.current_user_role() not in ('auditor', 'volunteer')
  );
