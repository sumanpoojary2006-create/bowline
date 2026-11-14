import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PageLoader from '../components/PageLoader';
import SectionHeader from '../components/SectionHeader';
import api from '../lib/api';

const emptyForm = { question: '', answer: '' };

function AdminFaqsPage() {
  const [faqs, setFaqs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = 'Bowline Admin | Website FAQs';

    const fetchFaqs = async () => {
      try {
        const { data } = await api.get('/admin/faqs');
        setFaqs(data.faqs || []);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Unable to load FAQs');
      } finally {
        setLoading(false);
      }
    };

    fetchFaqs();
  }, []);

  const persistFaqs = async (nextFaqs, successMessage) => {
    setSaving(true);
    try {
      const { data } = await api.put('/admin/faqs', { faqs: nextFaqs });
      setFaqs(data.faqs || []);
      toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update FAQs');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const submitFaq = async (event) => {
    event.preventDefault();
    const question = form.question.trim();
    const answer = form.answer.trim();
    if (!question || !answer) return;

    const nextFaqs = editingId
      ? faqs.map((faq) => (faq.id === editingId ? { ...faq, question, answer } : faq))
      : [...faqs, { question, answer }];

    const saved = await persistFaqs(nextFaqs, editingId ? 'FAQ updated' : 'FAQ added');
    if (saved) resetForm();
  };

  const editFaq = (faq) => {
    setEditingId(faq.id);
    setForm({ question: faq.question, answer: faq.answer });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeFaq = async (faq) => {
    if (!window.confirm(`Remove “${faq.question}”?`)) return;
    const saved = await persistFaqs(
      faqs.filter((item) => item.id !== faq.id),
      'FAQ removed'
    );
    if (saved && editingId === faq.id) resetForm();
  };

  const moveFaq = (index, offset) => {
    const destination = index + offset;
    if (destination < 0 || destination >= faqs.length) return;
    const nextFaqs = [...faqs];
    [nextFaqs[index], nextFaqs[destination]] = [nextFaqs[destination], nextFaqs[index]];
    persistFaqs(nextFaqs, 'FAQ order updated');
  };

  if (loading) return <PageLoader label="Loading website FAQs..." />;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Website Content"
        title="Manage FAQs"
        description="Add, edit, remove, and arrange the questions shown in the FAQ section of the public website. Changes are published immediately."
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <form className="glass h-fit rounded-[2rem] p-6" onSubmit={submitFaq}>
          <h2 className="text-2xl font-semibold text-white">
            {editingId ? 'Edit FAQ' : 'Add an FAQ'}
          </h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="faq-question">Question</label>
              <input
                id="faq-question"
                className="input"
                required
                maxLength={240}
                placeholder="What would guests like to know?"
                value={form.question}
                onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="faq-answer">Answer</label>
              <textarea
                id="faq-answer"
                className="input min-h-44 resize-y"
                required
                maxLength={4000}
                placeholder="Write the answer shown on the website"
                value={form.answer}
                onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update FAQ' : 'Add FAQ'}
              </button>
              {editingId && (
                <button className="btn-secondary" type="button" onClick={resetForm} disabled={saving}>
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </form>

        <div className="glass rounded-[2rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-white">Published FAQs</h2>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
              {faqs.length} {faqs.length === 1 ? 'question' : 'questions'}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {faqs.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-slate-400">
                No FAQs are published. Add the first question using the form.
              </p>
            )}
            {faqs.map((faq, index) => (
              <article key={faq.id} className="rounded-[1.5rem] bg-slate-900/70 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-200/70">
                      Question {index + 1}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{faq.question}</h3>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">{faq.answer}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="rounded-full border border-white/15 px-3 py-2 text-sm text-slate-200 disabled:opacity-30"
                      aria-label={`Move ${faq.question} up`}
                      disabled={saving || index === 0}
                      onClick={() => moveFaq(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-white/15 px-3 py-2 text-sm text-slate-200 disabled:opacity-30"
                      aria-label={`Move ${faq.question} down`}
                      disabled={saving || index === faqs.length - 1}
                      onClick={() => moveFaq(index, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    className="rounded-full border border-lime-300/30 px-4 py-2 text-sm font-semibold text-lime-200"
                    disabled={saving}
                    onClick={() => editFaq(faq)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-rose-400/30 px-4 py-2 text-sm font-semibold text-rose-300"
                    disabled={saving}
                    onClick={() => removeFaq(faq)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminFaqsPage;

