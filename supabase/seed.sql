-- Seed: BSE Odisha Class 9 curriculum aligned to the official 2025-26 syllabus
-- and the Madhyamik Bijaganit / Bhugola O Arthaniti textbooks.
-- Run via `supabase db push` after 0001/0002/0003.

-- =============================================================================
-- SUBJECTS (per BSE 2025-26 syllabus document)
-- =============================================================================
insert into subjects (code, name_en, name_or, name_hi, class_level) values
  ('FLO', 'First Language (Odia)',       'ପ୍ରଥମ ଭାଷା (ଓଡ଼ିଆ)',    'प्रथम भाषा (ओड़िया)', 9),
  ('SLE', 'Second Language (English)',   'ଦ୍ୱିତୀୟ ଭାଷା (ଇଂରାଜୀ)', 'द्वितीय भाषा (अंग्रेज़ी)', 9),
  ('TLH', 'Third Language (Hindi)',      'ତୃତୀୟ ଭାଷା (ହିନ୍ଦୀ)',   'तृतीय भाषा (हिन्दी)', 9),
  ('MTH', 'Mathematics',                 'ଗଣିତ',                 'गणित', 9),
  ('GSC', 'General Science',             'ସାଧାରଣ ବିଜ୍ଞାନ',        'सामान्य विज्ञान', 9),
  ('SSC', 'Social Science',              'ସାମାଜିକ ବିଜ୍ଞାନ',        'सामाजिक विज्ञान', 9)
on conflict (code) do nothing;

-- =============================================================================
-- MATHEMATICS — from Madhyamik Bijaganit (Class 9, BSE Odisha)
-- Exactly the 8 chapters from the textbook TOC.
-- =============================================================================
with s as (select id from subjects where code='MTH')
insert into chapters (subject_id, order_index, title_en, title_or, title_hi, est_hours)
select s.id, ord, en, orx, hi, hrs from s,
  (values
    (1, 'Set Operations and Applications',   'ସେଟ୍ ପ୍ରକ୍ରିୟା ଏବଂ ସେଟ୍ ର ପ୍ରୟୋଗ',      'समुच्चय संक्रियाएँ', 10.0),
    (2, 'Real Numbers',                      'ବାସ୍ତବ ସଂଖ୍ୟା',                       'वास्तविक संख्याएँ', 12.0),
    (3, 'Algebraic Expressions and Identities', 'ବୀଜଗାଣିତିକ ପରିପ୍ରକାଶ ଓ ଅଭେଦ',       'बीजगणितीय व्यंजक', 12.0),
    (4, 'Algebraic Equations',               'ବୀଜଗାଣିତିକ ସମୀକରଣ',                  'बीजगणितीय समीकरण', 10.0),
    (5, 'Coordinate Geometry',               'ସ୍ଥାନାଙ୍କ ଜ୍ୟାମିତି',                  'निर्देशांक ज्यामिति', 8.0),
    (6, 'Ratio and Proportion',              'ଅନୁପାତ ଓ ସମାନୁପାତ',                  'अनुपात और समानुपात', 8.0),
    (7, 'Statistics',                        'ପରିସଂଖ୍ୟାନ',                         'सांख्यिकी', 8.0),
    (8, 'Probability',                       'ସମ୍ଭାବ୍ୟତା',                         'प्रायिकता', 6.0)
  ) v(ord, en, orx, hi, hrs)
on conflict do nothing;

-- Math Ch 1: Set Operations and Applications — topics from textbook sections
with ch as (
  select c.id from chapters c join subjects s on s.id=c.subject_id
  where s.code='MTH' and c.order_index=1
)
insert into topics (chapter_id, order_index, title_en, title_or, title_hi, learning_objectives, approx_duration_min)
select ch.id, ord, en, orx, hi, obj::jsonb, dur from ch,
  (values
    (1, 'Sets and their elements',           'ସେଟ୍ ଓ ଏହାର ଉପାଦାନ',          'समुच्चय और उसके तत्व',
        '["Define a set","List elements using roster method","Describe sets using set-builder notation"]', 40),
    (2, 'Universal Set and Subsets',         'ବ୍ୟାପକ ସେଟ୍ ଓ ଉପସେଟ୍',        'सार्वत्रिक और उप-समुच्चय',
        '["Identify the universal set","Determine subsets","Draw Venn diagrams"]', 40),
    (3, 'Set Operations (Union, Intersection, Difference)', 'ସେଟ୍ ପ୍ରକ୍ରିୟା', 'समुच्चय संक्रियाएँ',
        '["Find union, intersection and difference of sets","Apply commutative and associative laws"]', 50),
    (4, 'Complement and De Morgan laws',     'ପରିପୂରକ ଏବଂ ଡି ମର୍ଗାନ ନିୟମ',  'पूरक और डी मॉर्गन के नियम',
        '["Compute complement of a set","State and verify De Morgan laws"]', 45),
    (5, 'Cartesian Product',                 'କାର୍ଟେଜିଆନ ଗୁଣନଫଳ',           'कार्तीय गुणनफल',
        '["Define ordered pair","Compute A x B","Apply in counting problems"]', 45)
  ) v(ord, en, orx, hi, obj, dur)
