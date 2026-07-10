import { Link, useParams } from 'react-router-dom';

/**
 * Placeholder habit detail shell. The real month calendar and streak stats
 * arrive in the `habit-detail-history` feature; this confirms deep links like
 * `/habits/:id` resolve to a reachable page.
 */
export function HabitDetailPage() {
	const { habitId } = useParams<{ habitId: string }>();

	return (
		<section className="space-y-3">
			<h1 className="text-2xl font-semibold">Habit detail</h1>
			<p className="text-muted-foreground">
				History and streak stats for habit <span className="font-mono">{habitId}</span> will
				appear here.
			</p>
			<Link className="text-primary underline-offset-4 hover:underline" to="/habits">
				Back to habits
			</Link>
		</section>
	);
}
