import { Link } from 'react-router-dom';

/**
 * Fallback page for unmatched routes. Registered as the catch-all `*` route so
 * unknown deep links show a friendly not-found message instead of a blank page.
 */
export function NotFoundPage() {
	return (
		<section className="space-y-3">
			<h1 className="text-2xl font-semibold">Page not found</h1>
			<p className="text-muted-foreground">
				The page you’re looking for doesn’t exist or may have moved.
			</p>
			<Link className="text-primary underline-offset-4 hover:underline" to="/">
				Go to dashboard
			</Link>
		</section>
	);
}