on conflict do nothing;

-- Math Ch 2: Real Numbers
with ch as (
  select c.id from chapters c join subjects s on s.id=c.subject_id
  where s.code='MTH' and c.order_index=2
)
insert into topics (chapter_id, order_index, title_en, title_or, title_hi, learning_objectives, approx_duration_min)
select ch.id, ord, en, orx, hi, obj::jsonb, dur from ch,
  (values
    (1, 'Natural numbers, Integers, Rational numbers', 'ସ୍ୱାଭାବିକ, ପୂର୍ଣ୍ଣ, ପରିମେୟ ସଂଖ୍ୟା', 'प्राकृत, पूर्ण, परिमेय संख्याएँ',
        '["Distinguish N, Z, Q","Show Q is closed under four operations","Represent rationals on number line"]', 50),
    (2, 'Irrational Numbers',                'ଅପରିମେୟ ସଂଖ୍ୟା',               'अपरिमेय संख्याएँ',
        '["Prove sqrt(2) is irrational","Identify non-terminating non-recurring decimals","Locate sqrt(2), sqrt(3) on number line"]', 50),
    (3, 'Real Numbers and their properties', 'ବାସ୍ତବ ସଂଖ୍ୟା ଓ ଧର୍ମ',          'वास्तविक संख्याएँ',
        '["List field axioms","Apply order properties","Use triangle inequality with absolute value"]', 45),
    (4, 'Laws of Exponents and Surds',       'ଘାତାଙ୍କ ନିୟମ',                'घातांक और करणी',
        '["Apply laws of exponents for rational powers","Rationalise denominators","Simplify surds"]', 50)
  ) v(ord, en, orx, hi, obj, dur)
on conflict do nothing;

-- Math Ch 3: Algebraic Expressions and Identities
with ch as (
  select c.id from chapters c join subjects s on s.id=c.subject_id
  where s.code='MTH' and c.order_index=3
)
insert into topics (chapter_id, order_index, title_en, title_or, title_hi, learning_objectives, approx_duration_min)
select ch.id, ord, en, orx, hi, obj::jsonb, dur from ch,
  (values
    (1, 'Polynomials: degree and classification', 'ବହୁପଦୀୟ: ଘାତ ଓ ବର୍ଗୀକରଣ',  'बहुपद: घात और वर्गीकरण',
        '["Define polynomial, monomial, binomial","Find degree","Classify polynomials"]', 45),
    (2, 'Operations on polynomials',         'ବହୁପଦୀୟ ଉପରେ ପ୍ରକ୍ରିୟା',       'बहुपदों पर संक्रियाएँ',
        '["Add, subtract, multiply polynomials","Divide using long division"]', 45),
    (3, 'Zeroes of a polynomial',            'ବହୁପଦୀୟର ଶୂନ୍ୟସ୍ଥାନ',         'बहुपद के शून्यक',
        '["Find zeroes","State factor theorem","Use remainder theorem"]', 50),
    (4, 'Algebraic Identities',              'ବୀଜଗାଣିତିକ ଅଭେଦ',              'बीजीय सर्वसमिकाएँ',
        '["Apply (a+-b)^2, (a+-b)^3, a^2-b^2, a^3+-b^3","Factorise using identities"]', 50)
  ) v(ord, en, orx, hi, obj, dur)
on conflict do nothing;

