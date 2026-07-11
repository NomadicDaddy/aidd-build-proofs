import { Suspense } from 'react';

import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';

function PageFallback() {
	return (
		<div className="space-y-4 p-6">
			<Skeleton className="h-8 w-48" />
			<Skeleton className="h-4 w-96" />
			<Skeleton className="h-64 w-full" />
		</div>
	);
}

function LazyPage({ Component }: { Component: React.LazyExoticComponent<React.ComponentType> }) {
	return (
		<ErrorBoundary>
			<Suspense fallback={<PageFallback />}>
				<Component />
			</Suspense>
		</ErrorBoundary>
	);
}

export { LazyPage };
