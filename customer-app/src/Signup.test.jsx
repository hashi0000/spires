import React from 'react';
import {render,fireEvent,screen,waitFor} from '@testing-library/react';
import Signup from './Signup';
import {createUserWithEmailAndPassword,updateProfile} from 'firebase/auth';
import {setDoc,serverTimestamp} from 'firebase/firestore';
import {httpsCallable} from 'firebase/functions';
jest.mock('./firebase',()=>({auth:{},db:{},functions:{}}));
jest.mock('firebase/auth',()=>({createUserWithEmailAndPassword:jest.fn(),updateProfile:jest.fn()}));
jest.mock('firebase/firestore',()=>({doc:jest.fn(()=>({})),setDoc:jest.fn(),serverTimestamp:jest.fn(()=> 'server-time')}));
jest.mock('firebase/functions',()=>({httpsCallable:jest.fn()}));
jest.mock('./guestClaim',()=>({claimGuestBooking:jest.fn(),previewGuestClaim:jest.fn(),readableAuthError:e=>e.message}));
const mockNavigate=jest.fn();
jest.mock('react-router-dom',()=>({useNavigate:()=>mockNavigate,useLocation:()=>({state:null,search:''}),useSearchParams:()=>[new URLSearchParams()],Link:({children})=><span>{children}</span>}),{virtual:true});
function fill(container){
 for(const [field,value] of [['First Name','Fixture'],['Last Name','Customer'],['Email','fixture@example.test'],['Phone Number','07700900123'],['Password','test-password'],['Confirm Password','test-password']])fireEvent.change(screen.getByPlaceholderText(field),{target:{value}});
 fireEvent.change(container.querySelector('input[type="date"]'),{target:{value:'1990-01-01'}});
 fireEvent.click(screen.getByRole('button',{name:'Sign Up'}));
}
beforeEach(()=>{
 jest.clearAllMocks();
 createUserWithEmailAndPassword.mockResolvedValue({user:{uid:'fixture-uid'}});
 updateProfile.mockResolvedValue();setDoc.mockResolvedValue();
 serverTimestamp.mockReturnValue('server-time');
});
test.each([false,true])('account creation succeeds when attribution is %s and measurement never blocks signup',async(granted)=>{
 const attribution=granted?{consent:'granted',first:{utmSource:'fixture'}}:null;
 window.SpiresMeasurement={signup:jest.fn(),attribution:jest.fn().mockResolvedValue(attribution)};
 const record=jest.fn().mockRejectedValue(new Error('Measurement unavailable'));httpsCallable.mockReturnValue(record);
 const {container}=render(<Signup/>);
 fill(container);
 await waitFor(()=>expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
 expect(setDoc.mock.calls[0][1].createdAt).toBe('server-time');
 expect(window.SpiresMeasurement.signup).toHaveBeenCalledTimes(1);
 if(granted)expect(record).toHaveBeenCalledWith({marketingAttribution:attribution});else expect(record).not.toHaveBeenCalled();
});
