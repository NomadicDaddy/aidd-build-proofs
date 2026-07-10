import { Bookmark, BookmarkPlus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSavedViews } from '@/hooks/assets/useSavedViews';

import { SAVED_VIEW_SEEDS } from './savedViewSeeds';

/** Max name length, mirrors the backend SAVED_VIEW_NAME_MAX_LENGTH bound. */
const NAME_MAX_LENGTH = 80;

interface SavedViewsBarProps {
	/** The active inventory filters (already reduced to persistable keys). */
	currentFilters: Record<string, string>;
	/** Apply a filter map to the inventory page, replacing all current filters. */
	onApply: (filters: Record<string, string>) => void;
}

/**
 * Saved-views control for the asset inventory page.
 *
 * Exposes a "Views" dropdown that loads either a built-in common-question preset
 * or one of the user's saved filter views (with inline delete), plus a "Save
 * view" action that persists the current filter selection under a name. Loading
 * a view re-applies its filters to the page URL; saving round-trips through the
 * `/saved-views` API scoped to the user and active workspace.
 */
export function SavedViewsBar({ currentFilters, onApply }: SavedViewsBarProps) {
	const { createMutation, deleteMutation, views } = useSavedViews();
	const [isSaveOpen, setIsSaveOpen] = useState(false);
	const [name, setName] = useState('');

	const hasActiveFilters = Object.keys(currentFilters).length > 0;
	const trimmedName = name.trim();

	function handleSave(e: React.FormEvent) {
		e.preventDefault();
		if (trimmedName.length === 0 || !hasActiveFilters) return;
		createMutation.mutate(
			{ filters: currentFilters, name: trimmedName },
			{
				onSuccess: () => {
					setIsSaveOpen(false);
					setName('');
				},
			}
		);
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="sm" variant="outline">
						<Bookmark aria-hidden="true" className="mr-2 size-4" />
						Views
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-72">
					<DropdownMenuLabel className="flex items-center gap-2">
						<Sparkles aria-hidden="true" className="size-3.5" />
						Common questions
					</DropdownMenuLabel>
					{SAVED_VIEW_SEEDS.map((seed) => (
						<DropdownMenuItem
							key={seed.id}
							onSelect={() => onApply(seed.filters)}
							title={seed.description}>
							<span className="flex flex-col">
								<span className="text-sm">{seed.name}</span>
								<span className="text-muted-foreground text-xs">
									{seed.description}
								</span>
							</span>
						</DropdownMenuItem>
					))}

					<DropdownMenuSeparator />
					<DropdownMenuLabel>My saved views</DropdownMenuLabel>
					{views.length === 0 ? (
						<DropdownMenuItem disabled>No saved views yet</DropdownMenuItem>
					) : (
						views.map((view) => (
							<DropdownMenuItem
								className="flex items-center justify-between gap-2"
								key={view.id}
								onSelect={() => onApply(view.filters)}>
								<span className="truncate text-sm">{view.name}</span>
								<button
									aria-label={`Delete view ${view.name}`}
									className="text-muted-foreground hover:text-destructive shrink-0"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										deleteMutation.mutate(view.id);
									}}
									type="button">
									<Trash2 aria-hidden="true" className="size-4" />
								</button>
							</DropdownMenuItem>
						))
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<Button
				disabled={!hasActiveFilters}
				onClick={() => setIsSaveOpen(true)}
				size="sm"
				title={
					hasActiveFilters
						? 'Save the current filters as a reusable view'
						: 'Apply at least one filter to save a view'
				}
				variant="outline">
				<BookmarkPlus aria-hidden="true" className="mr-2 size-4" />
				Save view
			</Button>

			<Dialog onOpenChange={setIsSaveOpen} open={isSaveOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Save current view</DialogTitle>
						<DialogDescription>
							Save the current inventory filters under a name so you can re-apply them
							later. Views are private to you in this workspace.
						</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" noValidate onSubmit={handleSave}>
						<div className="space-y-2">
							<Label htmlFor="saved-view-name">View name</Label>
							<Input
								autoComplete="off"
								autoFocus
								id="saved-view-name"
								maxLength={NAME_MAX_LENGTH}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g. Critical production servers"
								value={name}
							/>
						</div>
						<DialogFooter>
							<Button
								disabled={createMutation.isPending || trimmedName.length === 0}
								type="submit">
								{createMutation.isPending ? 'Saving…' : 'Save view'}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
