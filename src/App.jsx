import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import CreateTest from './pages/CreateTest';
import TestForm from './components/TestForm';
import Navbar from './components/Navbar';
import ThankYou from './pages/ThankYou';
import TestViewPage from './pages/TestViewPage';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Router>
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-8">
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/" 
            element={user ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin-login" replace />} 
          />
          <Route path="/admin-login" element={user ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />} />
          <Route path="/test/:testId" element={<TestForm />} />
          
          {/* Protected Admin Routes */}
          <Route 
            path="/admin/dashboard" 
            element={user ? <AdminDashboard /> : <Navigate to="/admin-login" replace />}
          />
          <Route 
            path="/admin/create-test" 
            element={user ? <CreateTest /> : <Navigate to="/admin-login" replace />}
          />
          <Route 
            path="/admin/tests/:testId" 
            element={user ? <TestViewPage /> : <Navigate to="/admin-login" replace />}
          />
          
          <Route path="/thank-you" element={<ThankYou />} />
          
          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;