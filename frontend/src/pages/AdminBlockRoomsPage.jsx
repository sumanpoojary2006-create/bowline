import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import SectionHeader from '../components/SectionHeader';
import PageLoader from '../components/PageLoader';

const emptyForm = { startDate: '', endDate: '', note: '' };

function AdminBlockRoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchRooms = async () => {
    try {
      const { data } = await api.get('/listings/admin/all');
      setRooms(data.listings.filter((listing) => listing.type === 'room' && listing.active));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load room inventory');
    }
  };

  const fetchBlocks = async () => {
    try {
      const { data } = await api.get('/bookings/admin/all', { params: { status: 'blocked' } });
      setBlocks((data.bookings || []).filter((b) => b.status === 'blocked'));
    } catch {
      setBlocks([]);
    }
  };

  useEffect(() => {
    document.title = 'Bowline Admin | Block Rooms';
    Promise.all([fetchRooms(), fetchBlocks()]).finally(() => setLoading(false));
  }, []);

  const allRoomIds = useMemo(() => rooms.map((room) => room._id), [rooms]);
  const fullHouseSelected = rooms.length > 0 && selectedRoomIds.length === rooms.length;

  const toggleRoom = (roomId) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const toggleFullHouse = () => setSelectedRoomIds(fullHouseSelected ? [] : allRoomIds);
  const clearRoomSelection = () => setSelectedRoomIds([]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submitBlock = async () => {
    if (!selectedRoomIds.length) {
      toast.error('Select at least one room');
      return;
    }
    if (!form.startDate || !form.endDate || !form.note.trim()) {
      toast.error('Fill in dates and a reason');
      return;
    }
    if (form.endDate <= form.startDate) {
      toast.error('"To" date must be after "From" date');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/bookings/admin/block', {
        listingIds: selectedRoomIds,
        startDate: form.startDate,
        endDate: form.endDate,
        blockNote: form.note,
      });
      toast.success(`Blocked ${selectedRoomIds.length} room${selectedRoomIds.length > 1 ? 's' : ''}`);
      setForm(emptyForm);
      clearRoomSelection();
      fetchBlocks();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to block rooms');
    } finally {
      setSubmitting(false);
    }
  };

  const removeBlock = async (id) => {
    try {
      await api.delete(`/bookings/admin/block/${id}`);
      toast.success('Block removed');
      fetchBlocks();
    } catch {
      toast.error('Failed to remove block');
    }
  };

  const roomNameById = useMemo(
    () => Object.fromEntries(rooms.map((room) => [room._id, room.name])),
    [rooms]
  );

  if (loading) {
    return <PageLoader label="Loading room inventory..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Inventory Management"
        title="Block rooms"
        description="Select every room that's affected, pick the date range and reason once, then block them all in a single action instead of repeating it room by room."
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="glass rounded-[2rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-semibold text-white">1. Select rooms</h3>
            <button type="button" className="btn-secondary" onClick={clearRoomSelection}>
              Clear
            </button>
          </div>

          <label
            className={`mt-4 flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              fullHouseSelected
                ? 'border-lime-400 bg-lime-400/10 text-lime-100'
                : 'border-white/10 text-slate-300 hover:border-white/30'
            }`}
          >
            <input
              type="checkbox"
              className="accent-lime-400"
              checked={fullHouseSelected}
              onChange={toggleFullHouse}
            />
            Full House — block every room
          </label>

          {rooms.length ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {rooms.map((room) => {
                const checked = selectedRoomIds.includes(room._id);
                return (
                  <label
                    key={room._id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                      checked
                        ? 'border-lime-400 bg-lime-400/10 text-lime-100'
                        : 'border-white/10 text-slate-300 hover:border-white/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-lime-400"
                      checked={checked}
                      onChange={() => toggleRoom(room._id)}
                    />
                    {room.name}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-lime-100/12 bg-[#0d1710]/70 px-4 py-3 text-sm text-[#c1cbbd]">
              No active rooms found.
            </p>
          )}

          <div className="mt-8 space-y-4 rounded-[1.5rem] border border-rose-400/20 bg-rose-950/20 p-4">
            <h3 className="text-xl font-semibold text-white">2. Dates &amp; reason</h3>
            <p className="text-xs text-[#b7c2b2]">Blocked dates are hidden from customers. Only visible to admin.</p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <label className="label">From</label>
                <input
                  type="date"
                  className="input"
                  value={form.startDate}
                  onChange={(e) => setField('startDate', e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="label">To</label>
                <input
                  type="date"
                  className="input"
                  min={form.startDate || undefined}
                  value={form.endDate}
                  onChange={(e) => setField('endDate', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Reason (admin only)</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Maintenance, Deep cleaning…"
                value={form.note}
                onChange={(e) => setField('note', e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn-secondary w-full border-rose-400/30 text-rose-300"
              onClick={submitBlock}
              disabled={submitting}
            >
              {submitting
                ? 'Blocking…'
                : `Block ${selectedRoomIds.length || ''} room${selectedRoomIds.length === 1 ? '' : 's'}`.trim()}
            </button>
          </div>
        </div>

        <div className="glass rounded-[2rem] p-6">
          <h3 className="text-xl font-semibold text-white">Active blocks</h3>
          <p className="mt-1 text-sm text-[#b7c2b2]">Across every room, most recent first.</p>

          {blocks.length ? (
            <div className="mt-4 space-y-2">
              {blocks.map((block) => (
                <div
                  key={block._id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-rose-400/15 bg-rose-950/30 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {block.listing?.name || roomNameById[block.listing?._id] || 'Room'}
                    </p>
                    <span className="font-semibold text-rose-300">{block.blockNote}</span>
                    <span className="ml-2 text-[#b7c2b2]">
                      {new Date(block.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {' → '}
                      {new Date(block.endDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBlock(block._id)}
                    className="shrink-0 text-rose-400 hover:text-rose-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-lime-100/12 bg-[#0d1710]/70 px-4 py-3 text-sm text-[#c1cbbd]">
              No active blocks right now.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminBlockRoomsPage;
