"use client";

import { useState } from "react";

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [vacantFlats, setVacantFlats] = useState<any[]>([]);
  const [error, setError] = useState("");

  // NEW: State for the Edit Modal
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    maintenancePaid: false,
    waterPaid: false,
    waterAmount: 0,
    paymentMethod: "UPI"
  });
  const [announcement, setAnnouncement] = useState("");
  const fetchFlatsData = async () => {
    const [pendingRes, vacantRes, paymentsRes] = await Promise.all([
      fetch("/api/admin/pending", { headers: { "x-admin-password": password } }),
      fetch("/api/admin/flats/vacant", { headers: { "x-admin-password": password } }),
      fetch("/api/admin/payments", { headers: { "x-admin-password": password } })
    ]);
    if (pendingRes.ok) setPending(await pendingRes.json());
    if (vacantRes.ok) setVacantFlats(await vacantRes.json());
    if (paymentsRes.ok) setPayments(await paymentsRes.json());
    const annRes = await fetch("/api/announcement");
    if (annRes.ok) setAnnouncement((await annRes.json()).announcement);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/payments", { headers: { "x-admin-password": password } });
    if (res.ok) {
      await fetchFlatsData();
      setIsAuthenticated(true);
    } else {
      setError("Incorrect Password");
    }
  };

  const toggleStatus = async (flatNumber: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Occupied' ? 'Vacant' : 'Occupied';
    if (!confirm(`Mark Flat ${flatNumber} as ${newStatus}?`)) return;
    await fetch("/api/admin/flats/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ flatNumber, status: newStatus }),
    });
    fetchFlatsData();
  };

  const toggleAssocMember = async (flatNumber: string, currentStatus: boolean) => {
    await fetch("/api/admin/flats/assoc", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ flatNumber, isAssoc: !currentStatus }),
    });
    fetchFlatsData();
  };

  const AssocBadge = ({ flat }: { flat: any }) => (
    <button 
      onClick={() => toggleAssocMember(flat.flat_number, flat.is_assoc_member)}
      className={`text-xs px-2 py-1 rounded ml-2 transition ${
        flat.is_assoc_member 
          ? 'bg-yellow-100 text-yellow-800 border border-yellow-300 font-bold' 
          : 'bg-gray-100 text-gray-400 hover:bg-gray-200 border border-gray-200'
      }`}
      title="Toggle Association Member Status"
    >
      ⭐ Assoc
    </button>
  );
  const saveAnnouncement = async () => {
    try {
      const res = await fetch("/api/admin/announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ announcement }),
      });
      if (res.ok) alert("Notice Board Updated!");
    } catch (err) {
      alert("Failed to update notice.");
    }
  };

  // NEW: Open the modal and pre-fill data
  const openEditModal = (payment: any) => {
    setEditingPayment(payment);
    setEditForm({
      maintenancePaid: Boolean(payment.maintenance_paid),
      waterPaid: Boolean(payment.water_paid),
      waterAmount: payment.water_amount || 0,
      paymentMethod: payment.payment_method || "UPI"
    });
  };

  // NEW: Save the edited data
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admin/payments/${editingPayment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({
          ...editForm,
          waterAmount: editForm.waterPaid ? parseFloat(editForm.waterAmount.toString()) || 0 : 0
        }),
      });

      if (res.ok) {
        setEditingPayment(null); // Close modal
        fetchFlatsData(); // Refresh table
      } else {
        alert("Failed to update payment");
      }
    } catch (err) {
      alert("Network error while saving.");
    }
  };

  const downloadCSV = () => {
    const headers = ["Flat Number,Month,Year,Maintenance Paid,Water Paid,Water Amount,Method,Date Recorded\n"];
    const rows = payments.map(p => {
      const date = new Date(p.created_at).toLocaleDateString();
      return `${p.flat_number},${p.payment_month},${p.payment_year},${p.maintenance_paid ? 'Yes' : 'No'},${p.water_paid ? 'Yes' : 'No'},${p.water_amount},${p.payment_method},${date}`;
    });
    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SocietyPay_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow border border-gray-100 max-w-sm w-full">
          <h2 className="text-xl font-bold mb-4 text-gray-800 text-center">Admin Login</h2>
          <input
            type="password"
            placeholder="Enter Admin Password"
            className="w-full p-3 border rounded-lg mb-4 outline-none text-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition font-bold">
            Access Dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 relative">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow border border-gray-100">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Society Dashboard</h1>
            <p className="text-gray-500">Current Month Overview</p>
          </div>
          <button onClick={downloadCSV} className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition font-bold shadow-sm">
            Download CSV Report
          </button>
        </div>

        {/* NEW: Notice Board Editor */}
        <div className="bg-white p-6 rounded-xl shadow border border-gray-100 flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex-1 w-full">
            <label className="block text-sm font-bold text-blue-800 mb-2">📢 Update Resident Notice Board</label>
            <textarea 
              className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-black resize-none"
              rows={2}
              placeholder="Type an announcement here, or leave blank to hide the notice board..."
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
            />
          </div>
          <button 
            onClick={saveAnnouncement}
            className="w-full md:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow"
          >
            Broadcast Notice
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Management */}
          <div className="lg:col-span-1 space-y-6">
            
            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
              <div className="bg-red-50 p-4 border-b border-red-100">
                <h2 className="text-lg font-bold text-red-800">Pending This Month</h2>
              </div>
              <div className="max-h-[350px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <tbody>
                    {pending.map((p, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-gray-800">
                          <span className="font-bold">Flat {p.flat_number}</span>
                          <AssocBadge flat={p} />
                        </td>
                        <td className="p-3 text-right">
                          <button onClick={() => toggleStatus(p.flat_number, p.status)} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300 transition">
                              Mark Vacant
                          </button>
                        </td>
                      </tr>
                    ))}
                    {pending.length === 0 && (
                      <tr><td colSpan={2} className="p-4 text-center text-green-600 font-bold text-sm">All caught up!</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
              <div className="bg-gray-100 p-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-700">Vacant Flats</h2>
              </div>
              <div className="max-h-[250px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <tbody>
                    {vacantFlats.map((v, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-gray-500">
                          <span className="font-bold">Flat {v.flat_number}</span>
                          <AssocBadge flat={v} />
                        </td>
                        <td className="p-3 text-right">
                          <button onClick={() => toggleStatus(v.flat_number, v.status)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition">
                              Mark Occupied
                          </button>
                        </td>
                      </tr>
                    ))}
                    {vacantFlats.length === 0 && (
                      <tr><td colSpan={2} className="p-4 text-center text-gray-400 text-sm">No vacant flats.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Master Ledger */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
            <div className="bg-gray-100 p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">Master Ledger (Recent Payments)</h2>
            </div>
            <div className="max-h-[650px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 text-sm">
                    <th className="p-3 border-b">Flat</th>
                    <th className="p-3 border-b">Ref ID</th> {/* NEW HEADER */}
                    <th className="p-3 border-b">Date</th>
                    <th className="p-3 border-b">Period</th>
                    <th className="p-3 border-b">Maint.</th>
                    <th className="p-3 border-b">Water</th>
                    <th className="p-3 border-b">Method</th>
                    <th className="p-3 border-b text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50 text-gray-800">
                      <td className="p-3">
                        <span className="font-bold">{p.flat_number}</span>
                      </td>
                      {/* NEW: Format the Reference ID exactly how the resident sees it */}
                      <td className="p-3 text-xs font-mono text-gray-500">
                        TXN-{p.payment_year}{String(p.payment_month).padStart(2, '0')}-{p.id}
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="p-3 text-sm">{p.payment_month}/{p.payment_year}</td>
                      <td className="p-3">{p.maintenance_paid ? "✅" : "❌"}</td>
                      <td className="p-3">{p.water_paid ? <span className="text-green-600 font-medium">₹{p.water_amount}</span> : "❌"}</td>
                      <td className="p-3 text-sm">{p.payment_method}</td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => openEditModal(p)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm transition"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-gray-500">No payments recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Edit Payment Modal Overlay */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                Edit Flat {editingPayment.flat_number}
              </h2>
              <button onClick={() => setEditingPayment(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
                &times;
              </button>
            </div>
            
            <p className="text-sm text-gray-500 mb-6">
              Editing record for Period: {editingPayment.payment_month}/{editingPayment.payment_year}
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="flex items-center p-3 bg-gray-50 rounded border border-gray-200">
                <input
                  type="checkbox"
                  id="editMaint"
                  className="w-5 h-5 text-blue-600 rounded"
                  checked={editForm.maintenancePaid}
                  onChange={(e) => setEditForm({ ...editForm, maintenancePaid: e.target.checked })}
                />
                <label htmlFor="editMaint" className="ml-3 font-medium text-gray-800">Maintenance Paid</label>
              </div>

              <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="editWater"
                    className="w-5 h-5 text-blue-600 rounded"
                    checked={editForm.waterPaid}
                    onChange={(e) => setEditForm({ ...editForm, waterPaid: e.target.checked })}
                  />
                  <label htmlFor="editWater" className="ml-3 font-medium text-gray-800">Water Bill Paid</label>
                </div>
                {editForm.waterPaid && (
                  <div className="pl-8">
                    <input
                      type="number"
                      required
                      placeholder="Amount (₹)"
                      className="w-full p-2 border border-gray-300 rounded outline-none text-black"
                      value={editForm.waterAmount}
                      onChange={(e) => setEditForm({ ...editForm, waterAmount: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded outline-none text-black"
                  value={editForm.paymentMethod}
                  onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                >
                  <option value="UPI (Assoc Acc)">UPI (Assoc Acc)</option>
                  <option value="Bank Transfer (Assoc Acc)">Bank Transfer (Assoc Acc)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setEditingPayment(null)} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded font-bold hover:bg-gray-300 transition">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 transition">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
