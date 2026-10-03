import { respondToRequest } from "../actions";

export default function RequestActions({ id }: { id: string }) {
  return (
    <form action={respondToRequest} className="space-y-2 rounded-xl border border-black/5 bg-gray-50 p-3">
      <input type="hidden" name="id" value={id} />
      <label className="text-xs font-semibold text-gray-600" htmlFor={`note-${id}`}>القرار والملاحظة</label>
      <textarea id={`note-${id}`} name="response_note" rows={2} placeholder="ملاحظة للمرسل (اختياري)" className="input text-sm" />
      <div className="flex flex-wrap gap-2">
        <button name="status" value="approved" className="btn-primary !bg-emerald-700 !px-3 !py-1.5 text-xs hover:!bg-emerald-800">
          موافقة
        </button>
        <button name="status" value="rejected" className="btn-primary !bg-red-700 !px-3 !py-1.5 text-xs hover:!bg-red-800">
          رفض
        </button>
        <button name="status" value="in_review" className="btn-secondary !px-3 !py-1.5 text-xs">
          قيد المراجعة
        </button>
        <button name="status" value="completed" className="btn-secondary !px-3 !py-1.5 text-xs">
          تم التنفيذ
        </button>
      </div>
    </form>
  );
}
