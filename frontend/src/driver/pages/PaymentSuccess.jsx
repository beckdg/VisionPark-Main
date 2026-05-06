import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, Clock } from "lucide-react";
import { apiClient } from "../../api/apiClient";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tx_ref = searchParams.get("tx_ref") || "";
  const paymentHint = searchParams.get("payment") || "";

  const [status, setStatus] = useState("loading");
  const [detail, setDetail] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!tx_ref) {
        setStatus("missing");
        setErrorMessage("Missing payment reference. Return here from the Chapa checkout page.");
        return;
      }

      try {
        const encoded = encodeURIComponent(tx_ref);
        const data = await apiClient.get(`/payments/chapa/verify/${encoded}`);
        if (cancelled) return;
        setDetail(data);
        if (data?.status === "success") setStatus("success");
        else if (data?.status === "failed") setStatus("failed");
        else setStatus("pending");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(e?.message || "Could not verify payment.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tx_ref]);

  const headline =
    status === "success"
      ? "Payment successful"
      : status === "failed"
        ? "Payment was not completed"
        : status === "pending"
          ? "Payment pending"
          : status === "missing"
            ? "Missing reference"
            : status === "error"
              ? "Verification failed"
              : "Checking payment…";

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-[#09090b] flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0f0f12] p-8 shadow-xl text-center">
        {status === "loading" ? (
          <Loader2 className="h-14 w-14 text-emerald-500 animate-spin mx-auto mb-6" aria-hidden />
        ) : status === "success" ? (
          <CheckCircle className="h-14 w-14 text-emerald-500 mx-auto mb-6" aria-hidden />
        ) : status === "pending" ? (
          <Clock className="h-14 w-14 text-amber-500 mx-auto mb-6" aria-hidden />
        ) : (
          <XCircle className="h-14 w-14 text-red-500 mx-auto mb-6" aria-hidden />
        )}

        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">{headline}</h1>
        {paymentHint ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
            Gateway redirect status: <span className="font-mono">{paymentHint}</span>
          </p>
        ) : null}

        {detail?.amount != null ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-2">
            Amount: <span className="font-semibold">{detail.amount} ETB</span>
          </p>
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-red-600 dark:text-red-400 mb-6">{errorMessage}</p>
        ) : status === "pending" ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
            Chapa has not confirmed this payment yet. You can refresh this page in a moment.
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
            {status === "success"
              ? "Your parking session is marked as paid. You may leave when ready."
              : null}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate("/driver/history")}
            className="w-full h-12 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm uppercase tracking-wide hover:bg-emerald-400 transition-colors"
          >
            View history
          </button>
          <button
            type="button"
            onClick={() => navigate("/driver/map")}
            className="w-full h-12 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-200 font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
          >
            Back to map
          </button>
        </div>
      </div>
    </div>
  );
}
