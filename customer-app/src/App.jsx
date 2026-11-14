import React, {useEffect,useState} from "react";
import {onAuthStateChanged} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {auth,functions} from './firebase';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./Login";
import Signup from "./Signup";
import Dashboard from "./Dashboard";
import QuotePage from "./QuotePage";
import ClaimBooking from "./ClaimBooking";
import ProtectedRoute from "./components/ProtectedRoute";
import "./styles.css";

export default function App() {
  const [withdrawalPending,setWithdrawalPending]=useState(false);
  useEffect(()=>{
    let user=null,choice='',busy=false,syncedUid='',active=true;
    const sync=()=>{
      if(!user || choice!=='denied' || busy || syncedUid===user.uid)return;
      const uid=user.uid;
      busy=true;
      void httpsCallable(functions,'withdrawAccountMeasurement')({})
        .then(()=>{syncedUid=uid;if(active)setWithdrawalPending(false);})
        .catch(()=>{if(active)setWithdrawalPending(true);})
        .finally(()=>{busy=false;});
    };
    const stopAuth=onAuthStateChanged(auth,next=>{user=next;sync();});
    const stopConsent=window.SpiresMeasurement?.onConsentChange?.(value=>{if(choice!==value)syncedUid='';choice=value;sync();});
    window.addEventListener('online',sync);
    window.addEventListener('focus',sync);
    return ()=>{active=false;stopAuth();if(stopConsent)stopConsent();window.removeEventListener('online',sync);window.removeEventListener('focus',sync);};
  },[]);
  return (
    <BrowserRouter basename="/">
      {withdrawalPending?<p role="status">Measurement is off in this browser. Saved account preferences could not sync yet. We will retry when you return online.</p>:null}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/quote" element={<QuotePage />} />
        <Route path="/claim" element={<ClaimBooking />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
