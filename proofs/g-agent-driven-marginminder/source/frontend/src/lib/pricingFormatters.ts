const currencyFormatter = new Intl.NumberFormat('en-US', {
	currency: 'USD',
	style: 'currency',
});

function formatCurrency(value: number): string {
	return currencyFormatter.format(value);
}

const percentFormatter = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 1,
	minimumFractionDigits: 1,
	style: 'percent',
});

function formatPercent(value: null | number, unavailableLabel = 'Unavailable'): string {
	if (value === null) return unavailableLabel;
	return percentFormatter.format(value / 100);
}

export { formatCurrency, formatPercent };
