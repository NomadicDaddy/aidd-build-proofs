import { FileUp } from 'lucide-react';
import { useRef, useState } from 'react';

import type { CreateImportInput } from '@/api/imports';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface NewImportDialogProps {
	isOpen: boolean;
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: CreateImportInput) => void;
}

const CSV_PLACEHOLDER =
	'name,assetType,hostname,primaryIp,role\nApp Server 01,virtual_machine,app01,10.0.0.10,app-tier';

/**
 * Modal for staging a new CSV asset import. The operator can paste CSV text
 * directly or load a `.csv` file into the editor, optionally label the source,
 * then submit to stage the rows for review. No records are created here — the
 * server parses, validates, and duplicate-checks every row into a review batch.
 */
function NewImportDialog({ isOpen, isPending, onOpenChange, onSubmit }: NewImportDialogProps) {
	const [csv, setCsv] = useState('');
	const [source, setSource] = useState('');
	const fileInputRef = useRef<HTMLInputElement>(null);

	function reset() {
		setCsv('');
		setSource('');
	}

	function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;
		if (!source) setSource(file.name);
		void file.text().then((text) => setCsv(text));
		// Allow re-selecting the same file later.
		event.target.value = '';
	}

	function handleSubmit() {
		const trimmed = csv.trim();
		if (trimmed.length === 0) return;
		onSubmit({ csv: trimmed, ...(source.trim() ? { source: source.trim() } : {}) });
	}

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) reset();
				onOpenChange(open);
			}}
			open={isOpen}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Import assets from CSV</DialogTitle>
					<DialogDescription>
						Paste CSV text or load a file. Every row is validated and checked for
						duplicates, then staged for your review — nothing is created until you apply
						it. The first row must be a header (e.g. name, assetType, hostname,
						primaryIp).
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label htmlFor="import-csv">CSV content</Label>
							<Button
								onClick={() => fileInputRef.current?.click()}
								size="sm"
								type="button"
								variant="outline">
								<FileUp aria-hidden="true" className="mr-2 size-4" />
								Load .csv file
							</Button>
							<input
								accept=".csv,text/csv"
								className="hidden"
								onChange={handleFile}
								ref={fileInputRef}
								type="file"
							/>
						</div>
						<Textarea
							className="min-h-48 font-mono text-xs"
							id="import-csv"
							onChange={(e) => setCsv(e.target.value)}
							placeholder={CSV_PLACEHOLDER}
							value={csv}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="import-source">Source label (optional)</Label>
						<Input
							id="import-source"
							maxLength={255}
							onChange={(e) => setSource(e.target.value)}
							placeholder="e.g. nmap-export.csv, vendor-inventory-2026"
							value={source}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						disabled={isPending}
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline">
						Cancel
					</Button>
					<Button disabled={isPending || csv.trim().length === 0} onClick={handleSubmit}>
						{isPending ? 'Staging…' : 'Stage for review'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export { NewImportDialog };
