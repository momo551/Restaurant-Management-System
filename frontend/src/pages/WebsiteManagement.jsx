import { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import {
    Globe, Palette, UtensilsCrossed, Quote, Save, Rocket,
    Plus, Search, Edit2, Trash2, Loader2, Eye, Monitor, Smartphone,
    CheckCircle2, XCircle, Star, Upload, ExternalLink, AlertTriangle
} from 'lucide-react';

const TABS = [
    { key: 'identity', label: 'الهوية والتصميم', icon: Palette },
    { key: 'menu', label: 'المنيو والمنتجات', icon: UtensilsCrossed },
    { key: 'testimonials', label: 'آراء العملاء', icon: Quote },
];

const CONTENT_FIELDS = [
    { key: 'display_name', label: 'اسم المطعم الظاهر', type: 'text', maxLength: 120 },
    { key: 'hero_title', label: 'العنوان الرئيسي', type: 'text', maxLength: 200 },
    { key: 'hero_subtitle', label: 'العنوان الفرعي', type: 'textarea', maxLength: 500 },
    { key: 'hero_cta_text', label: 'نص الزر الرئيسي', type: 'text', maxLength: 80 },
    { key: 'hero_secondary_text', label: 'نص الزر الثانوي', type: 'text', maxLength: 80 },
    { key: 'phone', label: 'رقم الهاتف', type: 'text', maxLength: 30 },
    { key: 'whatsapp', label: 'رقم الواتساب', type: 'text', maxLength: 30 },
    { key: 'address', label: 'العنوان', type: 'text', maxLength: 300 },
    { key: 'footer_text', label: 'نص الفوتر', type: 'textarea', maxLength: 500 },
];

const COLOR_FIELDS = [
    { key: 'primary_color', label: 'اللون الأساسي' },
    { key: 'secondary_color', label: 'اللون الثانوي' },
    { key: 'background_color', label: 'لون الخلفية' },
    { key: 'text_color', label: 'لون النصوص' },
];

const emptyContent = {
    display_name: '', hero_title: '', hero_subtitle: '', hero_cta_text: '', hero_secondary_text: '',
    primary_color: '#e04a4a', secondary_color: '#f97316', background_color: '#ffffff',
    text_color: '#111827', phone: '', whatsapp: '', address: '', footer_text: '',
    show_testimonials: true,
};

function StarRating({ value, onChange }) {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => onChange(n)}
                    className="p-1">
                    <Star size={22} className={n <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                </button>
            ))}
        </div>
    );
}

