import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import employeeApi from '../../lib/employeeApi';
import { useEmployeeAuth } from '../../context/EmployeeAuthContext';
import PageLoader from '../../components/PageLoader';

function EmployeeChecklistPage() {
  const navigate = useNavigate();
  const { refresh } = useEmployeeAuth();
  const [fields, setFields] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Bowline Staff | Checkout';

    const fetchTemplate = async () => {
      try {
        const { data } = await employeeApi.get('/employee/checklist-template');
        setFields(data.fields);
        const initial = {};
        data.fields.forEach((field) => {
          if (field.type === 'boolean') initial[field.key] = false;
          else if (field.type === 'status') initial[field.key] = 'good';
          else if (field.type === 'number') initial[field.key] = 0;
          else initial[field.key] = '';
        });
        setAnswers(initial);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Unable to load checklist');
        navigate('/employee/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [navigate]);

  const setAnswer = (key, value) => setAnswers((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await employeeApi.post('/employee/checkout', { answers });
      toast.success(`Checked out! Shift score: ${data.score} / 100`);
      await refresh();
      navigate('/employee/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to check out');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageLoader label="Loading checklist..." />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-[#08110a]/90 px-5 py-4 backdrop-blur">
        <button className="text-xs font-semibold text-slate-400" onClick={() => navigate('/employee/dashboard')}>
          ← Back
        </button>
        <h1 className="mt-2 font-display text-2xl text-white">End-of-shift checklist</h1>
        <p className="mt-1 text-xs text-slate-400">Quickly tap through each item, then submit to check out.</p>
      </header>

      <form className="flex-1 px-5 pb-28 pt-4" onSubmit={submit}>
        <div className="space-y-2">
          {fields.map((field) => (
            <div key={field.key} className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <span className="text-sm text-slate-100">{field.label}</span>

              {field.type === 'boolean' ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      answers[field.key] === true ? 'bg-lime-200 text-slate-950' : 'bg-white/5 text-slate-300'
                    }`}
                    onClick={() => setAnswer(field.key, true)}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      answers[field.key] === false ? 'bg-lime-200 text-slate-950' : 'bg-white/5 text-slate-300'
                    }`}
                    onClick={() => setAnswer(field.key, false)}
                  >
                    No
                  </button>
                </div>
              ) : field.type === 'status' ? (
                <div className="flex shrink-0 gap-2">
                  {['good', 'low', 'empty'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                        answers[field.key] === option ? 'bg-lime-200 text-slate-950' : 'bg-white/5 text-slate-300'
                      }`}
                      onClick={() => setAnswer(field.key, option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : field.type === 'number' ? (
                <input
                  className="input w-20 shrink-0 px-2 py-2 text-center"
                  type="number"
                  min="0"
                  value={answers[field.key]}
                  onChange={(event) => setAnswer(field.key, Number(event.target.value))}
                />
              ) : (
                <input
                  className="input w-32 shrink-0 px-3 py-2 text-sm"
                  type="text"
                  placeholder="Optional"
                  value={answers[field.key]}
                  onChange={(event) => setAnswer(field.key, event.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-white/5 bg-[#08110a]/95 px-5 py-4 backdrop-blur">
          <button className="btn-primary w-full" disabled={submitting} type="submit">
            {submitting ? 'Submitting...' : 'Submit & Check Out'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EmployeeChecklistPage;
