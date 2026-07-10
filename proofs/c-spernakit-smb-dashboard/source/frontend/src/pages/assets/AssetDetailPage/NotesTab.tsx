import { FileText, Lock } from 'lucide-react';

import type { Asset } from '@/api/assets';

import { NotYetTracked, SectionCard } from './primitives.tsx';

/** The Notes tab: operator notes, gated behind operator-level access. */
export function NotesTab({ asset, canSeeSensitive }: { asset: Asset; canSeeSensitive: boolean }) {
	if (!canSeeSensitive) {
		return (
			<NotYetTracked
				description="Operator notes are restricted to operator-level users and above. Your role does not have permission to view them."
				icon={Lock}
				title="Notes are restricted"
			/>
		);
	}

	if (asset.notes) {
		return (
			<SectionCard icon={FileText} title="Operator notes">
				<p className="text-sm whitespace-pre-wrap">{asset.notes}</p>
			</SectionCard>
		);
	}

	return (
		<NotYetTracked
			description="No operator notes have been recorded for this asset."
			icon={FileText}
			title="No notes yet"
		/>
	);
}
