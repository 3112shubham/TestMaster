import { Navigate } from 'react-router-dom';
import { auth } from '../firebase';

export default function AuthRoute({ children }) {
  return auth.currentUser ? children : <Navigate to="/admin-login" />;
}