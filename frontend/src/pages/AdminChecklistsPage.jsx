import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';

function AdminChecklistsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/checklists');
      setSubmissions(data.submissions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Bowline Admin | Checklists';
    fetchSubmissions();
  }, []);

  const select = (submission) => {
    setSelected(submission);
    setNotes(submission.adminNotes || '');
    setScore(submission.totalScore);
  };

  const save = async (markReviewed) => {
    if (!selected) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/checklists/${selected._id}`, {
        totalScore: Number(score),
        adminNotes: notes,
        adminReviewed: markReviewed,
      });
      toast.success('Checklist updated');
      setSelected(data.submission);
      setSubmissions((prev) => prev.map((item) => (item._id === data.submission._id ? data.submission : item)));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update checklist');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoader label="Loading checklists..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Staff Management"
        title="Checklist Submissions"
        description="Review end-of-shift checklists, leave notes, and adjust scores."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-semibold text-white">Submissions</h2>
          <div className="mt-5 space-y-3">
            {submissions.length === 0 ? (
              <p className="text-sm text-slate-400">No submissions yet.</p>
            ) : (
              submissions.map((submission) => (
                <button
                  key={submission._id}
                  className={`w-full rounded-[1.5rem] p-4 text-left transition ${
                    selected?._id === submission._id ? 'bg-lime-200 text-slate-950' : 'bg-slate-900/70 text-white'
                  }`}
                  onClick={() => select(submission)}
                >
                  <p className="text-lg font-semibold">{submission.employee?.name}</p>
                  <p
                    className={`mt-1 text-sm ${
                      selected?._id === submission._id ? 'text-slate-800' : 'text-slate-400'
                    }`}
                  >
                    {submission.attendance?.date} • {submission.type}
                  </p>
                  <p
                    className={`mt-2 text-sm ${
                      selected?._id === submission._id ? 'text-slate-800' : 'text-slate-300'
                    }`}
                  >
                    Score: {submission.totalScore} / 100 {submission.adminReviewed ? '• Reviewed' : ''}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="glass rounded-[2rem] p-6">
          {!selected ? (
            <p className="text-sm text-slate-400">Select a submission to review.</p>
          ) : (
            <div>
              <h2 className="text-2xl font-semibold text-white">
                {selected.employee?.name} — {selected.attendance?.date}
              </h2>
              <div className="mt-5 max-h-[420px] space-y-2 overflow-y-auto pr-2">
                {selected.responses.map((response) => (
                  <div key={response.key} className="flex items-center justify-between rounded-xl bg-slate-900/60 px-4 py-2">
                    <span className="text-sm text-slate-200">{response.label}</span>
                    <span className="text-sm font-semibold text-lime-200">
                      {typeof response.value === 'boolean'
                        ? response.value
                          ? 'Yes'
                          : 'No'
                        : response.value === null || response.value === ''
                          ? '—'
                          : String(response.value)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="label">Score (0-100)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    value={score}
                    onChange={(event) => setScore(event.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Admin notes</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button className="btn-secondary" disabled={saving} onClick={() => save(false)}>
                    Save
                  </button>
                  <button className="btn-primary" disabled={saving} onClick={() => save(true)}>
                    Save & Mark Reviewed
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminChecklistsPage;
