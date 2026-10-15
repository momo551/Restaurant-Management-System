import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { useCampaignStore } from '../store/campaignStore';
import { publicApi } from '../api/publicApi';
import { MapPin, Phone, User, Truck, ShoppingBag, Loader2, CheckCircle2, Table2, Tag, Star, Gift } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { restaurantPath, useRestaurantSlug } from '../restaurantContext';

const CheckoutPage = () => {
    const restaurantSlug = useRestaurantSlug();
    const { items, getTotal, clearCart, getDeliveryFee, orderMethod } = useCartStore();
    const { getMultiplier } = useCampaignStore();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const { tableInfo, sessionToken, clearSession } = useSessionStore();
    const [formData, setFormData] = useState({
        customer_name: '',
        customer_phone: '',
        delivery_address: '',
        order_type: sessionToken ? 'dine_in' : (orderMethod && orderMethod !== 'dine_in' ? orderMethod : 'delivery'),
        notes: ''
    });

    // Points state
    const [customerPoints, setCustomerPoints] = useState(null);
    const [usePoints, setUsePoints] = useState(false);
    const [checkingPoints, setCheckingPoints] = useState(false);

    // Coupon state
    const [couponCode, setCouponCode] = useState('');
    const [couponResult, setCouponResult] = useState(null);  // { discount_amount, message }
    const [couponError, setCouponError] = useState('');
    const [applyingCoupon, setApplyingCoupon] = useState(false);

    const subtotal = getTotal();
    const deliveryFee = formData.order_type === 'delivery' ? getDeliveryFee() : 0;
    const pointsDiscount = usePoints && customerPoints >= 10 ? Math.floor(customerPoints / 10) : 0;
    const couponDiscount = couponResult ? couponResult.discount_amount : 0;
    const totalSavings = pointsDiscount + couponDiscount;
    const grandTotal = Math.max(0, subtotal + deliveryFee - totalSavings);
    const estimatedPoints = Math.floor(grandTotal * getMultiplier());

    const checkPoints = async () => {
        if (!formData.customer_phone || formData.customer_phone.length < 8) return alert('يرجى إدخال رقم جوال صحيح أولاً');
        setCheckingPoints(true);
        try {
            const res = await publicApi.getCustomerInfo(restaurantSlug, formData.customer_phone);
            setCustomerPoints(res.data.points_balance);
        } catch {
            setCustomerPoints(0);
        } finally {
            setCheckingPoints(false);
        }
    };

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return;
        setApplyingCoupon(true);
        setCouponError('');
        setCouponResult(null);
        try {
            const res = await publicApi.applyCoupon(restaurantSlug, couponCode.trim().toUpperCase(), subtotal);
            setCouponResult(res.data);
        } catch (err) {
            setCouponError(err.response?.data?.error || 'كود غير صالح');
        } finally {
            setApplyingCoupon(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (items.length === 0) return;
        if (!formData.customer_name.trim()) return alert('يرجى إدخال اسم العميل');
        if (!formData.customer_phone.trim()) return alert('يرجى إدخال رقم الجوال');

        setLoading(true);
        try {
            const orderData = {
                ...formData,
                items: items.map(i => ({ menu_item: i.id, quantity: i.quantity })),
                session_token: sessionToken,
                use_points: usePoints && customerPoints ? customerPoints : 0,
                coupon_code: couponResult ? couponCode.trim().toUpperCase() : ''
            };

            const response = sessionToken
                ? await publicApi.submitCustomerOrder(restaurantSlug, orderData)
                : await publicApi.createOrder(restaurantSlug, orderData);
            const newOrder = response.data;

            localStorage.setItem('last_order', JSON.stringify({
                number: newOrder.order_number,
                phone: newOrder.customer_phone,
                savings: totalSavings,
                points_earned: estimatedPoints,
            }));

            clearCart();
            navigate(`${restaurantPath(restaurantSlug, '/track')}?order=${newOrder.order_number}&phone=${newOrder.customer_phone}`);
        } catch (error) {
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            alert('فشل إنشاء الطلب: ' + errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-container px-4 md:px-8 py-10">
            <div className="max-w-4xl mx-auto">
                <h2 className="text-4xl font-extrabold mb-10 dark:text-white">إتمام الطلب</h2>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* ── Left column — form ── */}
                    <div className="space-y-8">
                        {/* Personal Info */}
                        <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-neutral-800 shadow-sm space-y-6">
                            <h3 className="text-xl font-bold dark:text-white flex items-center gap-2 mb-2">
                                <User className="w-5 h-5 text-primary-500" /> البيانات الشخصية
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-500 dark:text-neutral-400 mb-2 mr-2">الاسم بالكامل</label>
                                    <input
                                        required type="text"
                                        value={formData.customer_name}
                                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                        placeholder="الاسم بالكامل (إجباري)..."
                                        className="w-full px-5 py-4 bg-gray-50 dark:bg-neutral-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 dark:text-white transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-500 dark:text-neutral-400 mb-2 mr-2">رقم الجوال</label>
                                    <div className="flex gap-2">
                                        <input
                                            required type="tel"
                                            value={formData.customer_phone}
                                            onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                                            placeholder="010XXXXXXXX (إجباري)..."
                                            className="flex-1 px-5 py-4 bg-gray-50 dark:bg-neutral-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 dark:text-white transition-all text-left"
                                        />
                                        <button
                                            type="button" onClick={checkPoints} disabled={checkingPoints}
                                            className="px-4 bg-orange-100 text-orange-600 font-bold rounded-2xl hover:bg-orange-200 transition-colors whitespace-nowrap"
                                        >
                                            {checkingPoints ? 'جاري...' : 'فحص النقاط'}
                                        </button>
                                    </div>
                                    {customerPoints !== null && (
                                        <div className="mt-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                                            <div className="flex justify-between items-center">
                                                <span className="text-orange-600 font-bold text-sm flex items-center gap-1">
                                                    <Star className="w-4 h-4 fill-orange-500" /> لديك {customerPoints} نقطة
                                                    <span className="text-orange-400 font-normal">(= {Math.floor(customerPoints / 10)} جنيه)</span>
                                                </span>
                                                {customerPoints >= 10 && (
                                                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-neutral-300 font-bold cursor-pointer">
                                                        <input
                                                            type="checkbox" checked={usePoints}
                                                            onChange={(e) => setUsePoints(e.target.checked)}
                                                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                                        />
                                                        استخدام النقاط
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Coupon */}
                        <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-neutral-800 shadow-sm space-y-4">
                            <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                                <Tag className="w-5 h-5 text-primary-500" /> كوبون الخصم
                            </h3>
                            <div className="flex gap-2">
                                <input
                                    type="text" value={couponCode}
                                    onChange={(e) => { setCouponCode(e.target.value); setCouponResult(null); setCouponError(''); }}
                                    placeholder="أدخل كود الخصم..."
                                    className="flex-1 px-5 py-4 bg-gray-50 dark:bg-neutral-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 dark:text-white transition-all uppercase"
                                    disabled={!!couponResult}
                                />
                                {couponResult ? (
                                    <button type="button" onClick={() => { setCouponResult(null); setCouponCode(''); }}
                                        className="px-4 bg-red-100 text-red-600 font-bold rounded-2xl hover:bg-red-200 transition-colors">
                                        إزالة
                                    </button>
                                ) : (
                                    <button type="button" onClick={handleApplyCoupon} disabled={applyingCoupon || !couponCode.trim()}
                                        className="px-4 bg-primary-100 text-primary-600 font-bold rounded-2xl hover:bg-primary-200 transition-colors whitespace-nowrap disabled:opacity-50">
                                        {applyingCoupon ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تطبيق'}
                                    </button>
                                )}
                            </div>
                            {couponResult && (
                                <p className="text-green-600 font-bold text-sm flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> {couponResult.message}
                                </p>
                            )}
                            {couponError && <p className="text-red-500 text-sm font-bold">{couponError}</p>}
                        </div>

                        {/* Delivery Method */}
                        {sessionToken ? (
                            <div className="bg-orange-50 dark:bg-orange-900/10 p-8 rounded-[2.5rem] border border-orange-100 dark:border-orange-800 shadow-sm flex items-center gap-4">
                                <div className="p-4 bg-orange-500 rounded-2xl text-white"><Table2 size={32} /></div>
                                <div className="text-right">
                                    <h3 className="text-xl font-bold dark:text-white">أنت تطلب للطاولة رقم {tableInfo?.number}</h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-2">سيتم تحضير الطلب وتقديمه لك على الطاولة مباشرة.</p>
                                    <button type="button" onClick={() => { clearSession(); setFormData(prev => ({ ...prev, order_type: 'takeaway' })); }}
                                        className="text-primary-500 font-bold text-sm hover:underline">
                                        لست على الطاولة؟ اطلب دليفري أو تيك اوي
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2 mr-2">
                                    <Truck className="w-5 h-5 text-primary-500" /> اختر طريقة الاستلام
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { type: 'delivery', label: 'توصيل للمنزل', icon: <Truck className="w-8 h-8" /> },
                                        { type: 'takeaway', label: 'استلام بنفسي', icon: <ShoppingBag className="w-8 h-8" /> },
                                    ].map(({ type, label, icon }) => (
                                        <button key={type} type="button"
                                            onClick={() => { setFormData({ ...formData, order_type: type }); useCartStore.getState().setOrderMethod(type); }}
                                            className={`group flex flex-col items-center gap-4 p-6 rounded-[2rem] border-2 transition-all hover:scale-[1.02] ${formData.order_type === type ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10' : 'border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm'}`}
                                        >
                                            <div className={`p-4 rounded-2xl transition-transform group-hover:rotate-6 ${formData.order_type === type ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-400'}`}>{icon}</div>
                                            <h4 className={`font-black ${formData.order_type === type ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500'}`}>{label}</h4>
                                        </button>
                                    ))}
                                </div>
                                {formData.order_type === 'delivery' && (
                                    <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2rem] border border-gray-100 dark:border-neutral-800 shadow-sm">
                                        <label className="block text-sm font-bold text-gray-500 dark:text-neutral-400 mb-2 mr-2 flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-primary-500" /> عنوان التوصيل بالكامل
                                        </label>
                                        <textarea required={formData.order_type === 'delivery'}
                                            value={formData.delivery_address}
                                            onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                                            placeholder="المنطقة، الشارع، البرج، الشقة..." rows="3"
                                            className="w-full px-5 py-4 bg-gray-50 dark:bg-neutral-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 dark:text-white transition-all resize-none"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Right column — summary ── */}
                    <div className="space-y-6">
                        <div className="bg-neutral-900 text-white p-8 rounded-[2.5rem] shadow-2xl sticky top-24">
                            <h3 className="text-2xl font-bold mb-8">ملخص الدفع</h3>
                            <div className="space-y-3 mb-8">
                                <div className="flex justify-between text-neutral-400">
                                    <span>الأصناف ({items.reduce((a, b) => a + b.quantity, 0)})</span>
                                    <span className="font-bold">{subtotal} جنيه</span>
                                </div>
                                {formData.order_type === 'delivery' && (
                                    <div className="flex justify-between text-neutral-400">
                                        <span>رسوم التوصيل</span>
                                        <span className="font-bold">+{deliveryFee} جنيه</span>
                                    </div>
                                )}
                                {pointsDiscount > 0 && (
                                    <div className="flex justify-between text-orange-400">
                                        <span className="flex items-center gap-1"><Star className="w-4 h-4 fill-orange-400" /> خصم نقاط الولاء</span>
                                        <span className="font-bold">-{pointsDiscount} جنيه</span>
                                    </div>
                                )}
                                {couponDiscount > 0 && (
                                    <div className="flex justify-between text-green-400">
                                        <span className="flex items-center gap-1"><Tag className="w-4 h-4" /> خصم الكوبون</span>
                                        <span className="font-bold">-{couponDiscount.toFixed(0)} جنيه</span>
                                    </div>
                                )}
                                {totalSavings > 0 && (
                                    <div className="flex justify-between text-emerald-400 bg-emerald-400/10 rounded-xl px-3 py-2">
                                        <span className="font-bold">💰 إجمالي التوفير</span>
                                        <span className="font-black">-{totalSavings.toFixed(0)} جنيه</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-neutral-400">
                                    <span>طريقة الدفع</span>
                                    <span className="text-white font-bold">نقدي (Cash)</span>
                                </div>
                                <div className="h-[1px] bg-neutral-800 my-4" />
                                <div className="flex justify-between text-2xl font-bold">
                                    <span>الإجمالي</span>
                                    <span className="text-primary-500">{grandTotal.toFixed(0)} جنيه</span>
                                </div>
                            </div>

                            {/* Estimated Points */}
                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 mb-6 flex items-center gap-3">
                                <Gift className="w-6 h-6 text-orange-400 flex-shrink-0" />
                                <div className="text-sm">
                                    <p className="text-orange-300 font-bold">ستكسب من هذا الطلب</p>
                                    <p className="text-orange-400 font-black text-lg">~{estimatedPoints} نقطة</p>
                                    <p className="text-orange-500/70 text-xs">(= {Math.floor(estimatedPoints / 10)} جنيه للطلب القادم)</p>
                                </div>
                            </div>

                            <button
                                disabled={loading}
                                className="w-full py-5 bg-primary-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-primary-600 transition-all hover:scale-[1.02] shadow-xl shadow-primary-500/20 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <div className="flex items-center gap-2">تأكيد الطلب <CheckCircle2 className="w-6 h-6" /></div>}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CheckoutPage;
