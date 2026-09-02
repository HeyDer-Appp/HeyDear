import React from 'react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

export default function ChildSafety() {
  return (
    <div className="min-h-screen bg-navy">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-32">
        <h1 className="font-serif text-5xl text-cream mb-8">Child Safety Standards</h1>
        <div className="prose prose-invert font-sans space-y-6 text-cream/70 leading-relaxed">
          <p>Last updated: September 2026</p>

          <h2 className="font-serif text-2xl text-cream mt-8">Our policy</h2>
          <p>
            HeyDer has zero tolerance for child sexual abuse and exploitation (CSAE) of any kind. HeyDer is an adults-only
            service — everyone must confirm they are 18 or older to create an account, and this is checked against the date
            of birth provided at signup. Any account found to involve a minor, or any content or behaviour involving the
            sexual abuse or exploitation of a minor, is removed immediately and permanently banned.
          </p>

          <h2 className="font-serif text-2xl text-cream mt-8">How to report a concern</h2>
          <p>You can report a safety concern about another user in two ways:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>In the app</strong> — open that person's profile or your conversation with them, and tap
              <strong> "Report"</strong>. This goes straight to our team.
            </li>
            <li>
              <strong>By email</strong> — write to{' '}
              <a href="mailto:info@heyder.nz" className="text-gold hover:text-yellow">info@heyder.nz</a> with as much
              detail as you can share.
            </li>
          </ul>

          <h2 className="font-serif text-2xl text-cream mt-8">What happens after a report</h2>
          <p>
            Every report is reviewed by a person on our team, not an automated system. Depending on what we find, we may
            warn, suspend, or permanently remove the reported account. Where a report involves child sexual abuse material
            or the exploitation of a minor, we also report it to the relevant law enforcement authorities, including the
            New Zealand Police and/or Department of Internal Affairs, and take immediate action against the account
            involved.
          </p>

          <h2 className="font-serif text-2xl text-cream mt-8">Designated contact</h2>
          <p>
            Our designated point of contact for child safety matters is{' '}
            <a href="mailto:info@heyder.nz" className="text-gold hover:text-yellow">info@heyder.nz</a>. This inbox is
            monitored and able to discuss HeyDer's child sexual abuse material (CSAM) prevention practices and compliance.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
