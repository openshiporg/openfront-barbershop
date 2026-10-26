import type { QueueSummary } from '../lib/data/queue';
import { SevenSeg } from './SevenSeg';

type NowServingBoardProps = {
  /** Live walk-in line; null when it could not be read (never guessed). */
  summary: QueueSummary | null;
  /** Barbers working right now, when known. */
  barbersOnNow?: number | null;
  headingId?: string;
  phone?: React.ReactNode;
};

/** The shop's "Now serving" board: who is waiting and how long, from the live queue. */
export function NowServingBoard({ summary, barbersOnNow = null, headingId = 'now-serving', phone = null }: NowServingBoardProps) {
  const open = Boolean(summary?.open);
  const waiting = summary && open ? summary.waiting : null;
  const wait = summary && open ? (summary.waiting ? summary.waitMinutes : 0) : null;
  // Closed with posted hours: the board spells the opening hour in lit segments instead of all ghosts.
  const opening = summary && !open && summary.opensAt ? /(\d{1,2}):\d{2}\s*([AP]M)/i.exec(summary.opensAt) : null;
  const spoken = !summary
    ? 'The walk-in line couldn’t be read right now.'
    : !open
      ? `Walk-ins closed.${summary.opensAt ? ` ${summary.opensAt}.` : ''}`
      : `${summary.waiting} ${summary.waiting === 1 ? 'person' : 'people'} waiting. ${summary.waiting ? `About ${summary.waitMinutes} minutes wait.` : 'No wait.'}`;

  return (
    <section className="sf-board-panel" aria-labelledby={headingId}>
      <div className="sf-board-plate">
        <h2 id={headingId}>Now serving</h2>
        <p>
          <span className={`sf-dot ${!summary ? '' : open ? 'is-live' : 'is-alert'}`} aria-hidden="true" />
          {!summary ? 'Line status unavailable' : open ? 'Walk-ins open' : 'Walk-ins closed'}
        </p>
      </div>
      <p className="sf-sr" role="status">{spoken}</p>
      {opening ? (
        <div className="sf-board-readouts">
          <div className="sf-readout">
            <SevenSeg value={opening[1]} digits={2} />
            <span className="sf-readout-label" aria-hidden="true"><strong>{summary!.opensAt}</strong></span>
          </div>
        </div>
      ) : (
      <div className="sf-board-readouts">
        <div className="sf-readout">
          <SevenSeg value={waiting == null ? '--' : String(waiting)} digits={2} dim={waiting == null} />
          <span className="sf-readout-label" aria-hidden="true">{waiting === 1 ? 'person waiting' : 'people waiting'}</span>
        </div>
        <div className="sf-readout">
          <SevenSeg value={wait == null ? '--' : String(wait)} digits={wait != null && wait >= 100 ? 3 : 2} dim={wait == null} />
          <span className="sf-readout-label" aria-hidden="true">{wait === 0 ? <strong>No wait</strong> : 'min estimated wait'}</span>
        </div>
      </div>
      )}
      <div className="sf-board-note">
        {!summary ? <span>The line couldn’t be read right now.{phone ? <> Call {phone}.</> : null}</span>
          : !open ? <span>{opening ? 'Book a time instead' : <><strong>{summary.opensAt || 'Closed now'}</strong> · book a time instead</>}</span>
          : (
            <>
              <span><strong>{summary.inChair}</strong> in the chair</span>
              {barbersOnNow ? <span><strong>{barbersOnNow}</strong> {barbersOnNow === 1 ? 'barber' : 'barbers'} on the floor</span> : null}
            </>
          )}
      </div>
    </section>
  );
}
