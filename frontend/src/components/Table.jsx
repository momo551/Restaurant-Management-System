import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Table({
    columns,
    data,
    rowClassName,
    onRowClick,
    pagination = null // { currentPage, totalCount, pageSize, onPageChange }
}) {
    const totalPages = pagination ? Math.ceil(pagination.totalCount / pagination.pageSize) : 0;

    return (
        <div className="flex flex-col gap-4">
            <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200">
                <table className="w-full text-right border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            {columns.map((col, idx) => (
                                <th
                                    key={idx}
                                    className="px-6 py-4 text-sm font-bold text-slate-600 first:rounded-tr-2xl last:rounded-tl-2xl"
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data && data.length > 0 ? (
                            data.map((row, rowIdx) => (
                                <tr
                                    key={rowIdx}
                                    onClick={() => onRowClick && onRowClick(row)}
                                    className={`
                    transition-colors hover:bg-slate-50 cursor-pointer
                    ${rowClassName ? rowClassName(row) : ''}
                  `}
                                >
                                    {columns.map((col, colIdx) => (
                                        <td key={colIdx} className="px-6 py-4 text-sm text-slate-700">
                                            {col.render ? col.render(row) : row[col.accessor]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-10 text-center text-slate-500 italic">
                                    لا توجد بيانات متاحة
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pagination && totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <div className="text-sm text-slate-500 font-medium">
                        عرض {data?.length} من أصل {pagination.totalCount} نتائج
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={pagination.currentPage === 1}
                            onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                            className="p-2 border rounded-lg bg-white disabled:opacity-50 hover:bg-slate-50 transition-colors"
                        >
                            <ChevronRight size={18} />
                        </button>
                        <div className="flex gap-1 items-center">
                            <span className="px-3 py-1 font-bold text-slate-700 bg-white border rounded-lg">
                                {pagination.currentPage}
                            </span>
                            <span className="text-slate-400">من</span>
                            <span className="px-3 py-1 font-bold text-slate-700 bg-white border rounded-lg">
                                {totalPages}
                            </span>
                        </div>
                        <button
                            disabled={pagination.currentPage >= totalPages}
                            onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                            className="p-2 border rounded-lg bg-white disabled:opacity-50 hover:bg-slate-50 transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