-- Math Ch 4: Algebraic Equations
with ch as (
  select c.id from chapters c join subjects s on s.id=c.subject_id
  where s.code='MTH' and c.order_index=4
)
insert into topics (chapter_id, order_index, title_en, title_or, title_hi, learning_objectives, approx_duration_min)
select ch.id, ord, en, orx, hi, obj::jsonb, dur from ch,
  (values
    (1, 'Linear equations in one variable',  'ଏକ ଚଳକରେ ଏକଘାତୀ ସମୀକରଣ',     'एक चर वाले रैखिक समीकरण',
        '["Solve ax+b=0 type equations","Check consistency","Apply to word problems"]', 45),
    (2, 'Quadratic equations by factorisation', 'ଦ୍ୱିଘାତୀ ସମୀକରଣ (ଗୁଣନୀକରଣ)', 'द्विघात समीकरण (गुणनखंड)',
        '["Recognise quadratic form","Solve by factorisation","Verify roots"]', 50),
    (3, 'Word problems leading to quadratic equations', 'ପାଟୀଗଣିତ ପ୍ରଶ୍ନ', 'शब्द समस्याएँ',
        '["Translate real situations into quadratic equations","Interpret both roots"]', 50),
    (4, 'Exponential equations',             'ଘାତାଙ୍କୀୟ ସମୀକରଣ',             'घातांकी समीकरण',
        '["Equate bases to solve a^x = a^y","Solve equations reducible to quadratic"]', 45)
  ) v(ord, en, orx, hi, obj, dur)
on conflict do nothing;

-- Math Ch 5: Coordinate Geometry
with ch as (
  select c.id from chapters c join subjects s on s.id=c.subject_id
  where s.code='MTH' and c.order_index=5
)
insert into topics (chapter_id, order_index, title_en, title_or, title_hi, learning_objectives, approx_duration_min)
select ch.id, ord, en, orx, hi, obj::jsonb, dur from ch,
  (values
    (1, 'Cartesian coordinate system',       'କାର୍ଟେଜିଆନ ସ୍ଥାନାଙ୍କ ପ୍ରଣାଳୀ', 'कार्तीय निर्देशांक प्रणाली',
        '["Identify axes and quadrants","Plot points","Find coordinates on axes"]', 40),
    (2, 'Equation of a line',                'ସରଳରେଖାର ସମୀକରଣ',              'रेखा का समीकरण',
        '["Write ax+by+c=0 form","Find slope and y-intercept","Sketch lines"]', 50),
    (3, 'Graph of a linear equation in two variables', 'ଦ୍ୱିଚଳ ରୈଖିକ ଗ୍ରାଫ୍', 'दो चरों का ग्राफ़',
        '["Plot line from equation","Find intersections with axes"]', 45)
  ) v(ord, en, orx, hi, obj, dur)
on conflict do nothing;

-- Math Ch 6: Ratio and Proportion
with ch as (
  select c.id from chapters c join subjects s on s.id=c.subject_id
  where s.code='MTH' and c.order_index=6
)
insert into topics (chapter_id, order_index, title_en, title_or, title_hi, learning_objectives, approx_duration_min)
select ch.id, ord, en, orx, hi, obj::jsonb, dur from ch,
  (values
    (1, 'Ratio and its properties',          'ଅନୁପାତ ଏବଂ ଏହାର ଧର୍ମ',         'अनुपात और गुणधर्म',
        '["Define ratio","Apply equivalent ratios","Simplify ratios"]', 40),
    (2, 'Proportion and continued proportion', 'ସମାନୁପାତ ଏବଂ କ୍ରମିକ ସମାନୁପାତ', 'समानुपात',
        '["State proportion properties","Find fourth and mean proportional"]', 45),
    (3, 'Componendo, dividendo and applications', 'ସଂୟୋଗ-ବିଯୋଗ ନିୟମ',        'योग-अंतर नियम',
        '["Apply invertendo, alternendo, componendo, dividendo to solve problems"]', 50)
  ) v(ord, en, orx, hi, obj, dur)
on conflict do nothing;

-- Math Ch 7: Statistics
with ch as (
  select c.id from chapters c join subjects s on s.id=c.subject_id
  where s.code='MTH' and c.order_index=7
)
insert into topics (chapter_id, order_index, title_en, title_or, title_hi, learning_objectives, approx_duration_min)
select ch.id, ord, en, orx, hi, obj::jsonb, dur from ch,
  (values
    (1, 'Data collection and frequency distribution', 'ତଥ୍ୟ ସଂଗ୍ରହ ଓ ପୌନଃପୁନ୍ୟ ବଣ୍ଟନ', 'बारंबारता बंटन',
        '["Collect raw data","Build frequency distribution","Use tally marks"]', 45),
    (2, 'Graphical representation',          'ଆଲେଖିକ ଉପସ୍ଥାପନା',             'आलेखी निरूपण',
        '["Draw histograms","Draw frequency polygon","Draw pie charts"]', 50)
  ) v(ord, en, orx, hi, obj, dur)
