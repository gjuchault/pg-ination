import type { PaginateOptions } from "./paginate.ts";

interface SortOptions extends Pick<PaginateOptions<never, never>, "orderBy"> {}

export function toSorted<T>(items: T[], orderBy?: SortOptions["orderBy"]) {
	if (orderBy === undefined) {
		return toSorted(items, { column: "id", order: "desc" });
	}

	return items.toSorted((a, b) => {
		const aValue = a[orderBy.column as keyof T];
		const bValue = b[orderBy.column as keyof T];

		if (aValue === bValue) {
			return 0;
		}

		const comparison = aValue < bValue ? -1 : 1;
		return orderBy.order === "asc" ? comparison : -comparison;
	});
}
