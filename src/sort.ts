import type { PaginateOptions } from "./paginate.ts";

export interface SortOptions extends Pick<PaginateOptions, "orderBy"> {}

export function toSorted<T extends { cursor: string | number }>(
	items: readonly T[],
	orderBy?: SortOptions["orderBy"],
) {
	return items.toSorted((a, b) => {
		let compareResult: number;

		if (orderBy?.column) {
			const cursorA = String(a.cursor);
			const cursorB = String(b.cursor);

			const [valueA, idA] = cursorA.split(",");
			const [valueB, idB] = cursorB.split(",");

			if (valueA === undefined || valueB === undefined) {
				throw new Error(
					"Expected items to be an array of objects with a cursor",
				);
			}

			const numA = Number(valueA);
			const numB = Number(valueB);

			if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
				compareResult = numA - numB;
			} else {
				compareResult = valueA.localeCompare(valueB);
			}

			if (compareResult === 0 && idA && idB) {
				compareResult = idA.localeCompare(idB);
			}
		} else {
			if (typeof a.cursor === "number" && typeof b.cursor === "number") {
				compareResult = a.cursor - b.cursor;
			} else {
				compareResult = String(a.cursor).localeCompare(String(b.cursor));
			}
		}

		return orderBy?.order === "asc" ? compareResult : -compareResult;
	});
}
