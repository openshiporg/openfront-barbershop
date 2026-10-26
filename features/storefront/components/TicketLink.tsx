'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

type TicketLinkProps = {
  href: string;
  title: string;
  sub?: React.ReactNode;
  /** The heavy numeral on the stub (a place in line, a date). */
  numeral: string;
  unit?: string;
  /** Black stock instead of the merchant's ticket colour. */
  sign?: boolean;
};

/** A primary action printed as a ticket: pressing it tears the ticket along its perforation. */
export function TicketLink({ href, title, sub, numeral, unit, sign = false }: TicketLinkProps) {
  const [torn, setTorn] = useState(false);
  return (
    <Link href={href} className={`sf-tix ${sign ? 'is-sign' : ''}`} data-torn={torn ? 'true' : undefined} onClick={() => setTorn(true)}>
      <span className="sf-tix-stub" aria-hidden="true">
        <span className={`sf-tix-numeral ${numeral.length > 3 ? 'is-word' : ''}`}>{numeral}</span>
        {unit ? <span className="sf-tix-unit">{unit}</span> : null}
      </span>
      <span className="sf-tix-body">
        <span className="sf-tix-title">{title}<ArrowRight aria-hidden="true" /></span>
        {sub ? <span className="sf-tix-sub">{sub}</span> : null}
      </span>
    </Link>
  );
}
