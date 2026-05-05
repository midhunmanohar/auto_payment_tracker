"use client";
import { useState } from "react";

export default function BillingDashboard() {
    const [password, setPassword] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [error, setError] = useState("");

    const [maintenanceFee, setMaintenanceFee] = useState(2500);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const login = async (e: any) => {
        e.preventDefault();
        // FIXED: Added /api/ to the fetch URL
        const res = await fetch('/api/admin/settings', { headers: { 'x-admin-password': password } });
        if (res.ok) {
            setIsLoggedIn(true);
            const data = await res.json();
            setMaintenanceFee(data.base_maintenance_fee || 2500);
            fetchBills(month, year, password);
        } else {
            setError("Incorrect Password");
        }
    };

    const updateSettings = async () => {
        // FIXED: Added /api/ to the fetch URL
        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
            body: JSON.stringify({ base_maintenance_fee: maintenanceFee })
        });
        alert("Maintenance Fee Updated globally!");
    };

    const generateBills = async () => {
        setLoading(true);
        // FIXED: Added /api/ to the fetch URL
        await fetch('/api/admin/generate-bills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
            body: JSON.stringify({ month, year })
        });
        await fetchBills(month, year, password);
        setLoading(false);
        alert(`Bills successfully generated for ${month}/${year}!`);
    };

    const fetchBills = async (m: number, y: number, pass: string) => {
        // FIXED: Added /api/ to the fetch URL
        const res = await fetch(`/api/admin/monthly-bills?month=${m}&year=${y}`, {
            headers: { 'x-admin-password': pass }
        });
        if (res.ok) {
            const data = await res.json();
            setBills(data);
        }
    };

    const handleWaterChange = (index: number, value: string) => {
        const newBills = [...bills];
        newBills[index].water_due = value;
        setBills(newBills);
    };

    const saveWaterBill = async (index: number) => {
        const bill = bills[index];
        const total = Number(bill.maintenance_due) + Number(bill.water_due);
        // FIXED: Added /api/ to the fetch URL
        await fetch(`/api/admin/monthly-bills/${bill.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
            body: JSON.stringify({ water_due: Number(bill.water_due), total_due: total })
        });
        alert(`Saved water bill for Flat ${bill.flat_number}`);
        fetchBills(month, year, password); // Refresh to show new total
    };

    if (!isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <form onSubmit={login} className="p-8 bg-white rounded-lg shadow-md border">
                    <h2 className="text-2xl font-bold mb-4 text-black">Billing Dashboard Login</h2>
                    {error && <p className="text-red-500 mb-4">{error}</p>}
                    <input
                        type="password"
                        placeholder="Admin Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-2 border rounded mb-4 text-black"
                    />
                    <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">Login</button>
                </form>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto text-black">
            <h1 className="text-3xl font-bold mb-8">Society True Billing System</h1>

            {/* 1. Settings Section */}
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500 mb-8">
                <h2 className="text-xl font-bold mb-4">1. Global Settings</h2>
                <div className="flex items-center gap-4">
                    <label className="font-semibold">Base Maintenance Fee (₹):</label>
                    <input 
                        type="number" 
                        value={maintenanceFee} 
                        onChange={(e) => setMaintenanceFee(Number(e.target.value))}
                        className="border p-2 rounded w-32 bg-gray-50"
                    />
                    <button onClick={updateSettings} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                        Save Fee
                    </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">Updating this will automatically apply to all NEW bills generated.</p>
            </div>

            {/* 2. Generate Section */}
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500 mb-8">
                <h2 className="text-xl font-bold mb-4">2. Generate Monthly Bills</h2>
                <div className="flex flex-wrap items-center gap-4">
                    <input type="number" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border p-2 rounded w-24 bg-gray-50" placeholder="Month (1-12)"/>
                    <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="border p-2 rounded w-24 bg-gray-50" placeholder="Year"/>
                    
                    <button onClick={generateBills} disabled={loading} className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:opacity-50">
                        {loading ? "Generating..." : "Generate Blank Bills"}
                    </button>

                    <button onClick={() => fetchBills(month, year, password)} className="bg-gray-200 text-black px-4 py-2 rounded hover:bg-gray-300">
                        View Month
                    </button>
                </div>
            </div>

            {/* 3. Spreadsheet Section */}
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
                <h2 className="text-xl font-bold mb-4">3. Input Water Charges ({bills.length} Flats Found)</h2>
                {bills.length === 0 ? (
                    <p className="text-gray-500 italic">No bills found for {month}/{year}. Click 'Generate Blank Bills' above to start.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="p-3 border-b">Flat</th>
                                    <th className="p-3 border-b">Maintenance</th>
                                    <th className="p-3 border-b">Water Due (₹)</th>
                                    <th className="p-3 border-b">Total Due</th>
                                    <th className="p-3 border-b">Status</th>
                                    <th className="p-3 border-b">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bills.map((bill, index) => (
                                    <tr key={bill.id} className="hover:bg-gray-50">
                                        <td className="p-3 border-b font-bold">{bill.flat_number}</td>
                                        <td className="p-3 border-b text-gray-600">₹{bill.maintenance_due}</td>
                                        <td className="p-3 border-b">
                                            <input 
                                                type="number" 
                                                value={bill.water_due} 
                                                onChange={(e) => handleWaterChange(index, e.target.value)}
                                                className="border p-1 rounded w-24 bg-white"
                                            />
                                        </td>
                                        <td className="p-3 border-b font-bold text-blue-600">₹{bill.total_due}</td>
                                        <td className="p-3 border-b">
                                            <span className={`px-2 py-1 rounded text-xs ${bill.status === 'Paid' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                                {bill.status}
                                            </span>
                                        </td>
                                        <td className="p-3 border-b">
                                            <button onClick={() => saveWaterBill(index)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                                                Save Row
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
