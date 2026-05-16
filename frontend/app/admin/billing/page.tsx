"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";

type BillingBill = {
    id: number;
    flat_number: string;
    is_vacant: number | boolean;
    maintenance_due: number;
    water_due: number;
    total_due: number;
    status: string;
    phone_number: string | null;
    receipt_image_path: string | null;
};

type BillSettingsResponse = {
    base_maintenance_fee?: number;
};

type LoadSessionArgs = {
    password: string;
    month: number;
    year: number;
    setIsLoggedIn: Dispatch<SetStateAction<boolean>>;
    setMaintenanceFee: Dispatch<SetStateAction<number>>;
    setBills: Dispatch<SetStateAction<BillingBill[]>>;
};

async function fetchBillsForPeriod(month: number, year: number, password: string, setBills: Dispatch<SetStateAction<BillingBill[]>>) {
    const res = await fetch(`/api/admin/monthly-bills?month=${month}&year=${year}`, {
        headers: { 'x-admin-password': password }
    });

    if (!res.ok) {
        return false;
    }

    const data: BillingBill[] = await res.json();
    setBills(data);
    return true;
}

async function loadAdminSession({
    password,
    month,
    year,
    setIsLoggedIn,
    setMaintenanceFee,
    setBills,
}: LoadSessionArgs) {
    const res = await fetch('/api/admin/settings', { headers: { 'x-admin-password': password } });

    if (!res.ok) {
        return false;
    }

    setIsLoggedIn(true);

    const data: BillSettingsResponse = await res.json();
    setMaintenanceFee(Number(data.base_maintenance_fee) || 2500);

    await fetchBillsForPeriod(month, year, password, setBills);
    return true;
}

