function PrivacyPolicyPage() {
  return (
    <section className="section-shell py-16">
      <div className="mx-auto max-w-3xl glass rounded-[2rem] p-10 text-slate-300">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Legal</p>
        <h1 className="mt-4 font-display text-4xl text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: June 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <p>
            Bowline Nature Stay ("Bowline", "we", "us") respects your privacy. This page explains what
            information we collect when you book a stay or contact us, and how we use it.
          </p>

          <div>
            <h2 className="font-display text-xl text-white">Information we collect</h2>
            <p className="mt-2">
              When you make a booking or message us (including via WhatsApp, our website, or email), we
              collect your name, phone number, email address, and booking details such as dates, number
              of guests, and any preferences you share with us (for example dietary requirements).
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl text-white">How we use your information</h2>
            <p className="mt-2">
              We use this information solely to process and confirm your booking, communicate with you
              about your stay, handle payments, and provide customer support. We do not sell your
              personal information to third parties.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl text-white">WhatsApp messaging</h2>
            <p className="mt-2">
              If you message us on WhatsApp, we use the WhatsApp Business Platform to receive and respond
              to your messages, including to help you check availability and complete a booking. Message
              content related to your booking may be stored to provide ongoing support.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl text-white">Data storage and security</h2>
            <p className="mt-2">
              Your information is stored securely and is only accessible to Bowline staff who need it to
              fulfil your booking. We use trusted third-party providers (such as payment processors and
              cloud hosting) who are contractually required to protect your data.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl text-white">Your rights</h2>
            <p className="mt-2">
              You can ask us to access, correct, or delete your personal information at any time by
              contacting us at{' '}
              <a className="text-amber-300 underline" href="mailto:bowlinestays@gmail.com">
                bowlinestays@gmail.com
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl text-white">Contact us</h2>
            <p className="mt-2">
              If you have any questions about this privacy policy, reach out to us at{' '}
              <a className="text-amber-300 underline" href="mailto:bowlinestays@gmail.com">
                bowlinestays@gmail.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default PrivacyPolicyPage;
