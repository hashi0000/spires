import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useLocation, useNavigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate("/", {
          replace: true,
          state: { from: `${location.pathname}${location.search}` },
        });
      } else {
        setUser(currentUser);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate, location.pathname, location.search]);

  if (loading) return <p>Loading...</p>;
  return user ? children : null;
}
