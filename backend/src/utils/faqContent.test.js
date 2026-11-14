import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FAQS, sanitizeFaqs } from './faqContent.js';

test('default FAQs contain stable ids and complete content', () => {
  assert.ok(DEFAULT_FAQS.length > 0);
  assert.equal(new Set(DEFAULT_FAQS.map((faq) => faq.id)).size, DEFAULT_FAQS.length);
  assert.ok(DEFAULT_FAQS.every((faq) => faq.question && faq.answer));
});

test('FAQ content is trimmed and duplicate ids are replaced', () => {
  const faqs = sanitizeFaqs([
    { id: 'same', question: ' First question? ', answer: ' First answer. ' },
    { id: 'same', question: 'Second question?', answer: 'Second answer.' },
  ]);

  assert.deepEqual(faqs[0], {
    id: 'same',
    question: 'First question?',
    answer: 'First answer.',
  });
  assert.notEqual(faqs[1].id, 'same');
});

test('FAQ content requires a question and answer', () => {
  assert.throws(
    () => sanitizeFaqs([{ question: 'Question only', answer: '' }]),
    /needs both a question and an answer/
  );
});

