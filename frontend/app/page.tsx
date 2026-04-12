"use client";

import { useState } from "react";

export default function Home() {
  const [flatNumber, setFlatNumber] = useState("");
  const [maintenancePaid, setMaintenancePaid] = useState(false);
  const [waterPaid, setWaterPaid] = useState(false);
  const [waterAmount, setWaterAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [status, setStatus] = useState({ type: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading", message: "Saving record..." });

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flatNumber,
          maintenancePaid,
          waterPaid,
          waterAmount: waterPaid ? parseFloat(waterAmount) || 0 : 0,
          paymentMethod,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", message: data.message });
        // Optional: clear form fields here
      } else {
        setStatus({ type: "error", message: data.error });
      }
    } catch (error) {
      setStatus({ type: "error", message: "Network error. Try again." });
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
             Sri Venkatadri Castle
          </h1>
          <p className="text-sm font-medium text-gray-500">
             Monthly Maintenance and Water Bill Tracker
          </p>
          </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Flat Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Flat Number</label>
            <input
              type="text"
              required
              placeholder="e.g. 304"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
              value={flatNumber}
              onChange={(e) => setFlatNumber(e.target.value)}
            />
          </div>

          {/* Maintenance Fee */}
          <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              id="maint"
              className="w-5 h-5 text-blue-600 rounded"
              checked={maintenancePaid}
              onChange={(e) => setMaintenancePaid(e.target.checked)}
            />
            <label htmlFor="maint" className="ml-3 font-medium text-gray-800">
              Maintenance Paid (₹2500)
            </label>
          </div>

          {/* Water Bill */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="water"
                className="w-5 h-5 text-blue-600 rounded"
                checked={waterPaid}
                onChange={(e) => setWaterPaid(e.target.checked)}
              />
              <label htmlFor="water" className="ml-3 font-medium text-gray-800">
                Water Bill Paid
              </label>
            </div>
            
            {waterPaid && (
              <div className="pl-8 mt-2">
                <input
                  type="number"
                  required
                  placeholder="Amount (₹)"
                  className="w-full p-2 border border-gray-300 rounded outline-none text-black"
                  value={waterAmount}
                  onChange={(e) => setWaterAmount(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="UPI">UPI</option>
              <option value="Bank Transfer (ICICI)">Bank Transfer (ICICI)</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Status Message */}
          {status.message && (
            <div className={`p-3 rounded-lg text-sm ${
              status.type === 'success' ? 'bg-green-100 text-green-800' : 
              status.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {status.message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Record Payment
          </button>
        </form>
      </div>
    </main>
  );
}