on conflict do nothing;

-- Math Ch 8: Probability
with ch as (
  select c.id from chapters c join subjects s on s.id=c.subject_id
  where s.code='MTH' and c.order_index=8
)
insert into topics (chapter_id, order_index, title_en, title_or, title_hi, learning_objectives, approx_duration_min)
select ch.id, ord, en, orx, hi, obj::jsonb, dur from ch,
  (values
    (1, 'Experimental probability',          'ପରୀକ୍ଷାଗତ ସମ୍ଭାବ୍ୟତା',         'प्रायोगिक प्रायिकता',
        '["Understand random experiments","Compute probability from observed data"]', 45),
    (2, 'Events and sample space',           'ଘଟଣା ଓ ନମୁନା ସ୍ପେସ୍',           'घटनाएँ और प्रतिदर्श समष्टि',
        '["Define sample space","List all possible outcomes","Compute P(E)=|E|/|S|"]', 50)
  ) v(ord, en, orx, hi, obj, dur)
on conflict do nothing;

-- =============================================================================
-- SOCIAL SCIENCE — Bhugola O Arthaniti Ch.6 is our first ingested chapter
-- =============================================================================
with s as (select id from subjects where code='SSC')
insert into chapters (subject_id, order_index, title_en, title_or, title_hi, est_hours)
select s.id, ord, en, orx, hi, hrs from s,
  (values
    (1, 'History: Milestones in World History', 'ବିଶ୍ୱର ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ଘଟଣା', 'विश्व इतिहास की घटनाएँ', 8.0),
    (2, 'Polity: Fundamental Rights and Duties', 'ମୌଳିକ ଅଧିକାର ଓ କର୍ତ୍ତବ୍ୟ',  'मौलिक अधिकार और कर्तव्य', 6.0),
    (3, 'Geography: India',                  'ଭାରତ',                         'भारत', 8.0),
    (4, 'Economics: Economic Development',   'ଅର୍ଥନୈତିକ ବିକାଶ',                'आर्थिक विकास', 6.0),
    (5, 'Climate of India',                  'ଭାରତର ଜଳବାୟୁ',                 'भारत की जलवायु', 6.0),
    (6, 'Human-made Disasters and Management','ମାନବୀୟ ବିପତ୍ତି ଓ ପରିଚାଳନା',    'मानव-जनित आपदा', 6.0),
    (7, 'Indian Rivers',                     'ଭାରତର ନଦୀ',                    'भारतीय नदियाँ', 6.0),
    (8, 'Money, Banking and Insurance',      'ମୁଦ୍ରା, ବ୍ୟାଙ୍କିଙ୍ଗ ଓ ବୀମା',     'मुद्रा, बैंकिंग और बीमा', 6.0)
  ) v(ord, en, orx, hi, hrs)
on conflict do nothing;

with ch as (
  select c.id from chapters c join subjects s on s.id=c.subject_id
  where s.code='SSC' and c.order_index=6
)
insert into topics (chapter_id, order_index, title_en, title_or, title_hi, learning_objectives, approx_duration_min)
select ch.id, ord, en, orx, hi, obj::jsonb, dur from ch,
  (values
    (1, 'Road Accidents',                    'ସଡ଼କ ଦୁର୍ଘଟଣା',                'सड़क दुर्घटना',
        '["List causes of road accidents in India","Suggest preventive measures","Understand traffic rules"]', 45),
    (2, 'Rail Accidents',                    'ରେଳ ଦୁର୍ଘଟଣା',                 'रेल दुर्घटना',
        '["Identify major causes of rail mishaps","List rail safety measures","Adopt safe travel practices"]', 40),
    (3, 'Boat Accidents',                    'ନୌକା ଦୁର୍ଘଟଣା',                'नौका दुर्घटना',
        '["Recognise causes of boat capsizes","Understand life-jacket importance","Follow weather advisories"]', 40),
    (4, 'Fire Accidents (Agnikanda)',        'ଅଗ୍ନିକାଣ୍ଡ',                   'अग्निकांड',
        '["Identify fire causes","Use fire extinguishers","Plan emergency exits"]', 45),
    (5, 'Mine Disasters',                    'ଖଣି ବିପତ୍ତି',                   'खान दुर्घटना',
        '["Understand occupational hazards in mining","List health and safety measures"]', 45)
  ) v(ord, en, orx, hi, obj, dur)
on conflict do nothing;
