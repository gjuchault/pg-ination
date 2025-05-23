import type { PaginateOptions } from "./paginate.ts";

export interface SortOptions extends Pick<PaginateOptions, "orderBy"> {}

export function toSorted<T>(
	items: readonly T[],
	orderBy?: SortOptions["orderBy"],
) {
	return items.toSorted((a, b) => {
		if (!(typeof a === "object" && a !== null && "cursor" in a)) {
			throw new Error("Expected items to be an array of objects with a cursor");
		}

		if (!(typeof b === "object" && b !== null && "cursor" in b)) {
			throw new Error("Expected items to be an array of objects with a cursor");
		}

		const aValue = a.cursor as number;
		const bValue = b.cursor as number;

		if (aValue === bValue) {
			return 0;
		}

		const comparison = aValue < bValue ? -1 : 1;
		return orderBy?.order === "asc" ? comparison : -comparison;
	});
}
