import React, { useState } from 'react';
import { Course } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { FileText, FileSpreadsheet, Download, X, AlertCircle } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  initialCourseId?: number;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  courses,
  initialCourseId,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<number>(
    initialCourseId || (courses.length > 0 ? courses[0].id : 0)
  );
  const [format, setFormat] = useState<'csv' | 'pdf' | 'excel'>('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!selectedCourseId) {
      setError('Please select a course to generate the report.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const course = courses.find((c) => c.id === Number(selectedCourseId));
      const codeClean = course ? course.code.replace(/\s+/g, '_') : `Course_${selectedCourseId}`;
      const ext = format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'xlsx';
      const filename = `KadPoly_${codeClean}_Attendance_Register.${ext}`;

      await api.downloadReport(format, Number(selectedCourseId), filename);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to download report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
        <div className="bg-[#004d25] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/10 rounded-lg">
              <Download className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-base">Export Attendance Records</h3>
              <p className="text-xs text-emerald-200">Offline Record-Keeping & Academic Audit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Select Course
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#004d25] focus:outline-none"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Select Export Format for Offline Record-Keeping
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  format === 'csv'
                    ? 'border-[#004d25] bg-emerald-50/80 text-[#004d25] ring-2 ring-[#004d25]'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <FileText className="w-5 h-5 text-emerald-700" />
                  <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                    CSV
                  </span>
                </div>
                <div>
                  <div className="font-bold text-xs">CSV Format</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Offline spreadsheet, Excel & database compatible</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  format === 'pdf'
                    ? 'border-[#004d25] bg-emerald-50/80 text-[#004d25] ring-2 ring-[#004d25]'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <FileText className="w-5 h-5 text-red-600" />
                  <span className="text-[10px] font-bold uppercase bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                    PDF
                  </span>
                </div>
                <div>
                  <div className="font-bold text-xs">PDF Document</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Printable register with KadPoly seal & signatures</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('excel')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  format === 'excel'
                    ? 'border-[#004d25] bg-emerald-50/80 text-[#004d25] ring-2 ring-[#004d25]'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                    XLSX
                  </span>
                </div>
                <div>
                  <div className="font-bold text-xs">Excel Sheet</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Formatted multi-column workbook</div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-800">Included in this Report:</p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-600">
              <li>Verified student list with Matriculation numbers</li>
              <li>Per-lecture attendance columns & breakdown</li>
              <li>Calculated attendance % and 75% examination eligibility</li>
              <li>Official KadPoly institutional seal & signature section</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleDownload}
              className="px-5 py-2.5 bg-[#004d25] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Generating Report...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download {format.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
