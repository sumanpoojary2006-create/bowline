import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/formatters';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data.users);
      if (!selectedUser && data.users.length) {
        setSelectedUser(data.users[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Bowline Admin | Users';
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedUser?._id) return;
      const { data } = await api.get(`/admin/users/${selectedUser._id}/bookings`);
      setHistory(data.bookings);
    };

    fetchHistory();
  }, [selectedUser]);

  if (loading) {
    return <PageLoader label="Loading users..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="User Management"
        title="Customer records and booking history"
        description="Review user accounts, total bookings, and historical reservation value."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-semibold text-white">Users</h2>
          <div className="mt-5 space-y-4">
            {users.map((item) => (
              <button
                key={item._id}
                className={`w-full rounded-[1.5rem] p-4 text-left transition ${
                  selectedUser?._id === item._id ? 'bg-amber-300 text-slate-950' : 'bg-slate-900/70 text-white'
                }`}
                onClick={() => setSelectedUser(item)}
              >
                <p className="text-lg font-semibold">{item.name}</p>
                <p className={`mt-1 text-sm ${selectedUser?._id === item._id ? 'text-slate-800' : 'text-slate-400'}`}>{item.email}</p>
                <p className={`mt-3 text-sm ${selectedUser?._id === item._id ? 'text-slate-800' : 'text-slate-300'}`}>
                  {item.bookingSummary.totalBookings} bookings • {formatCurrency(item.bookingSummary.totalSpent)}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-semibold text-white">
            {selectedUser ? `${selectedUser.name}'s bookings` : 'Booking history'}
          </h2>
          <div className="mt-5 space-y-4">
            {history.map((booking) => (
              <div key={booking._id} className="rounded-[1.5rem] bg-slate-900/70 p-4">
                <p className="text-lg font-semibold text-white">{booking.listing?.name}</p>
                <p className="mt-2 text-sm text-slate-300">
                  {booking.bookingType} • {formatDate(booking.startDate)} • {formatCurrency(booking.totalPrice)}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {booking.status} / {booking.paymentStatus}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminUsersPage;
