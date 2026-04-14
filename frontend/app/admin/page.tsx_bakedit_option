"use client";

import { useState } from "react";

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [vacantFlats, setVacantFlats] = useState<any[]>([]);
  const [error, setError] = useState("");

  const fetchFlatsData = async () => {
    const [pendingRes, vacantRes, paymentsRes] = await Promise.all([
      fetch("/api/admin/pending", { headers: { "x-admin-password": password } }),
      fetch("/api/admin/flats/vacant", { headers: { "x-admin-password": password } }),
      fetch("/api/admin/payments", { headers: { "x-admin-password": password } })
    ]);
    if (pendingRes.ok) setPending(await pendingRes.json());
    if (vacantRes.ok) setVacantFlats(await vacantRes.json());
    if (paymentsRes.ok) setPayments(await paymentsRes.json());
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

  // NEW: Function to permanently toggle the Association Member badge
  const toggleAssocMember = async (flatNumber: string, currentStatus: boolean) => {
    await fetch("/api/admin/flats/assoc", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ flatNumber, isAssoc: !currentStatus }),
    });
    fetchFlatsData(); // Refresh UI to show the highlighted button
  };

  // Reusable button component for the Assoc badge
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow border border-gray-100">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Association Dashboard</h1>
            <p className="text-gray-500">Current Month Overview</p>
          </div>
          <button onClick={downloadCSV} className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition font-bold shadow-sm">
            Download CSV Report
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Management */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Pending Flats Table */}
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

            {/* Vacant Flats Table */}
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
                    {/* NEW: Payment Date Column */}
                    <th className="p-3 border-b">Payment Date</th>
                    <th className="p-3 border-b">Period</th>
                    <th className="p-3 border-b">Maint.</th>
                    <th className="p-3 border-b">Water</th>
                    <th className="p-3 border-b">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50 text-gray-800">
                      <td className="p-3">
                        <span className="font-bold">{p.flat_number}</span>
                        <AssocBadge flat={p} />
                      </td>
                      {/* NEW: Render actual date and time visually */}
                      <td className="p-3 text-sm text-gray-600">
                        {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="p-3 text-sm">{p.payment_month}/{p.payment_year}</td>
                      <td className="p-3">{p.maintenance_paid ? "✅" : "❌"}</td>
                      <td className="p-3">{p.water_paid ? <span className="text-green-600 font-medium">₹{p.water_amount}</span> : "❌"}</td>
                      <td className="p-3 text-sm">{p.payment_method}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-500">No payments recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
