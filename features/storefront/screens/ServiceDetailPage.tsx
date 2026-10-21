import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StorefrontShell } from './StorefrontShell';
import { getAllServices } from '../lib/data/services';
import { StorefrontImage } from '../components/StorefrontImage';
import { formatMoney, formatDuration } from '../lib/format';

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = (await getAllServices()).find(item => item.id === id);
  if (!service) notFound();
  return <StorefrontShell><main id="main-content" className="sf-container py-10">
    <Link href="/services" className="sf-text-link mb-6 inline-flex min-h-11 items-center">All services</Link>
    <div className="grid gap-8 md:grid-cols-2"><StorefrontImage src={service.imagePath} fallbackSrc="/images/barbershop/photo/scissor-cut.webp" alt={service.name} className="aspect-[4/3]" sizes="(max-width: 640px) 100vw, 50vw" />
      <div className="space-y-6"><h1 className="sf-display text-4xl">{service.name}</h1><p>{service.description}</p><dl className="flex gap-8"><div><dt>Duration</dt><dd>{formatDuration(service.durationMinutes)}</dd></div><div><dt>Price</dt><dd>{formatMoney(service.price)}</dd></div></dl>
        {service.depositRequired ? <p role="status">Online booking unavailable for deposit-required services.</p> : <Link href={`/book?service=${encodeURIComponent(service.id)}`} className="sf-btn sf-btn-primary">Choose a time</Link>}
        <div><h2 className="font-semibold">Barbers</h2><ul className="mt-3 space-y-2">{service.specialists?.map(barber => <li key={barber.id}><Link className="sf-text-link inline-flex min-h-11 items-center" href={`/book?service=${encodeURIComponent(service.id)}&barber=${encodeURIComponent(barber.id)}`}>{barber.displayName} ↗</Link></li>)}</ul></div>
      </div>
    </div>
  </main></StorefrontShell>;
}
