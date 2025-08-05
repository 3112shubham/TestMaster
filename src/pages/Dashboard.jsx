import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition"
            >
              Logout
            </button>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Welcome to your dashboard!</h2>
            <p className="text-gray-600 mb-6">
              This is your personalized dashboard. You can add your content here.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-700 mb-2">Admin Features</h3>
                <p className="text-sm text-blue-600">
                  Manage users, view analytics, and configure settings.
                </p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-green-700 mb-2">User Information</h3>
                <p className="text-sm text-green-600">
                  View and edit your profile information.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}