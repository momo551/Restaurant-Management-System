import { useState, useEffect } from 'react';
import api from '../api/axios';
import {
    ShoppingBag,
    Trash2,
    Minus,
    Plus,
    CreditCard,
    Banknote,
    ChevronLeft,
    Search,
    Utensils,
    Edit,
    Star
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function OrderTaking() {
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCampaign, setActiveCampaign] = useState(null);

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [orderType, setOrderType] = useState('dine_in');
    const [selectedTable, setSelectedTable] = useState(null);
    const [notes, setNotes] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryAgents, setDeliveryAgents] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [deliveryAgentName, setDeliveryAgentName] = useState('');
    const [discountPercentage, setDiscountPercentage] = useState(0);

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const editOrderId = searchParams.get('edit');
    const [originalOrderItems, setOriginalOrderItems] = useState([]);

    useEffect(() => {
        fetchData();
        fetchAgents();
        if (editOrderId) {
            fetchOrderForEdit();
        }
    }, [editOrderId]);

    const fetchOrderForEdit = async () => {
        try {
            const res = await api.get(`/orders/${editOrderId}/`);
            const order = res.data;
            setOrderType(order.order_type);
            setSelectedTable(order.table || null);
            setNotes(order.notes || '');
            setCustomerName(order.customer_name || '');
            setCustomerPhone(order.customer_phone || '');
            setDeliveryAddress(order.delivery_address || '');
            setSelectedAgent(order.delivery_agent || null);
            setDeliveryAgentName(order.delivery_agent_name || '');
            setDiscountPercentage(order.discount_percentage || 0);

            // Map items
            const mappedCart = order.items.map(oItem => ({
                id: oItem.menu_item, // This maps to the menu item ID for the POS logic
                itemId: oItem.id, // Keep the specific orderItem ID for updates
                name: oItem.menu_item_details?.name || 'صنف',
                price: oItem.unit_price,
                quantity: oItem.quantity,
                itemNotes: oItem.notes || '',
                image: oItem.menu_item_details?.image || null
            }));

            setCart(mappedCart);
            setOriginalOrderItems(order.items);

        } catch (err) {
            alert('فشل جلب تفاصيل الطلب للتعديل');
            navigate('/orders');
        }
    };

    const fetchAgents = async () => {
        try {
            const res = await api.get('/users/active_staff/');
            // Filter users who have the delivery role
            setDeliveryAgents(res.data.filter(u => u.role === 'delivery'));
        } catch (err) {
            console.error('Error fetching agents', err);
        }
    };

    const fetchData = async () => {
        try {
            const [catRes, itemRes, tableRes, campaignRes] = await Promise.all([
                api.get('/menu/categories/'),
                api.get('/menu/items/'),
                api.get('/tables/'),
                api.get('/loyalty/campaigns/active/')
            ]);
            setCategories(catRes.data);
            setItems(itemRes.data);
            setTables(tableRes.data.filter(t => t.status === 'available'));
            setActiveCampaign(campaignRes.data);
            if (catRes.data.length > 0) setSelectedCategory(catRes.data[0].id);
        } catch (err) {
            console.error('Error fetching data', err);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (item) => {
        const priceToUse = item.active_offer ? item.active_offer.discounted_price : item.price;
        const existing = cart.find(i => i.id === item.id);
        if (existing) {
            setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
            setCart([...cart, { ...item, price: priceToUse, originalPrice: item.price, quantity: 1, active_offer: item.active_offer }]);
        }
    };

    const updateQuantity = (id, delta) => {
        setCart(cart.map(i => {
            if (i.id === id) {
                const newQty = Math.max(1, i.quantity + delta);
                return { ...i, quantity: newQty };
            }
            return i;
        }));
    };

    const updateItemNotes = (id, notes) => {
        setCart(cart.map(i => i.id === id ? { ...i, itemNotes: notes } : i));
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(i => i.id !== id));
    };

    const calculateSubtotal = () => {
        return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const calculateDeliveryFee = () => {
        if (orderType !== 'delivery') return 0;
        const total = calculateSubtotal();
        if (total === 0) return 0;
        if (total < 500) return 25;
        if (total < 1000) return 28;
        if (total < 2000) return 33;
        if (total < 5000) return 48;
        if (total < 8000) return 98;
        return 259;
    };

    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        const discountAmount = subtotal * (discountPercentage / 100);
        return (subtotal - discountAmount + calculateDeliveryFee()).toFixed(2);
    };

    const calculatePoints = () => {
        let totalPoints = 0;
        cart.forEach(item => {
            const multiplier = item.active_offer?.points_multiplier || (activeCampaign?.is_active ? activeCampaign.multiplier : 1);
            totalPoints += Math.floor(item.price * item.quantity * multiplier);
        });
        return totalPoints;
    };

    const calculateProductionCost = () => {
        return cart.reduce((sum, item) => {
            // Find the item in the original items list to get its production cost
            const fullItem = items.find(i => i.id === item.id);
            return sum + (Number(fullItem?.production_cost || 0) * item.quantity);
        }, 0);
    };

    const isDiscountValid = () => {
        const subtotal = calculateSubtotal();
        const discountAmount = subtotal * (discountPercentage / 100);
        const priceAfterDiscount = Number((subtotal - discountAmount).toFixed(2));
        const productionCost = Number(calculateProductionCost().toFixed(2));
        
        // Only invalidate if there is actually recipe data (cost > 0)
        // Add 0.01 buffer for float precision safety
        return productionCost === 0 || priceAfterDiscount >= (productionCost - 0.01);
    };

    const submitOrder = async () => {
        if (cart.length === 0) return alert('السلة فارغة');
        if (orderType === 'dine_in' && !selectedTable) return alert('يرجى اختيار طاولة');

        if (!customerName.trim()) return alert('يرجى إدخال اسم العميل');
        if (!customerPhone.trim()) return alert('يرجى إدخال رقم تليفون العميل');

        try {
            const orderData = {
                order_type: orderType,
                table: selectedTable,
                notes: notes,
                items: cart.map(item => ({
                    id: item.itemId, // Required for updates if it existed before
                    menu_item: item.id,
                    quantity: item.quantity,
                    unit_price: item.price,
                    notes: item.itemNotes || ''
                })),
                customer_name: customerName,
                customer_phone: customerPhone,
                delivery_address: orderType === 'delivery' ? deliveryAddress : '',
                delivery_agent: orderType === 'delivery' ? selectedAgent : null,
                delivery_agent_name: orderType === 'delivery' ? deliveryAgentName : '',
                discount_percentage: Number(Number(discountPercentage).toFixed(2))
            };

            if (editOrderId) {
                await api.patch(`/orders/${editOrderId}/edit/`, orderData);
                alert('تم تعديل الطلب بنجاح');
                navigate('/orders');
            } else {
                await api.post('/orders/', orderData);
                alert('تم إنشاء الطلب بنجاح');
                setCart([]);
                setNotes('');
                setSelectedTable(null);
                setCustomerName('');
                setCustomerPhone('');
                setDeliveryAddress('');
                setSelectedAgent(null);
                setDeliveryAgentName('');
                setDiscountPercentage(0);
                fetchData(); // Refresh available tables
            }
        } catch (err) {
            const msg = err.response?.data?.error || (editOrderId ? 'فشل تعديل الطلب' : 'فشل إنشاء الطلب');
            alert(msg);
        }
    };

    if (loading) return <div>جاري التحميل...</div>;

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-6 overflow-hidden">
            {/* Left: Menu Items */}
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                {/* Categories Header */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`
                px-6 py-3 rounded-2xl whitespace-nowrap transition-all font-medium border
                ${selectedCategory === cat.id
                                    ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-100'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}
              `}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* Items Grid */}
                <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pr-2">
                    {items.filter(i => i.category === selectedCategory && i.is_available).map(item => (
                        <button
                            key={item.id}
                            onClick={() => addToCart(item)}
                            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-500 transition-all text-right flex flex-col items-center gap-3 relative overflow-hidden group"
                        >
                            <div className="w-full aspect-square bg-slate-50 rounded-xl overflow-hidden mb-1">
                                {item.image ? (
                                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                        <Utensils size={32} />
                                    </div>
                                )}
                            </div>
                            <div className="w-full">
                                <p className="font-bold text-slate-800 text-sm mb-1">{item.name}</p>
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        {item.active_offer ? (
                                            <>
                                                <span className="text-orange-600 font-bold text-xs">{item.active_offer.discounted_price} ج.م</span>
                                                <span className="text-[10px] text-slate-400 line-through">{item.price} ج.م</span>
                                            </>
                                        ) : (
                                            <span className="text-orange-600 font-bold text-xs">{item.price} ج.م</span>
                                        )}
                                    </div>
                                    {(() => {
                                        const multiplier = item.active_offer?.points_multiplier || (activeCampaign?.is_active ? activeCampaign.multiplier : 1);
                                        const price = item.active_offer?.discounted_price || item.price;
                                        const points = Math.floor(price * multiplier);
                                        return (
                                            <span className="text-[9px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-md border border-orange-100">
                                                ⭐ {points}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div className="absolute top-2 left-2 bg-orange-100 text-orange-600 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus size={16} />
                            </div>
                            {item.active_offer && (
                                <div className="absolute top-2 right-2">
                                    <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg shadow-lg">
                                        -{Number(item.active_offer.discount_percentage).toFixed(0)}%
                                    </span>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Right: Cart & Checkout */}
            <div className="w-96 flex flex-col gap-6 h-full">
                <div className="flex-1 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-orange-50/50">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            {editOrderId ? (
                                <>
                                    <Edit className="text-blue-500" size={20} />
                                    تعديل طلب #{editOrderId}
                                </>
                            ) : (
                                <>
                                    <ShoppingBag className="text-orange-500" size={20} />
                                    طلب جديد
                                </>
                            )}
                        </h2>
                        {editOrderId ? (
                            <button onClick={() => navigate('/orders')} className="text-slate-400 hover:text-slate-600 text-xs font-medium">إلغاء التعديل</button>
                        ) : (
                            <button onClick={() => setCart([])} className="text-slate-400 hover:text-red-500 text-xs font-medium">مسح الكل</button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {cart.map(item => (
                            <div key={item.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 group">
                                <div className="w-12 h-12 rounded-xl bg-white overflow-hidden flex-shrink-0 border border-slate-100">
                                    {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Utensils size={20} className="m-3 text-slate-300" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-orange-600 font-bold">{item.price} ج.م</p>
                                            {(() => {
                                                const multiplier = item.active_offer?.points_multiplier || (activeCampaign?.is_active ? activeCampaign.multiplier : 1);
                                                const points = Math.floor(item.price * item.quantity * multiplier);
                                                return (
                                                    <p className="text-[9px] text-slate-400 font-medium">سيكسب {points} نقطة</p>
                                                );
                                            })()}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="ملاحظات..."
                                            className="text-[10px] bg-white border border-slate-200 rounded px-2 py-0.5 outline-none focus:border-orange-500 w-24"
                                            value={item.itemNotes || ''}
                                            onChange={(e) => updateItemNotes(item.id, e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-slate-200">
                                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-orange-500 transition-colors"><Minus size={14} /></button>
                                    <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-orange-500 transition-colors"><Plus size={14} /></button>
                                </div>
                                <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                            </div>
                        ))}
                        {cart.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 mt-12">
                                <ShoppingBag size={48} opacity={0.2} />
                                <p className="text-sm font-medium">السلة فارغة.. ابدأ بإضافة أصناف</p>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 border-t border-slate-100 space-y-4">
                        {/* Order Settings */}
                        <div className="grid grid-cols-3 gap-2">
                            {['dine_in', 'takeaway', 'delivery'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setOrderType(type)}
                                    className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${orderType === type ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-100' : 'bg-white text-slate-500 border-slate-200'}`}
                                >
                                    {type === 'dine_in' ? 'صالة' : type === 'takeaway' ? 'تيك اوي' : 'دليفرى'}
                                </button>
                            ))}
                        </div>

                        {orderType === 'dine_in' && (
                            <select
                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                                value={selectedTable || ''}
                                onChange={(e) => setSelectedTable(e.target.value)}
                            >
                                <option value="">اختر رقم الطاولة...</option>
                                {tables.map(t => (
                                    <option key={t.id} value={t.id}>طاولة {t.number} ({t.capacity} أفراد)</option>
                                ))}
                            </select>
                        )}

                        {['delivery', 'takeaway', 'dine_in'].includes(orderType) && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        placeholder="اسم العميل (إجباري)..."
                                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        required
                                    />
                                    <input
                                        type="text"
                                        placeholder="رقم التليفون (إجباري)..."
                                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        required
                                    />
                                </div>
                                {orderType === 'delivery' && (
                                    <>
                                        <textarea
                                            placeholder="عنوان التوصيل..."
                                            className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 h-20 resize-none font-sans"
                                            value={deliveryAddress}
                                            onChange={(e) => setDeliveryAddress(e.target.value)}
                                        />
                                        <select
                                            className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                                            value={selectedAgent || ''}
                                            onChange={(e) => setSelectedAgent(e.target.value)}
                                        >
                                            <option value="">اختر المندوب (اختياري)...</option>
                                            {deliveryAgents.map(agent => (
                                                <option key={agent.id} value={agent.id}>{agent.name}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="اسم المندوب..."
                                            className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                                            value={deliveryAgentName}
                                            onChange={(e) => setDeliveryAgentName(e.target.value)}
                                        />
                                    </>
                                )}
                            </div>
                        )}

                        <div>
                            <textarea
                                placeholder="ملاحظات عامة على الطلب..."
                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 h-20 resize-none font-sans"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-white border-t border-slate-100 space-y-4">
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between text-slate-500">
                                <span>المجموع الفرعي</span>
                                <span>{calculateSubtotal().toFixed(2)} ج.م</span>
                            </div>
                            <div className="flex items-center justify-between text-orange-500 font-bold">
                                <span className="flex items-center gap-1"><Star size={14} className="fill-orange-500" /> نقاط الولاء للمكتسبة</span>
                                <span>{calculatePoints()} نقطة</span>
                            </div>
                            {orderType === 'delivery' && (
                                <div className="flex items-center justify-between text-slate-500">
                                    <span>مصاريف التوصيل</span>
                                    <span>{calculateDeliveryFee().toFixed(2)} ج.م</span>
                                </div>
                            )}

                            {/* Discount Input */}
                            <div className="pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-600 font-bold">نسبة الخصم (%)</span>
                                    <div className="relative w-24">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={discountPercentage}
                                            onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                                            className={`w-full bg-slate-50 border ${!isDiscountValid() ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-200'} rounded-xl py-1.5 px-3 text-sm text-center outline-none focus:ring-2 focus:ring-orange-500/20`}
                                        />
                                    </div>
                                </div>
                                {!isDiscountValid() && (
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 animate-pulse">
                                        السعر بعد الخصم أقل من تكلفة الإنتاج ({calculateProductionCost().toFixed(2)} ج.م)
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 font-bold text-slate-800">
                                <span>الإجمالي النهائي</span>
                                <span className="text-xl text-orange-600">{calculateTotal()} ج.م</span>
                            </div>
                        </div>

                        <button
                            onClick={submitOrder}
                            disabled={cart.length === 0 || !isDiscountValid()}
                            className={`w-full text-white font-bold py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:grayscale ${!isDiscountValid() ? 'bg-slate-400 cursor-not-allowed' : editOrderId ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-100' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-100'}`}
                        >
                            {editOrderId ? <Edit size={20} /> : <CheckCircle2 size={20} />}
                            {editOrderId ? 'حفظ التعديلات' : 'إرسال الطلب'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CheckCircle2({ size, className }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="m9 12 2 2 4-4" /></svg>
    );
}
