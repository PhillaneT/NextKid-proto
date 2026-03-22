module.exports = [
"[project]/apps/web/src/lib/supabase.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/index.mjs [app-ssr] (ecmascript) <locals>");
;
const supabaseUrl = ("TURBOPACK compile-time value", "https://nwuhaoaeehrnrtchivla.supabase.co");
const supabaseAnonKey = ("TURBOPACK compile-time value", "sb_publishable_3tErJz14ECv6lvyaDJQRPQ_VPWKFaDd");
const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(supabaseUrl, supabaseAnonKey);
}),
"[project]/packages/shared/src/types.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Shared domain types — used by both apps/web and apps/mobile
__turbopack_context__.s([]);
;
}),
"[project]/packages/shared/src/constants.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ALL_CATEGORIES",
    ()=>ALL_CATEGORIES,
    "CATEGORY_EMOJI",
    ()=>CATEGORY_EMOJI,
    "CLOTHING_SIZES",
    ()=>CLOTHING_SIZES,
    "GRADES",
    ()=>GRADES,
    "LISTING_CONDITIONS",
    ()=>LISTING_CONDITIONS,
    "NATIONWIDE_CATEGORIES",
    ()=>NATIONWIDE_CATEGORIES,
    "PLATFORM_DEFAULTS",
    ()=>PLATFORM_DEFAULTS,
    "SA_PROVINCES",
    ()=>SA_PROVINCES,
    "SCHOOL_SPECIFIC_CATEGORIES",
    ()=>SCHOOL_SPECIFIC_CATEGORIES,
    "SHOE_SIZES",
    ()=>SHOE_SIZES,
    "SPORTS",
    ()=>SPORTS,
    "SUBCATEGORIES",
    ()=>SUBCATEGORIES
]);
const PLATFORM_DEFAULTS = {
    // RULE: auto-cancel + full refund if seller does not ship within 3 business days
    SELLER_SHIP_DAYS: 3,
    // RULE: buyer has 14 days from delivery confirmation to open a dispute
    BUYER_DISPUTE_DAYS: 14,
    // RULE: seller has 72 hours to respond before admin can rule in buyer's favour
    SELLER_RESPONSE_HOURS: 72,
    // RULE: funds auto-release to seller after 7 days if buyer does not dispute
    AUTO_CONFIRM_DAYS: 7,
    // RULE: debounce search input at 300ms to keep results fast
    SEARCH_DEBOUNCE_MS: 300
};
const LISTING_CONDITIONS = [
    'new',
    'like_new',
    'good',
    'fair',
    'poor'
];
const SCHOOL_SPECIFIC_CATEGORIES = [
    'School Uniforms',
    'School Sports Kit'
];
const NATIONWIDE_CATEGORIES = [
    'Shoes',
    'Sports Equipment',
    'Books & Stationery',
    'Bags & Accessories',
    'Other'
];
const ALL_CATEGORIES = [
    ...SCHOOL_SPECIFIC_CATEGORIES,
    ...NATIONWIDE_CATEGORIES
];
const CATEGORY_EMOJI = {
    'School Uniforms': '👕',
    'School Sports Kit': '🏆',
    'Shoes': '👟',
    'Sports Equipment': '⚽',
    'Books & Stationery': '📚',
    'Bags & Accessories': '🎒',
    'Other': '📦'
};
const SUBCATEGORIES = {
    'School Uniforms': [
        'Tops & Shirts',
        'Bottoms',
        'Dresses & Tunics',
        'Blazers & Jackets',
        'Jerseys & Hoodies',
        'Ties & Accessories',
        'Hats & Caps',
        'Socks'
    ],
    'School Sports Kit': [
        'Rugby',
        'Soccer',
        'Cricket',
        'Hockey',
        'Swimming',
        'Athletics',
        'Netball',
        'Tennis',
        'Other Sport'
    ],
    'Shoes': [
        'Black School Shoes',
        'PT / Takkies',
        'Rugby Boots',
        'Soccer Boots',
        'Cricket Shoes',
        'Hockey Shoes',
        'Running Shoes',
        'Other'
    ],
    'Sports Equipment': [
        'Rackets & Bats',
        'Balls',
        'Protective Gear',
        'Swimming Gear',
        'Bags & Holdalls',
        'Other'
    ],
    'Books & Stationery': [
        'Textbooks',
        'Study Guides',
        'Stationery Sets',
        'Calculators & Tech',
        'Other'
    ],
    'Bags & Accessories': [
        'Backpacks',
        'Sports Bags',
        'Lunch Boxes',
        'Water Bottles',
        'Other'
    ],
    'Other': [
        'Other'
    ]
};
const SPORTS = [
    'Rugby',
    'Soccer',
    'Cricket',
    'Hockey',
    'Swimming',
    'Athletics',
    'Netball',
    'Tennis',
    'Other'
];
const SA_PROVINCES = [
    'Gauteng',
    'Western Cape',
    'KwaZulu-Natal',
    'Eastern Cape',
    'Free State',
    'Limpopo',
    'Mpumalanga',
    'North West',
    'Northern Cape'
];
const CLOTHING_SIZES = [
    'XS',
    'S',
    'M',
    'L',
    'XL',
    'XXL',
    '4',
    '6',
    '8',
    '10',
    '12',
    '14',
    '16',
    '18',
    '20'
];
const SHOE_SIZES = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12'
];
const GRADES = [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12
];
}),
"[project]/packages/shared/src/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
// @nextkid/shared — types, utilities, and constants shared between web and mobile
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/types.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants.ts [app-ssr] (ecmascript)");
;
;
}),
"[project]/apps/web/app/onboarding/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>OnboardingPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/lib/supabase.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/shared/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/shared/src/constants.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
const input = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    background: '#2a2a2a',
    border: '1px solid #444',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box'
};
const card = {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '40px',
    width: '100%',
    maxWidth: '480px'
};
const btn = (active)=>({
        padding: '13px',
        borderRadius: '8px',
        border: 'none',
        fontSize: '15px',
        fontWeight: '600',
        cursor: active ? 'pointer' : 'not-allowed',
        background: active ? '#7c3aed' : '#333',
        color: active ? '#fff' : '#666'
    });
