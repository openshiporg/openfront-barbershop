import { notFound } from 'next/navigation';

// Unmatched storefront URLs render the storefront 404 inside the shop's chrome.
export default function MissingPage() {
  notFound();
}
