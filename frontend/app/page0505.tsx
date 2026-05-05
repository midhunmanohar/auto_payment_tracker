"use client";
import { useState } from "react";

export default function ResidentPortal() {
    const [flatNumber, setFlatNumber] = useState("");
    const [bill, setBill] = useState<any>(null);
    const [phoneNumber, setPhoneNumber] = useState("");
    const [receipt, setReceipt] = useState<File | null>(null);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Step 1: Fetch the Bill
    const fetchBill = async (e: any) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            const res = await fetch(`/api/resident/bill/${flatNumber}`);
            const data = await res.json();

            if (res.ok) {
                setBill(data);
            } else {
                setError(data.error);
                setBill(null);
            }
        } catch (err) {
            setError("Failed to connect to the server.");
        }
        setLoading(false);
    };

    // Step 2: Submit the Payment & Image
    const submitPayment = async (e: any) => {
        e.preventDefault();
        if (!receipt) {
            setError("Please attach a screenshot of your payment receipt.");
            return;
        }
        if (!phoneNumber) {
            setError("Please enter your phone number.");
            return;
        }

        setLoading(true);
        setError("");

        // Because we are sending a file, we MUST use FormData instead of standard JSON
        const formData = new FormData();
        formData.append('billId', bill.id);
        formData.append('flatNumber', flatNumber);
        formData.append('phoneNumber', phoneNumber);
        formData.append('receipt', receipt); // Attach the actual image file

        try {
            const res = await fetch('/api/resident/pay', {
                method: 'POST',
                body: formData 
                // Notice: We deliberately DO NOT set a 'Content-Type' header here. 
                // The browser automatically sets it to 'multipart/form-data' when using FormData.
            });
            const data = await res.json();

            if (res.ok) {
                setSuccess(data.message);
                setBill(null); // Hide the bill on success
                setFlatNumber(""); // Clear the input
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError("Failed to submit payment.");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 text-black">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg border p-8">
                
                <h1 className="text-2xl font-bold text-center mb-2">Sri Venkatadri Castle</h1>
                <p className="text-gray-500 text-center mb-8">Maintenance & Water Billing</p>

                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}
                {success && <div className="bg-green-100 border border-green-400 text-green-800 px-4 py-3 rounded mb-6 font-bold text-center">{success}</div>}

                {/* STEP 1: Flat Lookup Form (Hidden if bill is loaded) */}
                {!bill && !success && (
                    <form onSubmit={fetchBill} className="flex flex-col gap-4">
                        <label className="font-semibold text-gray-700">Enter Your Flat Number:</label>
                        <input 
                            type="text" 
                            placeholder="e.g. 101" 
                            value={flatNumber} 
                            onChange={(e) => setFlatNumber(e.target.value)}
                            className="border p-3 rounded-lg text-lg text-center"
                            required
                        />
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white font-bold p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {loading ? "Searching..." : "Find My Bill"}
                        </button>
                    </form>
                )}

                {/* STEP 2: The Invoice & Upload Form (Shown after bill is found) */}
                {bill && (
                    <div className="flex flex-col gap-6">
                        {/* The Invoice */}
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h2 className="font-bold text-lg mb-4 text-blue-900 border-b border-blue-200 pb-2">
                                Invoice: Flat {bill.flat_number} (Month {bill.billing_month}/{bill.billing_year})
                            </h2>
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-600">Maintenance:</span>
                                <span className="font-semibold">₹{bill.maintenance_due}</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-600">Water Bill:</span>
                                <span className="font-semibold">₹{bill.water_due}</span>
                            </div>
                            <div className="flex justify-between mt-4 pt-2 border-t border-blue-200 text-xl">
                                <span className="font-bold text-black">Total Due:</span>
                                <span className="font-bold text-blue-700">₹{bill.total_due}</span>
                            </div>
                        </div>

                        {/* Payment Instructions */}
                        <div className="text-center p-4 bg-gray-100 rounded-lg">
                            <p className="text-sm text-gray-600 mb-2">Scan QR or UPI to Society Account:</p>
                            <p className="font-bold">venkatadricastle@icici</p>
                        </div>

                        {/* Submission Form */}
                        <form onSubmit={submitPayment} className="flex flex-col gap-4 border-t pt-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Your Phone Number:</label>
                                <input 
                                    type="tel" 
                                    placeholder="For payment queries"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full border p-2 rounded"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Upload Payment Screenshot:</label>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={(e) => setReceipt(e.target.files ? e.target.files[0] : null)}
                                    className="w-full border p-2 rounded bg-white text-sm"
                                    required
                                />
                            </div>

                            <button type="submit" disabled={loading} className="w-full bg-green-600 text-white font-bold p-3 rounded-lg hover:bg-green-700 disabled:opacity-50 mt-2">
                                {loading ? "Uploading..." : "Submit Payment Proof"}
                            </button>
                            
                            <button type="button" onClick={() => setBill(null)} className="text-gray-500 text-sm hover:underline mt-2">
                                Cancel & Go Back
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