function NavBar() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        style: {
            background: '#111',
            borderBottom: '1px solid #222',
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                className: "fa-solid fa-paper-plane",
                style: {
                    color: 'rgb(228,37,205)',
                    fontSize: '18px',
                    marginRight: '8px'
                }
            }, void 0, false, {
                fileName: "[project]/apps/web/app/onboarding/page.tsx",
                lineNumber: 27,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                style: {
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '20px'
                },
                children: "NextKid"
            }, void 0, false, {
                fileName: "[project]/apps/web/app/onboarding/page.tsx",
                lineNumber: 28,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/app/onboarding/page.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
function OnboardingPage() {
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const [step, setStep] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(1);
    const TOTAL_STEPS = 3;
    // Step 1
    const [fullName, setFullName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    // Step 2
    const [dob, setDob] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [ageError, setAgeError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    // Step 3 — school picker
    const [province, setProvince] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [schools, setSchools] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [schoolSearch, setSchoolSearch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [selectedSchools, setSelectedSchools] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loadingSchools, setLoadingSchools] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [userId, setUserId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [userEmail, setUserEmail] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [saving, setSaving] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [saveError, setSaveError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].auth.getUser().then(({ data: { user } })=>{
            if (!user) {
                router.push('/');
                return;
            }
            setUserId(user.id);
            setUserEmail(user.email ?? '');
            __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('profiles').select('full_name').eq('id', user.id).single().then(({ data })=>{
                if (data?.full_name) router.push('/dashboard');
            });
        });
    }, [
        router
    ]);
    // Fetch schools when province changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!province) {
            setSchools([]);
            return;
        }
        setLoadingSchools(true);
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('schools').select('*').eq('province', province).order('name').then(({ data })=>{
            setSchools(data ?? []);
            setLoadingSchools(false);
        });
    }, [
        province
    ]);
    const getAge = (d)=>{
        const birth = new Date(d), today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        if (today.getMonth() < birth.getMonth() || today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate()) age--;
        return age;
    };
    const toggleSchool = (school)=>{
        setSelectedSchools((prev)=>prev.find((s)=>s.id === school.id) ? prev.filter((s)=>s.id !== school.id) : [
                ...prev,
                school
            ]);
    };
    const handleFinish = async ()=>{
        setSaveError('');
        if (!dob) return;
        const isAdult = getAge(dob) >= 18;
        setSaving(true);
        const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('profiles').upsert({
            id: userId,
            email: userEmail,
            full_name: fullName,
            date_of_birth: dob,
            is_age_verified: isAdult,
            role: isAdult ? 'buyer' : 'browse_only',
            school_ids: selectedSchools.map((s)=>s.id)
        });
        if (error) {
            setSaveError('Something went wrong. Please try again.');
            setSaving(false);
            return;
        }
        router.push('/dashboard');
    };
    const filteredSchools = schools.filter((s)=>s.name.toLowerCase().includes(schoolSearch.toLowerCase()));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        style: {
            minHeight: '100vh',
            background: '#0a0a0a',
            fontFamily: 'system-ui, sans-serif'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(NavBar, {}, void 0, false, {
                fileName: "[project]/apps/web/app/onboarding/page.tsx",
                lineNumber: 112,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 'calc(100vh - 57px)',
                    padding: '24px'
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    style: card,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            style: {
                                color: '#7c3aed',
                                fontSize: '13px',
                                marginBottom: '4px'
                            },
                            children: [
                                "Step ",
                                step,
                                " of ",
                                TOTAL_STEPS
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                            lineNumber: 116,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            style: {
                                display: 'flex',
                                gap: '6px',
                                marginBottom: '28px'
                            },
                            children: Array.from({
                                length: TOTAL_STEPS
                            }).map((_, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        flex: 1,
                                        height: '4px',
                                        borderRadius: '2px',
                                        background: i < step ? '#7c3aed' : '#333'
                                    }
                                }, i, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 119,
                                    columnNumber: 15
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                            lineNumber: 117,
                            columnNumber: 11
                        }, this),
                        step === 1 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    style: {
                                        color: '#fff',
                                        marginBottom: '8px'
                                    },
                                    children: "Welcome to NextKid!"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 125,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    style: {
                                        color: '#888',
                                        fontSize: '14px',
                                        marginBottom: '28px'
                                    },
                                    children: "Let's get your account set up."
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 126,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    style: {
                                        color: '#aaa',
                                        fontSize: '13px',
                                        display: 'block',
                                        marginBottom: '6px'
                                    },
                                    children: "Full Name"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 127,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    style: input,
                                    value: fullName,
                                    onChange: (e)=>setFullName(e.target.value),
                                    placeholder: "Your full name"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 128,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    style: {
                                        ...btn(!!fullName),
                                        width: '100%',
                                        marginTop: '20px'
                                    },
                                    disabled: !fullName,
                                    onClick: ()=>setStep(2),
                                    children: "Continue →"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 129,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true),
                        step === 2 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    style: {
                                        color: '#fff',
                                        marginBottom: '8px'
                                    },
                                    children: "Verify your age"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 136,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    style: {
                                        color: '#888',
                                        fontSize: '14px',
                                        marginBottom: '28px'
                                    },
                                    children: "You must be 18+ to buy or sell. Under 18s can browse only."
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 137,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    style: {
                                        color: '#aaa',
                                        fontSize: '13px',
                                        display: 'block',
                                        marginBottom: '6px'
                                    },
                                    children: "Date of Birth"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 141,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "date",
                                    style: input,
                                    value: dob,
                                    onChange: (e)=>{
                                        setDob(e.target.value);
                                        setAgeError('');
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 142,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        background: '#1e1b10',
                                        border: '1px solid #554',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        margin: '16px 0'
                                    },
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        style: {
                                            color: '#bba',
                                            fontSize: '12px',
                                            margin: 0
                                        },
                                        children: "🔒 Your date of birth is used only for age verification and stored securely."
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                        lineNumber: 144,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 143,
                                    columnNumber: 13
                                }, this),
                                ageError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    style: {
                                        color: '#ff6b6b',
                                        fontSize: '13px',
                                        marginBottom: '12px'
                                    },
                                    children: ageError
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 146,
                                    columnNumber: 26
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        display: 'flex',
                                        gap: '12px'
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            style: {
                                                ...btn(true),
                                                flex: 1,
                                                background: 'transparent',
                                                border: '1px solid #444',
                                                color: '#aaa'
                                            },
                                            onClick: ()=>setStep(1),
                                            children: "← Back"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                            lineNumber: 148,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            style: {
                                                ...btn(!!dob),
                                                flex: 2
                                            },
                                            disabled: !dob,
                                            onClick: ()=>{
                                                if (!dob) {
                                                    setAgeError('Please enter your date of birth.');
                                                    return;
                                                }
                                                setStep(3);
                                            },
                                            children: "Continue →"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                            lineNumber: 149,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 147,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true),
                        step === 3 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    style: {
                                        color: '#fff',
                                        marginBottom: '8px'
                                    },
                                    children: "Add your school(s)"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 155,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    style: {
                                        color: '#888',
                                        fontSize: '14px',
                                        marginBottom: '20px'
                                    },
                                    children: "Pick the school(s) your child attends so we can show relevant uniform and gear listings. You can skip this and add later."
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 156,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    style: {
                                        color: '#aaa',
                                        fontSize: '13px',
                                        display: 'block',
                                        marginBottom: '6px'
                                    },
                                    children: "Province"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 161,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                    style: {
                                        ...input,
                                        marginBottom: '12px'
                                    },
                                    value: province,
                                    onChange: (e)=>{
                                        setProvince(e.target.value);
                                        setSchoolSearch('');
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "",
                                            children: "Select a province..."
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                            lineNumber: 163,
                                            columnNumber: 15
                                        }, this),
                                        __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$shared$2f$src$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SA_PROVINCES"].map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: p,
                                                children: p
                                            }, p, false, {
                                                fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                                lineNumber: 164,
                                                columnNumber: 38
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 162,
                                    columnNumber: 13
                                }, this),
                                province && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            style: {
                                                color: '#aaa',
                                                fontSize: '13px',
                                                display: 'block',
                                                marginBottom: '6px'
                                            },
                                            children: "Search school"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                            lineNumber: 169,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            style: {
                                                ...input,
                                                marginBottom: '10px'
                                            },
                                            value: schoolSearch,
                                            onChange: (e)=>setSchoolSearch(e.target.value),
                                            placeholder: "Type school name..."
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                            lineNumber: 170,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                maxHeight: '200px',
                                                overflowY: 'auto',
                                                border: '1px solid #333',
                                                borderRadius: '8px',
                                                marginBottom: '16px'
                                            },
                                            children: loadingSchools ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                style: {
                                                    color: '#666',
                                                    padding: '16px',
                                                    textAlign: 'center',
                                                    margin: 0
                                                },
                                                children: "Loading..."
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                                lineNumber: 174,
                                                columnNumber: 21
                                            }, this) : filteredSchools.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                style: {
                                                    color: '#666',
                                                    padding: '16px',
                                                    textAlign: 'center',
                                                    margin: 0
                                                },
                                                children: "No schools found."
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                                lineNumber: 176,
                                                columnNumber: 23
                                            }, this) : filteredSchools.map((school)=>{
                                                const selected = selectedSchools.some((s)=>s.id === school.id);
                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    onClick: ()=>toggleSchool(school),
                                                    style: {
                                                        padding: '12px 16px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        background: selected ? '#2e1f5e' : 'transparent',
                                                        borderBottom: '1px solid #222'
                                                    },
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    style: {
                                                                        color: '#fff',
                                                                        margin: 0,
                                                                        fontSize: '14px'
                                                                    },
                                                                    children: school.name
                                                                }, void 0, false, {
                                                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                                                    lineNumber: 183,
                                                                    columnNumber: 29
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    style: {
                                                                        color: '#666',
                                                                        margin: 0,
                                                                        fontSize: '12px'
                                                                    },
                                                                    children: [
                                                                        school.city,
                                                                        " · ",
                                                                        school.type
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                                                    lineNumber: 184,
                                                                    columnNumber: 29
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                                            lineNumber: 182,
                                                            columnNumber: 27
                                                        }, this),
                                                        selected && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            style: {
                                                                color: '#7c3aed',
                                                                fontSize: '18px'
                                                            },
                                                            children: "✓"
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                                            lineNumber: 186,
                                                            columnNumber: 40
                                                        }, this)
                                                    ]
                                                }, school.id, true, {
                                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                                    lineNumber: 180,
                                                    columnNumber: 25
                                                }, this);
                                            })
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                            lineNumber: 172,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true),
                                selectedSchools.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        marginBottom: '16px'
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            style: {
                                                color: '#aaa',
                                                fontSize: '13px',
                                                marginBottom: '8px'
                                            },
                                            children: [
                                                "Selected (",
                                                selectedSchools.length,
                                                "):"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                            lineNumber: 197,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '6px'
                                            },
                                            children: selectedSchools.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    onClick: ()=>toggleSchool(s),
                                                    style: {
                                                        background: '#2e1f5e',
                                                        color: '#a78bfa',
                                                        padding: '4px 10px',
                                                        borderRadius: '20px',
                                                        fontSize: '12px',
                                                        cursor: 'pointer'
                                                    },
                                                    children: [
                                                        s.name,
                                                        " ✕"
                                                    ]
                                                }, s.id, true, {
                                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                                    lineNumber: 200,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                            lineNumber: 198,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 196,
                                    columnNumber: 15
                                }, this),
                                saveError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    style: {
                                        color: '#ff6b6b',
                                        fontSize: '13px',
                                        marginBottom: '12px'
                                    },
                                    children: saveError
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 208,
                                    columnNumber: 27
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        display: 'flex',
                                        gap: '12px'
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            style: {
                                                ...btn(true),
                                                flex: 1,
                                                background: 'transparent',
                                                border: '1px solid #444',
                                                color: '#aaa'
                                            },
                                            onClick: ()=>setStep(2),
                                            children: "← Back"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                            lineNumber: 211,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            style: {
                                                ...btn(!saving),
                                                flex: 2
                                            },
                                            disabled: saving,
                                            onClick: handleFinish,
                                            children: saving ? 'Saving...' : selectedSchools.length > 0 ? 'Finish Setup ✓' : 'Skip & Finish →'
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                            lineNumber: 212,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                                    lineNumber: 210,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/app/onboarding/page.tsx",
                    lineNumber: 114,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/app/onboarding/page.tsx",
                lineNumber: 113,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/app/onboarding/page.tsx",
        lineNumber: 111,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=_2eeb575b._.js.map