import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import employeeApi from '../../lib/employeeApi';
import { useEmployeeAuth } from '../../context/EmployeeAuthContext';
import SectionHeader from '../../components/SectionHeader';
import PageLoader from '../../components/PageLoader';

function EmployeeChecklistPage() {
  const navigate = useNavigate();
  const { refresh } = useEmployeeAuth();
  const [fields, setFields] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Bowline Staff | End of shift checklist';

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
    <section className="section-shell py-8 sm:py-12">
      <SectionHeader
        eyebrow="End of shift"
        title="Checkout Checklist"
        description="Fill out every item before checking out. This is mandatory."
      />

      <form className="glass space-y-4 rounded-[2rem] p-5 sm:p-8" onSubmit={submit}>
        {fields.map((field) => (
          <div key={field.key} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
            <label className="label">{field.label}</label>

            {field.type === 'boolean' ? (
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    answers[field.key] === true ? 'bg-lime-200 text-slate-950' : 'bg-slate-900/70 text-white'
                  }`}
                  onClick={() => setAnswer(field.key, true)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    answers[field.key] === false ? 'bg-lime-200 text-slate-950' : 'bg-slate-900/70 text-white'
                  }`}
                  onClick={() => setAnswer(field.key, false)}
                >
                  No
                </button>
              </div>
            ) : field.type === 'status' ? (
              <div className="mt-2 flex gap-3">
                {['good', 'low', 'empty'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
                      answers[field.key] === option ? 'bg-lime-200 text-slate-950' : 'bg-slate-900/70 text-white'
                    }`}
                    onClick={() => setAnswer(field.key, option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : field.type === 'number' ? (
              <input
                className="input mt-2"
                type="number"
                min="0"
                value={answers[field.key]}
                onChange={(event) => setAnswer(field.key, Number(event.target.value))}
              />
            ) : (
              <input
                className="input mt-2"
                type="text"
                placeholder="Optional"
                value={answers[field.key]}
                onChange={(event) => setAnswer(field.key, event.target.value)}
              />
            )}
          </div>
        ))}

        <button className="btn-primary w-full" disabled={submitting} type="submit">
          {submitting ? 'Submitting...' : 'Submit & Check Out'}
        </button>
      </form>
    </section>
  );
}

export default EmployeeChecklistPage;