export default function BillingDashboard() {
    const [password, setPassword] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [error, setError] = useState("");

    const [maintenanceFee, setMaintenanceFee] = useState(2500);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [bills, setBills] = useState<BillingBill[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [receiptViewer, setReceiptViewer] = useState<string | null>(null);

    useEffect(() => {
        const savedPassword = localStorage.getItem("adminPassword");
        if (savedPassword) {
            setPassword(savedPassword);
            void (async () => {
                const success = await loadAdminSession({
                    password: savedPassword,
                    month: new Date().getMonth() + 1,
                    year: new Date().getFullYear(),
                    setIsLoggedIn,
                    setMaintenanceFee,
                    setBills,
                });

                if (!success) {
                    localStorage.removeItem("adminPassword");
                }
            })();
        }
    }, []);

    const login = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const success = await loadAdminSession({
            password,
            month,
            year,
            setIsLoggedIn,
            setMaintenanceFee,
            setBills,
        });

        if (success) {
            localStorage.setItem("adminPassword", password); // <-- Saves it to browser!
            setError("");
        } else {
            setError("Incorrect Password");
        }
    };

    const logout = () => {
        localStorage.removeItem("adminPassword"); // Clear browser memory
        setIsLoggedIn(false);
        setPassword("");
        setError("");
        setBills([]);
    };

    const updateSettings = async () => {
        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
            body: JSON.stringify({ base_maintenance_fee: maintenanceFee })
        });
        alert("Maintenance Fee Updated globally!");
    };

    const generateBills = async () => {
        setLoading(true);
        try {
            await fetch('/api/admin/generate-bills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
                body: JSON.stringify({ month, year })
            });
            await fetchBillsForPeriod(month, year, password, setBills);
            alert(`Bills successfully generated for ${month}/${year}!`);
        } finally {
            setLoading(false);
        }
    };

    const handleWaterChange = (index: number, value: string) => {
        const nextWaterDue = value === "" ? 0 : Number(value);
        setBills((currentBills) =>
            currentBills.map((bill, billIndex) =>
                billIndex === index
                    ? { ...bill, water_due: Number.isNaN(nextWaterDue) ? 0 : nextWaterDue }
                    : bill
            )
        );
    };

    const saveWaterBill = async (index: number) => {
        const bill = bills[index];
        if (!bill) return;

        const total = Number(bill.maintenance_due) + Number(bill.water_due);
        await fetch(`/api/admin/monthly-bills/${bill.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
            body: JSON.stringify({ water_due: Number(bill.water_due), total_due: total })
        });
        alert(`Saved water bill for Flat ${bill.flat_number}`);
        await fetchBillsForPeriod(month, year, password, setBills);
    };

    // NEW: Function to toggle Vacancy directly from the table
    const toggleVacancy = async (index: number) => {
        const bill = bills[index];
        if (!bill) return;

        const newStatus = bill.is_vacant ? 0 : 1; // Flip the status
        
        await fetch(`/api/admin/flats/${bill.flat_number}/vacancy`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
            body: JSON.stringify({ is_vacant: newStatus })
        });

        setBills((currentBills) =>
            currentBills.map((currentBill, billIndex) =>
                billIndex === index ? { ...currentBill, is_vacant: newStatus } : currentBill
            )
        );
    };

    // UPDATED: Added Billing Period and Occupancy Status to the CSV Output
    const downloadCSV = () => {
        if (bills.length === 0) return;

        const headers = ["Billing Period", "Flat Number", "Occupancy", "Maintenance Due", "Water Due", "Total Due", "Status", "Phone Number"];
        
        const rows = bills.map(bill => [
            `${month}/${year}`,
            bill.flat_number,
            bill.is_vacant ? "Vacant" : "Occupied",
            bill.maintenance_due,
            bill.water_due,
            bill.total_due,
            bill.status,
            bill.phone_number || "N/A"
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(e => e.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Society_Billing_Report_${month}_${year}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <form onSubmit={login} className="p-8 bg-white rounded-lg shadow-md border">
                    <h2 className="text-2xl font-bold mb-4 text-black">Admin Login</h2>
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
        <div className="p-8 max-w-7xl mx-auto text-black relative">
           <div className="flex justify-between items-center mb-8">
             <h1 className="text-3xl font-bold">Society True Billing System</h1>
             <button onClick={logout} className="bg-red-100 text-red-700 px-4 py-2 rounded font-bold hover:bg-red-200 border border-red-200 shadow-sm transition-colors">
               Logout
             </button>
          </div>

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
            </div>

            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500 mb-8">
                <h2 className="text-xl font-bold mb-4">2. Generate Monthly Bills</h2>
                <div className="flex flex-wrap items-center gap-4">
                    <input type="number" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border p-2 rounded w-24 bg-gray-50"/>
                    <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="border p-2 rounded w-24 bg-gray-50"/>
                    <button onClick={generateBills} disabled={loading} className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:opacity-50">
                        {loading ? "Generating..." : "Generate Blank Bills"}
                    </button>
                    <button onClick={() => void fetchBillsForPeriod(month, year, password, setBills)} className="bg-gray-200 text-black px-4 py-2 rounded hover:bg-gray-300">
                        View Month
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">3. Billing Ledger ({bills.length} Flats Found)</h2>
                    
                    {bills.length > 0 && (
                        <button onClick={downloadCSV} className="bg-teal-600 text-white px-4 py-2 rounded font-bold hover:bg-teal-700 shadow flex items-center gap-2">
                            <span>⬇️ Download CSV Report</span>
                        </button>
                    )}
                </div>

                {bills.length === 0 ? (
                    <p className="text-gray-500 italic">No bills found for {month}/{year}.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="p-3 border-b">Flat</th>
                                    {/* NEW Occupancy Header */}
                                    <th className="p-3 border-b text-center">Occupancy</th>
                                    <th className="p-3 border-b">Maintenance</th>
                                    <th className="p-3 border-b">Water Due (₹)</th>
                                    <th className="p-3 border-b">Total Due</th>
                                    <th className="p-3 border-b">Status</th>
                                    <th className="p-3 border-b">Receipt</th>
                                    <th className="p-3 border-b">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bills.map((bill, index) => (
                                    <tr key={bill.id} className={`hover:bg-gray-50 ${bill.is_vacant ? 'bg-red-50 opacity-90' : ''}`}>
                                        <td className="p-3 border-b font-bold">{bill.flat_number}</td>
                                        
                                        {/* NEW: Interactive Vacancy Toggle Button */}
                                        <td className="p-3 border-b text-center">
                                            <button 
                                                onClick={() => toggleVacancy(index)} 
                                                className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${bill.is_vacant ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' : 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'}`}
                                            >
                                                {bill.is_vacant ? 'Vacant' : 'Occupied'}
                                            </button>
                                        </td>

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
                                            {bill.phone_number && <div className="text-xs text-gray-500 mt-1">Ph: {bill.phone_number}</div>}
                                        </td>
                                        <td className="p-3 border-b">
                                            {bill.receipt_image_path ? (
                                                <button 
                                                    onClick={() => setReceiptViewer(bill.receipt_image_path)} 
                                                    className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-sm hover:bg-indigo-200 font-semibold"
                                                >
                                                    View Image
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 text-sm">No Upload</span>
                                            )}
                                        </td>
                                        <td className="p-3 border-b">
                                            <button onClick={() => saveWaterBill(index)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 shadow-sm">
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

            {receiptViewer && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-6 rounded-lg max-w-2xl w-full relative">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-xl font-bold">Payment Receipt</h3>
                            <button onClick={() => setReceiptViewer(null)} className="text-red-500 font-bold text-3xl leading-none hover:text-red-700">
                                &times;
                            </button>
                        </div>
                        <div className="relative h-[60vh] w-full bg-gray-100 rounded overflow-hidden">
                            <Image
                                src={`/api${receiptViewer}`}
                                alt="Resident Uploaded Receipt"
                                fill
                                sizes="(max-width: 1024px) 100vw, 768px"
                                className="object-contain"
                                unoptimized
                            />
                        </div>
                        <div className="mt-4 text-center">
                            <a href={`/api${receiptViewer}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                Open Image in New Tab
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
