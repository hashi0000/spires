import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../utils/firebase";

type ReviewRow = { id: string; email: string; reason: string };

/** Off until reviewWelcomeEmail is deployed. onCustomerCreate remains the live welcome function. */
const REVIEW_WELCOME_EMAIL_RELEASED = false;

export function WelcomeReview() {
  if (!REVIEW_WELCOME_EMAIL_RELEASED) return null;
  return <WelcomeReviewPanel />;
}

function WelcomeReviewPanel() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "customers"), where("welcomeEmailStatus", "==", "needs_review"));
    return onSnapshot(q, (snap) => {
      setRows(snap.docs.map((row) => ({
        id: row.id,
        email: String(row.data().email || "No email stored"),
        reason: String(row.data().welcomeEmailReviewReason || "Check the inbox before sending another copy."),
      })));
      setError("");
    }, (err) => {
      setError(err.code === "permission-denied"
        ? "Welcome messages could not be loaded. This is not an empty list."
        : "Welcome messages could not be loaded.");
    });
  }, []);

  const act = async (id: string, action: "arrived" | "send_once") => {
    setNotice("");
    setError("");
    try {
      const call = httpsCallable(functions, "reviewWelcomeEmail");
      await call({ customerId: id, action });
      setNotice(action === "arrived" ? "Marked as arrived. No further copy was sent." : "One copy was sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The review could not be saved.");
    }
  };

  if (!rows.length && !error) return null;

  return (
    <section className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900">Welcome messages needing review</h3>
      {error ? <p className="bg-red-50 border border-red-200 text-red-800 p-3 rounded mt-2" role="alert">{error}</p> : null}
      <p className="text-sm text-gray-700 mt-1">A previous send is ambiguous. Check the inbox. Do not send another copy until you know it did not arrive.</p>
      {rows.map((row) => (
        <div key={row.id} className="mt-3">
          <p className="text-sm text-gray-800">{row.email}. {row.reason}</p>
          <div className="flex gap-2 mt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void act(row.id, "arrived")}>It arrived</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void act(row.id, "send_once")}>It did not arrive. Send one copy.</button>
          </div>
        </div>
      ))}
      {notice ? <p className="text-sm text-green-800 mt-2">{notice}</p> : null}
    </section>
  );
}
