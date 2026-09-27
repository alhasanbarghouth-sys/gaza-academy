-- ============================================================================
-- Seed the camps master list with Basma's real operating sites.
--
-- Source: Basma's own official CP AoR 5Ws Tracker submissions (79 sites,
-- decimal GPS coordinates, this is the authoritative data — it's literally
-- what Basma already reports to the Child Protection cluster every month)
-- plus 6 additional sites from the HI/Enable project camps list that don't
-- exactly match a tracker site name.
--
-- Note: a few tracker entries look like the same physical site under
-- slightly different spellings (e.g. "مخيمات أنصار 15" / "مخيمات انصار15" /
-- "انصار 15" / "مخيم انصار  ١٥"). They're kept as separate rows here rather
-- than silently merged — review "إدارة المخيمات" after this runs and delete
-- any you confirm are duplicates of another row.
--
-- Run this after 0001_init.sql and 0002_camps_and_sessions.sql.
-- ============================================================================

insert into public.camps (name, latitude, longitude, notes, is_verified)
values
  ('مخيم أبو خضرة', 31.519664, 34.454824, 'Gaza, Ad Darraj', true),
  ('مخيم اليرموك', 31.522453, 34.458244, 'Gaza, Ad Darraj', true),
  ('مدرسة المستقبل', 31.49924, 34.458046, 'Gaza, Ad Darraj', true),
  ('مخيم الإسراء', 31.49913, 34.458115, 'Gaza, Ad Darraj', true),
  ('ملعب اليرموك', 31.503537, 34.460045, 'Gaza, Ad Darraj', true),
  ('مدرسة فهمي الجرجاوي', 31.499264, 34.458068, 'Gaza, Ad Darraj', true),
  ('مخيم الجواد', NULL, NULL, 'Gaza, Ad Darraj', true),
  ('مدرسة المعتصم', 31.499288, 34.458026, 'Gaza, Ad Darraj', true),
  ('مخيم الجرجاوي', 31.499196, 34.458064, 'Gaza, Ad Darraj', true),
  ('مخيم التربية والتعليم', 31.507811, 34.46207, 'Gaza, Ad Darraj', true),
  ('نقابة المهندسين', 31.530821, 34.468505, 'Gaza, Ad Darraj', true),
  ('مدرسة الفرابي', 31.520164, 34.442416, 'Gaza, Ad Darraj', true),
  ('بلدية غزة', 31.507823, 34.462088, 'Gaza, Ad Darraj', true),
  ('جمعية فرسان فلسطين للاسعاف و الطوارئ', NULL, NULL, 'North Gaza, Al Karameh', true),
  ('نادي النصر العربي', 31.526093, 34.45425, 'Gaza, An Naser-Gaza', true),
  ('مخيم الحرية', 31.526582, 34.454028, 'Gaza, An Naser-Gaza', true),
  ('مخيم أصدقاء القلوب الرحيمة', 31.499212, 34.458027, 'Gaza, At Tuffah', true),
  ('مخيم أهل الخير', 31.503548, 34.460016, 'Gaza, At Tuffah', true),
  ('مخيم العلمي', 31.501378, 34.459004, 'Gaza, At Tuffah', true),
  ('مخيم أنا إنسان', 31.499021, 34.458035, 'Gaza, At Tuffah', true),
  ('مخيم سراح النور', 31.499226, 34.458038, 'Gaza, At Tuffah', true),
  ('مخيم العائدون', 31.507931, 34.462069, 'Gaza, At Tuffah', true),
  ('مخيم التعاون والسلام', 31.499063, 34.458073, 'Gaza, At Tuffah', true),
  ('مخيم الوحيدي', 31.499239, 34.457997, 'Gaza, At Tuffah', true),
  ('مخيم المغاربة', 31.49926, 34.458112, 'Gaza, At Tuffah', true),
  ('مخيم المغربي', 31.499202, 34.458077, 'Gaza, At Tuffah', true),
  ('مخيم السلام', 31.499274, 34.458013, 'Gaza, At Tuffah', true),
  ('مخيم ابو مراحيل', 31.499042, 34.45813, 'Gaza, Az Zaitoun', true),
  ('مدرسة المأمونية أ', 31.522646, 34.45411, 'Gaza, Northern Remal', true),
  ('مدرسة الحسن البصري', 31.522157, 34.442451, 'Gaza, Northern Remal', true),
  ('الشفا الخزندار', 31.522899, 34.444164, 'Gaza, Northern Remal', true),
  ('مدرسة المأمونية ب', 31.523181, 34.45326, 'Gaza, Northern Remal', true),
  ('مخيم سلطة الطاقة', 31.522168, 34.443624, 'Gaza, Northern Remal', true),
  ('مخيم البراق', 31.524729, 34.455948, 'Gaza, Northern Remal', true),
  ('مدرسة الكرمل', 31.520992, 34.442338, 'Gaza, Northern Remal', true),
  ('مخيم الصداقة', 31.52493, 34.452683, 'Gaza, Northern Remal', true),
  ('مخيم صلاح الدين 2', 31.520598, 34.456049, 'Gaza, Northern Remal', true),
  ('مبنى الصم', 31.522813, 34.456418, 'Gaza, Northern Remal', true),
  ('مخيم أرض الاسراء', NULL, NULL, 'Gaza, Northern Remal', true),
  ('مخيم الحياة', 31.523609, 34.454451, 'Gaza, Northern Remal', true),
  ('مدرسة القاهرة', 31.530856, 34.468532, 'Gaza, Northern Remal', true),
  ('ملعب فلسطين', 31.522527, 34.45134, 'Gaza, Northern Remal', true),
  ('مدرسة العائلة المقدسة', 31.524173, 34.451827, 'Gaza, Northern Remal', true),
  ('مخيم الطيب', 31.521275, 34.455437, 'Gaza, Northern Remal', true),
  ('مدرسة فلسطين', 31.530843, 34.468517, 'Gaza, Northern Remal', true),
  ('مخيم صلاح الدين 1', 31.521558, 34.455338, 'Gaza, Northern Remal', true),
  ('الرضوان ٥', 31.518885, 34.427476, 'Gaza, Northern Remal', true),
  ('مخيم بلدنا', 31.53082, 34.468505, 'Gaza, Northern Remal', true),
  ('مخيمات أنصار 15', 31.516046, 34.427728, 'Gaza, Southern Remal', true),
  ('مخيمات الميناء', 31.524016, 34.433454, 'Gaza, Southern Remal', true),
  ('مخيمات انصار15', 31.518859, 34.427509, 'Gaza, Southern Remal', true),
  ('مخيم المدرجات', 31.511921, 34.422261, 'Gaza, Southern Remal', true),
  ('مخيم المشتل الرمال', 31.51603, 34.43921, 'Gaza, Southern Remal', true),
  ('مخيمات الرشيد', 31.519421, 34.433894, 'Gaza, Southern Remal', true),
  ('مركز النور', 31.530751, 34.469365, 'Gaza, Southern Remal', true),
  ('مخيم الانسان', 31.521422, 34.431821, 'Gaza, Southern Remal', true),
  ('مخيم المشتل', NULL, NULL, 'Gaza, Southern Remal', true),
  ('مخيم خير الايادي', NULL, NULL, 'Gaza, Southern Remal', true),
  ('مخيم الرضوان 6', 31.519608, 34.4283, 'Gaza, Southern Remal', true),
  ('مخيم الامل', 31.518867, 34.429772, 'Gaza, Southern Remal', true),
  ('مخيم بغداد', 31.52478, 34.454719, 'Gaza, Southern Remal', true),
  ('مخيم نور الطابون', 31.523437, 34.453849, 'Gaza, Southern Remal', true),
  ('مدرسة الرمال الابتدائية المشتركة', 31.530848, 34.468484, 'Gaza, Southern Remal', true),
  ('مدرسة أحمد شوقي', NULL, NULL, 'Gaza, Southern Remal', true),
  ('مخيم مدينة عرفات', NULL, NULL, 'Gaza, Southern Remal', true),
  ('مخيم خديجة', 31.530821, 34.468505, 'Gaza, Southern Remal', true),
  ('مخيم البيت الصامد', 31.530843, 34.468489, 'Gaza, Southern Remal', true),
  ('مخيم الوليد', 31.502353, 34.452739, 'Gaza, Southern Remal', true),
  ('مخيم الصابرون', 31.518843, 34.427565, 'Gaza, Southern Remal', true),
  ('مخيم غزة العزة', 31.502686, 34.45282, 'Gaza, Southern Remal', true),
  ('مخيم الثقافة', 31.501252, 34.453207, 'Gaza, Southern Remal', true),
  ('انصار 15', 31.519509, 34.428324, 'Gaza, Southern Remal', true),
  ('مدرسة مصطفى حافظ', 31.530661, 34.470248, 'Gaza, Southern Remal', true),
  ('مدرسة الزيتون', 31.502702, 34.452757, 'Gaza, Southern Remal', true),
  ('مخيم الجرمق', 31.51603, 34.43921, 'Gaza, Southern Remal', true),
  ('مخيم التركمان', NULL, NULL, 'Gaza, Southern Remal', true),
  ('مبنى الانقاذ البحري', 31.510704, 34.420528, 'Gaza, Southern Remal', true),
  ('مخيم أرض دحلان', 31.53083, 34.468499, 'Gaza, Southern Remal', true),
  ('مخيم انصار  ١٥', 31.519154, 34.433911, 'Gaza, Tal El Hawa', true),
  ('الرحمة', 31.517306, 34.440583, 'مشروع HI / Enable', true),
  ('اليرموك', 31.515083, 34.456028, 'مشروع HI / Enable', true),
  ('من أجلك يا غزة', 31.51175, 34.436639, 'مشروع HI / Enable', true),
  ('مدرسة شهداء الزيتون', 31.500806, 34.456944, 'مشروع HI / Enable', true),
  ('أنصار', 31.521389, 34.434917, 'مشروع HI / Enable', true),
  ('التعاون', 31.5145, 34.4565, 'مشروع HI / Enable', true)
on conflict (lower(name)) do nothing;
