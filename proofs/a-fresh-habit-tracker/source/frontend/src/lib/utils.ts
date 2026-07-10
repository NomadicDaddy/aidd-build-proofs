import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind CSS class names, resolving conflicts via `twMerge`. */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