export default function WebsiteManagement() {
    const [tab, setTab] = useState('identity');

    // ── Settings state ──────────────────────────────────────────────
    const [settings, setSettings] = useState(null);
    const [content, setContent] = useState(emptyContent);
    const [logoFile, setLogoFile] = useState(null);
    const [heroFile, setHeroFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [heroPreview, setHeroPreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [previewMode, setPreviewMode] = useState('desktop');
    const [message, setMessage] = useState(null); // {type, text}

    // ── Menu state ──────────────────────────────────────────────────
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [menuLoading, setMenuLoading] = useState(false);
    const [menuSearch, setMenuSearch] = useState('');
    const [menuCategory, setMenuCategory] = useState('all');
    const [menuAvail, setMenuAvail] = useState('all');
    const [itemModal, setItemModal] = useState(null); // {mode:'create'|'edit', item?}
    const [itemForm, setItemForm] = useState(null);
    const [itemImage, setItemImage] = useState(null);
    const [itemImagePreview, setItemImagePreview] = useState(null);
    const [itemSaving, setItemSaving] = useState(false);

    // ── Testimonials state ──────────────────────────────────────────
    const [testimonials, setTestimonials] = useState([]);
    const [testLoading, setTestLoading] = useState(false);
    const [testModal, setTestModal] = useState(null);
    const [testForm, setTestForm] = useState(null);
    const [testSaving, setTestSaving] = useState(false);

    const flash = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    // ── Loaders ─────────────────────────────────────────────────────
    const loadSettings = async () => {
        try {
            const res = await api.get('/website/settings/');
            setSettings(res.data);
            setContent({ ...emptyContent, ...(res.data.content || {}) });
            setLogoPreview(res.data.logo || null);
            setHeroPreview(res.data.hero_image || null);
        } catch (err) {
            flash('error', err.response?.data?.detail || 'فشل تحميل إعدادات الموقع');
        }
    };

    const loadMenu = async () => {
        setMenuLoading(true);
        try {
            const [catRes, itemRes] = await Promise.all([
                api.get('/menu/categories/'),
                api.get('/menu/items/'),
            ]);
            setCategories(catRes.data);
            setItems(itemRes.data);
        } catch (err) {
            flash('error', 'فشل تحميل بيانات المنيو — تحقق من صلاحياتك');
        } finally {
            setMenuLoading(false);
        }
    };

    const loadTestimonials = async () => {
        setTestLoading(true);
        try {
            const res = await api.get('/website/testimonials/');
            setTestimonials(res.data);
        } catch (err) {
            flash('error', err.response?.data?.detail || 'فشل تحميل الآراء');
        } finally {
            setTestLoading(false);
        }
    };

    useEffect(() => { loadSettings(); }, []);
    useEffect(() => { if (tab === 'menu') loadMenu(); }, [tab]);
    useEffect(() => { if (tab === 'testimonials') loadTestimonials(); }, [tab]);

    // ── Settings handlers ───────────────────────────────────────────
    const setField = (key, value) => setContent(prev => ({ ...prev, [key]: value }));

    const handleImagePick = (kind, file) => {
        if (!file) return;
        if (kind === 'logo') { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
        else { setHeroFile(file); setHeroPreview(URL.createObjectURL(file)); }
    };

    const saveDraft = async () => {
        setSaving(true);
        try {
            if (logoFile || heroFile) {
                const fd = new FormData();
                if (logoFile) fd.append('logo', logoFile);
                if (heroFile) fd.append('hero_image', heroFile);
                await api.patch('/website/settings/', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                setLogoFile(null); setHeroFile(null);
            }
            await api.patch('/website/settings/', { content }, { headers: { 'Content-Type': 'application/json' } });
            await loadSettings();
            flash('success', 'تم حفظ المسودة بنجاح');
        } catch (err) {
            flash('error', formatApiError(err));
        } finally {
            setSaving(false);
        }
    };

    const publish = async () => {
        if (!window.confirm('سيتم نشر المسودة الحالية على موقع العميل فوراً. متابعة؟')) return;
        setPublishing(true);
        try {
            await api.post('/website/settings/publish/');
            await loadSettings();
            flash('success', 'تم نشر إعدادات الموقع بنجاح');
        } catch (err) {
            flash('error', formatApiError(err));
        } finally {
            setPublishing(false);
        }
    };

    const formatApiError = (err) => {
        const data = err.response?.data;
        if (!data) return 'حدث خطأ غير متوقع';
        if (typeof data === 'object') {
            return Object.entries(data)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : (typeof v === 'object' ? JSON.stringify(v) : v)}`)
                .join(' — ');
        }
        return String(data);
    };

    // ── Menu handlers ───────────────────────────────────────────────
    const filteredItems = useMemo(() => items.filter(item => {
        const q = menuSearch.trim().toLowerCase();
        const matchesSearch = !q ||
            item.name?.toLowerCase().includes(q) ||
            item.name_en?.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q);
        const matchesCat = menuCategory === 'all' || item.category === parseInt(menuCategory);
        const matchesAvail = menuAvail === 'all' ||
            (menuAvail === 'available' ? item.is_available : !item.is_available);
        return matchesSearch && matchesCat && matchesAvail;
    }), [items, menuSearch, menuCategory, menuAvail]);

    const openItemModal = (item = null) => {
        if (item) {
            setItemModal({ mode: 'edit', item });
            setItemForm({
                name: item.name || '', name_en: item.name_en || '',
                category: item.category, price: item.price,
                description: item.description || '', preparation_time: item.preparation_time,
                display_order: item.display_order, is_available: item.is_available,
            });
            setItemImagePreview(item.image || null);
        } else {
            setItemModal({ mode: 'create' });
            setItemForm({
                name: '', name_en: '', category: categories[0]?.id || '', price: '',
                description: '', preparation_time: 15, display_order: 0, is_available: true,
            });
            setItemImagePreview(null);
        }
        setItemImage(null);
    };

    const saveItem = async (e) => {
        e.preventDefault();
        if (!itemForm.category) { alert('يرجى اختيار الفئة'); return; }
        setItemSaving(true);
        const fd = new FormData();
        Object.entries(itemForm).forEach(([k, v]) => fd.append(k, v));
        if (itemImage) fd.append('image', itemImage);
        try {
            if (itemModal.mode === 'edit') {
                await api.patch(`/menu/items/${itemModal.item.id}/`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await api.post('/menu/items/', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            setItemModal(null);
            await loadMenu();
            flash('success', 'تم حفظ المنتج بنجاح');
        } catch (err) {
            flash('error', formatApiError(err));
        } finally {
            setItemSaving(false);
        }
    };

    const toggleItemAvailability = async (item) => {
        try {
            await api.post(`/menu/items/${item.id}/toggle_availability/`);
            await loadMenu();
            flash('success', item.is_available ? 'تم تعطيل المنتج' : 'تم إعادة تفعيل المنتج');
        } catch (err) {
            flash('error', formatApiError(err));
        }
    };

    // ── Testimonials handlers ───────────────────────────────────────
    const openTestModal = (t = null) => {
        if (t) {
            setTestModal({ mode: 'edit', item: t });
            setTestForm({
                author_name: t.author_name, text: t.text, rating: t.rating,
                display_order: t.display_order, is_published: t.is_published,
            });
        } else {
            setTestModal({ mode: 'create' });
            setTestForm({ author_name: '', text: '', rating: 5, display_order: 0, is_published: false });
        }
    };

    const saveTestimonial = async (e) => {
        e.preventDefault();
        setTestSaving(true);
        try {
            if (testModal.mode === 'edit') {
                await api.patch(`/website/testimonials/${testModal.item.id}/`, testForm);
            } else {
                await api.post('/website/testimonials/', testForm);
            }
            setTestModal(null);
            await loadTestimonials();
            flash('success', 'تم حفظ الرأي بنجاح');
        } catch (err) {
            flash('error', formatApiError(err));
        } finally {
            setTestSaving(false);
        }
    };

    const togglePublishTestimonial = async (t) => {
        try {
            await api.post(`/website/testimonials/${t.id}/${t.is_published ? 'unpublish' : 'publish'}/`);
            await loadTestimonials();
        } catch (err) {
            flash('error', formatApiError(err));
        }
    };

    const deleteTestimonial = async (t) => {
        if (!window.confirm('حذف هذا الرأي نهائياً؟')) return;
        try {
            await api.delete(`/website/testimonials/${t.id}/`);
            await loadTestimonials();
        } catch (err) {
            flash('error', formatApiError(err));
        }
    };

    const categoryName = (id) => categories.find(c => c.id === id)?.name || `#${id}`;
    const publicSitePath = settings?.restaurant_slug ? `/customer/${settings.restaurant_slug}` : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Globe className="text-orange-500" /> إدارة موقع العميل
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        تحكم في محتوى وتصميم الموقع دون تعديل الكود.
                        {settings?.published_at && (
                            <span className="mr-2 text-xs text-slate-400">
                                آخر نشر: {new Date(settings.published_at).toLocaleString('ar-EG')}
                            </span>
                        )}
                        {settings && !settings.is_published && (
                            <span className="mr-2 text-xs text-amber-600 font-bold">(لم يتم النشر بعد)</span>
                        )}
                    </p>
                </div>
                {publicSitePath && (
                    <a href={publicSitePath} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">
                        <ExternalLink size={16} /> فتح الموقع
                    </a>
                )}
            </div>

            {/* Flash message */}
            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-2 text-sm font-bold ${
                    message.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300'
                        : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setTab(key)}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-t-xl whitespace-nowrap transition-colors ${
                            tab === key
                                ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-b-2 border-orange-500'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}>
                        <Icon size={18} /> {label}
                    </button>
                ))}
            </div>

            {/* ═══ Tab: Identity & Design ═══ */}
            {tab === 'identity' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-6">
                            <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Upload size={18} className="text-orange-500" /> الصور والهوية
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ImagePicker label="شعار المطعم" preview={logoPreview}
                                    onPick={(f) => handleImagePick('logo', f)} />
                                <ImagePicker label="صورة الغلاف الرئيسية" preview={heroPreview}
                                    onPick={(f) => handleImagePick('hero', f)} />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-5">
                            <h2 className="font-bold text-slate-800 dark:text-white">محتوى الصفحة الرئيسية</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {CONTENT_FIELDS.map(f => (
                                    <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">{f.label}</label>
                                        {f.type === 'textarea' ? (
                                            <textarea rows={3} maxLength={f.maxLength}
                                                value={content[f.key] ?? ''}
                                                onChange={e => setField(f.key, e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                                        ) : (
                                            <input type="text" maxLength={f.maxLength}
                                                value={content[f.key] ?? ''}
                                                onChange={e => setField(f.key, e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-5">
                            <h2 className="font-bold text-slate-800 dark:text-white">بيانات التواصل</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {CONTENT_FIELDS.filter(f => ['phone', 'whatsapp', 'address'].includes(f.key)).map(f => (
                                    <div key={f.key}>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">{f.label}</label>
                                        <input type="text" maxLength={f.maxLength}
                                            value={content[f.key] ?? ''}
                                            onChange={e => setField(f.key, e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-5">
                            <h2 className="font-bold text-slate-800 dark:text-white">الألوان</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {COLOR_FIELDS.map(f => (
                                    <div key={f.key} className="flex items-center gap-3">
                                        <input type="color" value={content[f.key] || '#000000'}
                                            onChange={e => setField(f.key, e.target.value)}
                                            className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent" />
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-500 mb-1">{f.label}</label>
                                            <input type="text" dir="ltr" value={content[f.key] ?? ''}
                                                onChange={e => setField(f.key, e.target.value)}
                                                placeholder="#RRGGBB"
                                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono dark:text-white" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <label className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                                <input type="checkbox" checked={!!content.show_testimonials}
                                    onChange={e => setField('show_testimonials', e.target.checked)}
                                    className="w-4 h-4 accent-orange-500" />
                                إظهار قسم آراء العملاء في الصفحة الرئيسية
                            </label>
                        </div>
                    </div>

                    {/* Preview + actions */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-4 sticky top-6">
                            <div className="flex items-center justify-between">
                                <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Eye size={18} className="text-orange-500" /> معاينة
                                </h2>
                                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                    <button onClick={() => setPreviewMode('desktop')}
                                        className={`p-1.5 rounded-md ${previewMode === 'desktop' ? 'bg-white dark:bg-slate-700 shadow' : ''}`}>
                                        <Monitor size={16} />
                                    </button>
                                    <button onClick={() => setPreviewMode('mobile')}
                                        className={`p-1.5 rounded-md ${previewMode === 'mobile' ? 'bg-white dark:bg-slate-700 shadow' : ''}`}>
                                        <Smartphone size={16} />
                                    </button>
                                </div>
                            </div>
                            <WebsitePreview content={content} logo={logoPreview || settings?.logo}
                                hero={heroPreview || settings?.hero_image} mode={previewMode}
                                restaurantName={settings?.restaurant_name} />
                            <div className="space-y-2 pt-2">
                                <button onClick={saveDraft} disabled={saving}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50">
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    حفظ المسودة
                                </button>
                                <button onClick={publish} disabled={publishing}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-50">
                                    {publishing ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                                    نشر على الموقع
                                </button>
                                <p className="text-[11px] text-slate-400 text-center">
                                    النشر يطبّق المسودة الحالية فقط؛ التعديلات اللاحقة تبقى مسودة حتى تنشر مجدداً.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Tab: Menu ═══ */}
            {tab === 'menu' && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
                                placeholder="بحث بالاسم أو الوصف..."
                                className="w-full pr-10 pl-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                        </div>
                        <select value={menuCategory} onChange={e => setMenuCategory(e.target.value)}
                            className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white">
                            <option value="all">كل الأقسام</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select value={menuAvail} onChange={e => setMenuAvail(e.target.value)}
                            className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white">
                            <option value="all">كل الحالات</option>
                            <option value="available">متاح</option>
                            <option value="unavailable">غير متاح</option>
                        </select>
                        <button onClick={() => openItemModal()}
                            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600">
                            <Plus size={16} /> إضافة منتج
                        </button>
                    </div>

                    {menuLoading ? (
                        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={36} /></div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                                        <th className="text-right p-4 font-bold">المنتج</th>
                                        <th className="text-right p-4 font-bold">القسم</th>
                                        <th className="text-right p-4 font-bold">السعر</th>
                                        <th className="text-right p-4 font-bold">الترتيب</th>
                                        <th className="text-right p-4 font-bold">الحالة</th>
                                        <th className="text-right p-4 font-bold">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {filteredItems.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    {item.image ? (
                                                        <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><UtensilsCrossed size={16} /></div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-slate-800 dark:text-white">{item.name}</p>
                                                        {item.name_en && <p className="text-xs text-slate-400" dir="ltr">{item.name_en}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-600 dark:text-slate-300">{categoryName(item.category)}</td>
                                            <td className="p-4 font-bold text-slate-800 dark:text-white">{Number(item.price).toFixed(2)}</td>
                                            <td className="p-4 text-slate-500">{item.display_order}</td>
                                            <td className="p-4">
                                                {item.is_available ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                        <CheckCircle2 size={12} /> متاح
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                        <XCircle size={12} /> غير متاح
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => openItemModal(item)} title="تعديل"
                                                        className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit2 size={16} /></button>
                                                    <button onClick={() => toggleItemAvailability(item)}
                                                        title={item.is_available ? 'تعطيل مؤقت' : 'إعادة تفعيل'}
                                                        className={`p-2 rounded-lg ${item.is_available ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                                                        {item.is_available ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredItems.length === 0 && (
                                        <tr><td colSpan={6} className="p-10 text-center text-slate-400">لا توجد منتجات مطابقة</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className="text-xs text-slate-400">
                        ملاحظة: تعطيل المنتج يمنع طلبه من موقع العميل فوراً دون حذفه، ويمكن إعادة تفعيله في أي وقت.
                        الطلبات السابقة وسجلها لا تتأثر.
                    </p>
                </div>
            )}

            {/* ═══ Tab: Testimonials ═══ */}
            {tab === 'testimonials' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            هذه آراء يضيفها فريق المطعم يدوياً وتُعرض كمحتوى تسويقي — وليست تقييمات حقيقية مقدمة من العملاء.
                        </p>
                        <button onClick={() => openTestModal()}
                            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600">
                            <Plus size={16} /> إضافة رأي
                        </button>
                    </div>

                    {testLoading ? (
                        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={36} /></div>
                    ) : testimonials.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400">
                            لا توجد آراء بعد. أضف أول رأي ليظهر على الموقع بعد النشر.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {testimonials.map(t => (
                                <div key={t.id}
                                    className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 space-y-3 ${
                                        t.is_published ? 'border-green-200 dark:border-green-800' : 'border-slate-100 dark:border-slate-800 opacity-70'
                                    }`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white">{t.author_name}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                {[1, 2, 3, 4, 5].map(n => (
                                                    <Star key={n} size={14}
                                                        className={n <= t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                                                ))}
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                            t.is_published
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                            {t.is_published ? 'منشور' : 'مخفي'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t.text}</p>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800">
                                        <span className="text-[11px] text-slate-400">الترتيب: {t.display_order} • {t.source === 'admin_added' ? 'أُضيف من الإدارة' : t.source}</span>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openTestModal(t)} title="تعديل"
                                                className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit2 size={15} /></button>
                                            <button onClick={() => togglePublishTestimonial(t)}
                                                title={t.is_published ? 'إخفاء' : 'نشر'}
                                                className={`p-2 rounded-lg ${t.is_published ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                                                {t.is_published ? <Eye size={15} /> : <Rocket size={15} />}
                                            </button>
                                            <button onClick={() => deleteTestimonial(t)} title="حذف"
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={15} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Item modal */}
            {itemModal && itemForm && (
                <Modal title={itemModal.mode === 'edit' ? 'تعديل منتج' : 'إضافة منتج'} onClose={() => setItemModal(null)}>
                    <form onSubmit={saveItem} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="اسم المنتج *">
                                <input required value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                            </Field>
                            <Field label="الاسم بالإنجليزية">
                                <input value={itemForm.name_en} onChange={e => setItemForm({ ...itemForm, name_en: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" dir="ltr" />
                            </Field>
                            <Field label="القسم *">
                                <select required value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white">
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </Field>
                            <Field label="السعر *">
                                <input required type="number" step="0.01" min="0" value={itemForm.price}
                                    onChange={e => setItemForm({ ...itemForm, price: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                            </Field>
                            <Field label="وقت التحضير (دقيقة)">
                                <input type="number" min="1" value={itemForm.preparation_time}
                                    onChange={e => setItemForm({ ...itemForm, preparation_time: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                            </Field>
                            <Field label="ترتيب العرض">
                                <input type="number" min="0" value={itemForm.display_order}
                                    onChange={e => setItemForm({ ...itemForm, display_order: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                            </Field>
                        </div>
                        <Field label="الوصف">
                            <textarea rows={3} value={itemForm.description}
                                onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                        </Field>
                        <Field label="صورة المنتج">
                            <div className="flex items-center gap-4">
                                {itemImagePreview && <img src={itemImagePreview} className="w-16 h-16 rounded-xl object-cover" alt="" />}
                                <input type="file" accept="image/*" onChange={e => {
                                    const f = e.target.files[0];
                                    setItemImage(f);
                                    setItemImagePreview(f ? URL.createObjectURL(f) : itemImagePreview);
                                }} className="text-sm" />
                            </div>
                        </Field>
                        <label className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                            <input type="checkbox" checked={itemForm.is_available}
                                onChange={e => setItemForm({ ...itemForm, is_available: e.target.checked })}
                                className="w-4 h-4 accent-orange-500" />
                            متاح للطلب
                        </label>
                        <div className="flex gap-3 pt-2">
                            <button type="submit" disabled={itemSaving}
                                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-50">
                                {itemSaving ? 'جاري الحفظ...' : 'حفظ'}
                            </button>
                            <button type="button" onClick={() => setItemModal(null)}
                                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm">
                                إلغاء
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Testimonial modal */}
            {testModal && testForm && (
                <Modal title={testModal.mode === 'edit' ? 'تعديل رأي' : 'إضافة رأي'} onClose={() => setTestModal(null)}>
                    <form onSubmit={saveTestimonial} className="space-y-4">
                        <Field label="اسم العميل المعروض *">
                            <input required value={testForm.author_name}
                                onChange={e => setTestForm({ ...testForm, author_name: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                        </Field>
                        <Field label="نص الرأي *">
                            <textarea required rows={4} maxLength={1000} value={testForm.text}
                                onChange={e => setTestForm({ ...testForm, text: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                        </Field>
                        <Field label="التقييم">
                            <StarRating value={testForm.rating}
                                onChange={v => setTestForm({ ...testForm, rating: v })} />
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="ترتيب العرض">
                                <input type="number" min="0" value={testForm.display_order}
                                    onChange={e => setTestForm({ ...testForm, display_order: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                            </Field>
                            <Field label="الحالة">
                                <select value={testForm.is_published ? '1' : '0'}
                                    onChange={e => setTestForm({ ...testForm, is_published: e.target.value === '1' })}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white">
                                    <option value="0">مخفي</option>
                                    <option value="1">منشور</option>
                                </select>
                            </Field>
                        </div>
                        <p className="text-[11px] text-slate-400">
                            سيتم عرض هذا الرأي كمحتوى أضافته الإدارة — وليس كتقييم حقيقي من عميل.
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button type="submit" disabled={testSaving}
                                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-50">
                                {testSaving ? 'جاري الحفظ...' : 'حفظ'}
                            </button>
                            <button type="button" onClick={() => setTestModal(null)}
                                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm">
                                إلغاء
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}

function ImagePicker({ label, preview, onPick }) {
    return (
        <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500">{label}</label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 cursor-pointer hover:border-orange-400 transition-colors">
                {preview ? (
                    <img src={preview} alt={label} className="max-h-32 rounded-lg object-contain" />
                ) : (
                    <Upload size={28} className="text-slate-300" />
                )}
                <span className="text-xs text-slate-400">اضغط لاختيار صورة</span>
                <input type="file" accept="image/*" className="hidden"
                    onChange={e => onPick(e.target.files[0])} />
            </label>
        </div>
    );
}

function WebsitePreview({ content, logo, hero, mode, restaurantName }) {
    const width = mode === 'mobile' ? 'max-w-[320px]' : 'max-w-full';
    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white" dir="rtl">
            <div className={width} style={{ backgroundColor: content.background_color || '#fff' }}>
                {/* Fake navbar */}
                <div className="flex items-center justify-between px-4 h-12 border-b"
                    style={{ borderColor: `${content.text_color || '#111'}22` }}>
                    <div className="flex items-center gap-2">
                        {logo ? <img src={logo} className="w-7 h-7 rounded object-cover" alt="" /> : (
                            <div className="w-7 h-7 rounded" style={{ backgroundColor: content.primary_color }} />
                        )}
                        <span className="font-bold text-sm" style={{ color: content.text_color }}>
                            {content.display_name || restaurantName || 'اسم المطعم'}
                        </span>
                    </div>
                    <div className="flex gap-3 text-[10px]" style={{ color: content.text_color }}>
                        <span>المنيو</span><span>تتبع الطلب</span>
                    </div>
                </div>
                {/* Fake hero */}
                <div className="p-4 text-center space-y-2 min-h-[140px] flex flex-col items-center justify-center">
                    {hero && <img src={hero} className="w-full h-24 object-cover rounded-lg mb-2" alt="" />}
                    <h3 className="font-black text-base leading-snug" style={{ color: content.text_color }}>
                        {content.hero_title || 'العنوان الرئيسي'}
                    </h3>
                    <p className="text-[11px] leading-relaxed" style={{ color: `${content.text_color || '#111'}aa` }}>
                        {content.hero_subtitle || 'النص الفرعي'}
                    </p>
                    <div className="flex gap-2 mt-1">
                        <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
                            style={{ backgroundColor: content.primary_color }}>
                            {content.hero_cta_text || 'اطلب الآن'}
                        </span>
                        <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold border"
                            style={{ borderColor: content.secondary_color, color: content.secondary_color }}>
                            {content.hero_secondary_text || 'تتبع طلبك'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
            {children}
        </div>
    );
}
