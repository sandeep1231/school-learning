// Canonical BSE Odisha Class 9 curriculum — used in demo mode when Supabase
// isn't configured, and as the single source of truth for seeding.
// Aligned to the official 2025-26 BSE syllabus + Madhyamik Bijaganit textbook.

export type DemoTopic = {
  id: string;
  subjectCode: string;
  chapterSlug: string;
  chapterTitle: { en: string; or: string; hi: string };
  order: number;
  title: { en: string; or: string; hi: string };
  objectives: string[];
  durationMin: number;
  /** Preview paragraphs used by Learn-stage demo and RAG fallback. */
  excerpt?: { or?: string; en?: string };
  /** Page references in the BSE textbook (or: Odia edition). */
  pageHint?: { or?: string; en?: string };
};

export type DemoSubject = {
  code: string;
  name: { en: string; or: string; hi: string };
  chapters: Array<{
    slug: string;
    order: number;
    title: { en: string; or: string; hi: string };
    topics: DemoTopic[];
  }>;
};

// ----------------------------------------------------------------------------
// MATHEMATICS (MTH) — 8 chapters from Madhyamik Bijaganit
// ----------------------------------------------------------------------------
const MTH: DemoSubject = {
  code: "MTH",
  name: { en: "Mathematics", or: "ଗଣିତ", hi: "गणित" },
  chapters: [
    {
      slug: "mth-ch1-sets",
      order: 1,
      title: {
        en: "Set Operations and Applications",
        or: "ସେଟ୍ ପ୍ରକ୍ରିୟା ଏବଂ ସେଟ୍ ର ପ୍ରୟୋଗ",
        hi: "समुच्चय संक्रियाएँ",
      },
      topics: [
        {
          id: "mth-1-1",
          subjectCode: "MTH",
          chapterSlug: "mth-ch1-sets",
          chapterTitle: {
            en: "Set Operations and Applications",
            or: "ସେଟ୍ ପ୍ରକ୍ରିୟା ଏବଂ ସେଟ୍ ର ପ୍ରୟୋଗ",
            hi: "समुच्चय संक्रियाएँ",
          },
          order: 1,
          title: {
            en: "Sets and their elements",
            or: "ସେଟ୍ ଓ ଏହାର ଉପାଦାନ",
            hi: "समुच्चय और उसके तत्व",
          },
          objectives: [
            "Define a set and its elements",
            "List elements using roster method",
            "Describe sets using set-builder notation",
          ],
          durationMin: 40,
          pageHint: { or: "ଅଧ୍ୟାୟ-୧, ପୃ.୧" },
          excerpt: {
            or:
              "ସେଟ୍ ହେଉଛି କେତେକ ନିର୍ଦ୍ଦିଷ୍ଟ ବସ୍ତୁର ଏକ ସମାବେଶ। ପ୍ରତ୍ୟେକ ବସ୍ତୁକୁ ସେଟ୍ ର ଉପାଦାନ କୁହାଯାଏ। ସେଟ୍ କୁ ପ୍ରକାଶ କରିବା ପାଇଁ ଦୁଇଟି ପ୍ରଣାଳୀ ବ୍ୟବହୃତ ହୁଏ - ତାଲିକା ପ୍ରଣାଳୀ (Roster method) ଏବଂ ସୂତ୍ର ପ୍ରଣାଳୀ (Set-builder method)।",
          },
        },
        {
          id: "mth-1-2",
          subjectCode: "MTH",
          chapterSlug: "mth-ch1-sets",
          chapterTitle: {
            en: "Set Operations and Applications",
            or: "ସେଟ୍ ପ୍ରକ୍ରିୟା ଏବଂ ସେଟ୍ ର ପ୍ରୟୋଗ",
            hi: "समुच्चय संक्रियाएँ",
          },
          order: 2,
          title: {
            en: "Universal Set and Subsets",
            or: "ବ୍ୟାପକ ସେଟ୍ ଓ ଉପସେଟ୍",
            hi: "सार्वत्रिक और उप-समुच्चय",
          },
          objectives: [
            "Identify the universal set",
            "Determine subsets",
            "Draw Venn diagrams",
          ],
          durationMin: 40,
          pageHint: { or: "ଅଧ୍ୟାୟ-୧, ପୃ.୨-୩" },
        },
        {
          id: "mth-1-3",
          subjectCode: "MTH",
          chapterSlug: "mth-ch1-sets",
          chapterTitle: {
            en: "Set Operations and Applications",
            or: "ସେଟ୍ ପ୍ରକ୍ରିୟା ଏବଂ ସେଟ୍ ର ପ୍ରୟୋଗ",
            hi: "समुच्चय संक्रियाएँ",
          },
          order: 3,
          title: {
            en: "Set Operations: Union, Intersection, Difference",
            or: "ସଂଯୋଗ, ଛେଦ ଓ ଅନ୍ତର",
            hi: "योग, सर्वनिष्ठ और अंतर",
          },
          objectives: [
            "Find union (A ∪ B)",
            "Find intersection (A ∩ B)",
            "Apply commutative, associative and distributive laws",
          ],
          durationMin: 50,
          pageHint: { or: "ଅଧ୍ୟାୟ-୧, ପୃ.୩-୭" },
        },
        {
          id: "mth-1-4",
          subjectCode: "MTH",
          chapterSlug: "mth-ch1-sets",
          chapterTitle: {
            en: "Set Operations and Applications",
            or: "ସେଟ୍ ପ୍ରକ୍ରିୟା ଏବଂ ସେଟ୍ ର ପ୍ରୟୋଗ",
            hi: "समुच्चय संक्रियाएँ",
          },
          order: 4,
          title: {
            en: "Complement and De Morgan laws",
            or: "ପରିପୂରକ ଏବଂ ଡି ମର୍ଗାନ ନିୟମ",
            hi: "पूरक और डी मॉर्गन के नियम",
          },
          objectives: [
            "Compute complement of a set",
            "State and verify De Morgan laws",
          ],
          durationMin: 45,
        },
        {
          id: "mth-1-5",
          subjectCode: "MTH",
          chapterSlug: "mth-ch1-sets",
          chapterTitle: {
            en: "Set Operations and Applications",
            or: "ସେଟ୍ ପ୍ରକ୍ରିୟା ଏବଂ ସେଟ୍ ର ପ୍ରୟୋଗ",
            hi: "समुच्चय संक्रियाएँ",
          },
          order: 5,
          title: {
            en: "Cartesian Product",
            or: "କାର୍ଟେଜିଆନ ଗୁଣନଫଳ",
            hi: "कार्तीय गुणनफल",
          },
          objectives: [
            "Define ordered pair",
            "Compute A × B",
            "Apply in counting problems",
          ],
          durationMin: 45,
        },
      ],
    },
    {
      slug: "mth-ch2-reals",
      order: 2,
      title: {
        en: "Real Numbers",
        or: "ବାସ୍ତବ ସଂଖ୍ୟା",
        hi: "वास्तविक संख्याएँ",
      },
      topics: [
        {
          id: "mth-2-1",
          subjectCode: "MTH",
          chapterSlug: "mth-ch2-reals",
          chapterTitle: {
            en: "Real Numbers",
            or: "ବାସ୍ତବ ସଂଖ୍ୟା",
            hi: "वास्तविक संख्याएँ",
          },
          order: 1,
          title: {
            en: "Natural numbers, Integers, Rational numbers",
            or: "ସ୍ୱାଭାବିକ, ପୂର୍ଣ୍ଣ, ପରିମେୟ ସଂଖ୍ୟା",
            hi: "प्राकृत, पूर्ण, परिमेय संख्याएँ",
          },
          objectives: [
            "Distinguish N, Z, Q",
            "Show Q is closed under four operations",
            "Represent rationals on the number line",
          ],
          durationMin: 50,
          pageHint: { or: "ଅଧ୍ୟାୟ-୨, ପୃ.୨୦-୨୫" },
          excerpt: {
            or:
              "ପ୍ରତ୍ୟେକ ସ୍ୱାଭାବିକ ସଂଖ୍ୟା ଓ ପୂର୍ଣ୍ଣ ସଂଖ୍ୟା ଏକ ପରିମେୟ ସଂଖ୍ୟା। ଗୋଟିଏ ପରିମେୟ ସଂଖ୍ୟାର ବ୍ୟାପକ ରୂପ p/q, ଯେଉଁଠାରେ p ଓ q ପୂର୍ଣ୍ଣ ସଂଖ୍ୟା ଏବଂ q ≠ 0।",
          },
        },
        {
          id: "mth-2-2",
          subjectCode: "MTH",
          chapterSlug: "mth-ch2-reals",
          chapterTitle: {
            en: "Real Numbers",
            or: "ବାସ୍ତବ ସଂଖ୍ୟା",
            hi: "वास्तविक संख्याएँ",
          },
          order: 2,
          title: {
            en: "Irrational Numbers",
            or: "ଅପରିମେୟ ସଂଖ୍ୟା",
            hi: "अपरिमेय संख्याएँ",
          },
          objectives: [
            "Prove sqrt(2) is irrational",
            "Identify non-terminating, non-recurring decimals",
            "Locate sqrt(2), sqrt(3) on the number line",
          ],
          durationMin: 50,
        },
        {
          id: "mth-2-3",
          subjectCode: "MTH",
          chapterSlug: "mth-ch2-reals",
          chapterTitle: {
            en: "Real Numbers",
            or: "ବାସ୍ତବ ସଂଖ୍ୟା",
            hi: "वास्तविक संख्याएँ",
          },
          order: 3,
          title: {
            en: "Laws of Exponents and Surds",
            or: "ଘାତାଙ୍କ ନିୟମ",
            hi: "घातांक और करणी",
          },
          objectives: [
            "Apply laws of exponents for rational powers",
            "Rationalise denominators",
            "Simplify surds",
          ],
          durationMin: 50,
        },
      ],
    },
    {
      slug: "mth-ch3-algebra",
      order: 3,
      title: {
        en: "Algebraic Expressions and Identities",
        or: "ବୀଜଗାଣିତିକ ପରିପ୍ରକାଶ ଓ ଅଭେଦ",
        hi: "बीजीय व्यंजक और सर्वसमिकाएँ",
      },
      topics: [
        {
          id: "mth-3-1",
          subjectCode: "MTH",
          chapterSlug: "mth-ch3-algebra",
          chapterTitle: {
            en: "Algebraic Expressions and Identities",
            or: "ବୀଜଗାଣିତିକ ପରିପ୍ରକାଶ ଓ ଅଭେଦ",
            hi: "बीजीय व्यंजक",
          },
          order: 1,
          title: {
            en: "Polynomials: degree and classification",
            or: "ବହୁପଦୀୟ: ଘାତ ଓ ବର୍ଗୀକରଣ",
            hi: "बहुपद: घात और वर्गीकरण",
          },
          objectives: [
            "Define polynomial, monomial, binomial, trinomial",
            "Find the degree",
            "Classify polynomials",
          ],
          durationMin: 45,
        },
        {
          id: "mth-3-2",
          subjectCode: "MTH",
          chapterSlug: "mth-ch3-algebra",
          chapterTitle: {
            en: "Algebraic Expressions and Identities",
            or: "ବୀଜଗାଣିତିକ ପରିପ୍ରକାଶ ଓ ଅଭେଦ",
            hi: "बीजीय व्यंजक",
          },
          order: 2,
          title: {
            en: "Zeroes of a polynomial",
            or: "ବହୁପଦୀୟର ଶୂନ୍ୟସ୍ଥାନ",
            hi: "बहुपद के शून्यक",
          },
          objectives: [
            "Find zeroes of linear and quadratic polynomials",
            "State factor theorem",
            "Use remainder theorem",
          ],
          durationMin: 50,
        },
        {
          id: "mth-3-3",
          subjectCode: "MTH",
          chapterSlug: "mth-ch3-algebra",
          chapterTitle: {
            en: "Algebraic Expressions and Identities",
            or: "ବୀଜଗାଣିତିକ ପରିପ୍ରକାଶ ଓ ଅଭେଦ",
            hi: "बीजीय व्यंजक",
          },
          order: 3,
          title: {
            en: "Algebraic Identities",
            or: "ବୀଜଗାଣିତିକ ଅଭେଦ",
            hi: "बीजीय सर्वसमिकाएँ",
          },
          objectives: [
            "Apply (a+b)^2, (a-b)^2, a^2-b^2",
            "Apply (a+b)^3, (a-b)^3, a^3+b^3, a^3-b^3",
            "Factorise using identities",
          ],
          durationMin: 50,
        },
      ],
    },
    {
      slug: "mth-ch4-equations",
      order: 4,
      title: {
        en: "Algebraic Equations",
        or: "ବୀଜଗାଣିତିକ ସମୀକରଣ",
        hi: "बीजगणितीय समीकरण",
      },
      topics: [
        {
          id: "mth-4-1",
          subjectCode: "MTH",
          chapterSlug: "mth-ch4-equations",
          chapterTitle: {
            en: "Algebraic Equations",
            or: "ବୀଜଗାଣିତିକ ସମୀକରଣ",
            hi: "बीजगणितीय समीकरण",
          },
          order: 1,
          title: {
            en: "Linear equations in one variable",
            or: "ଏକ ଚଳକରେ ଏକଘାତୀ ସମୀକରଣ",
            hi: "एक चर वाले रैखिक समीकरण",
          },
          objectives: [
            "Solve ax+b=0 equations",
            "Check consistency",
            "Apply to word problems",
          ],
          durationMin: 45,
        },
        {
          id: "mth-4-2",
          subjectCode: "MTH",
          chapterSlug: "mth-ch4-equations",
          chapterTitle: {
            en: "Algebraic Equations",
            or: "ବୀଜଗାଣିତିକ ସମୀକରଣ",
            hi: "बीजगणितीय समीकरण",
          },
          order: 2,
          title: {
            en: "Quadratic equations by factorisation",
            or: "ଦ୍ୱିଘାତୀ ସମୀକରଣ (ଗୁଣନୀକରଣ)",
            hi: "द्विघात समीकरण (गुणनखंड)",
          },
          objectives: [
            "Recognise quadratic form",
            "Solve by factorisation",
            "Verify roots",
          ],
          durationMin: 50,
        },
      ],
    },
    {
      slug: "mth-ch5-coord",
      order: 5,
      title: {
        en: "Coordinate Geometry",
        or: "ସ୍ଥାନାଙ୍କ ଜ୍ୟାମିତି",
        hi: "निर्देशांक ज्यामिति",
      },
      topics: [
        {
          id: "mth-5-1",
          subjectCode: "MTH",
          chapterSlug: "mth-ch5-coord",
          chapterTitle: {
            en: "Coordinate Geometry",
            or: "ସ୍ଥାନାଙ୍କ ଜ୍ୟାମିତି",
            hi: "निर्देशांक ज्यामिति",
          },
          order: 1,
          title: {
            en: "Cartesian coordinate system",
            or: "କାର୍ଟେଜିଆନ ସ୍ଥାନାଙ୍କ ପ୍ରଣାଳୀ",
            hi: "कार्तीय निर्देशांक प्रणाली",
          },
          objectives: [
            "Identify the axes and quadrants",
            "Plot points on the plane",
            "Find coordinates on the axes",
          ],
          durationMin: 40,
        },
      ],
    },
    {
      slug: "mth-ch6-ratio",
      order: 6,
      title: {
        en: "Ratio and Proportion",
        or: "ଅନୁପାତ ଓ ସମାନୁପାତ",
        hi: "अनुपात और समानुपात",
      },
      topics: [
        {
          id: "mth-6-1",
          subjectCode: "MTH",
          chapterSlug: "mth-ch6-ratio",
          chapterTitle: {
            en: "Ratio and Proportion",
            or: "ଅନୁପାତ ଓ ସମାନୁପାତ",
            hi: "अनुपात और समानुपात",
          },
          order: 1,
          title: {
            en: "Ratio and its properties",
            or: "ଅନୁପାତ ଏବଂ ଏହାର ଧର୍ମ",
            hi: "अनुपात और गुणधर्म",
          },
          objectives: [
            "Define ratio",
            "Apply equivalent ratios",
            "Simplify ratios",
          ],
          durationMin: 40,
        },
      ],
    },
    {
      slug: "mth-ch7-stats",
      order: 7,
      title: { en: "Statistics", or: "ପରିସଂଖ୍ୟାନ", hi: "सांख्यिकी" },
      topics: [
        {
          id: "mth-7-1",
          subjectCode: "MTH",
          chapterSlug: "mth-ch7-stats",
          chapterTitle: { en: "Statistics", or: "ପରିସଂଖ୍ୟାନ", hi: "सांख्यिकी" },
          order: 1,
          title: {
            en: "Data collection and frequency distribution",
            or: "ତଥ୍ୟ ସଂଗ୍ରହ ଓ ପୌନଃପୁନ୍ୟ ବଣ୍ଟନ",
            hi: "बारंबारता बंटन",
          },
          objectives: [
            "Collect raw data",
            "Build a frequency distribution",
            "Use tally marks",
          ],
          durationMin: 45,
        },
      ],
    },
    {
      slug: "mth-ch8-prob",
      order: 8,
      title: { en: "Probability", or: "ସମ୍ଭାବ୍ୟତା", hi: "प्रायिकता" },
      topics: [
        {
          id: "mth-8-1",
          subjectCode: "MTH",
          chapterSlug: "mth-ch8-prob",
          chapterTitle: { en: "Probability", or: "ସମ୍ଭାବ୍ୟତା", hi: "प्रायिकता" },
          order: 1,
          title: {
            en: "Experimental probability",
            or: "ପରୀକ୍ଷାଗତ ସମ୍ଭାବ୍ୟତା",
            hi: "प्रायोगिक प्रायिकता",
          },
          objectives: [
            "Understand random experiments",
            "Compute probability from observed data",
          ],
          durationMin: 45,
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------------------
// SOCIAL SCIENCE (SSC) — History + Geography + Economics + Disaster Mgmt
// Aligned to BSE Odisha Class 9 2025-26 syllabus (12 chapters).
// ----------------------------------------------------------------------------
const SSC: DemoSubject = {
  code: "SSC",
  name: {
    en: "Social Science",
    or: "ସାମାଜିକ ବିଜ୍ଞାନ",
    hi: "सामाजिक विज्ञान",
  },
  chapters: [
    {
      slug: "ssc-h1-french-revolution",
      order: 1,
      title: {
        en: "French Revolution",
        or: "ଫ୍ରାନ୍ସ ବିପ୍ଲବ",
        hi: "फ्रांस क्रांति",
      },
      topics: [
        {
          id: "ssc-h1-1",
          subjectCode: "SSC",
          chapterSlug: "ssc-h1-french-revolution",
          chapterTitle: {
            en: "French Revolution",
            or: "ଫ୍ରାନ୍ସ ବିପ୍ଲବ",
            hi: "फ्रांस क्रांति",
          },
          order: 1,
          title: {
            en: "Causes of the French Revolution",
            or: "ଫ୍ରାନ୍ସ ବିପ୍ଲବର କାରଣ",
            hi: "फ्रांस क्रांति के कारण",
          },
          objectives: [
            "Identify financial crisis and social inequality as root causes",
            "Explain the role of Enlightenment ideas",
            "Analyse the structure of the Ancien Régime",
          ],
          durationMin: 50,
          pageHint: { or: "ଇତିହାସ, ଅଧ୍ୟାୟ-୧, ପୃ.୧-୪" },
          excerpt: {
            or:
              "୧୭୮୯ ମସିହାରେ ଫ୍ରାନ୍ସରେ ଏକ ମହାନ୍ ବିପ୍ଲବ ଘଟିଥିଲା। ଏହି ବିପ୍ଲବର ମୂଳ କାରଣ ଥିଲା ରାଜକୀୟ ଅସାଧାରଣ ଖର୍ଚ୍ଚ, ସାମାଜିକ ବୈଷମ୍ୟ ଏବଂ ସାଧାରଣ ମଣିଷ୍ଟିର ଦୁଃଖଦଦାୟ ଅବସ୍ଥା।",
          },
        },
        {
          id: "ssc-h1-2",
          subjectCode: "SSC",
          chapterSlug: "ssc-h1-french-revolution",
          chapterTitle: {
            en: "French Revolution",
            or: "ଫ୍ରାନ୍ସ ବିପ୍ଲବ",
            hi: "फ्रांस क्रांति",
          },
          order: 2,
          title: {
            en: "Course of the French Revolution",
            or: "ଫ୍ରାନ୍ସ ବିପ୍ଲବର ଗତି ଓ ପରିଣତି",
            hi: "फ्रांस क्रांति का प्रवाह",
          },
          objectives: [
            "Trace events from 1789 to 1799",
            "Explain the role of the National Assembly and Declaration of Rights",
            "Describe the Reign of Terror",
          ],
          durationMin: 50,
          pageHint: { or: "ଇତିହାସ, ଅଧ୍ୟାୟ-୧, ପୃ.୪-୯" },
        },
        {
          id: "ssc-h1-3",
          subjectCode: "SSC",
          chapterSlug: "ssc-h1-french-revolution",
          chapterTitle: {
            en: "French Revolution",
            or: "ଫ୍ରାନ୍ସ ବିପ୍ଲବ",
            hi: "फ्रांस क्रांति",
          },
          order: 3,
          title: {
            en: "Impact and Legacy of the French Revolution",
            or: "ଫ୍ରାନ୍ସ ବିପ୍ଲବର ପ୍ରଭାବ ଓ ଦୀର୍ଘସ୍ଥାୟୀ ପରିଣତି",
            hi: "फ्रांस क्रांति का प्रभाव",
          },
          objectives: [
            "Examine the ideals of liberty, equality, fraternity",
            "Analyse the emergence of nationalism",
            "Evaluate the impact on Europe and the wider world",
          ],
          durationMin: 45,
          excerpt: {
            en:
              "The French Revolution introduced the ideals of liberty, equality and fraternity that transformed European society. Its principles influenced democratic movements worldwide.",
          },
        },
      ],
    },
    {
      slug: "ssc-h2-russian-revolution",
      order: 2,
      title: {
        en: "Russian Revolution",
        or: "ରୁଷୀୟ ବିପ୍ଲବ",
        hi: "रूसी क्रांति",
      },
      topics: [
        {
          id: "ssc-h2-1",
          subjectCode: "SSC",
          chapterSlug: "ssc-h2-russian-revolution",
          chapterTitle: {
            en: "Russian Revolution",
            or: "ରୁଷୀୟ ବିପ୍ଲବ",
            hi: "रूसी क्रांति",
          },
          order: 1,
          title: {
            en: "Background and the 1917 Revolution",
            or: "ପୃଷ୍ଠଭୂମି ଏବଂ ୧୯୧୭ ସାଲର ବିପ୍ଲବ",
            hi: "पृष्ठभूमि और 1917 क्रांति",
          },
          objectives: [
            "Understand Russian social, economic and political conditions",
            "Trace the events of February and October 1917",
            "Explain Lenin's role and Bolshevik ideology",
          ],
          durationMin: 50,
          pageHint: { or: "ଇତିହାସ, ଅଧ୍ୟାୟ-୨, ପୃ.୧୫-୨୨" },
          excerpt: {
            or:
              "ରୁଷିଆରେ ୧୯୧୭ ମସିହାରେ ଲେନିନ୍‌ଙ୍କ ନେତୃତ୍ୱରେ ବୋଲ୍ଶେଭିକ୍ ବିପ୍ଲବ ଘଟିଥିଲା। ଏହି ବିପ୍ଲବ ବିଶ୍ୱର ପ୍ରଥମ ସମାଜବାଦୀ ରାଷ୍ଟ୍ର ସ୍ଥାପନ କରିଥିଲା।",
          },
        },
        {
          id: "ssc-h2-2",
          subjectCode: "SSC",
          chapterSlug: "ssc-h2-russian-revolution",
          chapterTitle: {
            en: "Russian Revolution",
            or: "ରୁଷୀୟ ବିପ୍ଲବ",
            hi: "रूसी क्रांति",
          },
          order: 2,
          title: {
            en: "Legacy and Impact of the Russian Revolution",
            or: "ରୁଷୀୟ ବିପ୍ଲବର ଦୀର୍ଘସ୍ଥାୟୀ ପରିଣତି",
            hi: "रूसी क्रांति का प्रभाव",
          },
          objectives: [
            "Analyse the formation of the USSR",
            "Evaluate the impact on international politics",
            "Discuss influence on colonial and post-colonial movements",
          ],
          durationMin: 45,
          pageHint: { or: "ଇତିହାସ, ଅଧ୍ୟାୟ-୨, ପୃ.୨୨-୨୬" },
        },
      ],
    },
    {
      slug: "ssc-h3-nazism-germany",
      order: 3,
      title: {
        en: "Nazism and the Rise of Hitler",
        or: "ନାଜିବାଦ ଓ ହିଟ୍‌ଲରଙ୍କ ଉତ୍ଥାନ",
        hi: "नाज़ीवाद और हिटलर का उदय",
      },
      topics: [
        {
          id: "ssc-h3-1",
          subjectCode: "SSC",
          chapterSlug: "ssc-h3-nazism-germany",
          chapterTitle: {
            en: "Nazism and the Rise of Hitler",
            or: "ନାଜିବାଦ ଓ ହିଟ୍‌ଲରଙ୍କ ଉତ୍ଥାନ",
            hi: "नाज़ीवाद और हिटलर का उदय",
          },
          order: 1,
          title: {
            en: "Weimar Republic and Rise of Hitler",
            or: "ଭାଇମାର୍ ଗଣତାନ୍ତ୍ରିକ ରାଷ୍ଟ୍ର ଓ ହିଟ୍‌ଲରଙ୍କ ଉତ୍ଥାନ",
            hi: "वाइमर गणराज्य और हिटलर का उदय",
          },
          objectives: [
            "Describe the formation and weaknesses of the Weimar Republic",
            "Explain the economic crisis and social discontent",
            "Trace Hitler's political ascendancy",
          ],
          durationMin: 50,
          pageHint: { or: "ଇତିହାସ, ଅଧ୍ୟାୟ-୩, ପୃ.୩୫-୪୨" },
        },
        {
          id: "ssc-h3-2",
          subjectCode: "SSC",
          chapterSlug: "ssc-h3-nazism-germany",
          chapterTitle: {
            en: "Nazism and the Rise of Hitler",
            or: "ନାଜିବାଦ ଓ ହିଟ୍‌ଲରଙ୍କ ଉତ୍ଥାନ",
            hi: "नाज़ीवाद और हिटलर का उदय",
          },
          order: 2,
          title: {
            en: "Ideology and Consolidation of Power",
            or: "ଚିନ୍ତାଧାରା ଓ ଶକ୍ତି ଏକତ୍ରୀକରଣ",
            hi: "विचारधारा और शक्ति का समेकन",
          },
          objectives: [
            "Explain Nazi ideology: Aryan supremacy and antisemitism",
            "Describe the methods of totalitarian control",
            "Analyse the role of propaganda and youth organisations",
          ],
          durationMin: 50,
          excerpt: {
            or:
              "ନାଜି ଦଳ ଜାତୀୟତାବାଦ, ସାମ୍ରାଜ୍ୟବାଦ ଓ ଜାତିଗତ ଶ୍ରେଷ୍ଠତ୍ୱର ଧାରଣା ପ୍ରଚାର କରୁଥିଲା। ସେମାନେ ଏକ ସର୍ବାତ୍ମକ ରାଷ୍ଟ୍ର ଗଠନ ଚାହୁଁଥିଲେ।",
          },
        },
        {
          id: "ssc-h3-3",
          subjectCode: "SSC",
          chapterSlug: "ssc-h3-nazism-germany",
          chapterTitle: {
            en: "Nazism and the Rise of Hitler",
            or: "ନାଜିବାଦ ଓ ହିଟ୍‌ଲରଙ୍କ ଉତ୍ଥାନ",
            hi: "नाज़ीवाद और हिटलर का उदय",
          },
          order: 3,
          title: {
            en: "Holocaust and Nazi Crimes Against Humanity",
            or: "ହଲୋକାଷ୍ଟ ଓ ମାନବତାର ବିରୁଦ୍ଧରେ ଅପରାଧ",
            hi: "होलोकॉस्ट और मानवता के विरुद्ध अपराध",
          },
          objectives: [
            "Understand the systematic persecution and genocide of Jews",
            "Examine other victim groups: Roma, disabled, political prisoners",
            "Discuss the moral and historical implications",
          ],
          durationMin: 45,
          pageHint: { or: "ଇତିହାସ, ଅଧ୍ୟାୟ-୩, ପୃ.୪୨-୪୮" },
        },
      ],
    },
    {
      slug: "ssc-h4-forest-society",
      order: 4,
      title: {
        en: "Forest Society and Colonialism",
        or: "ଜଙ୍ଗଲ, ସମାଜ ଓ ଉପନିବେଶବାଦ",
        hi: "वन, समाज और उपनिवेशवाद",
      },
      topics: [
        {
          id: "ssc-h4-1",
          subjectCode: "SSC",
          chapterSlug: "ssc-h4-forest-society",
          chapterTitle: {
            en: "Forest Society and Colonialism",
            or: "ଜଙ୍ଗଲ, ସମାଜ ଓ ଉପନିବେଶବାଦ",
            hi: "वन, समाज और उपनिवेशवाद",
          },
          order: 1,
          title: {
            en: "Deforestation under Colonial Rule",
            or: "ଉପନିବେଶ ଶାସନ ଅଧୀନରେ ଜଙ୍ଗଲ ଧ୍ୱଂସ",
            hi: "औपनिवेशिक शासन में वनों का विनाश",
          },
          objectives: [
            "Understand colonial resource extraction policies",
            "Examine the impact of plantation systems on forests",
            "Analyse the role of the railways in deforestation",
          ],
          durationMin: 45,
          pageHint: { or: "ଇତିହାସ, ଅଧ୍ୟାୟ-୪, ପୃ.୫୨-୫୮" },
          excerpt: {
            or:
              "ଉପନିବେଶ ଶାସକମାନେ ଭାରତର ବିଶାଳ ଜଙ୍ଗଲ ଭୂମି ଆବିଷ୍କାର କରିଥିଲେ। ତେବେ ଲାଭଜନକ ଚାଷାବାଦ ଓ ଲାକଡ଼ି ବାଣିଜ୍ୟ ଲାଗି ସେମାନେ ଏହି ଜଙ୍ଗଲ ଧ୍ୱଂସ କରିଥିଲେ।",
          },
        },
        {
          id: "ssc-h4-2",
          subjectCode: "SSC",
          chapterSlug: "ssc-h4-forest-society",
          chapterTitle: {
            en: "Forest Society and Colonialism",
            or: "ଜଙ୍ଗଲ, ସମାଜ ଓ ଉପନିବେଶବାଦ",
            hi: "वन, समाज और उपनिवेशवाद",
          },
          order: 2,
          title: {
            en: "Forest Rebellions and Resistance",
            or: "ଜଙ୍ଗଲ ବିଦ୍ରୋହ ଓ ପ୍ରତିରୋଧ",
            hi: "वन संग्राम और प्रतिरोध",
          },
          objectives: [
            "Study tribal movements against forest policies",
            "Examine the Bastar and Jharkhand uprisings",
            "Analyse resistance strategies and their outcomes",
          ],
          durationMin: 45,
          pageHint: { or: "ଇତିହାସ, ଅଧ୍ୟାୟ-୪, ପୃ.୫୮-୬୨" },
        },
      ],
    },
    {
      slug: "ssc-h5-pastoralists",
      order: 5,
      title: {
        en: "Pastoralists in the Modern World",
        or: "ଆଧୁନିକ ଯୁଗରେ ପଶୁପାଳକ",
        hi: "आधुनिक विश्व में पशुचारक",
      },
      topics: [
        {
          id: "ssc-h5-1",
          subjectCode: "SSC",
          chapterSlug: "ssc-h5-pastoralists",
          chapterTitle: {
            en: "Pastoralists in the Modern World",
            or: "ଆଧୁନିକ ଯୁଗରେ ପଶୁପାଳକ",
            hi: "आधुनिक विश्व में पशुचारक",
          },
          order: 1,
          title: {
            en: "Pastoral Nomads in India",
            or: "ଭାରତର ଭ୍ରମଣଶୀଳ ପଶୁପାଳକ",
            hi: "भारत में घुमक्कड़ पशुचारक",
          },
          objectives: [
            "Describe lifestyle and economy of pastoral communities",
            "Analyse the impact of colonialism and modern policies",
            "Examine migration patterns and grazing rights",
          ],
          durationMin: 45,
          pageHint: { or: "ଇତିହାସ, ଅଧ୍ୟାୟ-୫, ପୃ.୬୮-୭୪" },
          excerpt: {
            or:
              "ଭାରତର ବିଭିନ୍ନ ଅଞ୍ଚଳରେ ଧନଗର, ଗୁଜ୍ଜର ଓ ଅନ୍ୟାନ୍ୟ ପଶୁପାଳକ ସମ୍ପ୍ରଦାୟ ରହିଛନ୍ତି। ଏମାନେ ମୁଖ୍ୟତଃ ପଶୁ ପାଳନରେ ନିର୍ଭରଶୀଳ।",
          },
        },
        {
          id: "ssc-h5-2",
          subjectCode: "SSC",
          chapterSlug: "ssc-h5-pastoralists",
          chapterTitle: {
            en: "Pastoralists in the Modern World",
            or: "ଆଧୁନିକ ଯୁଗରେ ପଶୁପାଳକ",
            hi: "आधुनिक विश्व में पशुचारक",
          },
          order: 2,
          title: {
            en: "Pastoralism in Africa",
            or: "ଆଫ୍ରିକାରେ ପଶୁପାଳନ",
            hi: "अफ्रीका में पशुचारण",
          },
          objectives: [
            "Study African pastoral economies and societies",
            "Analyse the impact of colonialism and nationalism",
            "Examine contemporary challenges and adaptation",
          ],
          durationMin: 45,
          pageHint: { or: "ଇତିହାସ, ଅଧ୍ୟାୟ-୫, ପୃ.୭୪-୮୦" },
        },
      ],
    },
    {
      slug: "ssc-geo1-india-location",
      order: 6,
      title: {
        en: "India: Size and Location",
        or: "ଭାରତ: ଆକାର ଓ ଅବସ୍ଥିତି",
        hi: "भारत: आकार और अवस्थिति",
      },
      topics: [
        {
          id: "ssc-g1-1",
          subjectCode: "SSC",
          chapterSlug: "ssc-geo1-india-location",
          chapterTitle: {
            en: "India: Size and Location",
            or: "ଭାରତ: ଆକାର ଓ ଅବସ୍ଥିତି",
            hi: "भारत: आकार और अवस्थिति",
          },
          order: 1,
          title: {
            en: "Geographic Extent of India",
            or: "ଭାରତର ଭୌଗୋଳିକ ବ୍ୟାପ୍ତି",
            hi: "भारत का भौगोलिक विस्तार",
          },
          objectives: [
            "Identify India's latitudinal and longitudinal extent",
            "Understand the significance of the Tropic of Cancer",
            "Describe India's land and maritime boundaries",
          ],
          durationMin: 40,
          pageHint: { or: "ଭୂଗୋଳ, ଅଧ୍ୟାୟ-୧, ପୃ.୧-୩" },
          excerpt: {
            or:
              "ଭାରତ ୮°୪' ଉତ୍ତର ଅକ୍ଷାଂଶ ଓ ୩୭°୬' ଉତ୍ତର ଅକ୍ଷାଂଶ ମଧ୍ୟରେ ଅବସ୍ଥିତ। ଏହାର ମୋଟ ପୃଷ୍ଠଭୂମି ଆୟତନ ପ୍ରାୟ ୩.୨୮ ମିଲିୟନ୍ ବର୍ଗ କିଲୋମିଟର।",
          },
        },
        {
          id: "ssc-g1-2",
          subjectCode: "SSC",
          chapterSlug: "ssc-geo1-india-location",
          chapterTitle: {
            en: "India: Size and Location",
            or: "ଭାରତ: ଆକାର ଓ ଅବସ୍ଥିତି",
            hi: "भारत: आकार और अवस्थिति",
          },
          order: 2,
          title: {
            en: "India's Neighbouring Countries",
            or: "ଭାରତର ପଡ଼ୋଶୀ ଦେଶ",
            hi: "भारत के पड़ोसी देश",
          },
          objectives: [
            "List India's land and maritime neighbours",
            "Understand strategic importance of borders",
            "Identify major water bodies around India",
          ],
          durationMin: 40,
          pageHint: { or: "ଭୂଗୋଳ, ଅଧ୍ୟାୟ-୧, ପୃ.୩-୫" },
        },
      ],
    },
    {
      slug: "ssc-geo2-physiography",
      order: 7,
      title: {
        en: "Physical Features of India",
        or: "ଭାରତର ଭୌତିକ ବୈଶିଷ୍ଟ୍ୟ",
        hi: "भारत की भौतिक विशेषताएँ",
      },
      topics: [
        {
          id: "ssc-g2-1",
          subjectCode: "SSC",
          chapterSlug: "ssc-geo2-physiography",
          chapterTitle: {
            en: "Physical Features of India",
            or: "ଭାରତର ଭୌତିକ ବୈଶିଷ୍ଟ୍ୟ",
            hi: "भारत की भौतिक विशेषताएँ",
          },
          order: 1,
          title: {
            en: "The Himalayas",
            or: "ହିମାଳୟ ପର୍ବତମାଳା",
            hi: "हिमालय पर्वत",
          },
          objectives: [
            "Describe the formation and structure of the Himalayas",
            "Classify into Greater, Lesser and Outer Himalayas",
            "Explain their ecological and economic significance",
          ],
          durationMin: 50,
          pageHint: { or: "ଭୂଗୋଳ, ଅଧ୍ୟାୟ-୨, ପୃ.୧୨-୧୫" },
          excerpt: {
            en:
              "The Himalayas are the world's youngest mountain range, formed by tectonic collision. They profoundly influence India's climate and are crucial for water resources.",
          },
        },
        {
          id: "ssc-g2-2",
          subjectCode: "SSC",
          chapterSlug: "ssc-geo2-physiography",
          chapterTitle: {
            en: "Physical Features of India",
            or: "ଭାରତର ଭୌତିକ ବୈଶିଷ୍ଟ୍ୟ",
            hi: "भारत की भौतिक विशेषताएँ",
          },
          order: 2,
          title: {
            en: "Northern Plains and Peninsular Plateau",
            or: "ଉତ୍ତର ସମତଳ ଓ ଦକ୍ଷିଣ ମାଳଭୂମି",
            hi: "उत्तरी मैदान और दक्षिण पठार",
          },
          objectives: [
            "Describe formation of the Indo-Gangetic plain",
            "Explain its significance for agriculture and population",
            "Characterise the Deccan plateau",
          ],
          durationMin: 50,
          pageHint: { or: "ଭୂଗୋଳ, ଅଧ୍ୟାୟ-୨, ପୃ.୧୫-୧୮" },
        },
        {
          id: "ssc-g2-3",
          subjectCode: "SSC",
          chapterSlug: "ssc-geo2-physiography",
          chapterTitle: {
            en: "Physical Features of India",
            or: "ଭାରତର ଭୌତିକ ବୈଶିଷ୍ଟ୍ୟ",
            hi: "भारत की भौतिक विशेषताएँ",
          },
          order: 3,
          title: {
            en: "Coastal Plains and Islands",
            or: "ସମୁଦ୍ରତଟବର୍ତ୍ତୀ ସମତଳ ଓ ଦ୍ୱୀପପୁଞ୍ଜ",
            hi: "तटीय मैदान और द्वीप",
          },
          objectives: [
            "Identify India's coastal regions and features",
            "Describe the Western and Eastern Ghats",
            "Understand the importance of Andaman and Lakshadweep islands",
          ],
          durationMin: 45,
          pageHint: { or: "ଭୂଗୋଳ, ଅଧ୍ୟାୟ-୨, ପୃ.୧୮-୨୦" },
        },
      ],
    },
    {
      slug: "ssc-geo3-drainage",
      order: 8,
      title: {
        en: "Drainage",
        or: "ଜଳନିର୍ଗମ ବ୍ୟବସ୍ଥା",
        hi: "जल निकास व्यवस्था",
      },
      topics: [
        {
          id: "ssc-g3-1",
          subjectCode: "SSC",
          chapterSlug: "ssc-geo3-drainage",
          chapterTitle: {
            en: "Drainage",
            or: "ଜଳନିର୍ଗମ ବ୍ୟବସ୍ଥା",
            hi: "जल निकास व्यवस्था",
          },
          order: 1,
          title: {
            en: "Himalayan River Systems",
            or: "ହିମାଳୟୀୟ ନଦୀ ବ୍ୟବସ୍ଥା",
            hi: "हिमालयी नदी प्रणाली",
          },
          objectives: [
            "Describe major Himalayan rivers: Indus, Ganga, Brahmaputra",
            "Explain their characteristics and courses",
            "Understand their importance for irrigation and power",
          ],
          durationMin: 45,
          pageHint: { or: "ଭୂଗୋଳ, ଅଧ୍ୟାୟ-୩, ପୃ.୨୬-୩୦" },
          excerpt: {
            or:
              "ଭାରତର ବିଶାଳ ଜଳନିର୍ଗମ ବ୍ୟବସ୍ଥା ମୁଖ୍ୟତଃ ଦୁଇଟି ଭାଗରେ ବିଭକ୍ତ — ହିମାଳୟୀୟ ନଦୀ ଏବଂ ଦକ୍ଷିଣ ଭାରତର ନଦୀ। ଏଗୁଡ଼ିକ ଦେଶର ଜୀବନ ରେଖା।",
          },
        },
        {
          id: "ssc-g3-2",
          subjectCode: "SSC",
          chapterSlug: "ssc-geo3-drainage",
          chapterTitle: {
            en: "Drainage",
            or: "ଜଳନିର୍ଗମ ବ୍ୟବସ୍ଥା",
            hi: "जल निकास व्यवस्था",
          },
          order: 2,
          title: {
            en: "Peninsular River Systems",
            or: "ଦକ୍ଷିଣ ଭାରତର ନଦୀ ବ୍ୟବସ୍ଥା",
            hi: "प्रायद्वीपीय नदी प्रणाली",
          },
          objectives: [
            "Identify major peninsular rivers: Godavari, Krishna, Cauvery",
            "Compare characteristics with Himalayan rivers",
            "Analyse their seasonal nature and usage",
          ],
          durationMin: 45,
          pageHint: { or: "ଭୂଗୋଳ, ଅଧ୍ୟାୟ-୩, ପୃ.୩୦-୩୩" },
        },
      ],
    },
    {
      slug: "ssc-geo4-climate",
      order: 9,
      title: {
        en: "Climate of India",
        or: "ଭାରତର ଜଳବାୟୁ",
        hi: "भारत की जलवायु",
      },
      topics: [
        {
          id: "ssc-g4-1",
          subjectCode: "SSC",
          chapterSlug: "ssc-geo4-climate",
          chapterTitle: {
            en: "Climate of India",
            or: "ଭାରତର ଜଳବାୟୁ",
            hi: "भारत की जलवायु",
          },
          order: 1,
          title: {
            en: "Climatic Controls and Types",
            or: "ଜଳବାୟୁ ନିୟନ୍ତ୍ରକ ଓ ପ୍ରକାର",
            hi: "जलवायु नियंत्रक और प्रकार",
          },
          objectives: [
            "Identify factors controlling India's climate",
            "Classify climatic zones",
            "Relate climate to altitude and location",
          ],
          durationMin: 45,
          pageHint: { or: "ଭୂଗୋଳ, ଅଧ୍ୟାୟ-୪, ପୃ.୩୯-୪୨" },
          excerpt: {
            or:
              "ଭାରତର ଜଳବାୟୁ ଉଷ୍ଣ-ମୌସୁମୀ ପ୍ରକାରର। ଏହାର ମୁଖ୍ୟ ନିୟନ୍ତ୍ରକ ଅକ୍ଷାଂଶ, ଉଚ୍ଚତା ଓ ମୌସୁମୀ ପବନ।",
          },
        },
        {
          id: "ssc-g4-2",
          subjectCode: "SSC",
          chapterSlug: "ssc-geo4-climate",
          chapterTitle: {
            en: "Climate of India",
            or: "ଭାରତର ଜଳବାୟୁ",
            hi: "भारत की जलवायु",
          },
          order: 2,
          title: {
            en: "Monsoon and Seasons",
            or: "ମୌସୁମୀ ବାୟୁ ଓ ଋତୁସମୂହ",
            hi: "मानसून और ऋतुएँ",
          },
          objectives: [
            "Explain the mechanism of the monsoon",
            "Describe the four seasons and their characteristics",
            "Understand regional variations in monsoon",
          ],
          durationMin: 45,
          pageHint: { or: "ଭୂଗୋଳ, ଅଧ୍ୟାୟ-୪, ପୃ.୪୨-୪୫" },
        },
      ],
    },
    {
      slug: "ssc-eco1-story-village",
      order: 10,
      title: {
        en: "The Story of Village Palampur",
        or: "ପାଲାମ୍ପୁର ଗାଁର ଗଳ୍ପ",
        hi: "पालमपुर गाँव की कहानी",
      },
      topics: [
        {
          id: "ssc-e1-1",
          subjectCode: "SSC",
          chapterSlug: "ssc-eco1-story-village",
          chapterTitle: {
            en: "The Story of Village Palampur",
            or: "ପାଲାମ୍ପୁର ଗାଁର ଗଳ୍ପ",
            hi: "पालमपुर गाँव की कहानी",
          },
          order: 1,
          title: {
            en: "Factors of Production",
            or: "ଉତ୍ପାଦନର ଉପାଦାନ",
            hi: "उत्पादन के कारक",
          },
          objectives: [
            "Define land, labour, capital and entrepreneurship",
            "Understand their roles in agriculture",
            "Analyse distribution of resources in the village",
          ],
          durationMin: 45,
          pageHint: { or: "ଅର୍ଥନୀତି, ଅଧ୍ୟାୟ-୧, ପୃ.୧-୪" },
          excerpt: {
            or:
              "ଅର୍ଥବ୍ୟବସ୍ଥାରେ ଉତ୍ପାଦନର ଚାରିଟି ମୌଳିକ ଉପାଦାନ ରହିଛି — ଭୂମି, ଶ୍ରମ, ପୁଞ୍ଜି ଓ ଉଦ୍ୟମ। ଏଗୁଡ଼ିକ ଏକତ୍ର ହୋଇ ଯେକୌଣସି ଦ୍ରବ୍ୟ ବା ସେବା ଉତ୍ପାଦନ କରେ।",
          },
        },
        {
          id: "ssc-e1-2",
          subjectCode: "SSC",
          chapterSlug: "ssc-eco1-story-village",
          chapterTitle: {
            en: "The Story of Village Palampur",
            or: "ପାଲାମ୍ପୁର ଗାଁର ଗଳ୍ପ",
            hi: "पालमपुर गाँव की कहानी",
          },
          order: 2,
          title: {
            en: "Farming in Palampur",
            or: "ପାଲାମ୍ପୁରର ଚାଷାବାଦ",
            hi: "पालमपुर में खेती",
          },
          objectives: [
            "Examine modern farming techniques in Palampur",
            "Understand cropping patterns and yields",
            "Analyse impacts of globalisation on traditional farming",
          ],
          durationMin: 45,
          pageHint: { or: "ଅର୍ଥନୀତି, ଅଧ୍ୟାୟ-୧, ପୃ.୪-୮" },
        },
      ],
    },
    {
      slug: "ssc-eco2-people-resource",
      order: 11,
      title: {
        en: "People as Resource",
        or: "ଜନ ସମ୍ପଦ",
        hi: "मानव संसाधन",
      },
      topics: [
        {
          id: "ssc-e2-1",
          subjectCode: "SSC",
          chapterSlug: "ssc-eco2-people-resource",
          chapterTitle: {
            en: "People as Resource",
            or: "ଜନ ସମ୍ପଦ",
            hi: "मानव संसाधन",
          },
          order: 1,
          title: {
            en: "Economic and Non-economic Activities",
            or: "ଅର୍ଥନୈତିକ ଓ ଅଣ-ଅର୍ଥନୈତିକ କାର୍ଯ୍ୟକଳାପ",
            hi: "आर्थिक और गैर-आर्थिक गतिविधियाँ",
          },
          objectives: [
            "Define economic and non-economic activities",
            "Classify occupations and sectors",
            "Understand the role of education and health",
          ],
          durationMin: 45,
          pageHint: { or: "ଅର୍ଥନୀତି, ଅଧ୍ୟାୟ-୨, ପୃ.୧୫-୧୮" },
          excerpt: {
            en:
              "Economic activities are those undertaken for earning income, while non-economic activities are done for personal satisfaction or social welfare. Education and healthcare are crucial non-economic investments.",
          },
        },
        {
          id: "ssc-e2-2",
          subjectCode: "SSC",
          chapterSlug: "ssc-eco2-people-resource",
          chapterTitle: {
            en: "People as Resource",
            or: "ଜନ ସମ୍ପଦ",
            hi: "मानव संसाधन",
          },
          order: 2,
          title: {
            en: "Quality of Population",
            or: "ଜନସଂଖ୍ୟାର ଗୁଣାତ୍ମକ ମାନ",
            hi: "जनसंख्या की गुणवत्ता",
          },
          objectives: [
            "Understand health, education and skill indicators",
            "Analyse population statistics and trends",
            "Evaluate Human Development Index",
          ],
          durationMin: 45,
          pageHint: { or: "ଅର୍ଥନୀତି, ଅଧ୍ୟାୟ-୨, ପୃ.୧୮-୨୩" },
        },
      ],
    },
    {
      slug: "ssc-ch6-disasters",
      order: 12,
      title: {
        en: "Human-made Disasters and Management",
        or: "ମାନବୀୟ ବିପତ୍ତି ଓ ପରିଚାଳନା",
        hi: "मानव-जनित आपदा",
      },
      topics: [
        {
          id: "ssc-6-1",
          subjectCode: "SSC",
          chapterSlug: "ssc-ch6-disasters",
          chapterTitle: {
            en: "Human-made Disasters and Management",
            or: "ମାନବୀୟ ବିପତ୍ତି ଓ ପରିଚାଳନା",
            hi: "मानव-जनित आपदा",
          },
          order: 1,
          title: {
            en: "Road Accidents",
            or: "ସଡ଼କ ଦୁର୍ଘଟଣା",
            hi: "सड़क दुर्घटना",
          },
          objectives: [
            "List causes of road accidents in India",
            "Suggest preventive measures",
            "Understand traffic rules",
          ],
          durationMin: 45,
          pageHint: { or: "ଭୂଗୋଳ ଓ ଅର୍ଥନୀତି, ଅଧ୍ୟାୟ-୬, ପୃ.୧" },
          excerpt: {
            or:
              "ସଡ଼କ ଦୁର୍ଘଟଣା ଭାରତ ସମେତ ସମଗ୍ର ପୃଥିବୀରେ ଏକ ଗମ୍ଭୀର ସମସ୍ୟାରୂପେ ଉଭା ହୋଇଛି। ଭାରତରେ ପ୍ରତିଦିନ ପ୍ରାୟ ୧୨୦୦ରୁ ଅଧିକ ସଡ଼କ ଦୁର୍ଘଟଣା ଘଟୁଛି।",
          },
        },
        {
          id: "ssc-6-2",
          subjectCode: "SSC",
          chapterSlug: "ssc-ch6-disasters",
          chapterTitle: {
            en: "Human-made Disasters and Management",
            or: "ମାନବୀୟ ବିପତ୍ତି ଓ ପରିଚାଳନା",
            hi: "मानव-जनित आपदा",
          },
          order: 2,
          title: {
            en: "Rail Accidents",
            or: "ରେଳ ଦୁର୍ଘଟଣା",
            hi: "रेल दुर्घटना",
          },
          objectives: [
            "Identify major causes of rail mishaps",
            "List rail safety measures",
          ],
          durationMin: 40,
        },
        {
          id: "ssc-6-3",
          subjectCode: "SSC",
          chapterSlug: "ssc-ch6-disasters",
          chapterTitle: {
            en: "Human-made Disasters and Management",
            or: "ମାନବୀୟ ବିପତ୍ତି ଓ ପରିଚାଳନା",
            hi: "मानव-जनित आपदा",
          },
          order: 3,
          title: {
            en: "Fire Accidents (Agnikanda)",
            or: "ଅଗ୍ନିକାଣ୍ଡ",
            hi: "अग्निकांड",
          },
          objectives: [
            "Identify fire causes",
            "Use fire extinguishers",
            "Plan emergency exits",
          ],
          durationMin: 45,
        },
      ],
    },
  ],
};

// Subjects without curated demo lessons yet. Listed so the UI can surface
// them via subject-level RAG chat rather than fake topic stubs. Content for
// these flows entirely from ingested BSE textbook chunks.
//
// Each subject also lists the chapters present in its BSE Class 9 textbook.
// Clicking a chapter primes the tutor with a chapterHint so retrieval leans
// toward that chapter's vocabulary (authored manually from the textbook's
// table of contents; pageHint optional).
export type RagOnlyChapter = {
  slug: string;
  order: number;
  title: { en: string; or?: string; hi?: string };
  pageHint?: string;
};

export type RagOnlySubject = {
  code: string;
  name: { en: string; or: string; hi: string };
  books: string[]; // human-readable textbook(s) this subject draws on
  chapters: RagOnlyChapter[];
};

export const RAG_ONLY_SUBJECTS: RagOnlySubject[] = [
  {
    code: "GSC",
    name: { en: "General Science", or: "ସାଧାରଣ ବିଜ୍ଞାନ", hi: "सामान्य विज्ञान" },
    books: ["9th Physical Science (OR)", "9th Life Science (EN + OR)"],
    chapters: [
      { slug: "gsc-phy-1", order: 1, title: { en: "Motion", or: "ଗତି" } },
      { slug: "gsc-phy-2", order: 2, title: { en: "Force and Laws of Motion", or: "ବଳ ଓ ଗତିର ନିୟମ" } },
      { slug: "gsc-phy-3", order: 3, title: { en: "Gravitation", or: "ମାଧ୍ୟାକର୍ଷଣ" } },
      { slug: "gsc-phy-4", order: 4, title: { en: "Work and Energy", or: "କାର୍ଯ୍ୟ ଓ ଶକ୍ତି" } },
      { slug: "gsc-phy-5", order: 5, title: { en: "Sound", or: "ଧ୍ୱନି" } },
      { slug: "gsc-phy-6", order: 6, title: { en: "Matter in Our Surroundings", or: "ଆମ ଚାରିପଟର ପଦାର୍ଥ" } },
      { slug: "gsc-phy-7", order: 7, title: { en: "Is Matter Around Us Pure?", or: "ଆମ ଚାରିପଟର ପଦାର୍ଥ ଶୁଦ୍ଧ କି?" } },
      { slug: "gsc-phy-8", order: 8, title: { en: "Atoms and Molecules", or: "ପରମାଣୁ ଓ ଅଣୁ" } },
      { slug: "gsc-phy-9", order: 9, title: { en: "Structure of the Atom", or: "ପରମାଣୁର ଗଠନ" } },
      { slug: "gsc-life-1", order: 10, title: { en: "The Fundamental Unit of Life (Cell)", or: "ଜୀବନର ମୌଳିକ ଏକକ (କୋଷ)" } },
      { slug: "gsc-life-2", order: 11, title: { en: "Tissues", or: "କଳା" } },
      { slug: "gsc-life-3", order: 12, title: { en: "Diversity in Living Organisms", or: "ଜୀବଙ୍କ ମଧ୍ୟରେ ବିଭିନ୍ନତା" } },
      { slug: "gsc-life-4", order: 13, title: { en: "Why Do We Fall Ill?", or: "ଆମେ କାହିଁକି ଅସୁସ୍ଥ ହେଉ?" } },
      { slug: "gsc-life-5", order: 14, title: { en: "Natural Resources", or: "ପ୍ରାକୃତିକ ସମ୍ପଦ" } },
      { slug: "gsc-life-6", order: 15, title: { en: "Improvement in Food Resources", or: "ଖାଦ୍ୟ ସମ୍ପଦର ଉନ୍ନତି" } },
    ],
  },
  {
    code: "FLO",
    name: { en: "First Language (Odia)", or: "ପ୍ରଥମ ଭାଷା (ଓଡ଼ିଆ)", hi: "प्रथम भाषा (ओड़िया)" },
    books: ["ସାହିତ୍ୟ ଧାରା (Mil)", "ଓଡ଼ିଆ ବ୍ୟାକରଣ (Odia Grammar)"],
    chapters: [
      { slug: "flo-gr-varna", order: 1, title: { en: "Alphabet & Sounds", or: "ବର୍ଣ୍ଣ ଓ ଧ୍ୱନି" } },
      { slug: "flo-gr-sandhi", order: 2, title: { en: "Sandhi (Phonetic Combination)", or: "ସନ୍ଧି" } },
      { slug: "flo-gr-samasa", order: 3, title: { en: "Samasa (Compound Words)", or: "ସମାସ" } },
      { slug: "flo-gr-karaka", order: 4, title: { en: "Karaka (Case Relations)", or: "କାରକ ଓ ବିଭକ୍ତି" } },
      { slug: "flo-gr-lingvachan", order: 5, title: { en: "Gender, Number, Person", or: "ଲିଙ୍ଗ, ବଚନ, ପୁରୁଷ" } },
      { slug: "flo-gr-kriya", order: 6, title: { en: "Verbs and Tenses", or: "କ୍ରିୟା ଓ କ୍ରିୟାକାଳ" } },
      { slug: "flo-gr-alankara", order: 7, title: { en: "Figures of Speech (Alankara)", or: "ଅଳଙ୍କାର" } },
      { slug: "flo-sahitya-gadya", order: 8, title: { en: "Prose (Gadya) — selected chapters from Sahitya Dhara", or: "ଗଦ୍ୟ — ସାହିତ୍ୟ ଧାରାର ଚୟନିତ ଅଧ୍ୟାୟ" } },
      { slug: "flo-sahitya-padya", order: 9, title: { en: "Poetry (Padya) — selected poems from Sahitya Dhara", or: "ପଦ୍ୟ — ସାହିତ୍ୟ ଧାରାର ଚୟନିତ କବିତା" } },
      { slug: "flo-sahitya-natya", order: 10, title: { en: "Drama (Natya)", or: "ନାଟ୍ୟ" } },
      { slug: "flo-composition", order: 11, title: { en: "Essay & Letter Writing", or: "ନିବନ୍ଧ ଓ ପତ୍ର ରଚନା" } },
    ],
  },
  {
    code: "SLE",
    name: { en: "Second Language (English)", or: "ଦ୍ୱିତୀୟ ଭାଷା (ଇଂରାଜୀ)", hi: "द्वितीय भाषा (अंग्रेज़ी)" },
    books: ["9th English (Odisha State Textbook)", "9th English Grammar"],
    chapters: [
      { slug: "sle-prose-1", order: 1, title: { en: "Prose: The Selfish Giant" } },
      { slug: "sle-prose-2", order: 2, title: { en: "Prose: The Happy Prince" } },
      { slug: "sle-prose-3", order: 3, title: { en: "Prose: Stories from the Panchatantra" } },
      { slug: "sle-poetry-1", order: 4, title: { en: "Poetry: The Road Not Taken" } },
      { slug: "sle-poetry-2", order: 5, title: { en: "Poetry: Where the Mind is Without Fear" } },
      { slug: "sle-gr-tenses", order: 6, title: { en: "Grammar: Tenses" } },
      { slug: "sle-gr-voice", order: 7, title: { en: "Grammar: Active & Passive Voice" } },
      { slug: "sle-gr-speech", order: 8, title: { en: "Grammar: Direct & Indirect Speech" } },
      { slug: "sle-gr-clauses", order: 9, title: { en: "Grammar: Clauses & Sentence Types" } },
      { slug: "sle-gr-prep", order: 10, title: { en: "Grammar: Prepositions & Articles" } },
      { slug: "sle-writing-letter", order: 11, title: { en: "Writing: Formal & Informal Letters" } },
      { slug: "sle-writing-essay", order: 12, title: { en: "Writing: Paragraph & Essay" } },
      { slug: "sle-writing-comp", order: 13, title: { en: "Reading Comprehension" } },
    ],
  },
  {
    code: "TLH",
    name: { en: "Third Language (Hindi)", or: "ତୃତୀୟ ଭାଷା (ହିନ୍ଦୀ)", hi: "तृतीय भाषा (हिन्दी)" },
    books: ["9th Hindi Kshitij / Sparsh", "9th Hindi Grammar (Vyakaran)"],
    chapters: [
      { slug: "tlh-gr-varna", order: 1, title: { en: "Alphabet (Varnamala)", hi: "वर्णमाला" } },
      { slug: "tlh-gr-sandhi", order: 2, title: { en: "Sandhi", hi: "सन्धि" } },
      { slug: "tlh-gr-samas", order: 3, title: { en: "Samas (Compound)", hi: "समास" } },
      { slug: "tlh-gr-ling", order: 4, title: { en: "Gender, Number, Tense", hi: "लिंग, वचन, काल" } },
      { slug: "tlh-gr-kaarak", order: 5, title: { en: "Kaarak (Case)", hi: "कारक" } },
      { slug: "tlh-gr-kriya", order: 6, title: { en: "Verbs (Kriya)", hi: "क्रिया" } },
      { slug: "tlh-gr-alankar", order: 7, title: { en: "Alankar (Figures of Speech)", hi: "अलंकार" } },
      { slug: "tlh-gr-ras", order: 8, title: { en: "Ras (Sentiment) & Chhand (Meter)", hi: "रस व छंद" } },
      { slug: "tlh-prose-1", order: 9, title: { en: "Prose: Selected chapters", hi: "गद्य: चयनित पाठ" } },
      { slug: "tlh-poetry-1", order: 10, title: { en: "Poetry: Selected poems", hi: "पद्य: चयनित कविताएँ" } },
      { slug: "tlh-composition", order: 11, title: { en: "Essay, Letter & Story Writing", hi: "निबंध, पत्र व कहानी लेखन" } },
    ],
  },
];

export function findRagOnlySubject(code: string): RagOnlySubject | undefined {
  return RAG_ONLY_SUBJECTS.find((s) => s.code === code);
}

export const CURRICULUM: DemoSubject[] = [MTH, SSC];

export const ALL_TOPICS: DemoTopic[] = CURRICULUM.flatMap((s) =>
  s.chapters.flatMap((c) => c.topics),
);

export function findTopic(id: string): DemoTopic | undefined {
  return ALL_TOPICS.find((t) => t.id === id);
}

// ----------------------------------------------------------------------------
// BSE 2025-26 examination milestones — used to anchor study plans.
// ----------------------------------------------------------------------------
export const BSE_MILESTONES = [
  { key: "IA-1", label: "Internal Assessment 1", dueISO: "2025-07-14" },
  { key: "IA-2", label: "Internal Assessment 2", dueISO: "2025-09-01" },
  { key: "HY",   label: "Half-Yearly Examination", dueISO: "2025-09-08" },
  { key: "IA-3", label: "Internal Assessment 3", dueISO: "2025-11-24" },
  { key: "IA-4", label: "Internal Assessment 4", dueISO: "2026-02-16" },
  { key: "ANN",  label: "Annual Examination", dueISO: "2026-03-09" },
] as const;

export function nextMilestone(today: Date = new Date()) {
  return (
    BSE_MILESTONES.find((m) => new Date(m.dueISO) >= today) ??
    BSE_MILESTONES[BSE_MILESTONES.length - 1]
  );
}
