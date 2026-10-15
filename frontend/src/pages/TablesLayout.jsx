import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Map as MapIcon,
    Maximize2,
    Plus,
    Grid2X2,
    Table2 as TableIcon,
    CheckCircle2,
    AlertCircle,
    Save,
    X,
    Move,
    Lock,
    Unlock,
    Pin,
    PinOff,
    QrCode,
    RefreshCcw
} from 'lucide-react';

export default function TablesLayout() {
    const [tables, setTables] = useState([]);
    const [selectedFloor, setSelectedFloor] = useState(1);
    const [loading, setLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const [movedTables, setMovedTables] = useState({});
    const [lockedTables, setLockedTables] = useState(new Set());
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newTableData, setNewTableData] = useState({ number: '', capacity: 4 });
    const [selectedTableForQr, setSelectedTableForQr] = useState(null);
    const [updatingStatus, setUpdatingStatus] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        fetchTables();
    }, [selectedFloor]);

    const fetchTables = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/tables/layout/?floor=${selectedFloor}`);
            setTables(res.data);
            setMovedTables({});
            setLockedTables(new Set());
        } catch (err) {
            console.error('Error fetching tables', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLockTable = async (tableId, isLocked) => {
        if (!isLocked) {
            // Locking: Save the current position immediately
            const pos = movedTables[tableId];
            if (pos) {
                try {
                    await api.post(`/tables/${tableId}/update_position/`, pos);
                } catch (err) {
                    console.error('Error saving table position on lock', err);
                    return;
                }
            }
            setLockedTables(prev => new Set(prev).add(tableId));
        } else {
            // Unlocking
            setLockedTables(prev => {
                const next = new Set(prev);
                next.delete(tableId);
                return next;
            });
        }
    };

    const handleDragEnd = (tableId, event, info) => {
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const scrollLeft = containerRef.current.scrollLeft;

        // Calculate relative position in percentage based on container size
        let x = ((info.point.x - containerRect.left + containerRef.current.scrollLeft) / containerRect.width) * 100;
        let y = ((info.point.y - containerRect.top + containerRef.current.scrollTop) / containerRect.height) * 100;

        // Shift by approx half-size of table to keep it under cursor properly
        // No more snapping to grid
        x = x - 2.5;
        y = y - 2.5;

        // Constraint within boundaries
        const clampedX = Math.max(0, Math.min(94, x));
        const clampedY = Math.max(0, Math.min(92, y));

        setMovedTables(prev => ({
            ...prev,
            [tableId]: { position_x: clampedX, position_y: clampedY }
        }));
    };

    const handleSaveLayout = async () => {
        try {
            const promises = Object.entries(movedTables).map(([id, pos]) =>
                api.post(`/tables/${id}/update_position/`, pos)
            );
            await Promise.all(promises);
            setIsEditMode(false);
            fetchTables();
            // Show success notification (if available in project)
        } catch (err) {
            console.error('Error saving layout', err);
        }
    };

    const handleManualMove = (tableId, axis, value) => {
        const numValue = parseFloat(value) || 0;
        const clampedValue = Math.max(0, Math.min(axis === 'x' ? 94 : 92, numValue));
        
        const table = tables.find(t => t.id === tableId);
        const currentPos = movedTables[tableId] || { position_x: table.position_x, position_y: table.position_y };

        setMovedTables(prev => ({
            ...prev,
            [tableId]: {
                ...currentPos,
                [axis === 'x' ? 'position_x' : 'position_y']: clampedValue
            }
        }));
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        fetchTables(); // Reset positions
    };

    const handleUpdateStatus = async (tableId, currentStatus) => {
        const statusOrder = ['available', 'reserved', 'occupied'];
        const currentIndex = statusOrder.indexOf(currentStatus);
        const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

        try {
            setUpdatingStatus(tableId);
            await api.post(`/tables/${tableId}/update_status/`, { status: nextStatus });
            setTables(prev => prev.map(t => 
                t.id === tableId ? { ...t, status: nextStatus } : t
            ));
        } catch (err) {
            console.error('Error updating table status', err);
        } finally {
            setUpdatingStatus(null);
        }
    };

    const handleAddTable = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/tables/', {
                ...newTableData,
                floor: selectedFloor,
                position_x: 45, // Default center
                position_y: 45,
                status: 'available',
                is_active: true
            });
            setTables([...tables, res.data]);
            setIsAddModalOpen(false);
            setNewTableData({ number: '', capacity: 4 });
        } catch (err) {
            console.error('Error adding table', err);
            const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : 'خطأ في إضافة الطاولة';
            alert(`خطأ: ${errorMsg}. تأكد من أن رقم الطاولة غير مكرر.`);
        }
    };

    const statusColors = {
        available: 'bg-green-500',
        reserved: 'bg-orange-500',
        occupied: 'bg-blue-500',
    };

    if (loading && !isEditMode) return (
        <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
    );

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">تخطيط الصالة 🍽️</h1>
                    <p className="text-slate-500">تحكم في توزيع الطاولات وحالتها اللحظية.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        {[1, 2, 3].map(floor => (
                            <button
                                key={floor}
                                onClick={() => setSelectedFloor(floor)}
                                className={`px-4 py-2 rounded-lg transition-all font-medium text-sm ${selectedFloor === floor ? 'bg-orange-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                                disabled={isEditMode}
                            >
                                الطابق {floor}
                            </button>
                        ))}
                    </div>

                    {!isEditMode ? (
                        <button
                            onClick={() => setIsEditMode(true)}
                            className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-all font-medium shadow-lg shadow-slate-200"
                        >
                            <Move size={18} />
                            تعديل التوزيع
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={handleCancelEdit}
                                className="flex items-center gap-2 bg-white text-slate-600 border border-slate-200 px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-all font-medium"
                            >
                                <X size={18} />
                                إلغاء
                            </button>
                            <button
                                onClick={handleSaveLayout}
                                className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl hover:bg-green-700 transition-all font-medium shadow-lg shadow-green-100"
                            >
                                <Save size={18} />
                                حفظ التغييرات
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Hall Area (1/3 of screen width) */}
            <div className="flex justify-center flex-1">
                <div className="overflow-auto rounded-[2.5rem] shadow-2xl bg-white border border-slate-100 flex-shrink-0 custom-scrollbar" style={{ scrollBehavior: 'smooth' }}>
                    <div
                        ref={containerRef}
                        className={`bg-white relative transition-all duration-500 ${isEditMode ? 'ring-4 ring-orange-500/20' : ''}`}
                        style={{
                            width: '76vw',
                            height: '30vw',
                            minWidth: '420px',
                            minHeight: '420px',
                        }}
                    >
                        {/* Boundaries */}
                        {isEditMode && (
                            <div className="absolute inset-0 pointer-events-none border-t-8 border-l-8 border-dashed border-orange-200 rounded-3xl opacity-30 z-10"></div>
                        )}

                        {/* Markers */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white px-8 py-2 rounded-t-2xl font-bold text-slate-300 uppercase tracking-widest text-[10px] border-x border-t border-slate-100 shadow-xl z-30">
                            Entrance • المدخل
                        </div>

                        <div className="absolute top-10 right-10 bg-slate-900/95 backdrop-blur-xl text-white px-6 py-4 rounded-3xl font-bold flex flex-col items-center shadow-2xl border border-white/20 z-30">
                            <span className="text-[8px] opacity-50 mb-1 uppercase tracking-tighter font-black">Service</span>
                            <span className="text-lg">البار</span>
                        </div>

                        {/* Tables */}
                        {tables.map(table => {
                            const isMoved = movedTables[table.id];
                            const posX = isMoved ? isMoved.position_x : table.position_x;
                            const posY = isMoved ? isMoved.position_y : table.position_y;

                            return (
                                <motion.div
                                    key={table.id}
                                    drag={isEditMode && !lockedTables.has(table.id)}
                                    dragConstraints={containerRef}
                                    dragElastic={0}
                                    dragMomentum={false}
                                    dragTransition={{ power: 0, timeConstant: 0 }}
                                    onDragEnd={(e, info) => handleDragEnd(table.id, e, info)}
                                    className={`
                                    absolute rounded-3xl p-4 flex flex-col items-center justify-center gap-3 
                                    ${isEditMode ? (lockedTables.has(table.id) ? 'cursor-default ring-4 ring-green-500/50 shadow-lg' : 'cursor-move ring-4 ring-white ring-offset-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-50') : 'cursor-pointer z-20 transition-all duration-300'}
                                    ${statusColors[table.status]} text-white border-4 border-white/20
                                    ${isEditMode && lockedTables.has(table.id) ? 'opacity-80 scale-95' : ''}
                                `}
                                    style={{
                                        left: `${posX}%`,
                                        top: `${posY}%`,
                                        width: table.capacity > 4 ? '80px' : '65px',
                                        height: table.capacity > 4 ? '80px' : '65px',
                                        zIndex: isEditMode && !lockedTables.has(table.id) ? 100 : 20,
                                    }}
                                    whileHover={{ scale: 1.05, y: -2 }}
                                    whileTap={{ scale: 0.95 }}
                                    initial={false}
                                >
                                    <TableIcon size={table.capacity > 4 ? 20 : 16} className="drop-shadow-lg" />
                                    <span className="font-black text-lg tracking-tighter">{table.number}</span>
                                    <div className="flex items-center gap-1 text-[10px] opacity-90 font-black bg-black/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                        <Users size={10} />
                                        {table.capacity}
                                    </div>

                                    {!isEditMode && table.current_order && (
                                        <div className="absolute -top-4 -right-4 bg-yellow-400 text-slate-900 text-xs font-black px-3 py-2 rounded-2xl border-4 border-white shadow-2xl animate-bounce z-50">
                                            {table.current_order.total} ج
                                        </div>
                                    )}

                                    {isEditMode && (
                                        <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1.5 rounded-xl text-[10px] font-black shadow-2xl flex items-center gap-1 border whitespace-nowrap z-[60] transition-colors ${lockedTables.has(table.id) ? 'bg-green-600 text-white border-green-400' : 'bg-slate-900 text-white border-white/20'}`}>
                                            <div className="flex items-center gap-1">
                                                <span className={lockedTables.has(table.id) ? 'text-white' : 'text-orange-400'}>X:</span>
                                                <input 
                                                    type="number" 
                                                    step="0.1"
                                                    disabled={lockedTables.has(table.id)}
                                                    value={posX.toFixed(1)}
                                                    onChange={(e) => handleManualMove(table.id, 'x', e.target.value)}
                                                    className="w-10 bg-transparent border-none text-white focus:ring-0 p-0 text-[10px]"
                                                />
                                            </div>
                                            <span className="text-slate-500 italic">|</span>
                                            <div className="flex items-center gap-1">
                                                <span className={lockedTables.has(table.id) ? 'text-white' : 'text-blue-400'}>Y:</span>
                                                <input 
                                                    type="number" 
                                                    step="0.1"
                                                    disabled={lockedTables.has(table.id)}
                                                    value={posY.toFixed(1)}
                                                    onChange={(e) => handleManualMove(table.id, 'y', e.target.value)}
                                                    className="w-10 bg-transparent border-none text-white focus:ring-0 p-0 text-[10px]"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {isEditMode && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleLockTable(table.id, lockedTables.has(table.id));
                                            }}
                                            className={`absolute -top-2 -right-2 p-2 rounded-xl shadow-lg border transition-all z-[70] hover:scale-110 active:scale-90 ${lockedTables.has(table.id) ? 'bg-green-500 text-white border-green-400' : 'bg-white text-slate-400 border-slate-200'}`}
                                        >
                                            {lockedTables.has(table.id) ? <Pin size={16} /> : <PinOff size={16} />}
                                        </button>
                                    )}

                                    {!isEditMode && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedTableForQr(table);
                                            }}
                                            className="absolute -bottom-2 -left-2 bg-white text-indigo-600 p-2 rounded-xl shadow-lg border border-indigo-50 hover:bg-indigo-50 transition-colors z-[70]"
                                        >
                                            <QrCode size={14} />
                                        </button>
                                    )}

                                    {!isEditMode && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateStatus(table.id, table.status);
                                            }}
                                            disabled={updatingStatus === table.id}
                                            className={`absolute -bottom-2 -right-2 bg-white text-slate-700 p-2 rounded-xl shadow-lg border border-slate-100 hover:bg-slate-50 transition-all z-[70] ${updatingStatus === table.id ? 'animate-spin opacity-50' : ''}`}
                                            title="تغيير الحالة"
                                        >
                                            <RefreshCcw size={14} />
                                        </button>
                                    )}

                                    {isEditMode && !lockedTables.has(table.id) && (
                                        <div className="absolute -bottom-2 -right-2 bg-white text-orange-600 p-2 rounded-xl shadow-lg border border-orange-100 z-[60]">
                                            <Move size={14} />
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}

                        {tables.length === 0 && (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-6">
                                <div className="p-8 bg-white rounded-full shadow-xl shadow-slate-200/50">
                                    <AlertCircle size={64} className="text-slate-200" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-xl text-slate-800">لا يوجد طاولات</p>
                                    <p className="text-slate-500">ابدأ بإضافة طاولات لهذا الطابق</p>
                                </div>
                                <button 
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="bg-orange-500 text-white px-8 py-3 rounded-2xl flex items-center gap-3 hover:bg-orange-600 shadow-xl shadow-orange-200 transition-all font-bold"
                                >
                                    <Plus size={20} />
                                    إضافة طاولة جديدة
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Table Modal */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white rounded-[2.5rem] p-8 shadow-2xl w-full max-w-md border border-slate-100"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-slate-800">إضافة طاولة جديدة 🆕</h2>
                                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={24} className="text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleAddTable} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">رقم الطاولة</label>
                                    <input
                                        type="number"
                                        required
                                        value={newTableData.number}
                                        onChange={e => setNewTableData({ ...newTableData, number: e.target.value })}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all"
                                        placeholder="مثال: 15"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">سعة الأفراد</label>
                                    <div className="flex gap-3">
                                        {[2, 4, 6, 8].map(cap => (
                                            <button
                                                key={cap}
                                                type="button"
                                                onClick={() => setNewTableData({ ...newTableData, capacity: cap })}
                                                className={`flex-1 py-3 rounded-2xl border-2 transition-all font-bold ${newTableData.capacity === cap ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                                            >
                                                {cap}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold hover:bg-slate-700 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
                                >
                                    <Plus size={20} />
                                    تأكيد الإضافة
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Float Add Button in Edit Mode */}
            {isEditMode && (
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="fixed bottom-10 left-10 bg-orange-500 text-white p-5 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all z-[90] group"
                >
                    <Plus size={32} />
                    <span className="absolute right-full mr-4 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        إضافة طاولة
                    </span>
                </button>
            )}

            {/* Footer Stats */}
            {!isEditMode && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center gap-5 shadow-sm">
                        <div className="p-4 bg-green-50 text-green-600 rounded-2xl">
                            <CheckCircle2 size={26} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase font-black tracking-widest">متاحة</p>
                            <p className="text-2xl font-black text-slate-800">{tables.filter(t => t.status === 'available').length}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center gap-5 shadow-sm">
                        <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl">
                            <Users size={26} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase font-black tracking-widest">محجوزة</p>
                            <p className="text-2xl font-black text-slate-800">{tables.filter(t => t.status === 'reserved').length}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center gap-5 shadow-sm">
                        <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                            <Maximize2 size={26} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase font-black tracking-widest">مشغولة</p>
                            <p className="text-2xl font-black text-slate-800">{tables.filter(t => t.status === 'occupied').length}</p>
                        </div>
                    </div>
                </div>
            )}
            {/* Table QR Code Modal */}
            <AnimatePresence>
                {selectedTableForQr && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-[3rem] p-10 shadow-2xl w-full max-w-sm text-center relative border border-slate-100"
                        >
                            <button 
                                onClick={() => setSelectedTableForQr(null)}
                                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                            >
                                <X size={24} />
                            </button>

                            <div className="mb-8">
                                <h2 className="text-3xl font-black text-slate-800 mb-2">طاولة {selectedTableForQr.number}</h2>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">امسح الكود للطلب المباشر</p>
                            </div>

                            <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-slate-100 mb-8 flex flex-col justify-center items-center shadow-inner min-h-[200px]">
                                <img 
                                    src={`https://quickchart.io/qr?text=${encodeURIComponent((import.meta.env.VITE_CUSTOMER_APP_URL || `http://${window.location.hostname}:5174`) + '/scan/' + selectedTableForQr.qr_code?.code)}&size=250`} 
                                    alt="Table QR"
                                    className="w-48 h-48 mix-blend-multiply"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'block';
                                    }}
                                />
                                <div className="hidden text-slate-400 text-sm p-4 text-center">
                                    <AlertCircle size={48} className="mx-auto mb-4 text-orange-300" />
                                    <p className="font-bold text-slate-600 mb-2">تعذر تحميل الكود</p>
                                    <p className="text-xs">يرجى تعطيل مانع الإعلانات (AdBlock) لتتمكن من رؤية كود الـ QR.</p>
                                </div>
                            </div>

                            <button
                                onClick={() => window.print()}
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-orange-500 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 uppercase tracking-wider"
                            >
                                <Users size={18} />
                                طباعة الكود
                            </button>
                            
                            <p className="mt-4 text-[9px] text-slate-300 font-bold uppercase italic">Restaurant SaaS • Powered by Antigravity</p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
